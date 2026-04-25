"use client";

import { useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
    appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
    clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID!}
  >
    {children}
  </PrivyProvider>
    </QueryClientProvider>
  );
}
