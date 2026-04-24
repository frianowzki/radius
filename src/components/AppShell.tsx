"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { DynamicBackground } from "@/components/DynamicBackground";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { hasConfiguredPrivy } from "@/lib/privy";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "◆" },
  { href: "/send", label: "Send", icon: "↗" },
  { href: "/request", label: "Request", icon: "⬇" },
  { href: "/history", label: "History", icon: "☰" },
  { href: "/contacts", label: "Contacts", icon: "◎" },
  { href: "/profile", label: "Profile", icon: "◌" },
];

function formatAddress(address?: string | null) {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected: wagmiConnected, address: wagmiAddress } = useAccount();
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();

  const privyWalletAddress = wallets[0]?.address ?? null;
  const connectedAddress = wagmiAddress ?? privyWalletAddress ?? null;
  const isConnected = wagmiConnected || authenticated;
  const authLabel = authenticated
    ? user?.email?.address || user?.google?.email || user?.github?.email || formatAddress(connectedAddress)
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <DynamicBackground />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-24 pt-3 sm:px-4 sm:pb-28 sm:pt-4 lg:flex-row lg:gap-6 lg:px-6 lg:pb-8">
        <aside className="mobile-panel hidden w-64 shrink-0 flex-col overflow-hidden rounded-[28px] lg:flex">
          <div className="border-b border-white/8 px-6 py-5">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-zinc-950 shadow-lg shadow-black/20">
              R
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">Radius</h1>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
                Arc testnet payments
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                    isActive ? "bg-white text-zinc-950" : "text-zinc-400 hover:bg-white/6 hover:text-zinc-100"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all ${
                      isActive ? "bg-zinc-950 text-white" : "bg-white/5 text-zinc-300 group-hover:bg-white/10"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {!isConnected && (
            <div className="border-t border-white/8 px-5 py-4 text-xs leading-6 text-zinc-400">
              <p className="font-semibold text-zinc-100">Mobile auth</p>
              <p className="mt-2">
                {hasConfiguredPrivy
                  ? "Privy social or email login is ready for cleaner mobile onboarding."
                  : "Add real Privy app and client ids to enable social or email login."}
              </p>
            </div>
          )}
        </aside>

        <div className="flex min-h-screen flex-1 flex-col gap-3 sm:gap-4 lg:gap-6">
          <header className="mobile-panel rounded-[26px] px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Arc Network</p>
                <p className="mt-1 text-sm text-zinc-300">Fast stablecoin payments, cleaner in portrait mode</p>
              </div>

              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                {!isConnected && hasConfiguredPrivy && ready && (
                  <SocialLoginButton className="mobile-button mobile-button-primary w-full sm:w-auto" />
                )}

                <div className="wallet-connect-row">
                  <ConnectButton
                    showBalance={false}
                    chainStatus="icon"
                    accountStatus={isConnected ? "full" : "address"}
                  />
                  {authenticated && authLabel && (
                    <div className="mt-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200">
                      {authLabel}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      <nav className="mobile-tabbar lg:hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors ${
                isActive ? "bg-white text-zinc-950" : "text-zinc-400"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
