export const RADIUSD_POOL_ADDRESS = "0x8C5954bE2A8b463895eA9cd0bc2Ea83b5DC7B0d9" as `0x${string}`;
export const RADIUSD_LP_TOKEN_ADDRESS = "0xc349BCA5A206D52c2840f7BaBd4F72ee30C4127f" as `0x${string}`;
export const RADIUSD_RAD_TOKEN_ADDRESS = "0x196Ee81eC2e565188EC737234a108AcbFEA0d992" as `0x${string}`;
export const RADIUSD_STAKING_ADDRESS = "0xD4DD50Eb1fb8b4c3d88e508b1E80194835b5ecf5" as `0x${string}`;

export const RADIUSD_TOKEN_INDEX = { USDC: 0, EURC: 1 } as const;

export const RADIUSD_POOL_ABI = [
  { name: "exchange", type: "function", stateMutability: "nonpayable", inputs: [{ name: "i", type: "uint256" }, { name: "j", type: "uint256" }, { name: "dx", type: "uint256" }, { name: "minDy", type: "uint256" }], outputs: [{ name: "dy", type: "uint256" }] },
  { name: "get_dy", type: "function", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }, { name: "j", type: "uint256" }, { name: "dx", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "balances", type: "function", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "fee", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "lpToken", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "add_liquidity", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amounts", type: "uint256[2]" }, { name: "min_mint_amount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "remove_liquidity", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "min_amounts", type: "uint256[2]" }], outputs: [{ name: "", type: "uint256[2]" }] },
] as const;

export const RADIUSD_STAKING_ABI = [
  { name: "stake", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "claim", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "exit", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "staked", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "earned", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalStaked", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "rewardRatePerSecond", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const RADIUSD_ERC20_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export function calcRadiusApr(rewardRatePerSecond: bigint, totalStaked: bigint): number {
  if (totalStaked === BigInt(0)) return 0;
  return Number((rewardRatePerSecond * BigInt(365 * 24 * 3600) * BigInt(10000)) / totalStaked) / 100;
}
