# Project State

Updated: `2026-08-26 11:20 WAT`  
Status: `public GitHub source and revision-verified Railway deployment are live`

## Goal

Choose and build a differentiated, production-ready testnet product whose core user action executes and settles through DreamDEX Event Contracts on Somnia.

## Current Truth

- Verified fact: the downloaded DoraHacks page requires a working testnet prototype and GitHub repository, with meaningful DreamDEX Event Contracts and API/SDK usage.
- Verified fact: judging weights are Technical Implementation 25%, Innovation 20%, UX 20%, Business and Ecosystem Impact 20%, and Presentation and Demo 15%.
- Verified fact: DreamDEX Event Contracts are binary Up/Down BTC and ETH markets using `@somnia-chain/markets-sdk` on Somnia Shannon testnet (chain ID 50312).
- Verified fact: positions must be claimed after settlement; market status, venue IDs, expiry, tick/lot sizing, and indexer lag are consequential integration constraints.
- Direct user report: event time-zone and presentation requirements are currently unknown; follow updates on DoraHacks rather than infer them.
- Direct user decision: Branch is the approved product direction.

## Decisions

- Keep all unconfirmed presentation and deadline-zone fields unknown in `HACK_EVENT_GATE.json` - user confirmed they are not currently known - 2026-08-24.
- Reject a generic price-prediction bot as the primary thesis - official starter kit already includes oracle-follow, maker, passive, laddering, and settlement bots - 2026-08-24.
- Select Branch: conditional multi-window paths that continue only after the prior Event Contract settles as predicted - DreamDEX's binary lifecycle is load-bearing - 2026-08-25.
- Keep the first slice read-only and non-custodial - no private key or wallet transaction until market verification and branch termination logic are proven - 2026-08-25.
- Replace the editorial cream system after direct user review with a cinematic black/teal interface, lightweight sans typography, generous negative space, and an original glass branch-core hero based on the supplied Genesys mood reference - 2026-08-25.
- Use self-hosted Instrument Sans for a precise neo-grotesque voice and an original three-way path mark for both the topbar identity and SVG favicon - 2026-08-25.
- Split Overview and Composer into accessible top-level product tabs; keep the full scenario, preview, funding, and execution workflow off the landing view - 2026-08-25.
- Require an injected-wallet connection before Composer can open, with the persistent connection control and connected-address state in the global header - 2026-08-25.
- Keep signing in an injected browser wallet and require an explicit first-leg risk acknowledgement; never accept or store a private key - 2026-08-25.
- Use IOC orders only for the first proof transaction, with price/quantity aligned to DreamDEX's on-chain tick and lot grid - 2026-08-25.
- Treat funding as a visible three-step testnet workflow: acquire STT gas, connect a burner wallet, then mint faucet TestUSDC inside Branch - 2026-08-25.

## Evidence and Verification

