# Branch — 2:30 Demo Script

Record at 1280×720 or 1920×1080. Burn in `captions.srt` so the demo works muted.

## 0:00–0:18 — Thesis

Show Overview. “Prediction markets let you trade one event at a time. Branch lets you express a path: continue only while each prior outcome settles exactly as predicted.”

## 0:18–0:42 — Compose

Connect the burner wallet and show asset, window, collateral, probability cap, and outcomes. “Only the first contract is bound now.”

## 0:42–1:02 — Safety boundary

Show the market ID, stop rule, funding, and acknowledgement. Explain that Branch rechecks generation, on-chain status, expiry, order grid, and side-specific liquidity before prompting the wallet.

## 1:02–1:28 — Proven leg one

Open Positions and the first proof transaction. Show that BTC 15m DOWN won and was claimed. “Because settlement matched the path, Branch unlocked leg two.”

## 1:28–1:55 — Conditional continuation

Show Continuation queue, Review next leg, newly bound market, retained cap/allocation, and second approval. Use existing evidence rather than submitting another trade during recording.

## 1:55–2:18 — Adverse outcome

Show the leg-two UP fill and closed result: the market settled DOWN and stopped at leg two. Emphasize that Branch preserved the exact fill, settlement, and P&L instead of continuing.

## 2:18–2:30 — Close

Return to Overview with repository and live URL visible. “Branch turns DreamDEX’s binary settlement lifecycle into a non-custodial conditional trading primitive—trade the path, not one candle.”

## Recording checks

- Use the testnet burner wallet; never expose seed phrases, private keys, extension account lists, or unrelated balances.
- Pre-open the three explorer transactions in separate tabs.
- Do not submit a fresh trade during the final recording.
- Review the export muted and sample 0:10, 0:50, 1:35, and 2:10 for caption alignment.
