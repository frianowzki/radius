"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { AppShell } from "@/components/AppShell";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import { formatAmount, getIdentityProfile } from "@/lib/utils";
import { hasConfiguredPrivy } from "@/lib/privy";
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
    <div className="mobile-panel rounded-[28px] p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{symbol}</p>
        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Wallet
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
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
  { href: "/send", label: "Send", icon: "↗", blurb: "Move stablecoins fast." },
  { href: "/request", label: "Request", icon: "⬇", blurb: "Share a payment ask." },
  { href: "/contacts", label: "Contacts", icon: "◎", blurb: "Keep people nearby." },
  { href: "/history", label: "History", icon: "☰", blurb: "See every receipt." },
];

export default function DashboardPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const address = wagmiAddress ?? (wallets[0]?.address as `0x${string}` | undefined);
  const isConnected = wagmiConnected || authenticated;
  const identity = getIdentityProfile();

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
        <div className="space-y-4 sm:space-y-5">
          <section className="mobile-panel rounded-[32px] px-5 py-6 sm:px-7 sm:py-8">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-white text-2xl font-semibold text-zinc-950 shadow-lg shadow-black/20">
              R
            </div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-zinc-500">Radius</p>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Simple stablecoin payments on Arc.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Clean send, request, contacts, receipts, and a mobile-friendly auth path without the noisy wallet-app feel.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <p className="text-sm font-medium text-white">Send</p>
                <p className="mt-2 text-sm text-zinc-500">Fast stablecoin transfers.</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <p className="text-sm font-medium text-white">Request</p>
                <p className="mt-2 text-sm text-zinc-500">QR and payment links.</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <p className="text-sm font-medium text-white">Track</p>
                <p className="mt-2 text-sm text-zinc-500">Receipt-first history.</p>
              </div>
            </div>
          </section>

          <section className="mobile-panel rounded-[32px] px-5 py-6 sm:px-7 sm:py-7">
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Get started</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Better on mobile now.</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              {hasConfiguredPrivy
                ? "Privy social or email auth is available for cleaner mobile onboarding. You can still use an injected wallet or wallet in-app browser if you want."
                : "Use an injected wallet or wallet in-app browser now. Social or email auth becomes available once Privy is configured."}
            </p>

            {hasConfiguredPrivy && (
              <div className="mt-5">
                <SocialLoginButton className="mobile-button mobile-button-primary w-full" />
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-zinc-200">Social or email</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Better for plain mobile browsers when you do not want wallet-app friction first.
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-zinc-200">Wallet browser</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Still works if you open Radius inside a wallet browser that injects Ethereum support.
                </p>
              </div>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-5">
        <section className="mobile-panel rounded-[32px] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.32em] text-zinc-500">Radius</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Payments that feel instant and calm.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Send money fast, request with identity, and keep receipts readable without turning the app into a cluttered wallet dashboard.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Network</p>
                <p className="mt-2 text-sm font-medium text-zinc-100">Arc Testnet</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Mode</p>
                <p className="mt-2 text-sm font-medium text-zinc-100">Social payments</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BalanceCard symbol="USDC" balance={nativeBalance?.value} decimals={18} isLoading={nativeLoading} />
          <BalanceCard symbol="EURC" balance={eurcBalance as bigint | undefined} decimals={TOKENS.EURC.decimals} isLoading={eurcLoading} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-200">Quick actions</h3>
              <p className="text-xs text-zinc-500">What you actually use</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="mobile-panel group flex min-h-[148px] flex-col justify-between rounded-[28px] p-4 transition-all hover:border-white/14 hover:bg-white/[0.06]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg text-zinc-950 shadow-lg shadow-black/20 transition-transform group-hover:scale-105">
                    {action.icon}
                  </div>
                  <div>
                    <span className="text-base font-semibold text-zinc-100">{action.label}</span>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{action.blurb}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <IdentityCard profile={identity} />

            <div className="mobile-panel rounded-[28px] p-5 sm:p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Why it feels cleaner</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div className="border-b border-white/8 pb-4">
                  <p className="font-medium text-zinc-100">Less dashboard noise</p>
                  <p className="mt-2 leading-6 text-zinc-500">Portrait mode now focuses on the few things you actually need instead of cramming desktop layout into mobile.</p>
                </div>
                <div className="border-b border-white/8 pb-4">
                  <p className="font-medium text-zinc-100">Privy-first onboarding</p>
                  <p className="mt-2 leading-6 text-zinc-500">Social or email onboarding is now the intended mobile-browser path instead of being bolted on beside another auth system.</p>
                </div>
                <div>
                  <p className="font-medium text-zinc-100">Simple visual system</p>
                  <p className="mt-2 leading-6 text-zinc-500">Dark base, restrained panels, soft dynamic background, no extra chrome.</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm">
                <span className="text-zinc-500">Explorer</span>
                <a
                  href={arcTestnet.blockExplorers.default.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-white/90 hover:text-white"
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
