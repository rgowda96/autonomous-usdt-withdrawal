// Privy SDK wrapper. Env-gated: when EXPO_PUBLIC_PRIVY_APP_ID is set,
// the wrapper would delegate to @privy-io/expo for passkey-backed
// smart-account creation. Until then, return a deterministic local
// wallet address keyed off the device install ID so the rest of the
// app can develop against a stable interface.

import Constants from "expo-constants";

export type LocalWallet = {
  address: string;
  source: "privy" | "local-stub";
};

function deviceSalt(): string {
  // Constants.sessionId persists per-install on Expo; falls back to a
  // session-scoped random when not available.
  const id = (Constants as any).sessionId ?? "stablepay-stub";
  // Cheap hash so we get a 40-hex string.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hex = Math.abs(h).toString(16).padStart(8, "0");
  return ("0x" + hex.repeat(5)).slice(0, 42);
}

export async function getOrCreateWallet(): Promise<LocalWallet> {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  if (appId) {
    // Real implementation:
    //   import { PrivyProvider, usePrivy } from "@privy-io/expo";
    //   const wallet = await privy.embeddedWallet.create({ recoveryMethod: "passkey" });
    //   return { address: wallet.address, source: "privy" };
    throw new Error(
      "EXPO_PUBLIC_PRIVY_APP_ID is set but the Privy SDK isn't wired yet (Phase F 050.01). " +
      "Unset to use the local stub for development."
    );
  }
  return { address: deviceSalt(), source: "local-stub" };
}
