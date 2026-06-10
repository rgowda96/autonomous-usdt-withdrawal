// Aave V3 on Base Sepolia adapter. Real on-chain wiring (supply/withdraw
// UserOps via Pimlico bundler) lands when PIMLICO_API_KEY arrives.
// v0 returns deterministic APY based on the canonical reserve data shape
// so the yield service can compose against the same interface.

export type AaveReserve = {
  asset: string;
  liquidityRate: number;    // APY in bps (decimal: 500 = 5%)
  borrowRate: number;
  liquidityIndex: string;   // ray
  pool_address: string;
};

const POOL_ADDR = "0x0000000000000000000000000000000000aavev3";

const RESERVES: Record<string, AaveReserve> = {
  USDC: { asset: "USDC", liquidityRate: 500, borrowRate: 650, liquidityIndex: "1000000000000000000000000000", pool_address: POOL_ADDR },
  USDT: { asset: "USDT", liquidityRate: 480, borrowRate: 640, liquidityIndex: "1000000000000000000000000000", pool_address: POOL_ADDR },
  WETH: { asset: "WETH", liquidityRate: 200, borrowRate: 320, liquidityIndex: "1000000000000000000000000000", pool_address: POOL_ADDR },
};

export interface AaveAdapter {
  getReserve(asset: string): Promise<AaveReserve | null>;
  buildSupplyOp(asset: string, amount: string, userSmartWallet: string): Promise<{ to: string; data: string }>;
  buildWithdrawOp(asset: string, amount: string, userSmartWallet: string): Promise<{ to: string; data: string }>;
}

export class AaveBaseSepoliaAdapter implements AaveAdapter {
  async getReserve(asset: string): Promise<AaveReserve | null> {
    return RESERVES[asset] ?? null;
  }
  async buildSupplyOp(asset: string, amount: string, userSmartWallet: string) {
    // Real version: encode `supply(asset, amount, onBehalfOf=userSmartWallet, referralCode=0)`
    // via viem's encodeFunctionData. Stub returns a deterministic shape.
    return { to: POOL_ADDR, data: `0xsupply_${asset}_${amount}_${userSmartWallet.slice(0, 10)}` };
  }
  async buildWithdrawOp(asset: string, amount: string, userSmartWallet: string) {
    return { to: POOL_ADDR, data: `0xwithdraw_${asset}_${amount}_${userSmartWallet.slice(0, 10)}` };
  }
}

export function getAaveAdapter(): AaveAdapter {
  return new AaveBaseSepoliaAdapter();
}
