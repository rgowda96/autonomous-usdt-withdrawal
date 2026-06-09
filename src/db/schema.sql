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

CREATE TABLE IF NOT EXISTS cost_basis_lots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL,
  quantity TEXT NOT NULL,             -- decimal string, asset-native
  cost_inr_per_unit TEXT NOT NULL,    -- decimal string (FIFO basis)
  remaining_quantity TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_lots_user_asset ON cost_basis_lots(user_id, asset, chain, acquired_at);

CREATE TABLE IF NOT EXISTS realized_gains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  transaction_id TEXT,
  asset TEXT NOT NULL,
  quantity_sold TEXT NOT NULL,
  proceeds_inr INTEGER NOT NULL,
  cost_basis_inr INTEGER NOT NULL,
  gain_inr INTEGER NOT NULL,
  realized_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_gains_user ON realized_gains(user_id, realized_at);

CREATE TABLE IF NOT EXISTS beta_invites (
  code TEXT PRIMARY KEY,
  invited_by TEXT,
  cohort TEXT NOT NULL,                -- "founder", "internal", "wave-1", etc.
  email TEXT,
  consumed_by_user_id TEXT,
  consumed_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (consumed_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_beta_cohort ON beta_invites(cohort, consumed_at);

CREATE TABLE IF NOT EXISTS kyc_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,             -- sumsub, hyperverge, manual
  status TEXT NOT NULL,                -- pending, approved, rejected, expired
  document_type TEXT,                  -- aadhaar, pan, passport
  document_last4 TEXT,
  risk_level TEXT,                     -- low, medium, high
  raw_response TEXT,                   -- JSON
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_records(user_id, status);

CREATE TABLE IF NOT EXISTS kyt_screenings (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  risk_score INTEGER NOT NULL,         -- 0-100
  category TEXT,                       -- exchange, gambling, sanctions, mixer, none
  sanctions_hit INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,              -- chainalysis, trm, mock
  raw_response TEXT,
  screened_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kyt_user ON kyt_screenings(user_id);
CREATE INDEX IF NOT EXISTS idx_kyt_addr ON kyt_screenings(address);

CREATE TABLE IF NOT EXISTS compliance_freezes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,                -- sanctions_match, kyc_rejected, manual_review
  source TEXT NOT NULL,                -- kyt, kyc, manual
  ref_id TEXT,
  created_at INTEGER NOT NULL,
  released_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_freeze_user ON compliance_freezes(user_id, released_at);

CREATE TABLE IF NOT EXISTS billers (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,             -- electricity, mobile, dth, gas, broadband, water, insurance
  name TEXT NOT NULL,
  vpa TEXT NOT NULL,
  region TEXT,                        -- e.g. "MH", "KA", "ALL"
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_biller_cat ON billers(category, active);

CREATE TABLE IF NOT EXISTS mandates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,                -- "Netflix", "Electricity bill", etc.
  payee_vpa TEXT NOT NULL,
  amount_inr INTEGER NOT NULL,
  cadence TEXT NOT NULL,              -- monthly, weekly, daily
  next_run_at INTEGER NOT NULL,
  last_run_at INTEGER,
  last_tx_id TEXT,
  expires_at INTEGER,                 -- nullable: indefinite
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_mandate_user ON mandates(user_id);
CREATE INDEX IF NOT EXISTS idx_mandate_next ON mandates(next_run_at, revoked_at);

CREATE TABLE IF NOT EXISTS yield_prefs (
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, asset, chain),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
