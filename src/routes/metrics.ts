import type { FastifyInstance } from "fastify";
import { renderMetrics } from "../services/metrics.js";

export async function registerMetricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async (_req, reply) => {
    reply.type("text/plain; version=0.0.4; charset=utf-8");
    return reply.send(renderMetrics());
  });
}
