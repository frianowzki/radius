"use client";

import { useState } from "react";
import { hasConfiguredWeb3Auth, type SocialLoginMethod, useRadiusAuth } from "@/lib/web3auth";

type LoginMethod = SocialLoginMethod | "wallet";

function isEmbeddedMobileBrowser(userAgent: string) {
  return /Telegram|FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat/i.test(userAgent);
}

export function SocialLoginButton({
  className = "",
  method = "email",
  label,
  icon,
}: {
  className?: string;
  method?: LoginMethod;
  label?: string;
  icon?: React.ReactNode;
}) {
  const { login, initialized } = useRadiusAuth();
  const [isEmbeddedBrowser] = useState(() =>
    typeof window !== "undefined" ? isEmbeddedMobileBrowser(window.navigator.userAgent) : false
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const isMethodEnabled = method !== "wallet";

  async function copyCurrentUrl() {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogin() {
    if (!hasConfiguredWeb3Auth || !isMethodEnabled || busy) return;
    setBusy(true);
    try {
      await login(method);
    } catch (error) {
      console.error("Web3Auth login failed", error);
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
        disabled={!initialized || !hasConfiguredWeb3Auth || !isMethodEnabled || busy}
        title={!hasConfiguredWeb3Auth ? "Web3Auth is not configured" : undefined}
        className={className || "radius-auth-button disabled:cursor-not-allowed disabled:opacity-50"}
      >
        {icon ?? <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f2efff] text-lg">📧</span>}
        <span className="flex-1 text-center">{busy ? "Opening..." : label ?? "Continue with Email"}</span>
        <span className="text-[#b8b3c0]">›</span>
      </button>
    </div>
  );
}
