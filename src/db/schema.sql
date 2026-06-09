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

CREATE TABLE IF NOT EXISTS session_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,                -- "Claude Desktop", "Cursor", etc.
  token_hash TEXT NOT NULL UNIQUE,    -- SHA256 of bearer token
  daily_cap_inr INTEGER NOT NULL,
  per_txn_cap_inr INTEGER NOT NULL,
  vpa_allowlist TEXT,                 -- JSON array, null = any
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_session_keys_user ON session_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_session_keys_token ON session_keys(token_hash);

CREATE TABLE IF NOT EXISTS session_key_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key_id TEXT NOT NULL,
  transaction_id TEXT,
  amount_inr INTEGER NOT NULL,
  vpa TEXT NOT NULL,
  outcome TEXT NOT NULL,              -- ALLOWED, REJECTED_CAP, REJECTED_ALLOWLIST, REJECTED_EXPIRED, REJECTED_REVOKED
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_key_id) REFERENCES session_keys(id)
);

CREATE INDEX IF NOT EXISTS idx_skusage_session ON session_key_usage(session_key_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- agent_payment, agent_rejected, ...
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  ref_id TEXT,                        -- transaction_id, session_key_id, etc.
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS yield_positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL,
  venue TEXT NOT NULL,                -- "aave_v3_base_sepolia", "morpho_blue", etc.
  principal TEXT NOT NULL,            -- decimal string, asset-native
  current_value TEXT NOT NULL,        -- principal + accrued yield
  apy_bps INTEGER NOT NULL,           -- snapshot at last update
  opened_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_yield_user ON yield_positions(user_id, closed_at);

CREATE TABLE IF NOT EXISTS yield_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id TEXT NOT NULL,
  value TEXT NOT NULL,
  apy_bps INTEGER NOT NULL,
  taken_at INTEGER NOT NULL,
  FOREIGN KEY (position_id) REFERENCES yield_positions(id)
);

CREATE TABLE IF NOT EXISTS yield_prefs (
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, asset, chain),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
