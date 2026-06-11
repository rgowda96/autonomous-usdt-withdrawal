import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("./data/stablepay.db"),
  QUOTE_TTL_SECONDS: z.coerce.number().default(30),
  SPREAD_BPS: z.coerce.number().default(40),
  OFFRAMP_PROVIDER: z.enum(["mock", "onmeta", "cashfree"]).default("mock"),
  OFFRAMP_API_KEY: z.string().optional(),
  OFFRAMP_WEBHOOK_SECRET: z.string().default("devsecret"),
  TDS_RATE_BPS: z.coerce.number().default(100),
});

export const config = schema.parse(process.env);
export type Config = z.infer<typeof schema>;
