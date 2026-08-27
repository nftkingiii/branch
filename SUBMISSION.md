# Branch — DoraHacks Submission

## One-line summary

Branch turns separate DreamDEX Event Contracts into conditional trading paths: each new market is bound and signed only when the prior leg settles exactly as predicted.

## Description

Short-duration prediction markets force traders to repeatedly watch settlement, find the next contract, rebuild the order, and decide whether their broader thesis is still valid. Branch lets the trader compose that thesis once as a two-to-five-leg path.

The first leg binds to a currently tradable DreamDEX Event Contract. Later legs remain unsigned selectors. After every settlement, Branch verifies the result on-chain. A match unlocks a newly bound market and an explicit wallet review; a mismatch or void terminates the path. Nothing is auto-signed, and Branch never stores wallet credentials.

## Why it is different

Branch is not another binary-market frontend or prediction bot. Its product primitive is conditional continuation across rotating Event Contract generations. DreamDEX settlement is load-bearing: it controls whether the next user-approved action can exist.

## DreamDEX and Somnia integration

- `@somnia-chain/markets-sdk` market discovery, binary books, bounded IOC execution, portfolio reads, fills, and redemption history.
- Fresh on-chain market status, pool-generation, expiry, tick, lot, and side-specific liquidity verification before every signature.
- Injected-wallet signing on Somnia Shannon testnet, chain ID `50312`.
- Same-origin, read-only RPC proxy with an explicit method allowlist; signing remains inside the wallet.
- Stable `marketId` tracking across rotating contracts and indexer-lag safeguards.

## Verified two-leg proof

1. Leg one — BTC 15m DOWN, market `0x...a11d`
   - Fill: `0x2a454a837ceff6266df5e9dce82ddef97e8c59be52a6d8bff69b3211b8558635`
   - Settled DOWN and redeemed: `0x9e30adc3d2a966ab1c49d071aba176ab61cd8cbaf6b80f76723789de32417fd9`
   - Realized P&L: `+16.661233` tUSDC
2. Leg two — BTC 15m UP, newly bound market `0x...a143`
   - Fill: `0xe439f1b241bfbbb21dcd94d098003e733c25ba977245c185a2a7d8d3c495ca2c`
   - Settled DOWN; Branch stopped at leg two
   - Realized P&L: `-18.02331` tUSDC

Net path result: `-1.362077` tUSDC before gas. The loss is useful proof: Branch continued after a verified match and then enforced its hard-stop rule after a verified mismatch.

## Links

- Live application: https://branch-somnia.up.railway.app
- Source: https://github.com/nftkingiii/branch
- Demo video: https://youtu.be/bVF__RJWFJ0
- Network: Somnia Shannon testnet (`50312`)
- SDK feedback: `FEEDBACK.md`
- Detailed proof boundary: `PROOF_MATRIX.md`

## Current boundary

Branch is a non-custodial testnet prototype. It does not autonomously sign transactions, guarantee IOC liquidity, or claim production/mainnet readiness. Each continuation requires fresh verification, explicit risk acknowledgement, and a wallet signature.
