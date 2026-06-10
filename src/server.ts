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
import { registerBillRoutes } from "./routes/bills.js";
import { seedBillers } from "./services/billers.js";
import { startMandateExecutor } from "./services/mandates.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { installTracing } from "./services/tracing.js";
import { registerComplianceRoutes } from "./routes/compliance.js";
import { registerBetaRoutes } from "./routes/beta.js";
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

  // Tracing + metrics middleware (must be early so all routes get measured)
  installTracing(app);

  // Initialize DB at boot
  db();
  ensureDemoUser();
  startRateLimitSweeper();
  warmRates();
  startIdempotencyCleanup();
  startReconciliationSweeper();
  startDailyYieldSnapshot();
  seedBillers();
  startMandateExecutor();

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
  await registerBillRoutes(app);
  await registerMetricsRoutes(app);
  await registerComplianceRoutes(app);
  await registerBetaRoutes(app);

  await app.listen({ host: config.HOST, port: config.PORT });
}

import { seedDemoUser } from "./services/demo_seed.js";
function ensureDemoUser() {
  seedDemoUser(db());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
