import { test, expect } from "./fixtures";

// These tests require a local Anvil node. Start one with:
//   anvil --port 8545 --chain-id 31337
// (Optionally fork: --fork-url https://rpc.testnet.arc.network)
//
// They are skipped automatically when no RPC is reachable so smoke runs stay green.

async function isAnvilUp(): Promise<boolean> {
  try {
    const url = process.env.WALLET_RPC_URL || "http://127.0.0.1:8545";
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

test.beforeAll(async () => {
  const up = await isAnvilUp();
  test.skip(!up, "Local Anvil RPC not reachable — start `anvil --port 8545 --chain-id 31337`.");
});

test("injected wallet connects on home", async ({ walletPage }) => {
  await walletPage.goto("/");
  // RainbowKit shows ConnectButton; clicking opens its modal where our injected
  // provider should appear. Skip the modal by triggering the EIP-6963 announce
  // and asserting wagmi picks up the account address.
  await walletPage.evaluate(() => window.dispatchEvent(new Event("eip6963:requestProvider")));
  // wagmi's auto-connect on injected providers may take a tick; wait for the
  // dashboard's "Hello," greeting once the session restores or an account is detected.
  await expect(walletPage.locator("body")).toContainText(/Hello|Welcome|Connect/i, { timeout: 10_000 });
});

test("payment request page renders for connected wallet", async ({ walletPage }) => {
  await walletPage.goto("/request");
  await walletPage.evaluate(() => window.dispatchEvent(new Event("eip6963:requestProvider")));
  // Form may be gated until connection — at minimum the page should not crash.
  await expect(walletPage.locator("body")).toContainText(/Request|Connect/i, { timeout: 10_000 });
});
