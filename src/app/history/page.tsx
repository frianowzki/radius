"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { AppShell } from "@/components/AppShell";
import { ProfileChip } from "@/components/ProfileChip";
import { TokenLogo } from "@/components/TokenLogo";
import { TOKENS, type TokenKey } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import {
  formatAmount,
  formatContactLabel,
  findContactByAddress,
  getLocalTransfers,
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
  blockNumber?: bigint;
  createdAt?: number;
  direction: "sent" | "received";
  source: "chain" | "local";
  localId?: string;
}

export default function HistoryPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  const [transfers, setTransfers] = useState<TransferEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "sent" | "received">("all");

  useEffect(() => {
    if (!address) return;

    const localEvents: TransferEvent[] = getLocalTransfers(address).map((transfer) => ({
      from: transfer.from,
      to: transfer.to,
      value: BigInt(transfer.value),
      token: transfer.token,
      txHash: transfer.txHash,
      direction: transfer.direction,
      createdAt: transfer.createdAt,
      source: "local",
      localId: transfer.id,
    }));

    if (!publicClient) {
      queueMicrotask(() => setTransfers(localEvents));
      return;
    }

    async function fetchTransfers() {
      const client = publicClient;
      const currentAddress = address as `0x${string}` | undefined;
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
              source: "chain",
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
              source: "chain",
            });
          }
        }

        const merged = [...events, ...localEvents].filter((event, index, all) => {
          if (!event.txHash) return true;
          return (
            all.findIndex(
              (item) =>
                item.txHash?.toLowerCase() === event.txHash.toLowerCase() &&
                item.direction === event.direction
            ) === index
          );
        });

        merged.sort((a, b) => {
          if (a.blockNumber !== undefined && b.blockNumber !== undefined) {
            return Number(b.blockNumber - a.blockNumber);
          }
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        setTransfers(merged);
      } catch {
        // Keep local transaction history visible when the RPC rejects wide log ranges.
        setTransfers(localEvents);
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
      <div className="screen-pad">
        <div className="space-y-6">
            <div className="glass-panel-strong rounded-[32px] p-8">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">History</p>
              <h2 className="text-4xl font-semibold tracking-tight text-glow">
                Every transfer should read like a receipt feed.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Not charts, not noise, just clear sent and received payment moments across your Arc stablecoin activity.
              </p>
            </div>

            <div className="history-filter frosted-segment w-fit">
              {(["all", "sent", "received"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-medium capitalize transition-all ${
                    filter === f
                      ? "history-filter-active bg-white/70 text-[#17151f] shadow"
                      : "history-filter-idle text-[#8b8795] hover:text-[#17151f]"
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
            ) : loading && filtered.length === 0 ? (
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
                  const tokenInfo = TOKENS[tx.token as TokenKey];
                  const isSent = tx.direction === "sent";
                  const counterparty = isSent ? tx.to : tx.from;
                  const matchedContact = findContactByAddress(counterparty);
                  return (
                    <div
                      key={`${tx.txHash}-${tx.direction}`}
                      className="history-card glass-panel group rounded-[28px] p-5 transition-all hover:border-white/14"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <TokenLogo symbol={tx.token} size={48} />
                            <span
                              className={`absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] shadow-sm ${
                                isSent
                                  ? "bg-red-500 text-white"
                                  : "bg-emerald-500 text-white"
                              }`}
                              aria-hidden="true"
                            >
                              {isSent ? "↗" : "↙"}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="history-title text-base font-semibold text-zinc-100">
                                  {isSent ? "Sent" : "Received"} <span className="history-token text-zinc-500">{tx.token}</span>
                                </p>
                                {tx.source === "local" && (
                                  <span className="history-saved rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-indigo-300">
                                    Saved
                                  </span>
                                )}
                              </div>
                              <p className="history-counterparty mt-1 font-mono text-xs text-zinc-500">
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
                          <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                            {tx.localId && (
                              <Link
                                href={`/receipt/${tx.localId}`}
                                className="history-link inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-500 transition-colors hover:text-indigo-300"
                              >
                                Receipt
                              </Link>
                            )}
                            <Link
                              href={`/send?to=${encodeURIComponent(counterparty)}&amount=${encodeURIComponent(formatAmount(tx.value, tokenInfo.decimals).replace(/,/g, ""))}&token=${tx.token}`}
                              className="history-link inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-500 transition-colors hover:text-indigo-300"
                            >
                              Send again
                            </Link>
                            {tx.txHash.startsWith("0x") ? (
                              <a
                                href={`${arcTestnet.blockExplorers.default.url}/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="history-link inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-500 transition-colors hover:text-indigo-300"
                              >
                                View on ArcScan →
                              </a>
                            ) : (
                              <span className="history-link inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-500">Balance update</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
    </AppShell>
  );
}
