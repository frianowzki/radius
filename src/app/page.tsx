"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { AppShell } from "@/components/AppShell";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import { formatAmount, getIdentityProfile } from "@/lib/utils";
import { hasConfiguredProjectId } from "@/lib/reown";
import Link from "next/link";
import { IdentityCard } from "@/components/IdentityCard";

function BalanceCard({
  symbol,
  balance,
  decimals,
  isLoading,
}: {
  symbol: string;
  balance: bigint | undefined;
  decimals: number;
  isLoading: boolean;
}) {
  return (
    <div className="glass-panel rounded-[28px] p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{symbol}</p>
        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Wallet
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-glow">
        {isLoading ? (
          <span className="inline-block h-8 w-32 animate-pulse rounded-lg bg-white/8" />
        ) : balance !== undefined ? (
          formatAmount(balance, decimals)
        ) : (
          "—"
        )}
      </p>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: "/send", label: "Send", icon: "↗", color: "from-indigo-500 to-violet-600", blurb: "Move stablecoins in a few taps." },
  { href: "/request", label: "Request", icon: "⬇", color: "from-emerald-500 to-teal-600", blurb: "Share a payment link or QR instantly." },
  { href: "/contacts", label: "Contacts", icon: "◎", color: "from-amber-500 to-orange-600", blurb: "Keep trusted people one tap away." },
  { href: "/history", label: "History", icon: "☰", color: "from-sky-500 to-blue-600", blurb: "Track every payment moment cleanly." },
];

