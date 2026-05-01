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

export function ClientRuntime() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = () => setReady(true);
    const idle = window.requestIdleCallback?.(run, { timeout: 2000 });
    if (!idle) window.setTimeout(run, 800);
    return () => {
      if (idle) window.cancelIdleCallback?.(idle);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <GlobalErrorListeners />
      <ServiceWorkerRegistrar />
    </>
  );
}
