import Constants from "expo-constants";
import { getStoredApiBaseUrl } from "./storage";

export const DEMO_USER_ID = "user_demo_1";

export const defaultBaseUrl: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "http://localhost:3000";

let overrideBaseUrl: string | null = null;

export function getBaseUrl(): string {
  return overrideBaseUrl ?? defaultBaseUrl;
}

export function setBaseUrlOverride(url: string | null): void {
  overrideBaseUrl = url && url.length > 0 ? url : null;
}

// Backwards-compat export: most code reads `baseUrl` for display only.
export const baseUrl = defaultBaseUrl;

export async function initBaseUrl(): Promise<void> {
  const stored = await getStoredApiBaseUrl();
  if (stored) overrideBaseUrl = stored;
}

export type CostComponent = { component: string; bps: number; inr: number };

export type QuoteResponse = {
  quote_id: string;
  amount_inr: number;
  source_asset: string;
  source_chain: string;
  source_amount: string;
  rate_inr_per_unit: string;
  total_fee_bps: number;
  tds_inr: number;
  expires_at: number;
  steps: unknown[];
  cost_breakdown?: CostComponent[];
};

export type SettleResponse = {
  transaction_id: string;
  status: string;
  offramp_ref?: string;
  utr?: string;
};

export type Transaction = {
  id: string;
  status: string;
  amount_inr: number;
  source_asset: string;
  source_chain: string;
  source_amount: string;
  tds_inr: number;
  upi_utr: string | null;
  onchain_tx: string | null;
  created_at: number;
};

export type TimelineEvent = { from: string | null; to: string; at: number; detail: unknown };

export type TransactionDetail = Transaction & {
  user_id: string;
  payee: { identifier: string; display_name: string | null };
  channel: string;
  source: { asset: string; chain: string; amount: string };
  rate_inr_per_unit: string;
  offramp_ref: string | null;
  route_plan: unknown | null;
  updated_at: number;
  timeline: TimelineEvent[];
};

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error((json && json.error) || `HTTP ${res.status}`);
  return (json ?? {}) as T;
}

export const api = {
  get baseUrl() { return getBaseUrl(); },
  health: () => request<{ ok: boolean; version: string }>("GET", "/healthz"),
  balances: () =>
    request<{ user_id: string; balances: { asset: string; chain: string; amount: string }[] }>(
      "GET",
      `/v1/users/${DEMO_USER_ID}/balances`
    ),
  quote: (vpa: string, amount_inr: number, asset_preference: unknown = "auto_cheapest") =>
    request<QuoteResponse>("POST", "/v1/quote", {
      idempotency_key: uuid(),
      user_id: DEMO_USER_ID,
      payee: { type: "vpa", identifier: vpa, display_name: vpa.split("@")[0] },
      amount_inr,
      channel: "qr",
      asset_preference,
    }),
  settle: (quoteId: string) =>
    request<SettleResponse>("POST", "/v1/settle", {
      idempotency_key: uuid(),
      quote_id: quoteId,
      auth_proof: `demo-passkey-${uuid().slice(0, 8)}`,
    }),
  simulateWebhook: (quoteId: string, providerRef: string) =>
    fetch(`${getBaseUrl()}/v1/webhooks/offramp`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": "devsecret" },
      body: JSON.stringify({
        event_id: `evt_${uuid()}`,
        event_type: "PAYOUT_SUCCESS",
        client_ref: quoteId,
        provider_ref: providerRef,
        utr: "UTR" + Math.floor(Math.random() * 1e9).toString().padStart(9, "0"),
      }),
    }),
  transactions: () =>
    request<{ user_id: string; transactions: Transaction[] }>(
      "GET",
      `/v1/users/${DEMO_USER_ID}/transactions`
    ),
  transaction: (id: string) => request<TransactionDetail>("GET", `/v1/transactions/${id}`),
  sessionKeys: () =>
    request<{ user_id: string; session_keys: SessionKey[] }>("GET", `/v1/users/${DEMO_USER_ID}/session-keys`),
  createSessionKey: (body: { label: string; daily_cap_inr: number; per_txn_cap_inr: number; vpa_allowlist?: string[]; ttl_days?: number }) =>
    request<SessionKey & { token: string }>("POST", `/v1/users/${DEMO_USER_ID}/session-keys`, body),
  revokeSessionKey: (id: string) =>
    request<{ ok: boolean }>("DELETE", `/v1/users/${DEMO_USER_ID}/session-keys/${id}`),
  onlineQuote: (usd_amount: number) =>
    request<OnlineQuote>("POST", "/v1/online/quote", { usd_amount }),
  onlineCharge: (merchant: string, usd_amount: number, merchant_country?: string) =>
    request<OnlineChargeResult>("POST", "/v1/online/charge", {
      idempotency_key: uuid(),
      user_id: DEMO_USER_ID,
      merchant,
      merchant_country,
      usd_amount,
    }),
  onlinePurchases: () =>
    request<{ user_id: string; purchases: OnlinePurchase[] }>("GET", `/v1/users/${DEMO_USER_ID}/online-purchases`),
  savings: () =>
    request<{ user_id: string; lifetime_saved_inr: number; purchase_count: number }>("GET", `/v1/users/${DEMO_USER_ID}/savings`),
};

export type OnlineQuote = {
  usd_amount: number;
  mid_market_inr_per_usd: number;
  our_inr_per_usd: number;
  our_spread_bps: number;
  our_inr_total: number;
  our_fee_inr: number;
  redotpay_inr_per_usd: number;
  redotpay_inr_total: number;
  you_save_inr: number;
  you_save_pct: number;
  usdc_required: string;
  tds_inr: number;
};

export type OnlineChargeResult = {
  id: string;
  status: string;
  usd_amount: number;
  our_inr_total: number;
  saved_inr: number;
  network_ref: string;
};

export type OnlinePurchase = {
  id: string;
  merchant: string;
  merchant_country: string | null;
  usd_amount: string;
  our_inr_total: number;
  saved_inr: number;
  status: string;
  created_at: number;
};

export type SessionKey = {
  id: string;
  user_id: string;
  label: string;
  daily_cap_inr: number;
  per_txn_cap_inr: number;
  vpa_allowlist: string[] | null;
  expires_at: number;
  revoked_at: number | null;
  created_at: number;
};
