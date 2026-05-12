import { NextResponse } from "next/server";
import type { AccountType, Blockchain } from "@circle-fin/user-controlled-wallets";
import {
  CIRCLE_USER_WALLET_ACCOUNT_TYPE,
  CIRCLE_USER_WALLET_CHAIN,
  circleErrorMessage,
  getCircleUserWalletsClient,
  normalizeCircleUserId,
  normalizeUserToken,
} from "@/lib/circle-user-wallets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WalletAction = "create-user" | "token" | "initialize" | "wallets" | "balances";

type RequestBody = {
  action?: WalletAction;
  userId?: string;
  userToken?: string;
  walletId?: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return json({
    chain: CIRCLE_USER_WALLET_CHAIN,
    accountType: CIRCLE_USER_WALLET_ACCOUNT_TYPE,
    appId: process.env.CIRCLE_APP_ID || process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "",
    appIdConfigured: Boolean(process.env.CIRCLE_APP_ID || process.env.NEXT_PUBLIC_CIRCLE_APP_ID),
    apiConfigured: Boolean(process.env.CIRCLE_API_KEY),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const client = getCircleUserWalletsClient();

    if (body.action === "create-user") {
      const userId = normalizeCircleUserId(body.userId);
      const result = await client.createUser({ userId });
      return json({ ok: true, data: result.data });
    }

    if (body.action === "token") {
      const userId = normalizeCircleUserId(body.userId);
      const result = await client.createUserToken({ userId });
      return json({ ok: true, data: result.data });
    }

    if (body.action === "initialize") {
      const userToken = normalizeUserToken(body.userToken);
      const result = await client.createUserPinWithWallets({
        userToken,
        blockchains: [CIRCLE_USER_WALLET_CHAIN as Blockchain],
        accountType: (CIRCLE_USER_WALLET_ACCOUNT_TYPE === "SCA" ? "SCA" : "EOA") as AccountType,
        idempotencyKey: crypto.randomUUID(),
      });
      return json({ ok: true, data: result.data });
    }

    if (body.action === "wallets") {
      const userToken = normalizeUserToken(body.userToken);
      const result = await client.listWallets({ userToken, blockchain: CIRCLE_USER_WALLET_CHAIN as Blockchain });
      return json({ ok: true, data: result.data });
    }

    if (body.action === "balances") {
      const userToken = normalizeUserToken(body.userToken);
      const walletId = String(body.walletId ?? "").trim();
      if (!walletId) throw new Error("Missing wallet ID");
      const result = await client.getWalletTokenBalance({ userToken, walletId });
      return json({ ok: true, data: result.data });
    }

    return json({ ok: false, error: "Unsupported action" }, 400);
  } catch (error) {
    const circleError = circleErrorMessage(error);
    const status = circleError.status && circleError.status >= 400 ? circleError.status : 400;
    return json({ ok: false, error: circleError.message, code: circleError.code }, status);
  }
}
