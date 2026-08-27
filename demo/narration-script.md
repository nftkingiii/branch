# Branch demo narration

## 00:00 - Identity

Branch. Trade the path, not one candle.

## 00:06 - Thesis

Prediction markets normally ask for one isolated call. Branch lets a trader express a sequence: continue only while each earlier market settles exactly as expected.

## 00:22 - Compose

The trader chooses Bitcoin or Ethereum, a market window, test collateral, a maximum entry probability, and an expected outcome for every leg. Only the first live contract is bound now. Later legs remain conditional.

## 00:43 - Safety boundary

Before a wallet prompt, Branch refreshes the market generation and verifies its on-chain status, expiry, price grid, lot size, and side-specific liquidity. The order is locally signed and submitted directly to DreamDEX on Somnia Shannon testnet.

## 01:02 - Settlement and stop

Positions are monitored through on-chain lifecycle reads. In this verified run, leg one predicted down, settled down, and was redeemed. That match unlocked a freshly bound second market. Leg two predicted up, but settled down, so Branch stopped the path instead of continuing.

## 01:27 - Persistent evidence

Recent fills preserve the exact execution history. Closed positions remain visible after redemption, with realized profit or loss and direct transaction evidence. Branch never infers settlement from a stale indexer label.

## 01:47 - Close

This is a real two-leg DreamDEX path: one matched settlement, one continuation, then a hard stop. Branch turns binary Event Contracts into a non-custodial conditional trading primitive.

