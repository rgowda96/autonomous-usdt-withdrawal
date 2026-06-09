import { createHmac } from "node:crypto";
import { config } from "../config.js";
import type { OffRampAdapter, PayoutRequest, PayoutResponse } from "./offramp.js";

// Onmeta adapter. Spec inferred from public docs / partner discussions.
// Env vars: ONMETA_API_KEY, ONMETA_BASE_URL, ONMETA_WEBHOOK_SECRET.
// In v0 the underlying HTTP calls are gated on a key being present, so the
// adapter cleanly no-ops in test environments and live-fires once creds land.

const DEFAULT_BASE = "https://api.onmeta.in/v1";

export class OnmetaAdapter implements OffRampAdapter {
  private baseUrl: string;
  private apiKey: string;
  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl ?? process.env.ONMETA_BASE_URL ?? DEFAULT_BASE;
    this.apiKey = apiKey ?? process.env.ONMETA_API_KEY ?? "";
  }

  async payout(req: PayoutRequest): Promise<PayoutResponse> {
    if (!this.apiKey) {
      return { provider_ref: "", status: "FAILED", reason: "ONMETA_API_KEY missing" };
    }
    const url = `${this.baseUrl}/payouts`;
    const body = {
      client_ref: req.client_ref,
      payee_vpa: req.vpa,
      amount_inr: req.amount_inr,
      note: req.note,
    };
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const json = await res.json() as { id?: string; status?: string; message?: string };
      if (!res.ok) {
        return { provider_ref: json.id ?? "", status: "FAILED", reason: json.message ?? `HTTP ${res.status}` };
      }
      return {
        provider_ref: json.id ?? "",
        status: json.status === "rejected" ? "FAILED" : "ACCEPTED",
        reason: json.status === "rejected" ? json.message : undefined,
      };
    } catch (e: any) {
      return { provider_ref: "", status: "FAILED", reason: e?.message ?? "network_error" };
    } finally {
      clearTimeout(to);
    }
  }

  verifyWebhook(payload: string, signature: string): boolean {
    const secret = process.env.ONMETA_WEBHOOK_SECRET ?? config.OFFRAMP_WEBHOOK_SECRET;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    return safeCompare(expected, signature);
  }
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export class FallbackOffRamp implements OffRampAdapter {
  constructor(private primary: OffRampAdapter, private fallback: OffRampAdapter) {}
  async payout(req: PayoutRequest): Promise<PayoutResponse> {
    const r = await this.primary.payout(req);
    if (r.status === "ACCEPTED") return r;
    return this.fallback.payout(req);
  }
  verifyWebhook(payload: string, signature: string): boolean {
    return this.primary.verifyWebhook(payload, signature) || this.fallback.verifyWebhook(payload, signature);
  }
}
