import { z } from "zod";

export const AssetSchema = z.enum(["USDC", "USDT", "ETH", "SOL", "BTC", "INR_CREDIT"]);
export type Asset = z.infer<typeof AssetSchema>;

export const ChainSchema = z.enum(["base", "solana", "ethereum", "tron", "arbitrum", "internal"]);
export type Chain = z.infer<typeof ChainSchema>;

export const ChannelSchema = z.enum(["qr", "checkout", "agent", "p2p", "bill"]);
export type Channel = z.infer<typeof ChannelSchema>;

export const PayeeSchema = z.object({
  type: z.enum(["vpa", "merchant_id", "biller", "wallet"]),
  identifier: z.string().min(1),
  display_name: z.string().optional(),
});
export type Payee = z.infer<typeof PayeeSchema>;

export const AssetPreferenceSchema = z.union([
  z.literal("auto_cheapest"),
  z.literal("auto_tax_optimal"),
  z.literal("hodl_mode"),
  z.object({ asset: AssetSchema, chain: ChainSchema }),
]);
// already includes auto_tax_optimal — fully wired in routing.ts
export type AssetPreference = z.infer<typeof AssetPreferenceSchema>;

export const QuoteRequestSchema = z.object({
  idempotency_key: z.string().uuid(),
  user_id: z.string().min(1),
  payee: PayeeSchema,
  amount_inr: z.number().int().positive(),
  channel: ChannelSchema,
  asset_preference: AssetPreferenceSchema.default("auto_cheapest"),
});
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const SettleRequestSchema = z.object({
  idempotency_key: z.string().uuid(),
  quote_id: z.string().min(1),
  auth_proof: z.string().min(1), // passkey assertion / session_key_sig / mandate_ref
});
export type SettleRequest = z.infer<typeof SettleRequestSchema>;

export type TxStatus =
  | "INIT"
  | "PENDING"
  | "USDC_RECEIVED"
  | "PAYOUT_INITIATED"
  | "SETTLED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "FAILED";

export type CostComponent = { component: string; bps: number; inr: number };

export type RoutePlan = {
  source_asset: Asset;
  source_chain: Chain;
  source_amount: string; // decimal string, asset-native units
  steps: RouteStep[];
  total_fee_bps: number;
  tds_inr: number;
  amount_inr: number;
  cost_breakdown: CostComponent[];
};

export type RouteStep =
  | { kind: "swap"; from: Asset; to: Asset; venue: string; est_slippage_bps: number }
  | { kind: "bridge"; from_chain: Chain; to_chain: Chain; venue: string }
  | { kind: "offramp"; provider: string; fee_bps: number }
  | { kind: "upi_payout"; vpa: string };
