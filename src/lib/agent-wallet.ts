import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const AGENT_WALLET_CHAIN = process.env.CIRCLE_AGENT_WALLET_CHAIN || "ARC-TESTNET";
export const AGENT_WALLET_ADDRESS = process.env.CIRCLE_AGENT_WALLET_ADDRESS || "";

export type CircleCliResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function runCircle(args: string[]) {
  const { stdout } = await execFileAsync("circle", args, {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: process.env,
  });
  return stdout.trim();
}

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

export async function getAgentWalletStatus(): Promise<CircleCliResult> {
  try {
    const output = await runCircle(["wallet", "status", "--type", "agent", "--output", "json"]);
    return { ok: true, data: parseJson(output) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unable to read Circle wallet status" };
  }
}

export async function listAgentWallets(chain = AGENT_WALLET_CHAIN): Promise<CircleCliResult> {
  try {
    const output = await runCircle(["wallet", "list", "--chain", chain, "--type", "agent", "--output", "json"]);
    return { ok: true, data: parseJson(output) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unable to list Circle agent wallets" };
  }
}

export async function getAgentWalletBalance(address = AGENT_WALLET_ADDRESS, chain = AGENT_WALLET_CHAIN): Promise<CircleCliResult> {
  if (!address) return { ok: false, error: "CIRCLE_AGENT_WALLET_ADDRESS is not configured" };
  try {
    const output = await runCircle(["wallet", "balance", "--address", address, "--chain", chain, "--output", "json"]);
    return { ok: true, data: parseJson(output) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unable to read Circle agent wallet balance" };
  }
}

export async function fundAgentWallet(address = AGENT_WALLET_ADDRESS, chain = AGENT_WALLET_CHAIN): Promise<CircleCliResult> {
  if (!address) return { ok: false, error: "CIRCLE_AGENT_WALLET_ADDRESS is not configured" };
  try {
    const output = await runCircle(["wallet", "fund", "--address", address, "--chain", chain, "--token", "usdc", "--output", "json"]);
    return { ok: true, data: output ? parseJson(output) : { message: "Funding requested" } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unable to fund Circle agent wallet" };
  }
}
