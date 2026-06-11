import type { Config } from "drizzle-kit";

// Drizzle-kit configuration. The schema file is the source of truth
// for both SQLite (v0) and Postgres (Phase D). Migrations live in
// drizzle/ once generated.

export default {
  schema: "./src/db/drizzle_schema.ts",
  out: "./drizzle",
  dialect: process.env.DATABASE_URL?.startsWith("postgres") ? "postgresql" : "sqlite",
  dbCredentials: process.env.DATABASE_URL?.startsWith("postgres")
    ? { url: process.env.DATABASE_URL }
    : { url: process.env.DATABASE_URL ?? "./data/stablepay.db" },
  strict: true,
  verbose: true,
} satisfies Config;
