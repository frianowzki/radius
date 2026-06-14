"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Live EUR/USD rate — since USDC is USD-pegged and EURC is EUR-pegged,
 * this rate converts between them:
 *   EURC → USD:  eurcAmount × eurUsdRate
 *   USD → EURC:  usdAmount / eurUsdRate
 *
 * Fetches from frankfurter.app (free, no key, ECB data) with 60 s cache.
 * Falls back to 1.08 if the API is unreachable.
 */
const FALLBACK_RATE = 1.08;
const CACHE_KEY = "radius-eur-usd-rate";
const CACHE_TTL_MS = 60_000;

let inFlight: Promise<number> | null = null;
let lastFetch = 0;

async function fetchRate(): Promise<number> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL_MS) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) return Number(cached);
    } catch { /* noop */ }
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", { cache: "no-store" });
      const data = await res.json();
      const rate = data?.rates?.USD;
      if (typeof rate === "number" && rate > 0.5 && rate < 2) {
        try { sessionStorage.setItem(CACHE_KEY, String(rate)); } catch { /* noop */ }
        lastFetch = Date.now();
        return rate;
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

/** Returns { rate, loading } — rate is EUR/USD (≈1.08). */
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
