"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { ProfileChip } from "@/components/ProfileChip";
import { TOKENS } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import {
  formatAmount,
  formatContactLabel,
  findContactByAddress,
} from "@/lib/utils";

interface TransferLogArgs {
  from?: string;
  to?: string;
  value?: bigint;
}

interface TransferEvent {
  from: string;
  to: string;
  value: bigint;
  token: string;
  txHash: string;
  blockNumber: bigint;
  direction: "sent" | "received";
}

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [transfers, setTransfers] = useState<TransferEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "sent" | "received">("all");

  useEffect(() => {
    if (!address || !publicClient) return;

    async function fetchTransfers() {
      const client = publicClient;
      const currentAddress = address;
      if (!client || !currentAddress) return;

      setLoading(true);
      try {
        const events: TransferEvent[] = [];

        for (const [symbol, tokenInfo] of Object.entries(TOKENS)) {
          const [sentLogs, receivedLogs] = await Promise.all([
            client.getLogs({
              address: tokenInfo.address,
              event: {
                type: "event",
                name: "Transfer",
                inputs: [
                  { type: "address", name: "from", indexed: true },
                  { type: "address", name: "to", indexed: true },
                  { type: "uint256", name: "value", indexed: false },
                ],
              },
              args: { from: currentAddress },
              fromBlock: "earliest",
              toBlock: "latest",
            }),
            client.getLogs({
              address: tokenInfo.address,
              event: {
                type: "event",
                name: "Transfer",
                inputs: [
                  { type: "address", name: "from", indexed: true },
                  { type: "address", name: "to", indexed: true },
                  { type: "uint256", name: "value", indexed: false },
                ],
              },
              args: { to: currentAddress },
              fromBlock: "earliest",
              toBlock: "latest",
            }),
          ]);

          for (const log of sentLogs) {
            const args = log.args as TransferLogArgs;
            if (!args.from || !args.to || args.value === undefined) continue;
            events.push({
              from: args.from,
              to: args.to,
              value: args.value,
              token: symbol,
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber!,
              direction: "sent",
            });
          }

          for (const log of receivedLogs) {
            const args = log.args as TransferLogArgs;
            if (!args.from || !args.to || args.value === undefined) continue;
            if (args.from.toLowerCase() === currentAddress.toLowerCase()) continue;
            events.push({
              from: args.from,
              to: args.to,
              value: args.value,
              token: symbol,
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber!,
              direction: "received",
            });
          }
        }

        events.sort((a, b) => Number(b.blockNumber - a.blockNumber));
        setTransfers(events);
      } catch {
        // RPC may not support wide block ranges on testnet
      } finally {
        setLoading(false);
      }
    }

    fetchTransfers();
  }, [address, publicClient]);

  const filtered = transfers.filter(
    (t) => filter === "all" || t.direction === filter
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="glass-panel-strong rounded-[32px] p-8">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">History</p>
              <h2 className="text-4xl font-semibold tracking-tight text-glow">
                Every transfer should read like a receipt feed.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Not charts, not noise, just clear sent and received payment moments across your Arc stablecoin activity.
              </p>
            </div>

            <div className="flex gap-1 rounded-2xl bg-white/[0.04] p-1 w-fit">
              {(["all", "sent", "received"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-medium capitalize transition-all ${
                    filter === f
                      ? "bg-white/10 text-white shadow"
                      : "text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {!isConnected ? (
              <div className="glass-panel rounded-[28px] p-12 text-center text-zinc-500">
                Connect your wallet to view transaction history.
              </div>
            ) : loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-panel rounded-[28px] p-5 animate-pulse">
                    <div className="mb-2 h-5 w-40 rounded bg-white/8" />
                    <div className="h-4 w-64 rounded bg-white/8" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-panel rounded-[28px] p-12 text-center text-zinc-500">
                {transfers.length === 0
                  ? "No transactions found"
                  : `No ${filter} transactions`}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((tx) => {
                  const tokenInfo = TOKENS[tx.token as keyof typeof TOKENS];
                  const isSent = tx.direction === "sent";
                  const counterparty = isSent ? tx.to : tx.from;
                  const matchedContact = findContactByAddress(counterparty);
                  return (
                    <div
                      key={`${tx.txHash}-${tx.direction}`}
                      className="glass-panel group rounded-[28px] p-5 transition-all hover:border-white/14"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg ${
                              isSent
                                ? "bg-red-500/10 text-red-300"
                                : "bg-emerald-500/10 text-emerald-300"
                            }`}
                          >
                            {isSent ? "↗" : "↙"}
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-base font-semibold text-zinc-100">
                                {isSent ? "Sent" : "Received"} <span className="text-zinc-500">{tx.token}</span>
                              </p>
                              <p className="mt-1 font-mono text-xs text-zinc-500">
                                {isSent ? "To " : "From "}
                                {formatContactLabel(counterparty)}
                              </p>
                            </div>
                            <ProfileChip
                              contact={matchedContact}
                              address={counterparty}
                              fallbackLabel={formatContactLabel(counterparty)}
                            />
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p
                            className={`text-base font-semibold ${
                              isSent ? "text-red-300" : "text-emerald-300"
                            }`}
                          >
                            {isSent ? "−" : "+"}
                            {formatAmount(tx.value, tokenInfo.decimals)} {tx.token}
                          </p>
                          <a
                            href={`${arcTestnet.blockExplorers.default.url}/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs text-zinc-500 transition-colors hover:text-indigo-300"
                          >
                            View on ArcScan →
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="glass-panel rounded-[32px] p-6">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Receipt feed</p>
              <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
                History should feel alive, not administrative.
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                On Arc, fast finality should show up as fast visual confidence. A strong history page is a stream of clean receipts, not a ledger spreadsheet.
              </p>
            </div>

            <div className="glass-panel rounded-[32px] p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Current framing
              </h3>
              <div className="space-y-4 text-sm">
                <div className="border-b border-white/8 pb-4">
                  <p className="font-medium text-zinc-100">Sent and received</p>
                  <p className="mt-2 leading-6 text-zinc-500">Split by direction, then let the receipt do the talking.</p>
                </div>
                <div className="border-b border-white/8 pb-4">
                  <p className="font-medium text-zinc-100">Explorer access</p>
                  <p className="mt-2 leading-6 text-zinc-500">Still one click away when users want chain-level detail.</p>
                </div>
                <div>
                  <p className="font-medium text-zinc-100">Identity-aware receipts</p>
                  <p className="mt-2 leading-6 text-zinc-500">Known contacts now make this feed feel more like people and less like anonymous addresses.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
