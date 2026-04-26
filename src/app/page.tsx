"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContracts } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRadiusAuth } from "@/lib/web3auth";
import { AppShell } from "@/components/AppShell";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { TokenLogo } from "@/components/TokenLogo";
import { AvatarImage } from "@/components/AvatarImage";
import { QuickActionIcon } from "@/components/QuickActionIcon";
import { arcTestnet } from "@/config/wagmi";
import { formatAmount, getContacts, getIdentityProfile, getLocalTransfers, formatContactLabel } from "@/lib/utils";


function WalletLoginButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <button
            type="button"
            onClick={connected ? (chain.unsupported ? openChainModal : openAccountModal) : openConnectModal}
            className="radius-auth-button secondary justify-center"
          >
            <span>{connected ? (chain.unsupported ? "Switch network" : account.displayName) : "Connect wallet"}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M24 11C12.5 11 5 24 5 24s7.5 13 19 13 19-13 19-13-7.5-13-19-13Zm0 20.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <circle cx="24" cy="24" r="4.2" fill="white" opacity=".92" />
      {hidden && <path d="M8 42 42 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}

function LoginScreen() {
  return (
    <AppShell>
      <div className="screen-pad flex min-h-screen flex-col justify-between pb-8 text-center">
        <div className="flex justify-end"><ThemeToggle /></div>
        <div className="flex flex-1 flex-col justify-center">
          <div className="orb mx-auto mb-12 h-28 w-28 rounded-full" />
          <h1 className="text-5xl font-semibold tracking-[-0.06em] text-[#181521]">Radius</h1>
          <p className="mx-auto mt-4 max-w-52 text-sm leading-6 text-[#5f5a68]">P2P stablecoin payments on Arc Testnet</p>
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-[11px] font-semibold text-[#7a70d8] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#8f7cff]" /> Arc Testnet
          </div>

          <div className="mt-10 space-y-3 text-left">
            <SocialLoginButton label="Press to Continue" />
            <SocialLoginButton method="modal" label="Other social options" className="radius-auth-button secondary justify-center disabled:cursor-not-allowed disabled:opacity-50" />
            <WalletLoginButton />
          </div>
        </div>
        <div className="space-y-7 text-[10px] leading-5 text-[#8f8998]">
          
        </div>

      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { initialized, authenticated, address: authAddress } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const identity = getIdentityProfile();
  const [hideBalance, setHideBalance] = useState(false);
  const [showAssets, setShowAssets] = useState(false);

  const { data: balances } = useReadContracts({
    contracts: address ? (["USDC", "EURC"] as const).map((key) => ({
      address: TOKENS[key].address,
      abi: ERC20_TRANSFER_ABI,
      functionName: "balanceOf",
      args: [address],
      chainId: arcTestnet.id,
    })) : [],
    query: { enabled: !!address },
  });

  const usdcBalance = balances?.[0]?.result as bigint | undefined;
  const eurcBalance = balances?.[1]?.result as bigint | undefined;
  const usdcDisplay = usdcBalance !== undefined ? formatAmount(usdcBalance, TOKENS.USDC.decimals) : "0.00";
  const eurcDisplay = eurcBalance !== undefined ? formatAmount(eurcBalance, TOKENS.EURC.decimals) : "0.00";
  const totalDisplay = (Number(usdcDisplay.replace(/,/g, "")) + Number(eurcDisplay.replace(/,/g, ""))).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const contacts = getContacts().slice(0, 5);
  const recentTransfers = address ? getLocalTransfers(address).slice(0, 3) : [];
  const profileName = identity.displayName || "Arc user";
  const visibleTotal = hideBalance ? "••••••" : totalDisplay;
  const visibleUsdc = hideBalance ? "••••••" : usdcDisplay;
  const visibleEurc = hideBalance ? "••••••" : eurcDisplay;
  const [activityNotice, setActivityNotice] = useState("");
  const balanceSnapshot = useMemo(() => {
    if (!address || usdcBalance === undefined || eurcBalance === undefined) return null;
    return { USDC: usdcBalance, EURC: eurcBalance };
  }, [address, usdcBalance, eurcBalance]);

  useEffect(() => {
    queueMicrotask(() => setHideBalance(localStorage.getItem("radius-hide-balance") === "true"));
  }, []);

  useEffect(() => {
    localStorage.setItem("radius-hide-balance", String(hideBalance));
  }, [hideBalance]);


  useEffect(() => {
    if (!address || !balanceSnapshot) return;
    (["USDC", "EURC"] as const).forEach((symbol) => {
      const key = `radius-last-balance-${address}-${symbol}`;
      const previous = localStorage.getItem(key);
      const current = balanceSnapshot[symbol];
      if (previous && current > BigInt(previous)) {
        const tokenInfo = TOKENS[symbol];
        const delta = current - BigInt(previous);
        const message = `Received ${formatAmount(delta, tokenInfo.decimals)} ${symbol}`;
        setActivityNotice(message);
        window.setTimeout(() => setActivityNotice(""), 4200);
        if ("Notification" in window) {
          if (Notification.permission === "granted") new Notification("Radius activity", { body: message });
          else if (Notification.permission === "default") Notification.requestPermission().then((permission) => {
            if (permission === "granted") new Notification("Radius activity", { body: message });
          });
        }
      }
      localStorage.setItem(key, current.toString());
    });
  }, [address, balanceSnapshot]);

  if (!initialized) {
    return (
      <AppShell>
        <div className="screen-pad flex min-h-screen flex-col items-center justify-center text-center">
          <div className="orb mb-6 h-20 w-20 rounded-full" />
          <p className="text-sm font-semibold text-[#8b8795]">Restoring your Radius session…</p>
        </div>
      </AppShell>
    );
  }

  if (!isConnected) return <LoginScreen />;

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <div className="mb-3 text-2xl font-black text-[#7a70d8]">Radius</div>
            <h1 className="text-base font-semibold text-[#17151f]">Hello, {profileName} 👋</h1>
          </div>
          <ThemeToggle />
        </header>

        {activityNotice && (
          <div className="mb-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-700">
            {activityNotice}
          </div>
        )}

        <section className="gradient-card rounded-[24px] p-5">
          <div className="flex items-center justify-between text-xs text-white/75">
            <span>Total Balance</span><button type="button" aria-label={hideBalance ? "Show balance" : "Hide balance"} onClick={() => setHideBalance((v) => !v)} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-base font-bold text-white"><EyeIcon hidden={hideBalance} /></button>
          </div>
          <p className={`mt-3 text-4xl font-semibold tracking-[-0.06em] ${hideBalance ? "balance-hidden" : ""}`}>${visibleTotal}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-white/18 py-3 text-center text-sm font-semibold">＋ Add Funds</a>
            <Link href="/request" className="rounded-2xl bg-white/18 py-3 text-center text-sm font-semibold">⇩ Receive</Link>
          </div>

        </section>

        <section className="mt-6 grid grid-cols-5 gap-3 text-center">
          {[
            { href: "/send", icon: "send", label: "Send" },
            { href: "/request", icon: "request", label: "Request" },
            { href: "/scan", icon: "scan", label: "Scan" },
            { href: "/contacts", icon: "contacts", label: "Contacts" },
            { href: "/bridge", icon: "bridge", label: "Bridge" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="quick-action text-xs font-semibold text-[#595465]">
              <span className="icon-chip mx-auto mb-2"><QuickActionIcon name={item.icon as "send" | "request" | "scan" | "contacts" | "bridge"} /></span>{item.label}
            </Link>
          ))}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Latest Activities</h2></div>
          <div className="soft-card rounded-2xl p-4">
            {recentTransfers.length === 0 ? (
              <p className="text-sm text-[#8b8795]">No latest activities yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTransfers.map((transfer) => (
                  <Link href="/history" key={transfer.id} className="flex items-center justify-between text-sm">
                    <span>{transfer.direction === "sent" ? "↑" : "↓"} {formatAmount(BigInt(transfer.value), TOKENS[transfer.token].decimals)} {transfer.token}</span>
                    <span className="text-xs text-[#8b8795]">{formatContactLabel(transfer.direction === "sent" ? transfer.to : transfer.from)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Recent Contacts</h2><Link href="/contacts" className="text-xs text-[#8f7cff]">View all</Link></div>
          {contacts.length === 0 ? (
            <div className="soft-card rounded-2xl p-4 text-sm text-[#8b8795]">No contacts saved yet.</div>
          ) : (
            <div className="flex justify-between gap-2">
              {contacts.map((c) => <Link href={`/send?to=${encodeURIComponent(c.handle ? c.handle.replace(/^@/, "") : c.address)}`} key={c.id} className="min-w-0 text-center text-[10px] font-medium text-[#595465]"><div className="mx-auto mb-2 grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[#8f7cff] text-white shadow-sm"><AvatarImage src={c.avatar} fallback={c.name} /></div><span className="block truncate">{c.name}</span></Link>)}
            </div>
          )}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">My Assets</h2><button type="button" onClick={() => setShowAssets(true)} className="text-xs text-[#8f7cff]">Manage</button></div>
          <div className="soft-card overflow-hidden rounded-2xl">
            {[["USDC","USD Coin",visibleUsdc],["EURC","Euro Coin",visibleEurc]].map(([s,n,b], i) => (
              <div key={s} className={`flex items-center justify-between px-4 py-3 ${i ? 'border-t' : ''}`}><div className="flex items-center gap-3"><TokenLogo symbol={s} size={36} /><div><p className="text-sm font-bold">{s}</p><p className="text-xs text-[#9a94a3]">{n}</p></div></div><p className="text-sm font-semibold">{b}</p></div>
            ))}
          </div>
        </section>

        {showAssets && (
          <div className="fixed inset-0 z-[80] grid place-items-end bg-black/30 p-4" onClick={() => setShowAssets(false)}>
            <div className="soft-card w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">My Assets</h3><button onClick={() => setShowAssets(false)} className="ghost-btn px-3 py-2 text-xs">Close</button></div>
              <div className="space-y-3">
                {[["USDC","USD Coin",visibleUsdc],["EURC","Euro Coin",visibleEurc]].map(([s,n,b]) => (
                  <div key={s} className="flex items-center justify-between rounded-2xl bg-white/55 p-3">
                    <div className="flex items-center gap-3"><TokenLogo symbol={s} /><div><p className="text-sm font-bold">{s}</p><p className="text-xs text-[#8b8795]">{n}</p></div></div><p className="text-sm font-semibold">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
