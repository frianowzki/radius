"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GlobalErrorListeners = dynamic(
  () => import("@/components/GlobalErrorListeners").then((m) => m.GlobalErrorListeners),
  { ssr: false }
);
const ServiceWorkerRegistrar = dynamic(
  () => import("@/components/ServiceWorkerRegistrar").then((m) => m.ServiceWorkerRegistrar),
  { ssr: false }
);
const SyncToast = dynamic(
  () => import("@/components/SyncToast").then((m) => m.SyncToast),
  { ssr: false }
);

export function ClientRuntime() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = () => setReady(true);
    const idle = window.requestIdleCallback?.(run, { timeout: 1800 });
    if (!idle) window.setTimeout(run, 700);
    return () => {
      if (idle) window.cancelIdleCallback?.(idle);
    };
  }, []);

  if (!ready) return null;
  return (
    <>
      <GlobalErrorListeners />
      <ServiceWorkerRegistrar />
      <SyncToast />
    </>
  );
}
