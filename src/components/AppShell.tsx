"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DynamicBackground } from "@/components/DynamicBackground";
import { ThemeToggle } from "@/components/ThemeToggle";

const PaymentRequestNotifier = dynamic(
  () => import("@/components/PaymentRequestNotifier").then((m) => m.PaymentRequestNotifier),
  { ssr: false }
);

type NavIconName = "home" | "request" | "history" | "profile";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon?: NavIconName;
  special?: boolean;
}> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/request", label: "Request", icon: "request" },
  { href: "/send", label: "Radius", special: true },
  { href: "/history", label: "History", icon: "history" },
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

  if (name === "request") {
    return (
      <svg {...shared}>
        <path d="M12 3.8v11.1" />
        <path d="m7.4 10.3 4.6 4.6 4.6-4.6" />
        <path d="M5.2 16.9v3.3h13.6v-3.3" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg {...shared}>
        <path d="M7 3.8h10a1.7 1.7 0 0 1 1.7 1.7v15l-3.2-1.9-3.5 1.9-3.5-1.9-3.2 1.9v-15A1.7 1.7 0 0 1 7 3.8Z" />
        <path d="M8.7 8.1h6.6" />
        <path d="M8.7 11.8h6.6" />
        <path d="M8.7 15.5h4.2" />
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
      <ThemeToggle className="app-theme-toggle" />
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
                  <span className="nav-orb" aria-hidden="true">R</span>
                ) : item.icon ? (
                  <span className="nav-icon"><NavIcon name={item.icon} /></span>
                ) : null}
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
