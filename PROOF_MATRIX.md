# Branch Proof Matrix

Updated: 2026-08-26

| Requirement | Implementation | Required evidence | Status |
| --- | --- | --- | --- |
| DreamDEX integration | Discover binary markets, verify on-chain status and pool generation, bind first leg, construct an IOC order through the official SDK, and keep signing inside an injected wallet | API read-back, market ID, live-wallet transaction, settlement receipt | Partial: losing fill `0x99c2...7752`, winning fill `0x57d5...c9c2`, and winning redemption `0xad18...b965` are verified; automatic second-leg execution remains unproven |
| Conditional path | Continue only after the prior market settles to the expected outcome | Unit tests plus two-window testnet run | Partial: deterministic planner and persisted path monitor implemented; winning continuation transaction remains unproven |
| Adverse state | Expired, non-trading, voided, or mismatched outcome terminates later legs | Rejection UI and testnet read-back | Verified for mismatch: the real NO/DOWN position settled YES/UP, renders `Branch stopped`, exposes no claim action, and keeps later legs closed; live void proof remains missing |
| User need | Express a multi-window thesis without manually watching, claiming, and reopening each contract | User conversations or sourced research | Missing |
| UX | Cinematic black/teal scenario map exposes the bound contract, future selectors, stop rule, verified/stale boundary, STT/TestUSDC funding sequence, explicit order review, actionable provider errors, position lifecycle, and durable closed-position history | Desktop/mobile clean-browser recording plus injected-wallet retry | Partial: real winning/losing records and exact redemption evidence rendered locally at 1280px and 390px with no horizontal overflow; the visual QA provider was mocked and signing-disabled, while the fills and claim came from the user's real wallet; public deployment missing |
| Deployment | Public frontend and API serving the intended revision | Health check, revision endpoint, primary-flow browser check | Verified: `https://branch-production-045a.up.railway.app` served the exact GitHub revision, both hashed assets, live market API, position archive, security headers, and guarded wallet entry flow |
| Source | Public Branch repository with setup and license | GitHub URL and commit | Partial: `https://github.com/nftkingiii/branch` is public with setup, evidence boundary, Railway config, and milestone commits; an explicit project license is still missing |
| Submission | Working testnet prototype and repository | DoraHacks submission receipt | Missing |

## Proof boundary

The current slice implements browser-wallet connection, receipt-gated first-leg IOC execution, persisted branch references, on-chain-checked position monitoring, guarded claims, and a durable archive reconstructed from fills plus indexed redemption actions. A losing settlement and a winning redemption are proven through the user's real wallet flow. Conditional continuation is not yet proven.
