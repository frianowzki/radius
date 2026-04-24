"use client";

import { useAppKit } from "@reown/appkit/react";
import { hasConfiguredProjectId } from "@/lib/reown";

export function SocialLoginButton({ className = "" }: { className?: string }) {
  const { open } = useAppKit();

  return (
    <button
      type="button"
      onClick={() => {
        if (!hasConfiguredProjectId) return;
        open();
      }}
      disabled={!hasConfiguredProjectId}
      title={hasConfiguredProjectId ? "Continue with social or email" : "Set NEXT_PUBLIC_REOWN_PROJECT_ID to a real Reown project id"}
      className={className || "rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/[0.04]"}
    >
      {hasConfiguredProjectId ? "Continue with social or email" : "Social or email needs real Reown config"}
    </button>
  );
}
