"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/request", label: "Request", icon: "↧" },
  { href: "/send", label: "Pay", icon: "▦", special: true },
  { href: "/history", label: "History", icon: "▤" },
  { href: "/profile", label: "Profile", icon: "♙" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="phone-shell">
      <main>{children}</main>
      <nav className="bottom-nav">
        <div className="grid grid-cols-5 items-end gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-end gap-1 text-[10px] font-semibold transition ${
                  active ? "text-[#6f60d5]" : "text-[#a5a0ad]"
                }`}
              >
                <span className={item.special ? "nav-pay text-xl" : "text-lg leading-none"}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
