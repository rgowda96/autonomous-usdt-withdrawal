// Base Sepolia broadcast adapter. Live-fires when PIMLICO_API_KEY is set;
// otherwise stays in deterministic-stub mode for tests + dev.
//
// Real flow (env-gated):
//   1. Build ERC-4337 UserOperation with userSmartWallet sender + callData
//      for the USDC.transfer(to, amount) call.
//   2. Estimate verificationGasLimit + callGasLimit via Pimlico bundler.
//   3. Request paymaster sponsorship via Pimlico paymaster API.
//   4. Sign the UserOp digest with the user's passkey (mobile-side) or
//      ephemeral session key.
//   5. eth_sendUserOperation -> bundler. Wait for receipt.
//   6. Return real tx_hash.

import { adapterFor } from "./chain_adapters.js";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export type SendOpts = {
  user_smart_wallet: string;
  to: string;
  asset: "USDC" | "WETH";
  amount: string;        // human-readable decimal
};

export type SendResult = { tx_hash: string; chain: "base"; mode: "live" | "stub" };

export async function sendBaseSepolia(opts: SendOpts): Promise<SendResult> {
  const key = process.env.PIMLICO_API_KEY ?? "";
  if (!key) {
    // Stub path: deterministic hash so tests stay reproducible.
    const r = await adapterFor("base").broadcastTransfer({
      from: opts.user_smart_wallet,
      to: opts.to,
      asset: opts.asset,
      amount: opts.amount,
    });
    return { tx_hash: r.tx_hash, chain: "base", mode: "stub" };
  }
  // Live path: real Pimlico wiring lands when PIMLICO_API_KEY is set.
  // For now we fail loud so an accidental real-mode boot doesn't silently
  // fall through to the stub when a key IS configured but the SDK isn't.
  throw new Error(
    "PIMLICO_API_KEY is set but the live Base Sepolia broadcast (015.05/015.07) " +
    "isn't wired yet. Unset the key, or finish Phase F."
  );
}

export type PaymasterSponsorship = {
  paymasterAndData: string;
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
};

export async function sponsorWithPimlico(_userOp: unknown): Promise<PaymasterSponsorship> {
  const key = process.env.PIMLICO_API_KEY ?? "";
  if (!key) {
    return {
      paymasterAndData: "0xstub_paymaster",
      preVerificationGas: "0x186a0",       // 100000
      verificationGasLimit: "0x186a0",
      callGasLimit: "0x186a0",
    };
  }
  throw new Error("Pimlico paymaster (015.07) not yet wired; unset PIMLICO_API_KEY to use stub.");
}

export const USDC_ADDRESS = USDC_BASE_SEPOLIA;
