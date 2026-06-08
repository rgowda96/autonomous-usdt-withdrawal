import Fastify from "fastify";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { registerQuoteRoutes } from "./routes/quote.js";
import { registerSettleRoutes } from "./routes/settle.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { registerWalletRoutes } from "./routes/wallet.js";

async function main() {
  const app = Fastify({
    logger: config.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  // Initialize DB at boot
  db();

  app.get("/healthz", async () => ({ ok: true, service: "stablepay", version: "0.0.1" }));

  await registerQuoteRoutes(app);
  await registerSettleRoutes(app);
  await registerWebhookRoutes(app);
  await registerWalletRoutes(app);

  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
