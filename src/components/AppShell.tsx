"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { DynamicBackground } from "@/components/DynamicBackground";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { hasConfiguredProjectId } from "@/lib/reown";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "◆" },
  { href: "/send", label: "Send", icon: "↗" },
  { href: "/history", label: "History", icon: "☰" },
  { href: "/contacts", label: "Contacts", icon: "◎" },
  { href: "/request", label: "Request", icon: "⬇" },
  { href: "/profile", label: "Profile", icon: "◌" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <DynamicBackground />

      <div className="relative flex min-h-screen">
        <aside className="glass-panel fixed inset-y-4 left-4 z-30 hidden w-64 flex-col overflow-hidden rounded-[28px] lg:flex">
          <div className="border-b border-white/8 px-6 py-5">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold shadow-lg shadow-indigo-500/30">
              P2P
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">Arc P2P</h1>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
                Stablecoin rail on testnet
              </p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all ${
                    isActive
                      ? "bg-gradient-to-br from-indigo-500/80 to-violet-500/70 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white/4 text-zinc-300 group-hover:bg-white/8"
                  }`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/8 px-5 py-4 space-y-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[11px] text-zinc-500">
              <div className="mb-2 flex items-center gap-2 text-zinc-400">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Arc Testnet live
              </div>
              <div className="font-mono text-[10px] tracking-wide text-zinc-600">CHAIN 5042002</div>
            </div>

            {!isConnected && (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-4 text-xs leading-6 text-indigo-200">
                <p className="font-semibold text-indigo-100">Wallet plus auth entry</p>
                <p className="mt-2 text-indigo-200/80">
                  {hasConfiguredProjectId
                    ? "Browser wallet support is live, and social or email auth is enabled for mobile-friendly entry."
                    : "Browser wallet support is live. Social or email auth UI is wired, but it still needs NEXT_PUBLIC_REOWN_PROJECT_ID before it can actually work in mobile browsers."}
                </p>
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col lg:pl-[18.5rem]">
          <header className="sticky top-0 z-20 px-4 pt-4 lg:px-6">
            <div className="glass-panel flex flex-col gap-4 rounded-[24px] px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Arc Network</p>
                <p className="mt-1 text-sm text-zinc-300">Fast peer-to-peer stablecoin flows</p>
              </div>

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {!isConnected && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-xs leading-6 text-zinc-400 sm:max-w-[340px]">
                      <p className="font-medium text-zinc-200">Connect to start</p>
                      <p className="mt-1">Use social or email on mobile once Reown is configured, or use an injected wallet / wallet in-app browser.</p>
                    </div>
                    <SocialLoginButton className="rounded-2xl border border-indigo-500/25 bg-indigo-500/12 px-4 py-3 text-sm font-medium text-indigo-100 transition-colors hover:bg-indigo-500/18 disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-zinc-400" />
                  </div>
                )}

                <ConnectButton
                  showBalance={true}
                  chainStatus="icon"
                  accountStatus="address"
                />
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-6 lg:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
