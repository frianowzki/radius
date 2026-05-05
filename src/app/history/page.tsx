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
  getPaymentRequests,
  saveLocalTransfers,
  savePaymentRequests,
} from "@/lib/utils";
import { fetchRemoteActivity, mergePaymentRequests, mergeTransfers, pushRemoteActivity } from "@/lib/activity-sync";

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

function getTransferNotes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("radius-transfer-notes") || "{}"); } catch { return {}; }
}
function saveTransferNote(txHash: string, note: string) {
  const notes = getTransferNotes();
  if (note.trim()) notes[txHash] = note.trim();
  else delete notes[txHash];
  localStorage.setItem("radius-transfer-notes", JSON.stringify(notes));
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
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>(() => getTransferNotes());

  useEffect(() => {
    if (!address) return;

    const syncRemote = async () => {
      const remote = await fetchRemoteActivity(address);
      if (!remote) return;
      const mergedRequests = mergePaymentRequests(getPaymentRequests(), remote.requests);
      const mergedTransfers = mergeTransfers(getLocalTransfers(), remote.transfers);
      savePaymentRequests(mergedRequests);
      saveLocalTransfers(mergedTransfers);
      setTransfers(mergedTransfers
        .filter((transfer) => transfer.from.toLowerCase() === address.toLowerCase() || transfer.to.toLowerCase() === address.toLowerCase())
        .map((transfer) => ({
          from: transfer.from,
          to: transfer.to,
          value: BigInt(transfer.value),
          token: transfer.token,
          txHash: transfer.txHash,
          direction: transfer.direction,
          createdAt: transfer.createdAt,
          source: "local" as const,
          localId: transfer.id,
        })));
      void pushRemoteActivity(address, { requests: mergedRequests, transfers: mergedTransfers });
    };
    void syncRemote();

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

        const merged = [...events, ...localEvents.filter((e) => !e.txHash.startsWith("balance-"))].filter((event, index, all) => {
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
      <div className="history-reference-screen">
        <section className="history-reference-hero">
          <div>
            <p>History</p>
            <h1>Every transfer should read like a receipt feed.</h1>
            <span>Not charts, not noise, just clear sent and received payment moments across your Arc stablecoin activity.</span>
          </div>
        </section>

        <div className="history-reference-filter">
          {(["all", "sent", "received"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={filter === f ? "active" : ""}>
              {f}
            </button>
          ))}
        </div>

        {!isConnected ? (
          <div className="history-reference-empty">Connect your wallet to view transaction history.</div>
        ) : loading && filtered.length === 0 ? (
          <div className="history-reference-list">
            {[1, 2, 3].map((i) => <div key={i} className="history-reference-card skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="history-reference-empty">
            {transfers.length === 0 ? "No transactions found" : `No ${filter} transactions`}
          </div>
        ) : (
          <div className="history-reference-list">
            {filtered.map((tx) => {
              const tokenInfo = TOKENS[tx.token as TokenKey];
              const isSent = tx.direction === "sent";
              const counterparty = isSent ? tx.to : tx.from;
              const matchedContact = findContactByAddress(counterparty);
              const amount = formatAmount(tx.value, tokenInfo.decimals);
              return (
                <article key={`${tx.txHash}-${tx.direction}`} className="history-reference-card">
                  <div className="history-token-orb">
                    <TokenLogo symbol={tx.token} size={54} />
                    <span className={isSent ? "sent" : "received"}>{isSent ? "↗" : "✓"}</span>
                  </div>

                  <div className="history-card-main">
                    <div className="history-card-title-row">
                      <h2>{isSent ? "Sent" : "Received"} <span>{tx.token}</span></h2>
                      {tx.source === "local" && <em>Saved</em>}
                    </div>
                    <p className="history-from">{isSent ? "To" : "From"} {formatContactLabel(counterparty)}</p>
                    {tx.txHash.startsWith("0x") ? (
                      <a className="history-counterparty-chip history-tx-link inline-flex items-center gap-2 px-5 py-1" href={`${arcTestnet.blockExplorers.default.url}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer">
                        <strong className="text-xs font-medium">{formatContactLabel(tx.txHash)}</strong>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    ) : (
                      <div className="history-counterparty-chip">
                        <ProfileChip contact={matchedContact} address={counterparty} fallbackLabel={formatContactLabel(counterparty)} />
                      </div>
                    )}
                  </div>

                  <div className="history-card-side">
                    <strong className={isSent ? "sent" : "received"}>{isSent ? "−" : "+"}{amount}<br />{tx.token}</strong>
                    <Link href={`/send?to=${encodeURIComponent(counterparty)}&amount=${encodeURIComponent(amount.replace(/,/g, ""))}&token=${tx.token}`}>Send again</Link>
                    {tx.txHash.startsWith("0x") ? (
                      <a href={`${arcTestnet.blockExplorers.default.url}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer">Tx link</a>
                    ) : (
                      <span />
                    )}
                  </div>

                  {/* Transfer notes */}
                  <div style={{ gridColumn: "1 / -1", paddingTop: 4 }}>
                    {editingNote === tx.txHash ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          autoFocus
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              saveTransferNote(tx.txHash, noteText);
                              setNotes(getTransferNotes());
                              setEditingNote(null);
                              setNoteText("");
                            }
                            if (e.key === "Escape") { setEditingNote(null); setNoteText(""); }
                          }}
                          placeholder="Add a note…"
                          style={{ flex: 1, fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--brand, #7a70d8)", outline: "none", background: "rgba(255,255,255,0.7)" }}
                        />
                        <button
                          type="button"
                          onClick={() => { saveTransferNote(tx.txHash, noteText); setNotes(getTransferNotes()); setEditingNote(null); setNoteText(""); }}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "var(--brand, #7a70d8)", color: "#fff", border: "none", cursor: "pointer" }}
                        >Save</button>
                        <button
                          type="button"
                          onClick={() => { setEditingNote(null); setNoteText(""); }}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "transparent", border: "1px solid #ccc", cursor: "pointer" }}
                        >Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {notes[tx.txHash] && (
                          <span style={{ fontSize: 11, color: "#8b8795", fontStyle: "italic" }}>📝 {notes[tx.txHash]}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => { setEditingNote(tx.txHash); setNoteText(notes[tx.txHash] || ""); }}
                          style={{ fontSize: 10, color: "var(--brand, #7a70d8)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                        >
                          {notes[tx.txHash] ? "Edit note" : "Add note"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
