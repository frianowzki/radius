"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { AppShell } from "@/components/AppShell";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { formatAmount, getIdentityProfile, searchDirectoryEntries } from "@/lib/utils";
import { hasConfiguredPrivy } from "@/lib/privy";

const ACTIONS = [
  { href: "/send", label: "Send", icon: "↗" },
  { href: "/request", label: "Request", icon: "↓" },
  { href: "/contacts", label: "Scan", icon: "⌗" },
  { href: "/send", label: "Swap", icon: "⇄" },
];

const CONTACTS = ["Jamie", "Taylor", "Sam", "Morgan", "Casey"];

function RadiusOrb() {
  return (
    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_20%,_#ffffff,_#a991ff_36%,_#7d6dff_68%,_rgba(125,109,255,0.35))] shadow-[0_24px_70px_rgba(126,109,255,0.45)]">
      <span className="text-4xl font-bold text-white/80">R</span>
    </div>
  );
}

function SmallTokenRow({ symbol, name, balance }: { symbol: string; name: string; balance: string }) {
  return (
    <div className="flex items-center justify-between rounded-3xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.07]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#183B5C] text-sm font-bold text-white">
          {symbol[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#17151f] dark:text-white">{symbol}</p>
          <p className="text-xs text-zinc-500">{name}</p>
        </div>
      </div>
      <p className="text-sm font-semibold text-[#17151f] dark:text-white">{balance}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const address = wagmiAddress ?? (wallets[0]?.address as `0x${string}` | undefined);
  const isConnected = wagmiConnected || authenticated;
  const identity = getIdentityProfile();
  const [quickSearch, setQuickSearch] = useState("");

  const quickMatches = useMemo(
    () => searchDirectoryEntries(quickSearch, address).filter((entry) => entry.address && entry.kind === "contact").slice(0, 4),
    [quickSearch, address]
  );

  const { data: nativeBalance, isLoading: nativeLoading } = useBalance({
    address,
    query: { enabled: !!address },
  });

  const { data: eurcBalance, isLoading: eurcLoading } = useReadContract({
    address: TOKENS.EURC.address,
    abi: ERC20_TRANSFER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!isConnected) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-1 pb-4 pt-4">
          <section className="rounded-[36px] bg-white/78 px-6 py-8 text-center shadow-[0_28px_90px_rgba(42,32,92,0.12)] ring-1 ring-black/[0.04] backdrop-blur-xl dark:bg-white/[0.06]">
            <RadiusOrb />
            <h1 className="mt-8 text-5xl font-semibold tracking-tight text-[#17151f] dark:text-white">Radius</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-zinc-500">
              P2P stablecoin payments on Arc Testnet.
            </p>
            <div className="mx-auto mt-4 inline-flex rounded-full bg-[#f2efff] px-4 py-2 text-xs font-semibold text-[#6f60d5] dark:bg-white/10 dark:text-white">
              Arc Testnet
            </div>

            <div className="mt-10 space-y-3 text-left">
              {hasConfiguredPrivy && <SocialLoginButton className="radius-auth-button" />}
              <div className="radius-auth-button opacity-80">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef1f5] text-sm">◈</span>
                <span className="flex-1 text-center">Connect Wallet</span>
                <span className="text-zinc-400">›</span>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-xs text-xs leading-5 text-zinc-400">
              Your keys stay in your control. Radius never accesses your funds.
            </p>
          </section>
        </div>
      </AppShell>
    );
  }

  const usdcDisplay = nativeLoading
    ? "—"
    : nativeBalance?.value !== undefined
      ? formatAmount(nativeBalance.value, 18)
      : "0.00";
  const eurcDisplay = eurcLoading
    ? "—"
    : eurcBalance !== undefined
      ? formatAmount(eurcBalance as bigint, TOKENS.EURC.decimals)
      : "0.00";

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-5 lg:max-w-6xl">
        <section className="flex items-center justify-between px-1 pt-1">
          <div>
            <p className="text-sm text-zinc-500">Good morning,</p>
            <h1 className="text-2xl font-semibold text-[#17151f] dark:text-white">
              {identity.displayName || "Radius user"} 👋
            </h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-xl shadow-sm ring-1 ring-black/[0.04] dark:bg-white/10">
            R
          </div>
        </section>

        <section className="rounded-[32px] bg-[linear-gradient(135deg,_#8f7cff,_#83cfff)] p-5 text-white shadow-[0_24px_80px_rgba(126,109,255,0.35)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/75">Total Balance</p>
            <span className="rounded-full bg-white/18 px-3 py-1 text-xs text-white/80">USD</span>
          </div>
          <p className="mt-4 text-4xl font-semibold tracking-tight">${usdcDisplay}</p>
          <p className="mt-1 text-sm text-white/70">≈ {usdcDisplay} USDC</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/faucet" className="rounded-2xl bg-white/18 px-4 py-3 text-center text-sm font-semibold backdrop-blur">
              + Add Funds
            </Link>
            <Link href="/request" className="rounded-2xl bg-white/18 px-4 py-3 text-center text-sm font-semibold backdrop-blur">
              Receive
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-3">
          {ACTIONS.map((action) => (
            <Link key={action.label} href={action.href} className="flex flex-col items-center gap-2 rounded-3xl bg-white/70 p-3 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.07]">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1efff] text-lg text-[#7d6dff] dark:bg-white/10 dark:text-white">
                {action.icon}
              </span>
              <span className="text-[11px] font-medium text-zinc-500">{action.label}</span>
            </Link>
          ))}
        </section>

        <section className="rounded-[30px] bg-white/68 p-4 shadow-sm ring-1 ring-black/[0.04] backdrop-blur dark:bg-white/[0.06]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#17151f] dark:text-white">Quick send</h2>
            <Link href={`/send${quickSearch.trim() ? `?to=${encodeURIComponent(quickSearch.trim())}` : ""}`} className="text-xs font-semibold text-[#7d6dff]">
              Send
            </Link>
          </div>
          <input
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="@username, name, or 0x address"
            className="w-full rounded-2xl border border-black/[0.04] bg-white/80 px-4 py-3 text-sm text-[#17151f] outline-none placeholder:text-zinc-400 dark:bg-white/10 dark:text-white"
          />
          {quickMatches.length > 0 && (
            <div className="mt-3 space-y-2">
              {quickMatches.map((entry) => (
                <Link key={`${entry.handle}-${entry.address}`} href={`/send?to=${entry.handle ? `@${entry.handle}` : entry.address}`} className="block rounded-2xl bg-white/70 px-4 py-3 text-sm text-[#17151f] dark:bg-white/10 dark:text-white">
                  {entry.name} {entry.handle ? <span className="text-zinc-500">@{entry.handle}</span> : null}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[30px] bg-white/68 p-4 shadow-sm ring-1 ring-black/[0.04] backdrop-blur dark:bg-white/[0.06]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#17151f] dark:text-white">Recent Contacts</h2>
            <Link href="/contacts" className="text-xs font-semibold text-zinc-500">View all</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {CONTACTS.map((name) => (
              <div key={name} className="shrink-0 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[#183B5C] dark:text-white">
                  {name[0]}
                </div>
                <p className="mt-2 text-xs text-zinc-500">{name}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-base font-semibold text-[#17151f] dark:text-white">My Wallets</h2>
          <SmallTokenRow symbol="USDC" name="USD Coin" balance={usdcDisplay} />
          <SmallTokenRow symbol="EURC" name="Euro Coin" balance={eurcDisplay} />
        </section>
      </div>
    </AppShell>
  );
}
