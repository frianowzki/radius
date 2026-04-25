"use client";

import { useState } from "react";
import { useLogin } from "@privy-io/react-auth";
import { enabledSocialLoginMethods, hasConfiguredPrivy } from "@/lib/privy";

function isEmbeddedMobileBrowser(userAgent: string) {
  return /Telegram|FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat/i.test(userAgent);
}

function socialLabel(method: string) {
  return method === "twitter" ? "X" : method[0].toUpperCase() + method.slice(1);
}

export function SocialLoginButton({ className = "" }: { className?: string }) {
  const { login } = useLogin();
  const [isEmbeddedBrowser] = useState(() =>
    typeof window !== "undefined" ? isEmbeddedMobileBrowser(window.navigator.userAgent) : false
  );
  const [copied, setCopied] = useState(false);
  const enabledMethods = ["email", ...enabledSocialLoginMethods] as Array<"email" | "google" | "apple" | "github" | "twitter">;
  const methodLabel = enabledSocialLoginMethods.length
    ? `email, ${enabledSocialLoginMethods.map(socialLabel).join(", ")}`
    : "email";

  async function copyCurrentUrl() {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      {isEmbeddedBrowser && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
          Privy’s human check is unreliable inside Telegram/In-app browsers. Copy this link and open it in Chrome/Safari for login.
          <button
            type="button"
            onClick={copyCurrentUrl}
            className="mt-2 block rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 font-medium text-amber-50"
          >
            {copied ? "Link copied" : "Copy page link"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          if (!hasConfiguredPrivy || isEmbeddedBrowser) return;
          login({ loginMethods: enabledMethods });
        }}
        disabled={!hasConfiguredPrivy || isEmbeddedBrowser}
        title={
          !hasConfiguredPrivy
            ? "Set NEXT_PUBLIC_PRIVY_APP_ID and NEXT_PUBLIC_PRIVY_CLIENT_ID to enable Privy auth"
            : isEmbeddedBrowser
              ? "Open in Chrome/Safari for login"
              : `Social Login (${methodLabel})`
        }
        className={
          className ||
          "inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-center text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/[0.04]"
        }
      >
        {!hasConfiguredPrivy
          ? "Social or email needs Privy config"
          : isEmbeddedBrowser
            ? "Open in browser for login"
            : "Social Login"}
      </button>
      {hasConfiguredPrivy && enabledSocialLoginMethods.length === 0 && (
        <p className="text-xs leading-5 text-zinc-500">
          Google, GitHub, Apple, and X are hidden until enabled in Privy dashboard and listed in NEXT_PUBLIC_PRIVY_SOCIAL_LOGIN_METHODS.
        </p>
      )}
    </div>
  );
}
