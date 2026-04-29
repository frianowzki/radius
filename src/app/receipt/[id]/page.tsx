"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReceiptCard } from "@/components/ReceiptCard";
import { TOKENS } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import { findContactByAddress, formatAmount, formatContactLabel, getLocalTransfers, type LocalTransferRecord } from "@/lib/utils";

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [transfer, setTransfer] = useState<LocalTransferRecord | null | undefined>(undefined);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage hydrate on mount */
  useEffect(() => {
    const found = getLocalTransfers().find((t) => t.id === id);
    setTransfer(found || null);
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (transfer === undefined) {
    return (
      <AppShell>
        <div className="screen-pad pt-16 text-center text-sm text-[#8b8795]">Loading receipt…</div>
      </AppShell>
    );
  }

  if (transfer === null) {
    return (
      <AppShell>
        <div className="screen-pad pt-16 text-center">
          <h2 className="text-xl font-semibold">Receipt not found</h2>
          <p className="mt-2 text-sm text-[#8b8795]">This receipt is stored on the device that made the payment.</p>
          <Link href="/history" className="primary-btn mx-auto mt-6 inline-block px-5 py-3 text-xs">Open history</Link>
        </div>
      </AppShell>
    );
  }

  const decimals = TOKENS[transfer.token].decimals;
  const amount = formatAmount(BigInt(transfer.value), decimals);
  const direction = transfer.direction;
  const fromLabel = direction === "sent"
    ? "You"
    : (findContactByAddress(transfer.from)?.name || formatContactLabel(transfer.from));
  const toLabel = direction === "sent"
    ? (findContactByAddress(transfer.to)?.name || formatContactLabel(transfer.to))
    : "You";
  const explorerUrl = transfer.txHash && transfer.txHash.startsWith("0x")
    ? `${arcTestnet.blockExplorers.default.url}/tx/${transfer.txHash}`
    : undefined;

  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <header className="flex items-center justify-between">
          <Link href="/history" className="text-2xl">‹</Link>
          <h1 className="text-sm font-bold">Receipt</h1>
          <span className="w-6" />
        </header>
        <ReceiptCard
          title={transfer.routeLabel || (direction === "sent" ? "Payment sent" : "Payment received")}
          amount={amount}
          token={transfer.token}
          status={direction === "sent" ? "Sent" : "Received"}
          fromLabel={fromLabel}
          toLabel={toLabel}
          createdAt={transfer.createdAt}
          txHash={transfer.txHash.startsWith("0x") ? transfer.txHash : undefined}
          explorerUrl={explorerUrl}
          shareText={`${direction === "sent" ? "Sent" : "Received"} ${amount} ${transfer.token} on Radius`}
        />
      </div>
    </AppShell>
  );
}
