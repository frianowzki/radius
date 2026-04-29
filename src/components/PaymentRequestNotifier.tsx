"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { usePaymentRequestWatcher } from "@/lib/usePaymentRequestWatcher";
import { showRadiusNotification } from "@/lib/notifications";
import { getPaymentRequests } from "@/lib/utils";

interface ToastState { id: string; title: string; body: string }

export function PaymentRequestNotifier() {
  const { address: wagmiAddress } = useAccount();
  const { address: authAddress } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const [toast, setToast] = useState<ToastState | null>(null);

  usePaymentRequestWatcher({
    address,
    onPaid: (requestId) => {
      if (!address) return;
      const record = getPaymentRequests(address).find((r) => r.id === requestId);
      const title = "Request paid";
      const body = record
        ? `+${record.amount} ${record.token}${record.memo ? ` — ${record.memo}` : ""}`
        : "Incoming transfer received";
      setToast({ id: requestId, title, body });
      void showRadiusNotification(title, { body });
    },
  });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto rounded-2xl border border-emerald-300/40 bg-emerald-500/95 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur"
      >
        <p>{toast.title}</p>
        <p className="text-xs font-medium text-emerald-50/90">{toast.body}</p>
      </div>
    </div>
  );
}
