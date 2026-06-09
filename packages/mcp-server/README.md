# StablePay MCP Server

Exposes the StablePay payment rail to any MCP-aware LLM (Claude Desktop, Cursor, etc.) under a user-bounded session key.

## Setup

1. Mint a session key for an agent on the backend:
   ```bash
   curl -X POST http://localhost:3000/v1/users/user_demo_1/session-keys \
     -H 'content-type: application/json' \
     -d '{
       "label": "Claude Desktop",
       "daily_cap_inr": 2000,
       "per_txn_cap_inr": 500,
       "vpa_allowlist": ["swiggy@hdfc", "zomato@hdfc"],
       "ttl_days": 30
     }'
   ```
   Copy the `token` (`stp_...`) from the response — shown ONCE.

2. Install deps:
   ```bash
   cd packages/mcp-server
   npm install
   ```

3. Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:
   ```json
   {
     "mcpServers": {
       "stablepay": {
         "command": "node",
         "args": ["--import", "tsx/esm", "/absolute/path/to/packages/mcp-server/src/index.ts"],
         "env": {
           "STABLEPAY_API_URL": "http://localhost:3000",
           "STABLEPAY_TOKEN": "stp_..."
         }
       }
     }
   }
   ```

4. Restart Claude Desktop. Ask: *"Pay ₹150 to swiggy@hdfc."* The agent calls the `pay_upi` tool.

## Tools

- `pay_upi(vpa, amount_inr, note?)` — make a payment. Policy enforced server-side.
- `whoami` — show the session key's bounds (caps, allowlist, expiry).

## Policy enforcement

Every `pay_upi` call is checked against:
- `per_txn_cap_inr` — single transaction limit
- `daily_cap_inr` — rolling 24h sum
- `vpa_allowlist` — allowed payees (null = any)
- `expires_at` — token TTL
- `revoked_at` — manual revocation

Rejected calls are logged in `session_key_usage` with the outcome (REJECTED_CAP, REJECTED_ALLOWLIST, etc.) and a notification is recorded for the user.