- Visually reviewed all eight pages of `C:\Users\HP\Downloads\somia.pdf`.
- Reviewed the official `somnia-chain/dreamdex-bot-kit` repository and its Event Contracts integration notes.
- Live Shannon RPC returned chain ID 50312 and the DreamDEX GraphQL endpoint responded successfully.
- A direct `listBinaryMarkets` read returned current BTC/ETH Event Contract rows across multiple cadences and also exposed stale rows still labeled `Trading` by the indexer.
- The Branch API returned 12 currently tradable markets after rejecting 38 expired indexer rows and checking the remaining candidates on-chain.
- Unit verification: 19 tests passed, including 3 first-leg liquidity preflight tests for empty books, over-cap quotes, and fillable aligned quotes.
- Production verification: TypeScript project build and Vite production bundle completed successfully (625 modules transformed).
- Browser verification: the live market load and branch preview flow worked with no console warnings/errors; the 390px mobile viewport has no document-level horizontal overflow while the path rail remains intentionally scrollable.
- Dependency verification: `npm audit --omit=dev` reported 0 vulnerabilities.
- Implemented wallet network switching, market-status and pool-generation rechecks, bounded IOC construction, tick/lot alignment, confirmed-receipt handling, and explorer linking.
- Clean-browser QA verified the disconnected-wallet error state and 390px layout with no console errors; that browser had no injected wallet, so it did not produce a signature or transaction.
- Visual audit tightened the path to its real leg count, made DOWN/UP nodes semantic red/blue, removed misleading dollar notation, separated execution into a full-width proof dock, and added explicit Shannon chain ID and faucet steps.
- Fresh browser QA verified the revised 1280px and 390px layouts, intentional mobile-only path scrolling, and zero console warnings/errors.
- Fresh browser QA verified the redesigned hero, composer, execution preview, and funding dock at 1280px; the document stayed within the viewport and emitted no console warnings/errors.
- The former generic wallet-rejection message was caused by treating plain EIP-1193 provider error objects as JavaScript `Error` instances. Provider codes 4001, -32002, and 4902 now produce distinct, actionable messages, including nested provider errors.
- The user's provider identified Shannon `0xc488` as unrecognized but did not use standard error code 4902. Branch now recognizes equivalent unknown-chain messages, calls `wallet_addEthereumChain`, and explicitly switches afterward instead of assuming that adding also selects the chain.
- Direct Shannon RPC verification returned the user's STT balance (`0x0`) with HTTP 200, while the wallet browser reported `Failed to fetch`; this isolates the failure to the browser-to-RPC transport rather than the chain or address.
- Browser read-only RPC traffic now uses same-origin `/api/rpc`. The server forwards only an explicit allowlist of required read/simulation methods to the fixed Shannon HTTPS endpoint, rejects signing and raw-transaction methods, caps payloads at 64 KiB, and times out upstream calls after 15 seconds.
- Live local proxy verification returned HTTP 200 for `eth_getBalance` and HTTP 403 for `eth_sendRawTransaction`; CSP remained present.
- Clean-browser wallet QA now reports that no injected provider exists and explains how to proceed. The user's actual wallet-provider rejection remains unknown until the revised UI is retried in that wallet context.
- The original generated hero asset is stored at `public/assets/branch-path-core.png`; it contains no third-party logo or copied interface text.
- Pixel QA confirmed all four scenario controls share the same `239px` top position and `50px` height at 1280px. All three execution outcome badges use centered grid alignment in `58x30px` boxes.
- Browser QA confirmed the locally served Instrument Sans font loaded, `/branch-mark.svg` was registered as the favicon, and the page retained no document-level horizontal overflow.
- The execution empty state now uses the line-only Branch glyph (`public/branch-glyph.svg`) at low contrast instead of the earlier generic CSS fork sketch.
- A user screenshot proved a 15-minute market could pass API verification and then cross the 15-second expiry safety boundary before Preview was clicked. Preview now performs a fresh `/api/markets` verification and binds the newest matching market at click time.
- Browser regression QA confirmed Preview advanced the verification timestamp from `09:34:46` to `09:35:01`, produced a `BTC 15m path`, and emitted no stale-market error.
- A wallet-browser execution attempt exposed `@somnia-chain/markets-sdk: rpc readContract markets failed`; source inspection confirmed `exchange.client.getMarketOnchain` creates an internal direct WebSocket transport even when the trader receives Branch's proxied `publicClient`.
- Pre-signing market generation and book-grid verification now runs through validated same-origin `/api/execution-guard`; wallet signing and transaction submission remain inside the injected wallet.
- Live execution-guard verification returned status `1`, the exact expected pool, expiry generation, tick `1000`, lot `1000`, and minimum quantity `1000` for a current BTC 15m market.
- A real first-leg attempt reached DreamDEX but reverted `ImmediateOrCancelNoFill()`. Live book evidence showed 3 UP ask levels and 0 DOWN ask levels for the selected BTC 15m pool; the chosen DOWN IOC therefore had nothing to consume and created no position.
- Execution guard responses now include a 12-level on-chain binary book. Branch uses the SDK's `quoteBinaryStakeOverBook` kernel to size only fillable liquidity, enforce the user's selected-outcome cap, and stop empty/over-cap orders before a wallet transaction.
- A residual quote-to-submit race is mapped from `ImmediateOrCancelNoFill()` to a clear no-position retry message rather than exposing the raw contract error.
- Clean-browser QA verified Overview is selected, Composer is disabled, the builder is absent, and Connect wallet is visible in the persistent header before connection. Clicking Compose without a provider kept Overview active and surfaced the actionable provider error.
- Responsive browser QA verified the header tabs and Connect wallet control at 390x844 with no document-level horizontal overflow. The clean QA browser has no injected provider, so the successful connect-then-open transition still requires retry in the user's wallet browser.
- Live Event Contract rows currently report 6-decimal TestUSDC collateral at `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E`; do not generalize that precision to DreamDEX mainnet assets.
- First real fill verified in transaction `0x99c2b571a41b5ad280af10d9ad1d893890a789c8e4535feb7185f95226c27752`: wallet `0x8aab...4c4` bought `115.83` NO/DOWN tokens in BTC 15m market `0x...95cb` at an effective `0.213` tUSDC each, spending `24.67179` tUSDC after the unused escrow refund.
- Receipt and SDK portfolio read-back agree: the IOC order filled completely, no resting order remained, and the wallet held `115.83` NO tokens before settlement.
- On-chain settlement read-back returned status `4`, `finalized: true`, `winningOutcome: 0` (YES/UP), and `isVoided: false`. The NO/DOWN position therefore lost, has zero mark/settlement value, exposes no claimable balance, and must terminate the conditional branch before leg 2.
- No deployed Branch contract exists; execution is wallet-signed against DreamDEX contracts and later-leg monitoring/continuation is not implemented yet.
- Added a wallet-gated top-level Positions workspace. A filled first leg now saves a schema-validated local branch reference and hands off to the monitor; the monitor refreshes every 15 seconds and separates live, settling, won, claimable, lost, and voided states.
- Added `/api/positions?account=` with checksum address validation, fixed 20-fill history, a 50-position RPC fan-out cap, a 20-second route timeout, no-store responses, stable `marketId` fill grouping, and on-chain lifecycle verification. Indexer fills derive cost basis; indexer lifecycle labels never determine settlement.
- Live API verification for wallet `0x8aab...4c4` returned the known BTC 15m DOWN position in 3.2 seconds with `115.83` tokens, `21.3c` average entry, `24.67179` tUSDC cost basis, `-24.67179` tUSDC PnL, lifecycle `lost`, winning outcome `UP`, and the exact fill transaction hash.
- Implemented claim execution with a fresh same-origin positions read, exact account/market/outcome/amount matching, Shannon chain check, explicit wallet signing, and confirmed receipt handling. It remains unproven because this wallet has no claimable winning position.
- Clean-browser visual QA used a local mock EIP-1193 provider only to expose the connected read-only screen; it did not sign or submit anything. The real API data rendered at 1280px and 390px with no console warnings/errors and no page-level horizontal overflow.
- Verification: production build completed with 629 modules transformed; 25 tests passed across 7 files using a single-worker fork pool; `npm audit --omit=dev` reported 0 vulnerabilities.
- The first reported Positions read failure was not an indexer outage: the server still running on port 8787 was the pre-Positions process from 2026-08-25. It returned the SPA `index.html` as `200 text/html` for `/api/positions`, and the new frontend correctly failed closed when JSON parsing failed. Restarting that exact Branch process loaded the current route; three consecutive reads returned `200 application/json` in 1.58-1.90 seconds.
- A second real fill is now indexed in transaction `0x57d52add4500c672f6fed394aa2d7532433ba2d00b6317b3e00acc71bb0cc9c2`: `57.361` BTC 15m NO/DOWN tokens at an effective `0.507` tUSDC each, cost basis `29.082027` tUSDC. On-chain verification reports finalized DOWN, so the position is claimable and currently shows `28.278973` tUSDC position PnL before settlement-fee effects.
- Clean-browser read-only QA after the server restart rendered both the new claimable DOWN position and the earlier stopped DOWN position with no console warnings/errors. The temporary mock provider exposed the connected UI only; no claim transaction was signed.
- The winning position was redeemed in transaction `0xad18870a5446c7f1eeb9d4a9015e08c27993fd0ed66d2626dd6210437b7cb965`. DreamDEX's indexed redemption record verifies `57.361` tUSDC paid out against a `29.082027` tUSDC cost basis, for realized PnL of `+28.278973` tUSDC.
- Added a compact Closed positions archive below Recent fills. It reconstructs settled theses from stable market IDs and fill history, verifies terminal outcomes on-chain, and joins redemption actions for exact payout, timestamp, and claim transaction. Claimed winners therefore remain visible after their outcome-token balance reaches zero; losing positions retain exact zero-payout PnL.
- Live `/api/positions` verification returned two closed records: the claimed BTC 15m DOWN winner with linked fill and claim transactions, and the BTC 15m DOWN loser with `-24.67179` tUSDC realized PnL and no payout.
- Browser QA rendered both archived rows at 1280px and 390x844. The mobile document and each history row stayed within the viewport. A temporary mock EIP-1193 provider exposed the connected read-only screen only; it was configured to reject signing and submitted no transaction.
- Verification: 27 tests passed across 7 files and the production build completed with 629 modules transformed. The existing wallet chunk-size warning remains non-blocking.
- Public source: `https://github.com/nftkingiii/branch` on `main`, created with separate application, Railway release, production-header, and toolchain-security milestone commits.
- Public deployment: `https://branch-production-045a.up.railway.app`. Railway is connected to `nftkingiii/branch` for GitHub autodeploys and gates releases with `/api/health`.
- Live release verification matched Railway deployment `5fc7125b-02d4-4b4a-93d6-782cc7ad0b1a` to source revision `e09eac137bdde6c8a6bc2c1a88615e860224b975`; homepage, both hashed assets, 12 verified markets, two closed-history rows, CSP, HSTS, and the RPC write deny rule all passed.
- Clean public-browser QA loaded the Overview and live Shannon status with no console warnings/errors. With no injected wallet, Compose stayed gated and displayed the expected actionable wallet message; no signing or transaction was attempted.
- Public-repository security remediation updated Vite to `7.3.6` and Vitest to `3.2.7`. Full `npm audit` returned zero vulnerabilities, and all 127 installed packages had verified registry signatures; 65 also had provenance attestations.

