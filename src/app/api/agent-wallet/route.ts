import { NextResponse } from "next/server";
import {
  AGENT_WALLET_ADDRESS,
  AGENT_WALLET_CHAIN,
  fundAgentWallet,
  getAgentWalletBalance,
  getAgentWalletStatus,
  listAgentWallets,
} from "@/lib/agent-wallet";

export const dynamic = "force-dynamic";

type AgentWalletResponse = {
  chain: string;
  configuredAddress: string | null;
  status: Awaited<ReturnType<typeof getAgentWalletStatus>>;
  wallets: Awaited<ReturnType<typeof listAgentWallets>>;
  balance: Awaited<ReturnType<typeof getAgentWalletBalance>> | null;
};

function isAuthorized(request: Request) {
  const token = process.env.AGENT_WALLET_ADMIN_TOKEN;
  // Always require auth — no bypass even if token is unset
  if (!token) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getAgentWalletStatus();
  const wallets = await listAgentWallets();
  const balance = AGENT_WALLET_ADDRESS ? await getAgentWalletBalance() : null;

  const body: AgentWalletResponse = {
    chain: AGENT_WALLET_CHAIN,
    configuredAddress: AGENT_WALLET_ADDRESS || null,
    status,
    wallets,
    balance,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action !== "fund") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const result = await fundAgentWallet();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
