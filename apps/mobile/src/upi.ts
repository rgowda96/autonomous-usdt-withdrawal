// Mobile-side UPI deeplink parser. Mirrors src/services/intent.ts's
// parseUpiDeeplink so the app can interpret QR scans / shared intents
// without round-tripping to the backend.

export type ParsedUpi = {
  vpa: string;
  display_name?: string;
  amount_inr?: number;
  note?: string;
  txn_ref?: string;
};

const RE = /^upi:\/\/pay\?(.+)$/i;

export function parseUpiDeeplink(s: string): ParsedUpi {
  const m = s.match(RE);
  if (!m) throw new Error("Not a UPI deeplink");
  const params = new URLSearchParams(m[1]!);
  const pa = params.get("pa");
  if (!pa) throw new Error("Missing payee VPA (pa)");
  const am = params.get("am");
  const cu = (params.get("cu") ?? "INR").toUpperCase();
  if (cu !== "INR") throw new Error(`Currency ${cu} not supported`);
  return {
    vpa: pa,
    display_name: params.get("pn") ?? undefined,
    amount_inr: am ? Math.round(parseFloat(am)) : undefined,
    note: params.get("tn") ?? undefined,
    txn_ref: params.get("tr") ?? undefined,
  };
}

// Detect whether the host string is a UPI deeplink at all (used by
// expo-linking listener before throwing on non-UPI URLs).
export function isUpiDeeplink(s: string | null | undefined): boolean {
  return !!s && RE.test(s);
}
