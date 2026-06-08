# StablePay

Universal stablecoin spending rail for India. Hold USDC/USDT/ETH/SOL/BTC; pay any UPI VPA, online checkout, biller, or AI agent — at ~1% all-in instead of the ~11% effective fee crypto cards levy.

## Status

`v0.0.1` — backend settlement engine. Mock off-ramp, in-memory rate book. No frontend yet.

## Architecture (this repo)

```
QR scan / Checkout / Agent / P2P / Bill
                │
                ▼
        Intent Gateway (HTTP)
                │
        ┌───────┴─────────┐
        ▼                 ▼
    /v1/quote        /v1/settle
        │                 │
        ▼                 ▼
  Routing Engine    On-chain debit (mock)
  (cheapest path     +  Off-ramp adapter
   across assets)         (mock / onmeta / cashfree)
        │                 │
        └────► Ledger ◄───┘
              (SQLite v0,
               Postgres v1)
        │
        ▼
   /v1/webhooks/offramp  ← PAYOUT_SUCCESS / PAYOUT_FAILED
```

Core flow: client posts a `/v1/quote`, gets a 30-second-locked route plan. Client signs, posts `/v1/settle`. Engine debits the chosen asset, calls the off-ramp partner to push UPI to the merchant, accrues 1% TDS, waits for the partner webhook to mark `SETTLED`.

## Quick start

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Then:

```bash
# Quote a Rs 500 Swiggy payment
curl -X POST http://localhost:3000/v1/quote \
  -H 'content-type: application/json' \
  -d '{
    "idempotency_key": "11111111-1111-1111-1111-111111111111",
    "user_id": "user_demo_1",
    "payee": { "type": "vpa", "identifier": "swiggy@hdfc", "display_name": "Swiggy" },
    "amount_inr": 500,
    "channel": "qr",
    "asset_preference": "auto_cheapest"
  }'

# Settle (use the quote_id from above)
curl -X POST http://localhost:3000/v1/settle \
  -H 'content-type: application/json' \
  -d '{
    "idempotency_key": "22222222-2222-2222-2222-222222222222",
    "quote_id": "<quote_id>",
    "auth_proof": "stub-passkey-assertion-xxxx"
  }'

# Simulate the off-ramp partner reporting success
curl -X POST http://localhost:3000/v1/webhooks/offramp \
  -H 'content-type: application/json' \
  -H 'x-signature: devsecret' \
  -d '{
    "event_id": "evt_1",
    "event_type": "PAYOUT_SUCCESS",
    "client_ref": "<quote_id>",
    "provider_ref": "mock_abc",
    "utr": "UTR123456"
  }'

# Inspect
curl http://localhost:3000/v1/users/user_demo_1/transactions
```

## Tests

```bash
npm test
```

## Roadmap

- **v0.0.x** (this) — engine, ledger, mock off-ramp, tests.
- **v0.1** — real Onmeta adapter, Pimlico bundler integration, Postgres, KYC stub.
- **v0.2** — React Native client with UPI deeplink handler + passkey wallet.
- **v0.3** — MCP server exposing `pay_upi()` to agents; ERC-4337 session keys.
- **v0.4** — Aave yield-while-idle; multi-chain (Solana, Tron) via LI.FI.
- **v0.5** — Bridge.xyz Visa card for travel/ATM.