## Sources

- `C:\Users\HP\Downloads\somia.pdf` - accessed 2026-08-24 - event rules and rubric - downloaded page snapshot; deadline time zone and presentation logistics are absent.
- https://github.com/somnia-chain/dreamdex-bot-kit - accessed 2026-08-24 - official SDK examples, networks, and supported strategy context - repository warns that venue identifiers can change.
- https://github.com/somnia-chain/dreamdex-bot-kit/blob/main/docs/event-contracts.md - accessed 2026-08-24 - Event Contracts lifecycle and integration hazards - protocol state remains time-sensitive.
- https://kalshi.com/pro/help - accessed 2026-08-25 - dense professional market-workspace patterns - inspiration only, not a product template.
- https://polymarket.com/ - accessed 2026-08-25 - consumer probability and outcome presentation - inspiration only, not copied.
- https://github.com/Instrument/instrument-sans - accessed 2026-08-25 - self-hosted variable webfont and SIL Open Font License - typography source only.

## Current Work

- Complete: read-only scenario composer, verified-market API, termination-state logic, reference-led responsive visual system, provider-error diagnostics, wallet review flow, STT/TestUSDC funding UX, disconnected-state QA, and on-chain-checked Positions lifecycle UI.
- Next: implement and prove the second wallet-approved leg after a winning first-leg settlement; choose a repository license and complete submission evidence.

## Resume Notes

- Read `PROJECT_STATE.md` and `HACK_EVENT_GATE.json` first.
- `Branch` is approved; keep repository, package, deployment, and submission naming aligned.
- Do not treat a dry run, indexer row, or transaction submission as successful execution; verify on-chain status and receipt.
- Never store or paste a private key in project files or chat.
