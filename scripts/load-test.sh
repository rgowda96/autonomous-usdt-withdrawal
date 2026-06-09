#!/usr/bin/env bash
# Load test for /v1/quote using autocannon.
# Usage: ./scripts/load-test.sh [URL] [DURATION_S] [CONCURRENCY]

set -euo pipefail

URL="${1:-http://localhost:3000/v1/quote}"
DURATION="${2:-30}"
CONNECTIONS="${3:-50}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found; install Node 22+"; exit 1
fi

PAYLOAD=$(cat <<'JSON'
{
  "idempotency_key": "00000000-0000-4000-8000-000000000000",
  "user_id": "user_demo_1",
  "payee": { "type": "vpa", "identifier": "swiggy@hdfc" },
  "amount_inr": 500,
  "channel": "qr",
  "asset_preference": "auto_cheapest"
}
JSON
)

# autocannon -m POST -d DURATION -c CONNECTIONS -H "content-type=application/json" -b PAYLOAD URL
# Note: each connection reuses the same idempotency_key — the engine dedupes,
# which is the realistic hot path.
echo "Hitting $URL for ${DURATION}s with ${CONNECTIONS} connections..."
npx --yes autocannon \
  -m POST \
  -d "$DURATION" \
  -c "$CONNECTIONS" \
  -H "content-type: application/json" \
  -b "$PAYLOAD" \
  "$URL"
