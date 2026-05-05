/** Lunex Finance — Curve-style StableSwap on Arc Testnet */

export const LUNEX_SWAP_POOL = "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8" as `0x${string}`;
export const LUNEX_LP = "0x9fD18A3dCbcb8238f7426E888bA73aFfbF9F3b69" as `0x${string}`;

/** Token index in the StableSwap pool */
export const LUNEX_TOKEN_INDEX = { USDC: 0, EURC: 1 } as const;

/** StableSwap pool ABI (Curve-style) */
export const LUNEX_POOL_ABI = [
  {
    name: "exchange",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "i", type: "uint256" },
      { name: "j", type: "uint256" },
      { name: "dx", type: "uint256" },
      { name: "minDy", type: "uint256" },
    ],
    outputs: [{ name: "dy", type: "uint256" }],
  },
  {
    name: "get_dy",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "i", type: "uint256" },
      { name: "j", type: "uint256" },
      { name: "dx", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balances",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "i", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "fee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "lpToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
