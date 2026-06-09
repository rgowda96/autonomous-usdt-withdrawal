// Drizzle ORM schema mirror of src/db/schema.sql. Postgres-compatible.
// v0 still runs on better-sqlite3; Drizzle is provided so a Postgres swap
// is a one-line connection change (Phase D follow-up).

import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  created_at: integer("created_at").notNull(),
  pan: text("pan"),
  smart_wallet_address: text("smart_wallet_address"),
  kyc_status: text("kyc_status").notNull().default("pending"),
});

export const balances = sqliteTable("balances", {
  user_id: text("user_id").notNull(),
  asset: text("asset").notNull(),
  chain: text("chain").notNull(),
  amount: text("amount").notNull().default("0"),
  updated_at: integer("updated_at").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.user_id, t.asset, t.chain] }) }));

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  idempotency_key: text("idempotency_key").notNull().unique(),
  payee_type: text("payee_type").notNull(),
  payee_identifier: text("payee_identifier").notNull(),
  payee_display: text("payee_display"),
  amount_inr: integer("amount_inr").notNull(),
  channel: text("channel").notNull(),
  route_plan: text("route_plan").notNull(),
  rate_inr_per_unit: text("rate_inr_per_unit").notNull(),
  expires_at: integer("expires_at").notNull(),
  created_at: integer("created_at").notNull(),
}, (t) => ({ userCreated: index("idx_quotes_user").on(t.user_id, t.created_at) }));

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  quote_id: text("quote_id").notNull(),
  settle_idempotency_key: text("settle_idempotency_key").notNull().unique(),
  status: text("status").notNull(),
  amount_inr: integer("amount_inr").notNull(),
  source_asset: text("source_asset").notNull(),
  source_chain: text("source_chain").notNull(),
  source_amount: text("source_amount").notNull(),
  tds_inr: integer("tds_inr").notNull(),
  offramp_provider: text("offramp_provider"),
  offramp_ref: text("offramp_ref"),
  upi_utr: text("upi_utr"),
  onchain_tx: text("onchain_tx"),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
}, (t) => ({
  userCreated: index("idx_tx_user").on(t.user_id, t.created_at),
  status: index("idx_tx_status").on(t.status),
}));

export const transactionEvents = sqliteTable("transaction_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transaction_id: text("transaction_id").notNull(),
  from_status: text("from_status"),
  to_status: text("to_status").notNull(),
  detail: text("detail"),
  created_at: integer("created_at").notNull(),
}, (t) => ({ tx: index("idx_events_tx").on(t.transaction_id, t.created_at) }));

export const tdsAccruals = sqliteTable("tds_accruals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull(),
  transaction_id: text("transaction_id").notNull(),
  amount_inr: integer("amount_inr").notNull(),
  fiscal_year: text("fiscal_year").notNull(),
  quarter: text("quarter").notNull(),
  filed: integer("filed").notNull().default(0),
  created_at: integer("created_at").notNull(),
}, (t) => ({ userFy: index("idx_tds_user").on(t.user_id, t.fiscal_year) }));

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  event_type: text("event_type").notNull(),
  transaction_id: text("transaction_id"),
  payload: text("payload").notNull(),
  received_at: integer("received_at").notNull(),
  processed_at: integer("processed_at"),
});

export const sessionKeys = sqliteTable("session_keys", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  label: text("label").notNull(),
  token_hash: text("token_hash").notNull().unique(),
  daily_cap_inr: integer("daily_cap_inr").notNull(),
  per_txn_cap_inr: integer("per_txn_cap_inr").notNull(),
  vpa_allowlist: text("vpa_allowlist"),
  expires_at: integer("expires_at").notNull(),
  revoked_at: integer("revoked_at"),
  created_at: integer("created_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  ref_id: text("ref_id"),
  created_at: integer("created_at").notNull(),
  read_at: integer("read_at"),
});

// Additional tables (billers, mandates, kyc_records, kyt_screenings,
// compliance_freezes, cost_basis_lots, realized_gains, beta_invites,
// yield_positions, yield_snapshots, yield_prefs) follow the same pattern;
// added incrementally as the Postgres migration progresses (Phase D
// follow-ups 004.02 / 004.03 / 004.04 / 004.05).
