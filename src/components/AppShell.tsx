"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DynamicBackground } from "@/components/DynamicBackground";

const PaymentRequestNotifier = dynamic(
  () => import("@/components/PaymentRequestNotifier").then((m) => m.PaymentRequestNotifier),
  { ssr: false }
);

type NavIconName = "home" | "swap" | "bridge" | "profile" | "agent";

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
        <path d="M4.2 14.6c2.2-2.1 4.8-3.1 7.8-3.1s5.6 1 7.8 3.1" />
        <path d="M6.4 17.8c1.6-1.4 3.5-2.1 5.6-2.1s4 .7 5.6 2.1" />
        <path d="M4.8 10.4h14.4" />
        <path d="M7.2 7.1h9.6" />
        <path d="M12 4.2v15.6" />
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
