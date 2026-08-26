import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createBranchPlan, type BranchPlan, type LiveMarket, type Outcome } from "../shared/branch";
import type { ExecutionReceipt, FundingStatus, WalletSession } from "./wallet";
import { PositionsView } from "./PositionsView";
import { rememberBranchExecution } from "./branch-store";

interface MarketResponse {
  chainId: number;
  source: string;
  fetchedAt: string;
  markets: LiveMarket[];
  excluded: { expired: number; unverified: number; notTradingOnchain: number };
}

const cadenceLabel = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  return `${seconds / 3600}h`;
};

const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-5)}`;

function DirectionToggle({ value, onChange, index }: { value: Outcome; onChange: (value: Outcome) => void; index: number }) {
  return (
    <fieldset className="direction-field">
      <legend>Leg {index + 1} outcome</legend>
      <div className="segmented">
        {(["UP", "DOWN"] as Outcome[]).map((direction) => (
          <button
            className={`segment ${direction.toLowerCase()}${value === direction ? " active" : ""}`}
            type="button"
            aria-pressed={value === direction}
            onClick={() => onChange(direction)}
            key={direction}
          >
            <span aria-hidden="true">{direction === "UP" ? "↗" : "↘"}</span>
            {direction}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "composer" | "positions">("overview");
  const [marketData, setMarketData] = useState<MarketResponse | null>(null);
  const [marketError, setMarketError] = useState("");
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<"BTC" | "ETH">("BTC");
  const [intervalSec, setIntervalSec] = useState(900);
  const [budget, setBudget] = useState(90);
  const [maxEntryPrice, setMaxEntryPrice] = useState(0.72);
  const [path, setPath] = useState<Outcome[]>(["DOWN", "UP", "UP"]);
  const [plan, setPlan] = useState<BranchPlan | null>(null);
  const [planError, setPlanError] = useState("");
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [walletError, setWalletError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [funding, setFunding] = useState<FundingStatus | null>(null);
  const [fundingPending, setFundingPending] = useState(false);
  const [walletConnecting, setWalletConnecting] = useState(false);

  const fetchMarketData = async () => {
    const response = await fetch("/api/markets", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Market verification failed");
    return (await response.json()) as MarketResponse;
  };

  const loadMarkets = async () => {
    setLoading(true);
    setMarketError("");
    try {
      setMarketData(await fetchMarketData());
    } catch {
      setMarketError("Verified DreamDEX markets are unavailable. Branch will not create a plan from stale data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMarkets();
  }, []);

  const cadences = useMemo(
    () => [...new Set((marketData?.markets ?? []).filter((market) => market.asset === asset).map((market) => market.intervalSec))],
    [asset, marketData],
  );

  useEffect(() => {
    if (cadences.length > 0 && !cadences.includes(intervalSec)) setIntervalSec(cadences[0]);
  }, [cadences, intervalSec]);

  const firstLegFundingReady = Boolean(
    plan && funding?.hasGas && Number(funding.testUsdc) >= plan.legs[0].allocation,
  );

  const buildPlan = async () => {
    setPlanError("");
    setLoading(true);
    try {
      const freshData = await fetchMarketData();
      setMarketData(freshData);
      const freshMarket = freshData.markets.find(
        (market) => market.asset === asset && market.intervalSec === intervalSec,
      );
      if (!freshMarket) throw new Error("No freshly verified market matches this asset and cadence. Try another window.");
      setPlan(createBranchPlan({ asset, intervalSec, budget, maxEntryPrice, path }, freshMarket));
      setAcknowledged(false);
      setReceipt(null);
    } catch (error) {
      setPlan(null);
      setPlanError(error instanceof Error ? error.message : "The branch could not be created.");
    } finally {
      setLoading(false);
    }
  };

  const requestWallet = async (openComposer = false) => {
    setWalletError("");
    setWalletConnecting(true);
    try {
      const { connectWallet } = await import("./wallet");
      const session = await connectWallet();
      setWallet(session);
      const { getFundingStatus } = await import("./wallet");
      setFunding(await getFundingStatus(session));
      if (openComposer) setActiveTab("composer");
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection was rejected.");
    } finally {
      setWalletConnecting(false);
    }
  };

  const openComposer = () => {
    if (wallet) setActiveTab("composer");
    else void requestWallet(true);
  };

  const mintTestCollateral = async () => {
    if (!wallet) return;
    setFundingPending(true);
    setWalletError("");
    try {
      const { getFundingStatus, requestTestCollateral } = await import("./wallet");
      await requestTestCollateral(wallet);
      setFunding(await getFundingStatus(wallet));
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Test collateral was not minted.");
    } finally {
      setFundingPending(false);
    }
  };

  const placeFirstLeg = async () => {
    if (!plan || !wallet || !acknowledged) return;
    setExecuting(true);
    setWalletError("");
    setReceipt(null);
    try {
      const { executeFirstLeg } = await import("./wallet");
      const confirmed = await executeFirstLeg(plan, wallet);
      setReceipt(confirmed);
      if (confirmed.fills > 0) {
        rememberBranchExecution(wallet, plan, confirmed);
        setActiveTab("positions");
      }
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "The order was not confirmed.");
    } finally {
      setExecuting(false);
    }
  };

  const updatePath = (index: number, value: Outcome) => {
    setPath((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
    setPlan(null);
  };

  return (
    <main>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setActiveTab("overview")} aria-label="Branch overview">
          <img className="brand-mark" src="/branch-mark.svg" alt="" />
          Branch
        </button>
        <nav className="app-tabs" aria-label="Branch views" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</button>
          <button type="button" role="tab" aria-selected={activeTab === "composer"} disabled={!wallet} onClick={() => wallet && setActiveTab("composer")}>Composer</button>
          <button type="button" role="tab" aria-selected={activeTab === "positions"} disabled={!wallet} onClick={() => wallet && setActiveTab("positions")}>Positions</button>
        </nav>
        <div className="header-wallet">
          {wallet ? (
            <span className="wallet-chip"><i aria-hidden="true" />{short(wallet.address)}</span>
          ) : (
            <button className="header-wallet-button" type="button" disabled={walletConnecting} onClick={() => void requestWallet()}>
              {walletConnecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </header>

      {walletError && activeTab === "overview" && <div className="header-wallet-error alert error-alert" role="alert">{walletError}</div>}

      {activeTab === "overview" ? (
        <div className="tab-panel" role="tabpanel" aria-label="Overview">
      <section className="hero" id="overview">
        <div className="hero-copy">
          <h1>Trade the path,<br />not one candle.</h1>
          <p>Compose a conditional BTC or ETH thesis. Each DreamDEX contract activates only when the previous outcome resolves exactly as expected.</p>
          <button className="hero-link" type="button" disabled={walletConnecting} onClick={openComposer}>{walletConnecting ? "Connecting wallet…" : "Compose a path"} <span aria-hidden="true">↘</span></button>
        </div>
        <div className="hero-visual" aria-label="A luminous three-way conditional path">
          <img src="/assets/branch-path-core.png" alt="" />
          <div className="visual-note note-one"><b>01</b><span>Verified market</span></div>
          <div className="visual-note note-two"><b>03</b><span>Conditional legs</span></div>
          <p>One live contract.<br />Three possible continuations.</p>
        </div>
      </section>

      <div className="verification-strip">
        <div><span className={marketError ? "status-dot error" : "status-dot"} /><strong>{marketError ? "Market read blocked" : "Somnia Shannon testnet"}</strong><span className="network-chip">50312</span></div>
        <p>Wallet execution is locally signed · Every first leg is re-verified immediately before its prompt</p>
      </div>

        </div>
      ) : activeTab === "composer" ? (
        <div className="tab-panel composer-view" role="tabpanel" aria-label="Composer">

      <section className="workspace" id="branch-workspace">
        <div className="composer-panel">
          <div className="section-heading">
            <div>
              <h2>Build your branch</h2>
            </div>
            <button className="text-button" type="button" onClick={() => void loadMarkets()} disabled={loading}>
              {loading ? "Verifying…" : "Refresh markets"}
            </button>
          </div>

          {marketError && <div className="alert error-alert" role="alert">{marketError}</div>}

          <div className="form-grid">
            <label>
              <span className="field-label">Asset</span>
              <select value={asset} onChange={(event) => { setAsset(event.target.value as "BTC" | "ETH"); setPlan(null); }}>
                <option value="BTC">Bitcoin</option>
                <option value="ETH">Ethereum</option>
              </select>
            </label>
            <label>
              <span className="field-label">Window</span>
              <select value={intervalSec} onChange={(event) => { setIntervalSec(Number(event.target.value)); setPlan(null); }} disabled={!cadences.length}>
                {cadences.map((cadence) => <option value={cadence} key={cadence}>{cadenceLabel(cadence)}</option>)}
              </select>
            </label>
            <label>
              <span className="field-label">Total test collateral</span>
              <div className="input-affix"><span>tUSDC</span><input type="number" min="1" max="10000" value={budget} onChange={(event) => { setBudget(Number(event.target.value)); setPlan(null); }} /></div>
            </label>
            <label>
              <span className="field-label">Maximum entry probability</span>
              <div className="input-affix"><input type="number" min="1" max="99" step="1" value={Math.round(maxEntryPrice * 100)} onChange={(event) => { setMaxEntryPrice(Number(event.target.value) / 100); setPlan(null); }} /><span>¢</span></div>
            </label>
          </div>

          <div className="path-builder" style={{ "--path-count": path.length } as CSSProperties}>
            <div className="path-line" aria-hidden="true" />
            {path.map((outcome, index) => (
              <div className="path-step" key={index}>
                <div className={`step-node ${outcome.toLowerCase()}`}>{index + 1}</div>
                <DirectionToggle value={outcome} onChange={(value) => updatePath(index, value)} index={index} />
                <p>{index === 0 ? "Execute now" : `Only after leg ${index} matches`}</p>
              </div>
            ))}
          </div>

          <div className="composer-actions">
            <button className="secondary-button" type="button" onClick={() => path.length < 5 && setPath((current) => [...current, "UP"])} disabled={path.length >= 5}>Add leg</button>
            <button className="secondary-button" type="button" onClick={() => path.length > 2 && setPath((current) => current.slice(0, -1))} disabled={path.length <= 2}>Remove leg</button>
            <button className="primary-button" type="button" onClick={() => void buildPlan()} disabled={loading}>{loading ? "Verifying current market…" : plan ? "Update verified branch" : "Preview verified branch"}</button>
          </div>
          {planError && <div className="alert error-alert" role="alert">{planError}</div>}
        </div>

        <aside className="verification-panel" aria-live="polite">
          <div className="section-heading compact">
            <div>
              <span>Execution preview</span>
              <h2>{plan ? `${plan.asset} ${cadenceLabel(plan.intervalSec)} path` : "Awaiting a branch"}</h2>
            </div>
          </div>

          {!plan ? (
            <div className="empty-state">
              <img className="empty-branch" src="/branch-glyph.svg" alt="" />
              <p>Choose the outcomes you expect. Branch will bind the first live contract and leave later legs as just-in-time selectors.</p>
            </div>
          ) : (
            <>
              <div className="plan-metrics">
                <div><span>Collateral</span><strong>{plan.budget.toFixed(2)}</strong><small>tUSDC</small></div>
                <div><span>Per leg</span><strong>{plan.legs[0].allocation.toFixed(2)}</strong><small>tUSDC</small></div>
                <div><span>Max entry</span><strong>{Math.round(plan.maxEntryPrice * 100)}¢</strong></div>
              </div>
              <ol className="execution-list">
                {plan.legs.map((leg) => (
                  <li key={leg.index}>
                    <span className={`outcome-badge ${leg.expected.toLowerCase()}`}>{leg.expected}</span>
                    <div>
                      <strong>{leg.binding.kind === "market" ? "Bound to live market" : "Resolve after prior settlement"}</strong>
                      <span>{leg.condition}</span>
                      <code>{leg.binding.kind === "market" ? short(leg.binding.marketId) : `${leg.binding.asset} · ${cadenceLabel(leg.binding.intervalSec)}`}</code>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="stop-rule"><span>Hard stop</span><p>{plan.stopRule}</p></div>
            </>
          )}

          {marketData && (
            <div className="market-proof">
              <span>Latest verification</span>
              <p>{marketData.markets.length} tradable markets · {marketData.excluded.expired} stale rows rejected</p>
              <small>{new Date(marketData.fetchedAt).toLocaleString()}</small>
            </div>
          )}
        </aside>
      </section>

      {plan && wallet && (
        <section className="execution-dock" aria-live="polite">
          <div className="dock-intro">
            <span>Testnet proof step</span>
            <h2>Execute the first leg</h2>
            <p>Branch rechecks the exact market generation before opening a wallet prompt. Future legs remain unsigned until settlement matches your path.</p>
          </div>
          <div className="execution-gate">
            <div className="gate-title">
              <span>Wallet and funding</span>
              <strong>{wallet ? short(wallet.address) : "Wallet disconnected"}</strong>
            </div>
              <>
                <div className="funding-status">
                  <div><span>Gas</span><strong>{funding?.stt ?? "…"} STT</strong></div>
                  <div><span>Collateral</span><strong>{funding?.testUsdc ?? "…"} tUSDC</strong></div>
                </div>
                <div className="funding-actions">
                  <a className="faucet-link" href="https://testnet.somnia.network/" target="_blank" rel="noreferrer">Get test STT ↗</a>
                  <button className="collateral-button" type="button" disabled={fundingPending || !funding?.hasGas} onClick={() => void mintTestCollateral()}>{fundingPending ? "Confirming faucet receipt…" : "Mint 1,000 TestUSDC"}</button>
                </div>
                <dl className="order-review">
                  <div><dt>Action</dt><dd>IOC BUY {plan.legs[0].expected === "UP" ? "YES" : "NO"}</dd></div>
                  <div><dt>Max loss</dt><dd>{plan.legs[0].allocation.toFixed(2)} tUSDC</dd></div>
                  <div><dt>Limit</dt><dd>{Math.round(plan.maxEntryPrice * 100)}¢</dd></div>
                </dl>
                <label className="risk-check">
                  <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                  <span>I reviewed the exact market, outcome, cap and maximum testnet loss. The wallet may request a collateral approval before the order.</span>
                </label>
                <button className="execute-button" type="button" disabled={!acknowledged || executing || !firstLegFundingReady} onClick={() => void placeFirstLeg()}>
                  {executing ? "Waiting for confirmed receipt…" : firstLegFundingReady ? "Sign and execute first leg" : "Fund wallet to continue"}
                </button>
              </>
            {walletError && <div className="alert error-alert" role="alert">{walletError}</div>}
            {receipt && (
              <div className="receipt-card" role="status">
                <span>Confirmed on Somnia</span>
                <strong>{receipt.fills ? `${receipt.fills} fill${receipt.fills === 1 ? "" : "s"}` : "IOC closed without a fill"}</strong>
                <a href={`https://shannon-explorer.somnia.network/tx/${receipt.hash}`} target="_blank" rel="noreferrer">View transaction ↗</a>
              </div>
            )}
          </div>
        </section>
      )}
        </div>
      ) : wallet ? (
        <div className="tab-panel positions-view" role="tabpanel" aria-label="Positions">
          <PositionsView wallet={wallet} onCompose={() => setActiveTab("composer")} />
        </div>
      ) : null}
    </main>
  );
}
