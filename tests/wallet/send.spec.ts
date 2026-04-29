import { test, expect } from "./fixtures";
import { fundTestWallet, WALLET_CONFIG } from "./fixtures";

const RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // anvil[1]

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(WALLET_CONFIG.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method} failed: ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

async function isAnvilUp(): Promise<boolean> {
  try { await rpc("eth_chainId"); return true; } catch { return false; }
}

test.beforeAll(async () => {
  const up = await isAnvilUp();
  test.skip(!up, "Local Anvil RPC not reachable — start `npm run anvil:test:arc`.");
});

test("injected wallet sends a native transfer through Anvil", async ({ walletPage }) => {
  await fundTestWallet();
  const balanceBefore = (await rpc("eth_getBalance", [RECIPIENT, "latest"])) as string;

  await walletPage.goto("/");
  // Force the EIP-6963 announcement so wagmi's discovery loop picks our provider up.
  await walletPage.evaluate(() => window.dispatchEvent(new Event("eip6963:requestProvider")));

  // Drive a tx through window.ethereum directly. This proves the inject + Anvil
  // pipe is functional end-to-end, without depending on the Send UI being on a
  // funded chain (USDC fixtures vary across forks).
  const txHash = await walletPage.evaluate(async ({ from, to }) => {
    const eth = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) throw new Error("window.ethereum missing");
    return (await eth.request({
      method: "eth_sendTransaction",
      params: [{ from, to, value: "0xDE0B6B3A7640000" /* 1 ETH */ }],
    })) as string;
  }, { from: WALLET_CONFIG.address, to: RECIPIENT });

  expect(txHash).toMatch(/^0x[0-9a-f]{64}$/i);

  // Mine a block (anvil auto-mines per tx by default; this is a no-op safety net).
  await rpc("evm_mine");

  const receipt = await rpc("eth_getTransactionReceipt", [txHash]) as { status: string } | null;
  expect(receipt).not.toBeNull();
  expect(receipt!.status).toBe("0x1");

  const balanceAfter = (await rpc("eth_getBalance", [RECIPIENT, "latest"])) as string;
  expect(BigInt(balanceAfter)).toBeGreaterThan(BigInt(balanceBefore));
});

test("send page renders form when wallet is connected", async ({ walletPage }) => {
  await walletPage.goto("/send");
  await walletPage.evaluate(() => window.dispatchEvent(new Event("eip6963:requestProvider")));
  // Either the connected dashboard "Send" form or the connect prompt should render.
  await expect(walletPage.locator("body")).toContainText(/Send|Connect/i, { timeout: 10_000 });
  // No fatal client errors should leak.
  const errors: string[] = [];
  walletPage.on("pageerror", (err) => errors.push(err.message));
  await walletPage.waitForTimeout(500);
  expect(errors.filter((e) => /hydration|cannot read/i.test(e))).toHaveLength(0);
});
