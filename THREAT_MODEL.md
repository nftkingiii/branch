# Branch Threat Model

Updated: 2026-08-26

## Assets

- A user's future testnet wallet authority and collateral.
- The integrity of the selected DreamDEX market, path conditions, and entry cap.
- Execution and settlement receipts used as proof.

## Trust boundaries

1. DreamDEX indexer data enters the Branch server and is untrusted until expiry and on-chain status are checked.
2. Somnia RPC responses are authoritative for the selected market generation but can be unavailable or stale at the transport layer.
3. Same-origin RPC proxy requests are untrusted input; the upstream URL is fixed and client-selected methods must never become an open relay.
4. Composer form values are untrusted until schema validation.
5. Future wallet and agent output must be treated as proposed actions, not authorization.
6. Wallet-address portfolio queries and indexed fill history are public but untrusted inputs; only on-chain market resolution can authorize a terminal state or claim.

## Initial abuse cases and controls

| Abuse case | Control in this slice | Remaining work |
| --- | --- | --- |
| Stale indexed row appears tradable | Reject expired rows and require on-chain status `Trading` | Re-check immediately before signing |
| Market pool is recycled between reads | Bind by `marketId`, not pool address | Carry one on-chain snapshot through transaction review |
| Invalid budget, price, or path enters planner | Zod schema bounds budget, probability, path length, asset, and cadence | Repeat validation server-side before writes |
| User is tricked into signing an unintended later leg | Later legs are selectors, not pre-signed transactions | Require explicit bounded session authority or per-leg confirmation |
| A mismatched or voided outcome still advances | Deterministic state returns `TERMINATE` | Prove with live settlement read-back |
| Pool recycles after plan preview | Re-read market status and require the pool's on-chain expiry generation to match the bound market before prompting | Preserve the confirmed receipt and re-read the resulting position |
| User signs an unintended order | Explicit first-leg review, risk acknowledgement, IOC-only order, bounded allocation and price cap | Add decoded wallet-call preview if the injected wallet does not provide one |
| Private key leaks through source or logs | Signing stays inside the injected browser wallet; no private-key field exists; `.env` and key files are ignored | Add scoped session authority only after per-leg wallet execution is proven |
| Public API is exhausted by repeated verification | No write or funded action is exposed | Add bounded cache, request timeout, and rate limit before deployment |
| RPC proxy is abused as an unrestricted relay | Fixed Shannon HTTPS upstream, strict JSON-RPC schema, 64 KiB body cap, 15-second timeout, and read/simulation method allowlist; signing and raw submission are rejected | Add per-origin rate limiting before public deployment |
| Crafted portfolio request causes unbounded RPC fan-out | Checksum address validation, 20-fill history, 50-position cap, 20-second response timeout, and no-store responses | Add per-origin rate limiting before public deployment |
| Stale indexer data exposes an invalid claim | Claim re-fetches the connected wallet's position, requires exact market/outcome/amount match, verifies finalized resolution on-chain, checks chain 50312, and still requires the wallet signature | Prove the redemption receipt and collateral read-back with a real winning position |
| Recycled pool fills corrupt position cost basis | Group fill history by stable `marketId`, never pool address | Continue treating live mark/PnL as advisory and settlement as authoritative |

## Non-goals of this slice

- Custody, autonomous signing, mainnet trading, or profit claims.
- Treating an indexer label or submitted transaction hash as successful execution.
