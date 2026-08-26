import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRawAmount, type PositionSnapshot, type PositionsResponse } from "../shared/positions";
import { deriveBranchProgress } from "../shared/branch-progress";
import type { BranchPlan, LiveMarket } from "../shared/branch";
import { readBranchExecutions, rememberContinuation, type StoredBranchExecution } from "./branch-store";
import type { ExecutionReceipt, WalletSession } from "./wallet";

const explorer = "https://shannon-explorer.somnia.network/tx/";
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-5)}`;

const lifecycleCopy = {
  live: { label: "Live", title: "Capital is active", detail: "The market is still trading. Branch is watching for expiry and resolution." },
  settling: { label: "Settling", title: "Awaiting oracle result", detail: "Trading has ended. No later leg can open until the outcome is final." },
  claimable: { label: "Claimable", title: "Payout is ready", detail: "This outcome matched the settlement and can be redeemed to TestUSDC." },
  won: { label: "Won", title: "Awaiting finalization", detail: "The outcome matched, but settlement backing is not finalized for redemption yet." },
  lost: { label: "Stopped", title: "Branch stopped", detail: "The market resolved against this leg. Nothing is claimable and later legs stay closed." },
  voided: { label: "Voided", title: "Market voided", detail: "The market did not produce a directional result. Later legs stay closed." },
} as const;

function probability(raw: string, decimals: number) {
  const value = Number(formatRawAmount(raw, decimals, 6));
  return Number.isFinite(value) ? `${(value * 100).toFixed(value * 100 % 1 ? 1 : 0)}¢` : "—";
}

export function PositionsView({ wallet, onCompose }: { wallet: WalletSession; onCompose: () => void }) {
  const [data, setData] = useState<PositionsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimReceipt, setClaimReceipt] = useState<ExecutionReceipt | null>(null);
  const [executionVersion, setExecutionVersion] = useState(0);
  const [continuation, setContinuation] = useState<{ execution: StoredBranchExecution; index: number; market: LiveMarket } | null>(null);
  const [continuationAcknowledged, setContinuationAcknowledged] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [continuationReceipt, setContinuationReceipt] = useState<ExecutionReceipt | null>(null);
  const executions = useMemo(() => readBranchExecutions(wallet.address), [wallet.address, data, executionVersion]);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/positions?account=${encodeURIComponent(wallet.address)}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Position verification failed");
      setData(await response.json() as PositionsResponse);
    } catch {
      setError("Position reads are temporarily unavailable. Branch will not infer settlement from stale indexer data.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [wallet.address]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const claim = async (position: PositionSnapshot) => {
    setClaiming(`${position.marketId}:${position.outcomeIndex}`);
    setClaimReceipt(null);
    setError("");
    try {
      const { claimPosition } = await import("./wallet");
      setClaimReceipt(await claimPosition(wallet, position));
      await refresh(true);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "The claim was not confirmed.");
    } finally {
      setClaiming(null);
    }
  };

  const prepareContinuation = async (execution: StoredBranchExecution, index: number) => {
    setError("");
    setContinuationReceipt(null);
    try {
      const response = await fetch("/api/markets", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Fresh markets are unavailable.");
      const payload = await response.json() as { markets: LiveMarket[] };
      const used = new Set(execution.legs.map((leg) => leg.marketId.toLowerCase()));
      const market = payload.markets.find((candidate) =>
        candidate.asset === execution.asset
        && candidate.intervalSec === execution.intervalSec
        && !used.has(candidate.marketId.toLowerCase()),
      );
      if (!market) throw new Error("No new verified market generation matches this branch yet. Refresh after the next window opens.");
      setContinuation({ execution, index, market });
      setContinuationAcknowledged(false);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "The next leg could not be prepared.");
    }
  };

  const executeContinuation = async () => {
    if (!continuation || !continuationAcknowledged) return;
    setContinuing(true);
    setError("");
    try {
      const { execution, index, market } = continuation;
      const plan: BranchPlan = {
        asset: execution.asset,
        intervalSec: execution.intervalSec,
        budget: execution.allocation,
        maxEntryPrice: execution.maxEntryPrice,
        stopRule: "Stop on the first mismatched or voided outcome; never execute later legs.",
        legs: [{
          index,
          expected: execution.path[index],
          allocation: execution.allocation,
          condition: `Continue only after leg ${index} settled ${execution.path[index - 1]}`,
          binding: {
            kind: "market",
            marketId: market.marketId,
            expiry: market.expiry,
            venueId: market.venueId,
            poolAddress: market.poolAddress,
          },
        }],
      };
      const { executeBoundLeg } = await import("./wallet");
      const confirmed = await executeBoundLeg(plan, wallet);
      if (!confirmed.fills) throw new Error("The IOC closed without a fill, so this leg remains ready to retry.");
      rememberContinuation(execution, { index, marketId: market.marketId, txHash: confirmed.hash, expiry: market.expiry });
      setExecutionVersion((value) => value + 1);
      setContinuationReceipt(confirmed);
      setContinuation(null);
      setContinuationAcknowledged(false);
      await refresh(true);
    } catch (continuationError) {
      setError(continuationError instanceof Error ? continuationError.message : "The continuation order was not confirmed.");
    } finally {
      setContinuing(false);
    }
  };

  const liveCapital = (data?.positions ?? [])
    .filter((position) => position.lifecycle === "live" || position.lifecycle === "settling")
    .reduce((sum, position) => sum + Number(formatRawAmount(position.costBasisRaw, position.quoteDecimals, 6)), 0);
  const claimableCount = (data?.positions ?? []).filter((position) => position.lifecycle === "claimable").length;
  const stoppedCount = (data?.positions ?? []).filter((position) => position.lifecycle === "lost" || position.lifecycle === "voided").length;

  return (
    <section className="positions-workspace" aria-live="polite">
      <div className="positions-heading">
        <div>
          <span>Wallet lifecycle</span>
          <h1>Your branches</h1>
          <p>Monitor every filled leg from execution through settlement and redemption.</p>
        </div>
        <button className="text-button" type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Verifying…" : "Refresh positions"}
        </button>
      </div>

      <div className="portfolio-strip">
        <div><span>Live cost basis</span><strong>{liveCapital.toFixed(2)}</strong><small>tUSDC</small></div>
        <div><span>Ready to claim</span><strong>{claimableCount}</strong><small>positions</small></div>
        <div><span>Stopped paths</span><strong>{stoppedCount}</strong><small>terminal</small></div>
        <div className="proof-cell"><span>Verification</span><strong><i aria-hidden="true" />On-chain checked</strong><small>{data ? new Date(data.fetchedAt).toLocaleTimeString() : "Waiting for read"}</small></div>
      </div>

      {error && <div className="alert error-alert positions-alert" role="alert">{error}</div>}
      {claimReceipt && (
        <div className="claim-confirmation" role="status">
          <span>Claim confirmed</span>
          <a href={`${explorer}${claimReceipt.hash}`} target="_blank" rel="noreferrer">View settlement transaction ↗</a>
        </div>
      )}
      {continuationReceipt && (
        <div className="claim-confirmation" role="status">
          <span>Next leg filled and monitoring started</span>
          <a href={`${explorer}${continuationReceipt.hash}`} target="_blank" rel="noreferrer">View continuation transaction ↗</a>
        </div>
      )}

      {data && executions.length > 0 && (
        <section className="continuation-section">
          <div className="activity-heading"><div><span>Conditional workflow</span><h2>Continuation queue</h2></div><p>Each next leg requires a fresh market check and wallet signature</p></div>
          <div className="continuation-list">
            {executions.map((execution) => {
              const progress = deriveBranchProgress(execution, data);
              const nextLegIndex = progress.nextLegIndex;
              return (
                <article className={`continuation-row ${progress.state}`} key={execution.legs[0].txHash}>
                  <div><span>{execution.asset} · {execution.intervalSec / 60}m</span><strong>Leg {execution.legs.length} of {execution.path.length}</strong></div>
                  <ol aria-label="Branch execution progress">
                    {execution.path.map((outcome, index) => <li className={index < execution.legs.length ? "executed" : index === progress.nextLegIndex ? "ready" : "locked"} key={`${outcome}-${index}`}><b>{index + 1}</b><span>{outcome}</span></li>)}
                  </ol>
                  <div className="continuation-state">
                    <span>{progress.state === "ready" ? `Leg ${Number(progress.nextLegIndex) + 1} unlocked` : progress.state}</span>
                    {progress.state === "ready" && nextLegIndex != null && <button type="button" onClick={() => void prepareContinuation(execution, nextLegIndex)}>Review next leg</button>}
                  </div>
                </article>
              );
            })}
          </div>
          {continuation && (
            <div className="continuation-review">
              <div><span>Freshly bound market</span><h3>Leg {continuation.index + 1}: {continuation.execution.path[continuation.index]}</h3><p>{continuation.execution.asset} · {continuation.execution.intervalSec / 60}m · expires {new Date(continuation.market.expiry * 1000).toLocaleString()}</p></div>
              <dl className="order-review">
                <div><dt>Action</dt><dd>IOC BUY {continuation.execution.path[continuation.index] === "UP" ? "YES" : "NO"}</dd></div>
                <div><dt>Max loss</dt><dd>{continuation.execution.allocation.toFixed(2)} tUSDC</dd></div>
                <div><dt>Limit</dt><dd>{Math.round(continuation.execution.maxEntryPrice * 100)}¢</dd></div>
              </dl>
              <label className="risk-check"><input type="checkbox" checked={continuationAcknowledged} onChange={(event) => setContinuationAcknowledged(event.target.checked)} /><span>I reviewed this new market generation, outcome, probability cap, and maximum testnet loss.</span></label>
              <div className="continuation-review-actions"><button type="button" className="secondary-button" onClick={() => setContinuation(null)} disabled={continuing}>Cancel</button><button type="button" className="execute-button" disabled={!continuationAcknowledged || continuing} onClick={() => void executeContinuation()}>{continuing ? "Waiting for confirmed receipt…" : `Sign and execute leg ${continuation.index + 1}`}</button></div>
            </div>
          )}
        </section>
      )}

      {loading && !data ? (
        <div className="positions-empty"><img src="/branch-glyph.svg" alt="" /><p>Reading outcome balances and checking each market on-chain…</p></div>
      ) : data?.positions.length ? (
        <div className="position-list">
          {data.positions.map((position) => {
            const meta = lifecycleCopy[position.lifecycle];
            const execution = executions.find((item) => item.legs.some((leg) => leg.marketId === position.marketId.toLowerCase()));
            const pnl = formatRawAmount(position.unrealizedPnlRaw, position.quoteDecimals, 2);
            const claimKey = `${position.marketId}:${position.outcomeIndex}`;
            return (
              <article className={`position-card ${position.lifecycle}`} key={claimKey}>
                <div className="position-main">
                  <div className="position-identity">
                    <span className={`position-status ${position.lifecycle}`}>{meta.label}</span>
                    <p>{position.asset} · {position.interval ?? "Event"}</p>
                    <h2>{position.outcome} position</h2>
                    <code>{short(position.marketId)}</code>
                  </div>
                  <div className="position-thesis">
                    <span>Settlement state</span>
                    <h3>{meta.title}</h3>
                    <p>{meta.detail}</p>
                    {position.winningOutcome && <small>Resolved outcome <b>{position.winningOutcome}</b></small>}
                  </div>
                </div>

                <div className="position-numbers">
                  <div><span>Tokens</span><strong>{formatRawAmount(position.balanceRaw, position.quoteDecimals, 2)}</strong><small>{position.outcome}</small></div>
                  <div><span>Average entry</span><strong>{probability(position.averageEntryRaw, position.quoteDecimals)}</strong><small>per token</small></div>
                  <div><span>Cost basis</span><strong>{formatRawAmount(position.costBasisRaw, position.quoteDecimals, 2)}</strong><small>tUSDC</small></div>
                  <div><span>Position P&amp;L</span><strong className={position.unrealizedPnlRaw.startsWith("-") ? "negative" : "positive"}>{pnl}</strong><small>tUSDC</small></div>
                </div>

                {execution && (
                  <div className="stored-path" aria-label="Saved branch path">
                    <div><span>Saved path</span><strong>{position.lifecycle === "lost" || position.lifecycle === "voided" ? "Stopped on this leg" : `${execution.legs.length} leg${execution.legs.length === 1 ? "" : "s"} executed`}</strong></div>
                    <ol>
                      {execution.path.map((outcome, index) => (
                        <li className={index === 0 ? position.lifecycle : "locked"} key={`${outcome}-${index}`}>
                          <b>{index + 1}</b><span>{outcome}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="position-actions">
                  <span>{new Date(position.expiry * 1000).toLocaleString()}</span>
                  <div>
                    {position.latestTradeHash && <a href={`${explorer}${position.latestTradeHash}`} target="_blank" rel="noreferrer">Execution ↗</a>}
                    {position.lifecycle === "claimable" && (
                      <button type="button" disabled={claiming != null} onClick={() => void claim(position)}>
                        {claiming === claimKey ? "Confirming claim…" : "Claim TestUSDC"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="positions-empty">
          <img src="/branch-glyph.svg" alt="" />
          <h2>No outcome balance found</h2>
          <p>A recent fill can take a few seconds to reach the indexer. Refresh here, or compose the first branch for this wallet.</p>
          <button className="primary-button" type="button" onClick={onCompose}>Compose a path</button>
        </div>
      )}

      {data?.activity.length ? (
        <section className="activity-section">
          <div className="activity-heading"><div><span>Receipt trail</span><h2>Recent fills</h2></div><p>Indexer history · transaction links are chain evidence</p></div>
          <div className="activity-table" role="table" aria-label="Recent fills">
            {data.activity.map((fill) => {
              const isNo = fill.side.includes("NO");
              const rawPrice = isNo ? (10n ** BigInt(fill.quoteDecimals) - BigInt(fill.priceRaw)).toString() : fill.priceRaw;
              return (
                <div className="activity-row" role="row" key={fill.id}>
                  <div role="cell"><span>{fill.asset} · {fill.interval ?? "Event"}</span><strong>{fill.side.replace("BUY_", "Bought ").replace("SELL_", "Sold ")}</strong></div>
                  <div role="cell"><span>Quantity</span><strong>{formatRawAmount(fill.quantityRaw, fill.quoteDecimals, 2)}</strong></div>
                  <div role="cell"><span>Fill</span><strong>{probability(rawPrice, fill.quoteDecimals)}</strong></div>
                  <div role="cell"><span>Time</span><strong>{new Date(fill.timestamp * 1000).toLocaleString()}</strong></div>
                  <a href={`${explorer}${fill.txHash}`} target="_blank" rel="noreferrer" aria-label="Open fill transaction">↗</a>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {data?.closed?.length ? (
        <section className="closed-section">
          <div className="activity-heading">
            <div><span>Position archive</span><h2>Closed positions</h2></div>
            <p>{data.closed.length} settled · retained after redemption</p>
          </div>
          <div className="closed-table" role="table" aria-label="Closed positions">
            {data.closed.map((position) => {
              const pnl = position.pnlRaw == null ? null : formatRawAmount(position.pnlRaw, position.quoteDecimals, 2);
              const claimLabel = position.claimState === "claimed"
                ? "Claimed"
                : position.claimState === "claimable"
                  ? "Ready to claim"
                  : position.claimState === "no-payout"
                    ? "No payout"
                    : "Payout unverified";
              return (
                <article className="closed-row" role="row" key={position.id}>
                  <div className="closed-result" role="cell">
                    <span className={`result-mark ${position.result}`}>{position.result}</span>
                    <div><strong>{position.asset} · {position.interval ?? "Event"}</strong><small>{position.outcome} thesis · resolved {position.winningOutcome ?? "void"}</small></div>
                  </div>
                  <div role="cell"><span>Entry</span><strong>{probability(position.averageEntryRaw, position.quoteDecimals)}</strong><small>{formatRawAmount(position.quantityRaw, position.quoteDecimals, 2)} tokens</small></div>
                  <div role="cell"><span>Cost</span><strong>{formatRawAmount(position.costBasisRaw, position.quoteDecimals, 2)}</strong><small>tUSDC</small></div>
                  <div role="cell"><span>Net result</span><strong className={position.pnlRaw?.startsWith("-") ? "negative" : position.pnlRaw ? "positive" : ""}>{pnl ?? "—"}</strong><small>{claimLabel}</small></div>
                  <div className="closed-proof" role="cell">
                    <a href={`${explorer}${position.executionTxHash}`} target="_blank" rel="noreferrer">Fill ↗</a>
                    {position.settlementTxHash && <a href={`${explorer}${position.settlementTxHash}`} target="_blank" rel="noreferrer">Claim ↗</a>}
                    <time dateTime={new Date(position.closedAt * 1000).toISOString()}>{new Date(position.closedAt * 1000).toLocaleDateString()}</time>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
