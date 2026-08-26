# Branch Proof Matrix

Updated: 2026-08-26

| Requirement | Implementation | Required evidence | Status |
| --- | --- | --- | --- |
| DreamDEX integration | Discover binary markets, verify on-chain status and pool generation, bind each leg just in time, construct IOC orders through the official SDK, and keep signing inside an injected wallet | API read-back, market IDs, live-wallet transactions, settlement receipts | Verified on testnet: leg-one DOWN fill `0x2a45...8635` won and was redeemed in `0x9e30...fd9`; leg-two UP fill `0xe439...ca2c` used a different market generation and settled DOWN |
| Conditional path | Continue only after the prior market settles to the expected outcome | Unit tests plus two-window testnet run | Verified: matching leg one unlocked a wallet-approved leg two; the second fill settled against the expected UP outcome and Branch correctly stopped at leg two |
| Adverse state | Expired, non-trading, voided, or mismatched outcome terminates later legs | Rejection UI and testnet read-back | Verified for mismatch: the real NO/DOWN position settled YES/UP, renders `Branch stopped`, exposes no claim action, and keeps later legs closed; live void proof remains missing |
| User need | Express a multi-window thesis without manually watching, claiming, and reopening each contract | User conversations or sourced research | Missing |
| UX | Cinematic black/teal scenario map exposes the bound contract, future selectors, stop rule, verified/stale boundary, STT/TestUSDC funding sequence, explicit order review, actionable provider errors, position lifecycle, and durable closed-position history | Desktop/mobile clean-browser recording plus injected-wallet retry | Verified for the primary public workflow: real wallet fills, redemption, continuation, and hard stop are indexed; desktop/mobile read-only views passed responsive QA. A final captioned recording remains outstanding |
| Deployment | Public frontend and API serving the intended revision | Health check, revision endpoint, primary-flow browser check | Verified: `https://branch-somnia.up.railway.app` served the exact GitHub revision, both hashed assets, live market API, position archive, security headers, and guarded wallet entry flow |
| Source | Public Branch repository with setup and license | GitHub URL and commit | Verified: `https://github.com/nftkingiii/branch` is public with setup, evidence boundary, Railway config, milestone commits, and an MIT license |
| Submission | Working testnet prototype, repository, 2–3 minute demo, and SDK feedback | DoraHacks submission receipt | Partial: prototype, repository, submission draft, demo script/captions, and `FEEDBACK.md` are ready; final video URL and DoraHacks submission receipt are missing |

## Proof boundary

The current slice implements browser-wallet connection, receipt-gated IOC execution for every leg, persisted multi-leg references, on-chain-checked monitoring, guarded claims, and a durable archive reconstructed from fills plus indexed redemption actions. A real two-leg path is proven: leg one won, unlocked continuation, and was redeemed; leg two filled in a different market generation, lost, and terminated the branch.
