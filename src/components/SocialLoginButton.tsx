"use client";

import { useLogin } from "@privy-io/react-auth";
import { hasConfiguredPrivy } from "@/lib/privy";

export function SocialLoginButton({ className = "" }: { className?: string }) {
  const { login } = useLogin();

  return (
    <button
      type="button"
      onClick={() => {
        if (!hasConfiguredPrivy) return;
        login({ loginMethods: ["email", "google", "apple", "github"] });
      }}
      disabled={!hasConfiguredPrivy}
      title={hasConfiguredPrivy ? "Continue with social or email" : "Set NEXT_PUBLIC_PRIVY_APP_ID and NEXT_PUBLIC_PRIVY_CLIENT_ID to enable Privy auth"}
      className={
        className ||
        "rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/[0.04]"
      }
    >
      {hasConfiguredPrivy ? "Continue with social or email" : "Social or email needs Privy config"}
    </button>
  );
}
