# CrediProof (Hedera) — Hackathon Starter

One command demo:
1) Anchors a hashed invoice JSON to **Hedera Consensus Service** (HCS).
2) Creates a **Hedera Token Service** (HTS) fungible token (2 decimals), mints and transfers it.
3) (Included) Settlement & **burn** step to reduce total supply.

## Quick start
cp .env.example .env         # paste your *Testnet* Account ID + Private Key
npm install
npm run demo

Then open https://hashscan.io/testnet and paste:
- Topic ID   (see message payload with `sha256`)
- Token ID   (see supply, transfers, burn)
- Account ID (see balances)

Safety: Keep .env secret; never commit keys.
