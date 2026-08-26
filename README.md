# Branch

Branch lets a trader express a conditional multi-window thesis across DreamDEX Event Contracts: the first leg executes now, while later legs remain locked unless each prior outcome settles as predicted.

The current prototype runs on Somnia Shannon testnet (chain ID `50312`). It uses `@somnia-chain/markets-sdk` for market discovery, Event Contract execution, portfolio reads, redemption, and indexed fill/claim history.

## What is implemented

- Fresh on-chain market and pool-generation verification before preview and execution.
- Side-specific DreamDEX order-book preflight and bounded Immediate-or-Cancel execution.
- Injected-wallet connection, Shannon network switching, STT/TestUSDC funding guidance, and explicit signing.
- Wallet-gated Positions workspace with live, settling, claimable, lost, and voided lifecycle states.
- Durable closed-position history reconstructed from stable market IDs, fills, on-chain settlement, and redemption records.
- Same-origin, allowlisted JSON-RPC proxy so browser wallet reads fail closed without exposing transaction submission.

Conditional second-leg execution is not implemented yet. Later legs are currently a persisted plan and monitoring state, not an autonomous on-chain executor.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm ci
npm run dev
```

The development server is available at `http://127.0.0.1:8787`.

## Verification

```bash
npm test
npm run build
npm audit --omit=dev
```

## Deployment

The repository includes `railway.json`. Railway builds the Vite client, starts the Node server, and checks `/api/health` before marking a deployment healthy.

Required Railway variables:

- `HOST=0.0.0.0`
- `APP_REVISION=<git commit SHA>` for manual uploads; GitHub deployments use Railway's source revision automatically.

No private key, seed phrase, or wallet credential belongs in this repository or its deployment environment. Wallet signatures remain inside the user's injected wallet.

## Evidence boundary

Two real first-leg fills, one losing settlement, and one winning redemption have been verified on Somnia Shannon and are documented in `PROJECT_STATE.md` and `PROOF_MATRIX.md`. A public deployment does not change the prototype's testnet status.
