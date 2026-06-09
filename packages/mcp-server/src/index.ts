#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const STABLEPAY_API_URL = process.env.STABLEPAY_API_URL ?? "http://localhost:3000";
const STABLEPAY_TOKEN = process.env.STABLEPAY_TOKEN ?? "";

async function api(method: string, path: string, body?: unknown) {
  if (!STABLEPAY_TOKEN) throw new Error("STABLEPAY_TOKEN env var required");
  const res = await fetch(`${STABLEPAY_API_URL}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${STABLEPAY_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

const server = new Server(
  { name: "stablepay", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "pay_upi",
      description:
        "Pay an Indian UPI VPA from the user's StablePay wallet. Routing picks the cheapest asset automatically. " +
        "Subject to session-key spending policy (per-txn cap, daily cap, VPA allowlist). Returns the transaction id.",
      inputSchema: {
        type: "object",
        required: ["vpa", "amount_inr"],
        properties: {
          vpa: { type: "string", description: "UPI VPA e.g. swiggy@hdfc" },
          amount_inr: { type: "integer", description: "Amount in INR rupees (integer)", minimum: 1 },
          note: { type: "string", description: "Optional memo", maxLength: 280 },
        },
      },
    },
    {
      name: "whoami",
      description: "Returns the session-key's bounds: user_id, label, per-txn + daily caps, VPA allowlist, expiry.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "pay_upi") {
      const out = await api("POST", "/v1/agent/pay-upi", args);
      return {
        content: [
          {
            type: "text",
            text:
              `Paid ₹${(args as any).amount_inr} to ${(args as any).vpa}.\n` +
              `Transaction: ${out.transaction_id}\n` +
              `Status: ${out.status}\n` +
              `Paid from: ${out.source_asset} (fee ${(out.total_fee_bps / 100).toFixed(2)}%, TDS ₹${out.tds_inr})`,
          },
        ],
      };
    }
    if (name === "whoami") {
      const out = await api("GET", "/v1/agent/whoami");
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (e: any) {
    return { content: [{ type: "text", text: `Error: ${e.message ?? e}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("StablePay MCP server up");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
