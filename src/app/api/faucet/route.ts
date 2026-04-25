import { NextResponse } from "next/server";
import { isAddress } from "viem";

const SUPPORTED_BLOCKCHAINS = new Set([
  "ARC-TESTNET",
  "ETH-SEPOLIA",
  "BASE-SEPOLIA",
  "ARB-SEPOLIA",
]);

export async function POST(req: Request) {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Circle API key is not configured on the server.",
        fallbackUrl: "https://faucet.circle.com/",
      },
      { status: 501 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    address?: string;
    blockchain?: string;
    token?: "usdc" | "eurc";
  } | null;

  const address = body?.address?.trim();
  const blockchain = body?.blockchain?.trim().toUpperCase();
  const token = body?.token === "eurc" ? "eurc" : "usdc";

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Valid EVM address required." }, { status: 400 });
  }

  if (!blockchain || !SUPPORTED_BLOCKCHAINS.has(blockchain)) {
    return NextResponse.json({ error: "Unsupported faucet chain." }, { status: 400 });
  }

  const res = await fetch("https://api.circle.com/v1/faucet/drips", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      blockchain,
      usdc: token === "usdc",
      eurc: token === "eurc",
    }),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Circle faucet request failed.", details: data },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true, data });
}
