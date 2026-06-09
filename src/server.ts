import Fastify from "fastify";
import cors from "@fastify/cors";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { db, now } from "./db/index.js";
import { registerQuoteRoutes } from "./routes/quote.js";
import { registerSettleRoutes } from "./routes/settle.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import { registerSessionKeyRoutes } from "./routes/session_keys.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { registerIntentRoutes } from "./routes/intents.js";
import { registerYieldRoutes } from "./routes/yield.js";
import { startDailyYieldSnapshot } from "./services/yield.js";
import { startRateLimitSweeper } from "./services/rate_limit.js";
import { warmRates } from "./services/rates.js";
import { startIdempotencyCleanup, startReconciliationSweeper } from "./services/sweepers.js";
import { pinoSerializers } from "./services/logging.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = Fastify({
    logger: config.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty" }, serializers: pinoSerializers, redact: ["req.headers.authorization", "req.headers.cookie", "req.headers['x-signature']"] }
      : { serializers: pinoSerializers, redact: ["req.headers.authorization", "req.headers.cookie", "req.headers['x-signature']"] },
  });

  // CORS — mobile app (Expo) and any local web demo
  await app.register(cors, { origin: true });

  // Initialize DB at boot
  db();
  ensureDemoUser();
  startRateLimitSweeper();
  warmRates();
  startIdempotencyCleanup();
  startReconciliationSweeper();
  startDailyYieldSnapshot();

  app.get("/healthz", async () => ({ ok: true, service: "stablepay", version: "0.0.1" }));

  const indexHtml = await readFile(resolve(__dirname, "public/index.html"), "utf8");
  app.get("/", async (_req, reply) => reply.type("text/html").send(indexHtml));

  await registerQuoteRoutes(app);
  await registerSettleRoutes(app);
  await registerWebhookRoutes(app);
  await registerWalletRoutes(app);
  await registerSessionKeyRoutes(app);
  await registerAgentRoutes(app);
  await registerIntentRoutes(app);
  await registerYieldRoutes(app);

  await app.listen({ host: config.HOST, port: config.PORT });
}

function ensureDemoUser() {
  const userId = "user_demo_1";
  const conn = db();
  conn.transaction(() => {
    conn.prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`)
      .run(userId, now(), "approved");
    const ins = conn.prepare(
      `INSERT OR IGNORE INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`
    );
    ins.run(userId, "USDC", "base", "1000.000000", now());
    ins.run(userId, "USDT", "tron", "500.000000", now());
    ins.run(userId, "INR_CREDIT", "internal", "2000.00", now());
  })();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
