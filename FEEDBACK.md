# DreamDEX Event Contracts SDK and Documentation Feedback

Branch was built against `@somnia-chain/markets-sdk` `0.28.1` on Somnia Shannon testnet.

## What worked well

- One SDK covers binary-market discovery, books, execution, portfolio positions, fills, and redemption actions.
- `marketId`, pool, outcome token, tick, and lot concepts are typed clearly enough to build a guarded execution flow.
- Bigint-native price and quantity handling avoids float rounding at the contract boundary.
- Indexed history plus direct on-chain reads supports a useful evidence split: fast discovery from the indexer, authoritative lifecycle decisions from contracts.

## Friction encountered

### Indexed `Trading` is not sufficient execution evidence

Expired or rotated rows can remain labeled `Trading`. A safe client must additionally verify on-chain status, expiry headroom, and the exact market-to-pool generation immediately before signing.

Suggested documentation change: make this re-verification sequence a required production pattern, not an optional caution.

### Market identity needs stronger emphasis

Pool addresses are reused across successive Event Contracts. State keyed only by pool can silently attach fills or settlement to the wrong generation.

Suggested documentation change: repeat the rule “key lifecycle state by `marketId`, never pool address” in discovery, portfolio, and execution examples.

### Browser transport behavior should be configurable end to end

Some SDK reads create their own RPC/WebSocket path even when the trader is given a custom public client. This makes same-origin browser proxies, RPC redundancy, and controlled failure handling harder.

Suggested SDK change: allow every internal read used by execution to inherit the supplied transport/client, with no implicit direct network path.

### IOC failures need structured receipt evidence

Real transactions can be approved and submitted but revert with `ImmediateOrCancelNoFill()` because liquidity moves after preflight. Depending on the provider path, the caller may receive nested text or only selector `0xd48c4403`.

Suggested SDK change: return a structured transaction failure containing the transaction hash, decoded custom error, receipt status, and execution phase. Applications could then distinguish wallet rejection, approval success, liquidity race, and protocol rejection without parsing messages.

### Testnet collateral precision should be explicit

The live Shannon Event Contract collateral used by Branch has six decimals. Examples spanning spot, mainnet USDso, and testnet TestUSDC can otherwise encourage incorrect generalization.

Suggested documentation change: show the collateral address and decimals next to every environment-specific example and recommend reading decimals rather than hard-coding them.

## Requested reference flow

A complete Event Contract browser example would ideally show discovery, stale-row rejection, on-chain generation verification, side-specific depth, tick/lot alignment, allowance, IOC execution, decoded reverted receipts, position read-back, settlement verification, and redemption.