const HERO_PILLS = ["Crosschain-ready", "Stablecoin-native", "Receipt-first"];

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const identity = getIdentityProfile();

  const { data: nativeBalance, isLoading: nativeLoading } = useBalance({
    address,
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
        <div className="mx-auto flex min-h-[72vh] max-w-5xl items-center justify-center">
          <div className="glass-panel-strong w-full rounded-[32px] p-8 lg:p-12">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-indigo-500/25 via-violet-500/20 to-emerald-400/20 text-4xl shadow-2xl shadow-indigo-500/20 lg:mx-0">
                  ◈
                </div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.34em] text-zinc-500">Arc P2P</p>
                <h2 className="mb-4 text-4xl font-semibold tracking-tight text-glow lg:text-5xl">
                  Stablecoin payments with a sharper interface.
                </h2>
                <p className="max-w-2xl text-base leading-7 text-zinc-400 lg:text-lg">
                  Send, request, and track USDC or EURC on Arc Testnet with a cleaner wallet flow and faster payment links.
                </p>
                <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Pay fast</p>
                    <p className="mt-2 text-sm text-zinc-500">Quick send flow for wallet-to-wallet transfers.</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Request cleanly</p>
                    <p className="mt-2 text-sm text-zinc-500">Share links and QR codes in one step.</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Stay visible</p>
                    <p className="mt-2 text-sm text-zinc-500">Keep balances, contacts, and history in one place.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-6">
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Onboarding status</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
                  Browser wallet login is live.
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {hasConfiguredProjectId
                    ? "This build now exposes a real social or email auth entry for mobile-friendly onboarding alongside browser wallets."
                    : "This build is wallet-first right now. Social or email auth UI is wired, but it still needs a real NEXT_PUBLIC_REOWN_PROJECT_ID before it can actually work."}
                </p>
                <div className="mt-6 rounded-[24px] border border-white/8 bg-black/20 p-4">
                  <p className="text-sm font-medium text-zinc-100">Best way to start</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    On mobile, social or email auth is the cleaner path once Reown config is active. Otherwise use an injected wallet like MetaMask, Rabby, or a wallet in-app browser.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <SocialLoginButton className="rounded-2xl border border-indigo-500/25 bg-indigo-500/12 px-4 py-3 text-sm font-medium text-indigo-100 transition-colors hover:bg-indigo-500/18 disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-zinc-400" />
                  </div>
                </div>
                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                    <span className="text-zinc-200">Injected/browser wallet</span>
                    <span className="font-medium text-emerald-300">Live</span>
                  </div>
                  <div className={`flex items-start justify-between gap-4 rounded-2xl px-4 py-3 ${hasConfiguredProjectId ? "border border-indigo-500/20 bg-indigo-500/10" : "border border-white/8 bg-white/[0.03]"}`}>
                    <span className={hasConfiguredProjectId ? "text-zinc-200" : "text-zinc-400"}>Social or email auth entry</span>
                    <span className={`font-medium ${hasConfiguredProjectId ? "text-indigo-300" : "text-zinc-500"}`}>{hasConfiguredProjectId ? "Enabled" : "Needs config"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <span className="text-zinc-400">Embedded wallet production-ready flow</span>
                    <span className="font-medium text-zinc-500">Not finalized</span>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-zinc-200">On mobile</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Use social or email auth once configured, or use an in-app browser from a wallet that injects Ethereum support. Standard mobile browsers may show no injected wallet at all.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-zinc-200">If nothing appears</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      That usually means no injected wallet is present yet. {hasConfiguredProjectId ? "Use the social or email button instead." : "Set NEXT_PUBLIC_REOWN_PROJECT_ID to a real Reown project id to enable the social or email route."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="glass-panel-strong overflow-hidden rounded-[32px] p-8 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap gap-2">
                {HERO_PILLS.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-zinc-400"
                  >
                    {pill}
                  </span>
                ))}
              </div>
              <p className="mb-3 text-[11px] uppercase tracking-[0.34em] text-zinc-500">Arc Flow</p>
              <h2 className="text-4xl font-semibold tracking-tight text-glow lg:text-5xl">
                Crosschain social payments, designed like a product, not a wallet.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 lg:text-lg">
                Send money fast, request with identity, and turn every transfer into a clean receipt that feels native to Arc’s stablecoin rail.
              </p>
            </div>
            <div className="grid gap-3 sm:min-w-[340px] sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Headline</p>
                <p className="mt-2 text-sm font-medium text-zinc-100">USDC payments that feel immediate.</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Next layer</p>
                <p className="mt-2 text-sm font-medium text-zinc-100">Crosschain routing and social receipts.</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-200">Balances</h3>
            <p className="text-sm text-zinc-500">Live wallet state</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BalanceCard
              symbol="USDC"
              balance={nativeBalance?.value}
              decimals={18}
              isLoading={nativeLoading}
            />
            <BalanceCard
              symbol="EURC"
              balance={eurcBalance as bigint | undefined}
              decimals={TOKENS.EURC.decimals}
              isLoading={eurcLoading}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-200">Quick actions</h3>
              <p className="text-sm text-zinc-500">The stuff you actually do</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="glass-panel group flex min-h-[170px] flex-col justify-between rounded-[28px] p-5 transition-all hover:-translate-y-1 hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div
                    className={`flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${action.color} text-xl shadow-lg shadow-black/20 transition-transform group-hover:scale-110`}
                  >
                    {action.icon}
                  </div>
                  <div>
                    <span className="text-base font-semibold text-zinc-100">
                      {action.label}
                    </span>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{action.blurb}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <IdentityCard profile={identity} />
            <div className="glass-panel rounded-[28px] p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500 mb-4">
                Why this feels different
              </h3>
              <div className="space-y-4 text-sm">
                <div className="border-b border-white/8 pb-4">
                  <p className="text-zinc-100 font-medium">Immediate flow</p>
                  <p className="mt-2 leading-6 text-zinc-500">The UI should feel sub-second and decisive, not like waiting in a bloated wallet app.</p>
                </div>
                <div className="border-b border-white/8 pb-4">
                  <p className="text-zinc-100 font-medium">Request-first payments</p>
                  <p className="mt-2 leading-6 text-zinc-500">Requests, notes, and QR should feel like product surfaces, not hidden utility tools.</p>
                </div>
                <div>
                  <p className="text-zinc-100 font-medium">Crosschain-ready identity</p>
                  <p className="mt-2 leading-6 text-zinc-500">Today: stablecoin sends on Arc. Next: routed transfers, social receipts, and identity-rich payment moments.</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm">
                <span className="text-zinc-500">Explorer</span>
                <a
                  href={arcTestnet.blockExplorers.default.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-400 hover:text-indigo-300"
                >
                  ArcScan
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
