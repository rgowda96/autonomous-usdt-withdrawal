import { randomUUID } from "node:crypto";
import { config } from "../config.js";

export type PayoutRequest = {
  client_ref: string;       // our quote_id; partner must dedupe on this
  vpa: string;
  amount_inr: number;
  note?: string;
};

export type PayoutResponse = {
  provider_ref: string;
  status: "ACCEPTED" | "FAILED";
  reason?: string;
};

export interface OffRampAdapter {
  payout(req: PayoutRequest): Promise<PayoutResponse>;
  verifyWebhook(payload: string, signature: string): boolean;
}

class MockAdapter implements OffRampAdapter {
  async payout(req: PayoutRequest): Promise<PayoutResponse> {
    // Mock: always accept; webhook will be triggered separately by /dev/webhook helper.
    return { provider_ref: `mock_${randomUUID()}`, status: "ACCEPTED" };
  }
  verifyWebhook(_payload: string, signature: string): boolean {
    return signature === config.OFFRAMP_WEBHOOK_SECRET;
  }
}

// Onmeta / Cashfree adapters will implement the same interface later.
export function getOffRamp(): OffRampAdapter {
  switch (config.OFFRAMP_PROVIDER) {
    case "mock":
    default:
      return new MockAdapter();
  }
}
