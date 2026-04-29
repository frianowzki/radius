import { test as base, expect, type Page } from "@playwright/test";
import path from "node:path";

// Anvil should run with Arc Testnet's chain id (5042002) so wagmi accepts the
// network. Override via WALLET_RPC_URL / WALLET_CHAIN_ID / WALLET_ADDRESS.
const RPC_URL = process.env.WALLET_RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.WALLET_CHAIN_ID || 5042002);
const ADDRESS = (process.env.WALLET_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266").toLowerCase();

export const WALLET_CONFIG = { rpcUrl: RPC_URL, chainId: CHAIN_ID, address: ADDRESS };

/** Anvil cheat: set the test wallet's native balance to 100 ETH. */
export async function fundTestWallet(amountWei = "0x56BC75E2D63100000") {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "anvil_setBalance", params: [ADDRESS, amountWei] }),
  });
  if (!res.ok) throw new Error(`anvil_setBalance failed: ${res.status}`);
}

export const test = base.extend<{ walletPage: Page }>({
  walletPage: async ({ page }, use) => {
    // Step 1: seed the wallet config global before any page script runs.
    await page.addInitScript(
      ({ address, chainIdHex, rpcUrl }) => {
        Object.defineProperty(window, "__RADIUS_TEST_WALLET__", {
          value: { address, chainIdHex, rpcUrl },
          configurable: true,
        });
      },
      { address: ADDRESS, chainIdHex: `0x${CHAIN_ID.toString(16)}`, rpcUrl: RPC_URL },
    );
    // Step 2: install the EIP-1193 provider.
    await page.addInitScript({ path: path.join(__dirname, "inject.js") });
    await use(page);
  },
});

export { expect };
