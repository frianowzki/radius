"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePathname } from "next/navigation";
import { useReadContracts } from "wagmi";
import { DynamicBackground } from "@/components/DynamicBackground";
import { QuickActionIcon } from "@/components/QuickActionIcon";
import { TOKENS } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import { RADIUSD_POOL_ABI, RADIUSD_POOL_ADDRESS } from "@/config/radiusdex";

const PaymentRequestNotifier = dynamic(
  () => import("@/components/PaymentRequestNotifier").then((m) => m.PaymentRequestNotifier),
  { ssr: false }
);

type NavIconName = "home" | "swap" | "bridge" | "profile" | "agent";
type QuickIconName = "send" | "request" | "swap" | "scan" | "contacts" | "bridge" | "wallet" | "pool" | "yield" | "history";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon?: NavIconName;
  special?: boolean;
}> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/swap", label: "Swap", icon: "swap" },
  { href: "/send", label: "Radius", special: true },
  { href: "/bridge", label: "Bridge", icon: "bridge" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

const DESKTOP_NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: NavIconName | QuickIconName;
  source?: "quick";
  dividerBefore?: boolean;
}> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/swap", label: "Swap", icon: "swap", source: "quick" },
  { href: "/bridge", label: "Bridge", icon: "bridge" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/request", label: "Request", icon: "request", source: "quick", dividerBefore: true },
  { href: "/history", label: "History", icon: "history", source: "quick" },
  { href: "/pool", label: "Pool", icon: "pool", source: "quick" },
  { href: "/yield", label: "Yield", icon: "yield", source: "quick" },
  { href: "/contacts", label: "Contacts", icon: "contacts", source: "quick" },
];

function NavIcon({ name }: { name: NavIconName }) {
  const shared = {
    width: 27,
    height: 27,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...shared}>
        <path d="M3.8 10.7 12 3.8l8.2 6.9" />
        <path d="M6.2 9.2v10.3h4.1v-5.8h3.4v5.8h4.1V9.2" />
      </svg>
    );
  }

  if (name === "swap") {
    return (
      <svg {...shared}>
        <path d="M7 7h10" />
        <path d="m13.8 3.8 3.2 3.2-3.2 3.2" />
        <path d="M17 17H7" />
        <path d="m10.2 20.2-3.2-3.2 3.2-3.2" />
      </svg>
    );
  }

  if (name === "bridge") {
    return (
      <svg {...shared}>
        <path d="M7 7h10" />
        <path d="m14 4 3 3-3 3" />
        <path d="M17 17H7" />
        <path d="m10 14-3 3 3 3" />
      </svg>
    );
  }

  if (name === "agent") {
    return (
      <svg {...shared}>
        <path d="M12 3.8v3" />
        <path d="M7.3 8.2h9.4a2.2 2.2 0 0 1 2.2 2.2v5.1a2.2 2.2 0 0 1-2.2 2.2H7.3a2.2 2.2 0 0 1-2.2-2.2v-5.1a2.2 2.2 0 0 1 2.2-2.2Z" />
        <path d="M9.2 12.1h.1" />
        <path d="M14.7 12.1h.1" />
        <path d="M9.8 15.1h4.4" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <path d="M12 12.4a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" />
      <path d="M4.8 20.1a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

function formatLiquidity(raw: bigint, decimals: number) {
  const numeric = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(numeric)) return "0.00";
  return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DesktopLiquidityCard() {
  const { data } = useReadContracts({
    contracts: [
      { address: RADIUSD_POOL_ADDRESS, abi: RADIUSD_POOL_ABI, functionName: "balances", args: [BigInt(0)], chainId: arcTestnet.id },
      { address: RADIUSD_POOL_ADDRESS, abi: RADIUSD_POOL_ABI, functionName: "balances", args: [BigInt(1)], chainId: arcTestnet.id },
    ],
    query: { refetchInterval: 10_000 },
  });
  const usdc = (data?.[0]?.result as bigint | undefined) ?? BigInt(0);
  const eurc = (data?.[1]?.result as bigint | undefined) ?? BigInt(0);
  const total = Number(formatUnits(usdc, TOKENS.USDC.decimals)) + Number(formatUnits(eurc, TOKENS.EURC.decimals));

  return (
    <div className="desktop-sidebar-tvl" aria-label="RadiusDex liquidity locked">
      <p>Liquidity Locked <span>live</span></p>
      <strong>${Number.isFinite(total) ? total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</strong>
      <div className="desktop-liquidity-lines">
        <span><b>USDC</b>{formatLiquidity(usdc, TOKENS.USDC.decimals)}</span>
        <span><b>EURC</b>{formatLiquidity(eurc, TOKENS.EURC.decimals)}</span>
      </div>
      <svg viewBox="0 0 180 62" aria-hidden="true"><path d="M6 48c14-24 26-32 38-16 10 13 18 15 31-3 13-17 25-15 35 2 13 23 31 19 42-8 7-17 15-21 23-9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifierReady, setNotifierReady] = useState(false);

  useEffect(() => {
    const run = () => setNotifierReady(true);
    const idle = window.requestIdleCallback?.(run, { timeout: 1600 });
    if (!idle) window.setTimeout(run, 500);
    return () => {
      if (idle) window.cancelIdleCallback?.(idle);
    };
  }, []);

  return (
    <div className="phone-shell">
      <DynamicBackground />
      {notifierReady && <PaymentRequestNotifier />}
      <aside className="desktop-sidebar" aria-label="Desktop navigation">
        <Link href="/" className="desktop-sidebar-logo">Radius</Link>
        <nav className="desktop-sidebar-nav">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`desktop-sidebar-link${active ? " active" : ""}${item.dividerBefore ? " with-divider" : ""}`}
              >
                <span className="desktop-sidebar-icon">
                  {item.source === "quick" ? <QuickActionIcon name={item.icon as QuickIconName} /> : <NavIcon name={item.icon as NavIconName} />}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <DesktopLiquidityCard />
      </aside>
      <main>{children}</main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="bottom-nav-grid">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-item${active ? " active" : ""}${item.special ? " nav-item-special" : ""}`}
              >
                {item.special ? (
                  <span className="nav-orb" aria-hidden="true">
                    <span className="nav-orb-inner" />
                  </span>
                ) : item.icon ? (
                  <span className="nav-icon"><NavIcon name={item.icon} /></span>
                ) : null}
                {!item.special && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
