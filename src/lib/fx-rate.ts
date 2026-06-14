"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Live USDC↔EURC conversion rate from Circle (production key) or CoinGecko.
 *
 *   EURC → USD:  eurcAmount × eurUsdRate
 *   USD → EURC:  usdAmount / eurUsdRate
 *
 * Fetches from /api/fx-rate with 60 s client-side cache.
 * Falls back to 1.08 if unreachable.
 */
const FALLBACK_RATE = 1.08;
const CACHE_KEY = "radius-fx-rate";
const CACHE_TTL_MS = 60_000;

type FxResponse = { usdcEurc: number; eurcUsdc: number; source: string; ts: number };

let inFlight: Promise<number> | null = null;
let lastFetch = 0;

async function fetchRate(): Promise<number> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL_MS) {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: FxResponse = JSON.parse(raw);
        if (typeof cached.eurcUsdc === "number") return cached.eurcUsdc;
      }
    } catch { /* noop */ }
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/fx-rate", { cache: "no-store" });
      const data: FxResponse = await res.json();
      if (typeof data.eurcUsdc === "number" && data.eurcUsdc > 0.5 && data.eurcUsdc < 2) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* noop */ }
        lastFetch = Date.now();
        return data.eurcUsdc;
      }
      return FALLBACK_RATE;
    } catch {
      return FALLBACK_RATE;
    }
  })();

  const result = await inFlight;
  inFlight = null;
  return result;
}

/** Returns { rate, loading, eurcToUsd, usdToEurc } — rate is EUR/USD. */
export function useEurUsdRate() {
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRate().then((r) => {
      if (!cancelled) { setRate(r); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  /** Convert EURC amount (numeric) to USD equivalent. */
  const eurcToUsd = useCallback((eurcAmount: number) => eurcAmount * rate, [rate]);

  /** Convert USD amount to EURC equivalent. */
  const usdToEurc = useCallback((usdAmount: number) => usdAmount / rate, [rate]);

  return { rate, loading, eurcToUsd, usdToEurc };
}
