"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string; code?: number };
type TokenData = { userToken?: string; encryptionKey?: string };
type Wallet = { id?: string; address?: string; blockchain?: string; accountType?: string; state?: string };
type Balance = { token?: { symbol?: string; name?: string }; amount?: string; symbol?: string; name?: string };

const storageKey = "radius-circle-user-wallet";

async function postCircle<T>(body: Record<string, unknown>) {
  const response = await fetch("/api/user-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !json.ok) {
    const error = new Error(json.error || "Circle request failed") as Error & { code?: number };
    error.code = json.code;
    throw error;
  }
  return json.data as T;
}

export default function UserWalletPage() {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [appId, setAppId] = useState("");
  const [userId, setUserId] = useState("");
  const [credentials, setCredentials] = useState<TokenData | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [status, setStatus] = useState("Ready to create a user-controlled wallet.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { userId?: string; credentials?: TokenData };
      if (parsed.userId) setUserId(parsed.userId);
      if (parsed.credentials?.userToken && parsed.credentials?.encryptionKey) setCredentials(parsed.credentials);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    if (!userId && !credentials) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ userId, credentials }));
  }, [userId, credentials]);

  useEffect(() => {
    let cancelled = false;
    async function initSdk() {
      try {
        // Read from client-side env var (already bundled in NEXT_PUBLIC_* client JS)
        const nextAppId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID?.trim() || "";
        if (!nextAppId) {
          setStatus("Missing Circle User-Controlled Wallet App ID. Add NEXT_PUBLIC_CIRCLE_APP_ID in Vercel/local env first.");
          return;
        }
        setAppId(nextAppId);
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        const sdk = new W3SSdk({ appSettings: { appId: nextAppId } });
        await sdk.getDeviceId();
        if (cancelled) return;
        sdkRef.current = sdk;
        setSdkReady(true);
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Unable to load Circle SDK");
      }
    }
    void initSdk();
    return () => { cancelled = true; };
  }, []);

  const primaryWallet = useMemo(() => wallets.find((w) => w.blockchain === "ARC-TESTNET") ?? wallets[0], [wallets]);

  const loadWallets = useCallback(async (token = credentials?.userToken) => {
    if (!token) return;
    const data = await postCircle<{ wallets?: Wallet[] }>({ action: "wallets", userToken: token });
    const nextWallets = data.wallets ?? [];
    setWallets(nextWallets);
    const wallet = nextWallets.find((w) => w.blockchain === "ARC-TESTNET") ?? nextWallets[0];
    if (wallet?.id) {
      const balanceData = await postCircle<{ tokenBalances?: Balance[] }>({ action: "balances", userToken: token, walletId: wallet.id });
      setBalances(balanceData.tokenBalances ?? []);
    }
  }, [credentials?.userToken]);

  async function runStep(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
    } catch (error) {
      const err = error as Error & { code?: number };
      if (err.code === 155106) {
        setStatus("Wallet already initialized. Loading existing wallet…");
        await loadWallets();
      } else {
        setStatus(err.message || "Action failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function createUser() {
    await runStep("Creating Circle user…", async () => {
      await postCircle({ action: "create-user", userId });
      setStatus("User created. Next: get a session token.");
    });
  }

  async function getToken() {
    await runStep("Creating user session token…", async () => {
      const data = await postCircle<TokenData>({ action: "token", userId });
      setCredentials(data);
      setStatus("Session ready. Next: initialize the PIN wallet.");
    });
  }

  async function initializeWallet() {
    await runStep("Creating PIN setup challenge…", async () => {
      if (!credentials?.userToken) throw new Error("Get a user token first");
      const data = await postCircle<{ challengeId?: string }>({ action: "initialize", userToken: credentials.userToken });
      if (!data.challengeId) throw new Error("Circle did not return a challenge ID");
      setChallengeId(data.challengeId);
      setStatus("Challenge ready. Open Circle PIN setup to finish wallet creation.");
    });
  }

  function executeChallenge() {
    const sdk = sdkRef.current;
    if (!sdk || !credentials?.userToken || !credentials.encryptionKey || !challengeId) return;
    sdk.setAuthentication({ userToken: credentials.userToken, encryptionKey: credentials.encryptionKey });
    setStatus("Complete the PIN setup in Circle's secure modal.");
    sdk.execute(challengeId, (error) => {
      if (error) {
        setStatus(error.message || "Circle challenge failed");
        return;
      }
      setChallengeId("");
      setStatus("Wallet created. Loading wallet…");
      window.setTimeout(() => void loadWallets(credentials.userToken), 1500);
    });
  }

  const canUseUserId = userId.trim().length >= 5 && !busy;

  return (
    <AppShell>
      <div className="min-h-screen px-5 pb-28 pt-8 text-slate-950">
        <section className="rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-xl shadow-blue-950/10 backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Circle User-Controlled Wallets</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">User owns the wallet</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This uses Circle User-Controlled Wallets with PIN auth on Arc Testnet. Users approve setup and future signing in Circle&apos;s secure UI; Radius never receives private keys and cannot move funds alone.
          </p>
        </section>

        <section className="mt-5 space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-xl shadow-blue-950/10 backdrop-blur">
          <label className="block text-sm font-semibold">
            Circle user ID
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="email, username, or stable app user id"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-3">
            <button type="button" onClick={createUser} disabled={!canUseUserId} className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50">1. Create user</button>
            <button type="button" onClick={getToken} disabled={!canUseUserId} className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white shadow-lg shadow-slate-950/10 disabled:opacity-50">2. Get user token</button>
            <button type="button" onClick={initializeWallet} disabled={busy || !credentials?.userToken} className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-950 shadow-sm disabled:opacity-50">3. Create PIN wallet challenge</button>
            <button type="button" onClick={executeChallenge} disabled={busy || !sdkReady || !challengeId} className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50">4. Open Circle PIN setup</button>
          </div>

          <p className="rounded-2xl bg-slate-950/5 p-3 text-sm text-slate-600">{busy ? "Working… " : ""}{status}</p>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div className="rounded-2xl bg-slate-950/5 p-3"><strong className="block text-slate-900">SDK</strong>{sdkReady ? "Ready" : "Not ready"}</div>
            <div className="rounded-2xl bg-slate-950/5 p-3"><strong className="block text-slate-900">App ID</strong>{appId ? "Configured" : "Missing"}</div>
          </div>
        </section>

        <section className="mt-5 space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-xl shadow-blue-950/10 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Wallet</h2>
            <button type="button" onClick={() => void loadWallets()} disabled={busy || !credentials?.userToken} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50">Refresh</button>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Arc Testnet address</div>
            <code className="mt-2 block break-all rounded-2xl bg-slate-950/5 p-3 text-xs">{primaryWallet?.address || "No wallet loaded yet"}</code>
          </div>

          {balances.length ? (
            <div className="space-y-2">
              {balances.map((balance, index) => (
                <div key={`${balance.symbol ?? balance.token?.symbol ?? index}`} className="flex items-center justify-between rounded-2xl bg-slate-950/5 px-4 py-3 text-sm">
                  <span>{balance.symbol ?? balance.token?.symbol ?? balance.name ?? "Token"}</span>
                  <strong>{balance.amount ?? "0"}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No balances loaded yet.</p>
          )}
        </section>

        <section className="mt-5 space-y-2 rounded-[28px] border border-white/60 bg-white/75 p-5 text-sm text-slate-600 shadow-xl shadow-blue-950/10 backdrop-blur">
          <h2 className="text-lg font-bold text-slate-950">Choice</h2>
          <p>Choose <strong>User-Controlled Wallets</strong>, not Developer-Controlled or Agent Wallets. For Radius on Arc Testnet, I defaulted this integration to EOA because it is simplest and gives each user direct control.</p>
          <Link href="/" className="inline-block font-semibold text-blue-600">Back home</Link>
        </section>
      </div>
    </AppShell>
  );
}
