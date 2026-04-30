"use client";

import { useState } from "react";
import { hasConfiguredPrivy, type SocialLoginMethod, useRadiusAuth } from "@/lib/web3auth";

type LoginMode = SocialLoginMethod | "modal";
type LoginIcon = "sparkle" | "users";

function LoginIconGlyph({ name }: { name: LoginIcon }) {
  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9.6 11.1a3.45 3.45 0 1 0 0-6.9 3.45 3.45 0 0 0 0 6.9Z" />
        <path d="M3.5 20.1v-1.6c0-2.6 2.1-4.7 4.7-4.7H11c2.6 0 4.7 2.1 4.7 4.7v1.6" />
        <path d="M15.1 5.2a3.25 3.25 0 0 1 0 5.9" />
        <path d="M16.8 13.9c2.1.35 3.7 2.15 3.7 4.35v1.85" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M11.2 3.6c.75 4.2 2.95 6.4 7.2 7.2-4.25.8-6.45 3-7.2 7.25-.8-4.25-3-6.45-7.25-7.25 4.25-.8 6.45-3 7.25-7.2Z" />
      <path d="M18.4 4.6c.25 1.35.95 2.05 2.3 2.3-1.35.25-2.05.95-2.3 2.3-.25-1.35-.95-2.05-2.3-2.3 1.35-.25 2.05-.95 2.3-2.3Z" />
    </svg>
  );
}

function isEmbeddedMobileBrowser(userAgent: string) {
  return /Telegram|FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat/i.test(userAgent);
}

export function SocialLoginButton({
  className = "",
  method = "google",
  label = "Press to Continue",
  icon,
}: {
  className?: string;
  method?: LoginMode;
  label?: string;
  icon?: LoginIcon;
}) {
  const { login, initialized } = useRadiusAuth();
  const [isEmbeddedBrowser] = useState(() =>
    typeof window !== "undefined" ? isEmbeddedMobileBrowser(window.navigator.userAgent) : false
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyCurrentUrl() {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogin() {
    if (!hasConfiguredPrivy || busy) return;
    setBusy(true);
    try {
      localStorage.setItem("radius-login-pending", "true");
      await login(method === "modal" ? undefined : method);
    } catch (error) {
      localStorage.removeItem("radius-login-pending");
      console.error("Privy login failed", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {isEmbeddedBrowser && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          If login opens oddly inside an in-app browser, copy this link and open it in Chrome/Safari.
          <button type="button" onClick={copyCurrentUrl} className="mt-2 block rounded-xl bg-white px-3 py-2 font-semibold text-amber-800">
            {copied ? "Link copied" : "Copy page link"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={handleLogin}
        disabled={!initialized || !hasConfiguredPrivy || busy}
        title={!hasConfiguredPrivy ? "Privy is not configured" : undefined}
        className={className || "radius-auth-button justify-center disabled:cursor-not-allowed disabled:opacity-50"}
      >
        {icon && <span className="login-action-icon" aria-hidden="true"><LoginIconGlyph name={icon} /></span>}
        <span className="text-center font-semibold">{busy ? "Opening..." : label}</span>
      </button>
    </div>
  );
}
