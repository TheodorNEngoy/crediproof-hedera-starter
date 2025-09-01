# CrediProof — Tokenized Invoices on Hedera (HCS + HTS)

**Track:** On‑Chain Finance & RWA
**One‑liner:** Hash‑anchor a structured invoice to **HCS**, mint an **HTS** token, transfer it, then **settle & burn** — all verifiable on HashScan.

## Demo Proof (Testnet)
- **Topic:** 0.0.6747966 — https://hashscan.io/testnet/topic/0.0.6747966  (Messages tab shows JSON payload with `sha256`)
- **Token:** 0.0.6747967 — https://hashscan.io/testnet/token/0.0.6747967  (see Mint → Transfer → Burn and supply drop)
- **Buyer Account:** 0.0.6747968 — https://hashscan.io/testnet/account/0.0.6747968  (balances/tokens)

## How it works
1) Create HCS topic → submit message with SHA‑256 of invoice JSON (immutable timestamp).
2) Create HTS fungible token (2 decimals) → mint to treasury.
3) Associate buyer account → transfer tokens to buyer.
4) Settlement: transfer back to treasury → burn (reduces total supply).

## Run locally (Testnet)
cp .env.example .env   # paste your Testnet Account ID + Private Key
npm install
npm run demo

## Why it fits this track
- Receivables tokenization with a verifiable audit trail (HCS) and full lifecycle (mint → transfer → burn).
- Judges can independently verify everything on HashScan by pasting the IDs above.

## Next steps (post‑hackathon)
- DID/VC issuance for credentials, OCR → JSON extraction, automated settlement rails.
