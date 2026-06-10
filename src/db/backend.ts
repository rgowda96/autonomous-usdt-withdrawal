// Storage backend selector. v0 still uses better-sqlite3; this file lets
// the rest of the codebase declare "I want a backend" and lets a future
// migration drop in a Postgres driver without touching call sites.
//
// Selection:
//   DATABASE_URL=./data/foo.db       -> SQLite (default)
//   DATABASE_URL=postgres://...      -> Postgres (Drizzle + pg)
//
// For now the Postgres path throws a clear error so deploy.md's
// "Postgres migration" hint surfaces at boot time instead of silently
// landing on a non-functional driver.

import { config } from "../config.js";

export type Backend = "sqlite" | "postgres";

export function detectBackend(url: string = config.DATABASE_URL): Backend {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgres";
  return "sqlite";
}

export function assertSupportedBackend(): void {
  const b = detectBackend();
  if (b === "postgres") {
    throw new Error(
      "DATABASE_URL=postgres://... detected but the Postgres adapter is not yet wired in v0. " +
      "Phase D follow-ups 004.02-04.05 will land it. For now set DATABASE_URL to a SQLite path."
    );
  }
}
