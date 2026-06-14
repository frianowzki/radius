import { NextResponse } from "next/server";

/**
 * GET /api/fx-rate  →  { usdcEurc: number, eurcUsdc: number, source: string, ts: number }
 *
 * Tries Circle's exchange rate API first (needs production CIRCLE_API_KEY),
 * falls back to CoinGecko (free, no key) for real-time USDC/EURC market prices.
 *
 * Response is Cache-Control'd for 60 s at the edge.
 */

let cached: { usdcEurc: number; eurcUsdc: number; source: string; ts: number } | null = null;
let lastFetch = 0;
const CACHE_TTL = 60_000;

async function fetchCircleRate(): Promise<{ usdcEurc: number; eurcUsdc: number } | null> {
  const key = process.env.CIRCLE_API_KEY?.trim();
  if (!key || key.startsWith("TEST_API_KEY")) return null;

  try {
    const res = await fetch("https://api.circle.com/v1/exchange/rates", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rates: Record<string, number> = {};
    for (const entry of data?.data?.exchangeRates ?? []) {
      if (entry?.id && typeof entry?.rate === "number") {
        rates[entry.id] = entry.rate;
      }
    }
    // Circle pairs are typically "USDC-EURC" or similar
    const usdcEurc = rates["USDC-EURC"] ?? rates["USD-EUR"];
    if (typeof usdcEurc === "number" && usdcEurc > 0.5 && usdcEurc < 2) {
      return { usdcEurc, eurcUsdc: 1 / usdcEurc };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchCoinGeckoRate(): Promise<{ usdcEurc: number; eurcUsdc: number } | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,euro-coin&vs_currencies=usd,eur",
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const usdcUsd = data?.["usd-coin"]?.usd;
    const eurcUsd = data?.["euro-coin"]?.usd;
    if (typeof usdcUsd === "number" && typeof eurcUsd === "number" && eurcUsd > 0) {
      const usdcEurc = usdcUsd / eurcUsd;
      return { usdcEurc, eurcUsdc: eurcUsd / usdcUsd };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cached && now - lastFetch < CACHE_TTL) {
    return NextResponse.json(cached, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }

  let result = await fetchCircleRate();
  let source = "circle";
  if (!result) {
    result = await fetchCoinGeckoRate();
    source = "coingecko";
  }
  if (!result) {
    // Hard fallback
    result = { usdcEurc: 0.926, eurcUsdc: 1.08 };
    source = "fallback";
  }

  cached = { ...result, source, ts: now };
  lastFetch = now;

  return NextResponse.json(cached, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
