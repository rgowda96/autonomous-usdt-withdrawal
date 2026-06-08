-- StablePay ledger. Append-mostly, double-entry on transaction_events.
-- SQLite for v0; structure is Postgres-compatible.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  pan TEXT,
  smart_wallet_address TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS balances (
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT '0',  -- decimal string, asset-native units
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, asset, chain),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payee_type TEXT NOT NULL,
  payee_identifier TEXT NOT NULL,
  payee_display TEXT,
  amount_inr INTEGER NOT NULL,
  channel TEXT NOT NULL,
  route_plan TEXT NOT NULL,        -- JSON
  rate_inr_per_unit TEXT NOT NULL, -- decimal string
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id, created_at);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  quote_id TEXT NOT NULL,
  settle_idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  amount_inr INTEGER NOT NULL,
  source_asset TEXT NOT NULL,
  source_chain TEXT NOT NULL,
  source_amount TEXT NOT NULL,
  tds_inr INTEGER NOT NULL,
  offramp_provider TEXT,
  offramp_ref TEXT,
  upi_utr TEXT,
  onchain_tx TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);

CREATE TABLE IF NOT EXISTS transaction_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  detail TEXT,                     -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_events_tx ON transaction_events(transaction_id, created_at);

CREATE TABLE IF NOT EXISTS tds_accruals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  amount_inr INTEGER NOT NULL,
  fiscal_year TEXT NOT NULL,
  quarter TEXT NOT NULL,
  filed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_tds_user ON tds_accruals(user_id, fiscal_year);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,                -- provider event id, for dedup
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  transaction_id TEXT,
  payload TEXT NOT NULL,              -- JSON
  received_at INTEGER NOT NULL,
  processed_at INTEGER
);
