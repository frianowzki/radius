"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient, useReadContracts, useChainId, useSwitchChain } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { createWalletClient, custom, parseUnits, isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { ReceiptCard } from "@/components/ReceiptCard";
import { ProfileChip } from "@/components/ProfileChip";
import { TOKENS, ERC20_TRANSFER_ABI, type TokenKey } from "@/config/tokens";
import { TokenLogo } from "@/components/TokenLogo";
import { arcTestnet } from "@/config/wagmi";
import { decimalToUnits, formatAmount, formatContactLabel, getDirectoryEntries, getIdentityLabel, getIdentityProfile, getLocalTransfers, getPaymentRequests, resolveRecipientInput, saveLocalTransfer, upsertContactByAddress } from "@/lib/utils";
import type { DirectoryEntry } from "@/lib/utils";
import { fetchRegistryProfile, type RegistryProfile } from "@/lib/registry-client";
import { useMounted } from "@/lib/useMounted";
import { advanceSchedule } from "@/lib/scheduled-payments";
import { pushRemoteActivity } from "@/lib/activity-sync";

type SendStatus = "idle" | "sending" | "confirming" | "success" | "error";

export default function SendPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const wagmiChainId = useChainId();
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const mounted = useMounted();
  const [token, setToken] = useState<TokenKey>("USDC");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [autorunRequested, setAutorunRequested] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- hydrate URL params on mount to avoid SSR mismatch */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") as TokenKey | null;
    if (t && t in TOKENS) setToken(t);
    const to = params.get("to");
    if (to) setRecipient(to);
    const amt = params.get("amount");
    if (amt) setAmount(amt);
    const sid = params.get("schedule");
    if (sid) setScheduleId(sid);
    const m = params.get("memo");
    if (m) setMemo(m);
    if (params.get("autorun") === "1") setAutorunRequested(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [status, setStatus] = useState<SendStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [showDirectory, setShowDirectory] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showSaveRecipient, setShowSaveRecipient] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveHandle, setSaveHandle] = useState("");
  const [saveAvatar, setSaveAvatar] = useState("");
  const [registryRecipient, setRegistryRecipient] = useState<RegistryProfile | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const senderLabel = mounted ? getIdentityLabel(getIdentityProfile()) : "Connected wallet";

  const { data: balances } = useReadContracts({
    contracts: address ? (Object.keys(TOKENS) as TokenKey[]).map((key) => ({
      address: TOKENS[key].address,
      abi: ERC20_TRANSFER_ABI,
      functionName: "balanceOf",
      args: [address],
      chainId: arcTestnet.id,
    })) : [],
    query: { enabled: !!address },
  });

  const balanceByToken = Object.fromEntries((Object.keys(TOKENS) as TokenKey[]).map((key, i) => [key, balances?.[i]?.result as bigint | undefined])) as Record<TokenKey, bigint | undefined>;
  const isOnArc = activeChainId === arcTestnet.id;
  const requestedRaw = amount && Number(amount) > 0 ? decimalToUnits(amount, TOKENS[token].decimals) : BigInt(0);
  const selectedBalance = balanceByToken[token];
  const hasEnoughBalance = typeof selectedBalance === "bigint" ? selectedBalance >= requestedRaw : false;
  const canSend = isConnected && isOnArc && !!amount && Number(amount) > 0 && hasEnoughBalance && status !== "sending" && status !== "confirming";

  const directoryEntries = useMemo(() => {
    if (!mounted) return [] as DirectoryEntry[];
    const query = directoryQuery.trim().toLowerCase();
    return getDirectoryEntries(address).filter((entry) => {
      if (!query) return entry.kind === "contact";
      return [entry.name.toLowerCase(), entry.handle?.toLowerCase(), entry.address?.toLowerCase(), entry.note?.toLowerCase(), entry.bio?.toLowerCase()].some((value) => value?.includes(query));
    });
  }, [mounted, address, directoryQuery]);

  const resolvedRecipient = resolveRecipientInput(recipient);
  const registryRecipientAddress = registryRecipient?.address;
  const resolvedRecipientAddress = resolvedRecipient.address || registryRecipientAddress;
  const validRecipient = !!resolvedRecipientAddress && isAddress(resolvedRecipientAddress);
  const recipientLabel = registryRecipient ? `${registryRecipient.displayName}${registryRecipient.handle ? ` (@${registryRecipient.handle})` : ""}` : validRecipient && resolvedRecipientAddress ? formatContactLabel(resolvedRecipientAddress) : recipient;
  const readyToSend = canSend && validRecipient;

  useEffect(() => {
    const trimmed = recipient.trim();
    const handle = trimmed && !trimmed.startsWith("0x") ? trimmed : "";
    if (!handle || resolvedRecipient.address) {
      queueMicrotask(() => setRegistryRecipient(null));
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchRegistryProfile({ handle })
        .then((profile) => { if (!cancelled) setRegistryRecipient(profile); })
        .catch(() => { if (!cancelled) setRegistryRecipient(null); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [recipient, resolvedRecipient.address]);

  async function getActiveWalletClient() {
    if (walletClient) return walletClient;
    if (!authProvider || !address) return null;
    return createWalletClient({ account: address, chain: arcTestnet, transport: custom(authProvider) });
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient || !address || !validRecipient || !resolvedRecipientAddress) return;
    if (!isOnArc) {
      setStatus("error");
      setError("Switch to Arc Testnet before sending. Bridge is now a separate tab.");
      return;
    }
    if (!hasEnoughBalance) {
      setStatus("error");
      setError(`Insufficient ${token} balance for this send.`);
      return;
    }
    setShowConfirm(true);
  }

  // Auto-confirm flow: when navigated with `?autorun=1` (set by the schedule
  // toggle), open the confirmation modal as soon as the form is hydrated and
  // ready. The user still signs the transaction — we never sign silently.
  /* eslint-disable react-hooks/set-state-in-effect -- effect reacts to URL-derived intent and gating state */
  useEffect(() => {
    if (!autorunRequested) return;
    if (!readyToSend || !validRecipient || !resolvedRecipientAddress) return;
    if (status !== "idle") return;
    setAutorunRequested(false);
    setShowConfirm(true);
  }, [autorunRequested, readyToSend, validRecipient, resolvedRecipientAddress, status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function executeSend() {
    if (!publicClient || !address || !validRecipient || !resolvedRecipientAddress) return;
    setShowConfirm(false);
    const activeWalletClient = await getActiveWalletClient();
    if (!activeWalletClient) {
      setStatus("error");
      setError("Wallet signer unavailable. Reconnect and try again.");
      return;
    }

    try {
      setStatus("sending");
      setError("");
      const tokenInfo = TOKENS[token];
      const parsedAmount = parseUnits(amount, tokenInfo.decimals);
      const hash = await activeWalletClient.writeContract({
        address: tokenInfo.address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [resolvedRecipientAddress as `0x${string}`, parsedAmount],
      });
      setTxHash(hash);
      setStatus("confirming");
      await publicClient.waitForTransactionReceipt({ hash });
      saveLocalTransfer({ from: address, to: resolvedRecipientAddress, value: parsedAmount.toString(), token, txHash: hash, direction: "sent", routeLabel: memo.trim() || "Arc → Arc" });
      void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
      if (scheduleId) {
        try { advanceSchedule(scheduleId, Date.now()); } catch { /* noop */ }
      }
      setShowSaveRecipient(!resolvedRecipient.contact && !registryRecipient);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? (err.message.includes("User rejected") ? "Transaction rejected" : err.message.slice(0, 200)) : "Transaction failed");
    }
  }

  function handleSelectDirectoryEntry(entry: DirectoryEntry) {
    if (entry.kind !== "contact" || !entry.address) return;
    setRecipient(entry.handle ? entry.handle.replace(/^@/, "") : entry.address);
    setShowDirectory(false);
  }

  function handleSaveRecipient() {
    if (!resolvedRecipientAddress || !saveName.trim()) return;
    upsertContactByAddress(resolvedRecipientAddress, { name: saveName.trim(), handle: saveHandle, avatar: saveAvatar });
    setShowSaveRecipient(false);
    setSaveName("");
    setSaveHandle("");
    setSaveAvatar("");
  }

  function resetForm() {
    setAmount("");
    setRecipient("");
    setMemo("");
    setStatus("idle");
    setTxHash("");
    setError("");
  }

  return (
    <AppShell>
      <div className="screen-pad">
        {status === "success" ? (
          <div className="space-y-5">
            <div className="glass-panel-strong rounded-[32px] p-6">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">Payment sent</p>
              <h2 className="text-3xl font-semibold tracking-tight text-glow">Sent on Arc.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{amount} {token} sent to {recipientLabel}.</p>
              {memo.trim() && (
                <p className="mt-2 text-sm text-zinc-500">Memo: {memo.trim()}</p>
              )}
              {showSaveRecipient && resolvedRecipientAddress && (
                <div className="mt-5 space-y-3 rounded-[24px] bg-white/70 p-4">
                  <p className="text-sm font-semibold">Save this recipient</p>
                  <input className="radius-input text-sm" placeholder="Name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                  <input className="radius-input text-sm" placeholder="@username" value={saveHandle} onChange={(e) => setSaveHandle(e.target.value)} />
                  <button onClick={handleSaveRecipient} className="primary-btn w-full text-sm">Save recipient</button>
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={resetForm} className="ghost-btn text-sm">Send another</button>
                {txHash && <a href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" className="primary-btn text-center text-sm">View tx</a>}
              </div>
            </div>
            <ReceiptCard title="Arc Flow" amount={amount} token={token} status="Settled" fromLabel={address ? senderLabel : "Connected wallet"} toLabel={recipientLabel} note="Arc Testnet" shareText={validRecipient ? `Sent ${amount} ${token} on Arc to ${recipientLabel}${memo.trim() ? ` — "${memo.trim()}"` : ""}` : undefined} txHash={txHash} explorerUrl={txHash ? `${arcTestnet.blockExplorers.default.url}/tx/${txHash}` : undefined} />
          </div>
        ) : (
          <form onSubmit={handleSend} className="send-flow space-y-5">
            <div className="send-hero-card glass-panel-strong rounded-[32px] p-6">
              <div className="flex items-start gap-4">
                <div className="bridge-header-icon shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">Send</p>
                  <h2 className="text-2xl font-black tracking-tight text-glow">Send on Arc</h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-400">Send stablecoins to a wallet, saved contact, or global Radius username in seconds.</p>
                </div>
              </div>
            </div>

            <div className="flow-card compact glass-panel rounded-[28px] p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Network</span>
                <span className={`inline-flex items-center gap-2 font-medium ${isOnArc ? "text-emerald-500" : "text-amber-500"}`}>
                  <span className={`status-dot ${isOnArc ? "ok" : "warn"}`} aria-hidden="true" />
                  {isOnArc ? "Arc Testnet" : "Switch to Arc Testnet"}
                </span>
              </div>
              {!isOnArc && <button type="button" onClick={() => switchChainAsync({ chainId: arcTestnet.id }).catch(() => setError("Failed to switch network"))} className="ghost-btn mt-3 w-full text-xs">Switch to Arc</button>}
            </div>

            <div className="flow-card glass-panel rounded-[28px] p-5">
              <div className="mb-3 flex items-center justify-between"><label className="text-sm font-medium text-zinc-400">Recipient</label><span className="text-xs text-zinc-500">Address or username</span></div>
              <input className="radius-input font-mono text-sm border-0 ring-0 focus:ring-0 focus:border-[rgba(27,22,43,.08)] focus:shadow-none" value={recipient} onChange={(e) => { setRecipient(e.target.value); }} placeholder="0x... or username" />
              <button type="button" onClick={() => { setDirectoryQuery(""); setShowDirectory(true); }} className="ghost-btn mt-3 w-full text-xs">Choose from contacts</button>
              {registryRecipient && !resolvedRecipient.contact && (
                <button type="button" onClick={() => { setRecipient(registryRecipient.handle || registryRecipient.address); setShowDirectory(false); }} className="mt-3 w-full rounded-2xl bg-white/60 p-3 text-left text-sm">
                  <ProfileChip contact={{ id: registryRecipient.address, name: registryRecipient.displayName, address: registryRecipient.address, handle: registryRecipient.handle, avatar: registryRecipient.avatar, note: registryRecipient.bio }} address={registryRecipient.address} />
                </button>
              )}
            </div>

            <div className="send-amount-card flow-card glass-panel rounded-[28px] p-5">
              <label className="mb-3 block text-sm font-medium text-zinc-400">Amount</label>
              <div className="flex items-center gap-3 rounded-[24px] border-0 bg-white/55 p-4">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 border-0 bg-transparent text-5xl font-semibold tracking-tight outline-none ring-0 focus:ring-0" />
                <button type="button" onClick={() => setShowTokenPicker(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)]/8 px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">
                  <TokenLogo symbol={token} size={20} />
                  {token}
                </button>
              </div>
              {balanceByToken[token] !== undefined && (
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
                  <span>Available: {formatAmount(balanceByToken[token]!, TOKENS[token].decimals)} {token}</span>
                  <button type="button" onClick={() => setAmount(formatAmount(balanceByToken[token]!, TOKENS[token].decimals).replace(/,/g, ""))} className="font-semibold text-[var(--brand)]">Max</button>
                </div>
              )}
              {!hasEnoughBalance && amount && Number(amount) > 0 && (
                <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs font-medium text-red-500">Insufficient {token} balance.</p>
              )}
            </div>

            <div className="flow-card glass-panel rounded-[28px] p-5">
              <label className="mb-3 block text-sm font-medium text-zinc-400">Memo (optional)</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What's this for?" className="radius-input font-mono text-sm border-0 ring-0 focus:ring-0 focus:border-[rgba(27,22,43,.08)] focus:shadow-none" maxLength={200} />
            </div>

            {readyToSend && (
              <div className="review-card glass-panel rounded-[28px] p-5 text-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Review before sending</p>
                <div className="space-y-3">
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Recipient</span><span className="min-w-0 text-right font-medium break-words">{recipientLabel}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Amount</span><span className="font-medium">{amount} {token}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Network</span><span className="font-medium text-emerald-500">Arc Testnet</span></div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Network fee</span><span className="font-medium">Wallet estimate</span></div>
                  {memo.trim() && (
                    <div className="flex justify-between gap-4"><span className="text-zinc-500">Memo</span><span className="min-w-0 text-right font-medium break-words">{memo.trim()}</span></div>
                  )}
                </div>
              </div>
            )}

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={!readyToSend} className="primary-btn flow-primary-action w-full disabled:opacity-40">{status === "sending" ? "Sending..." : status === "confirming" ? "Confirming..." : "Review send"}</button>

          </form>
        )}

        {showConfirm && (
          <div className="fixed inset-0 z-[90] grid place-items-end bg-black/35 p-4 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
            <div className="soft-card w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Confirm send</p>
              <h3 className="mt-2 text-2xl font-bold">Send {amount} {token}?</h3>
              <div className="mt-5 space-y-3 rounded-2xl bg-white/55 p-4 text-sm">
                <div className="flex justify-between gap-4"><span className="text-[#8b8795]">To</span><span className="min-w-0 text-right font-semibold break-words">{recipientLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#8b8795]">Network</span><span className="font-semibold">Arc Testnet</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#8b8795]">Fee</span><span className="font-semibold">Shown in wallet</span></div>
                {memo.trim() && (
                  <div className="flex justify-between gap-4"><span className="text-[#8b8795]">Memo</span><span className="min-w-0 text-right font-semibold break-words">{memo.trim()}</span></div>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowConfirm(false)} className="ghost-btn text-sm">Cancel</button>
                <button type="button" onClick={executeSend} className="primary-btn text-sm">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {showTokenPicker && (
          <div className="fixed inset-0 z-[90] grid place-items-end bg-black/30 p-4" onClick={() => setShowTokenPicker(false)}>
            <div className="bg-white w-full max-w-sm rounded-[30px] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Choose token</h3>
                <button type="button" onClick={() => setShowTokenPicker(false)} className="grid h-9 w-9 place-items-center rounded-full bg-red-500/10 text-red-500">❌</button>
              </div>
              <div className="space-y-3">
                {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
                  <button key={key} type="button" onClick={() => { setToken(key); setShowTokenPicker(false); }} className={`frosted-choice w-full ${token === key ? "active" : ""}`}>
                    <div className="flex items-center gap-3">
                      <TokenLogo symbol={key} size={34} />
                      <div>
                        <p className="font-bold">{key}</p>
                        <p className="text-xs opacity-70">{TOKENS[key].name}</p>
                      </div>
                      {balanceByToken[key] !== undefined && <div className="ml-auto text-xs opacity-70">Balance: {formatAmount(balanceByToken[key]!, TOKENS[key].decimals)}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showDirectory && (
          <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" onClick={() => setShowDirectory(false)}>
            <div className="bg-white w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[30px] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Contacts</h3>
                <button type="button" onClick={() => setShowDirectory(false)} className="grid h-9 w-9 place-items-center rounded-full bg-red-500/10 text-red-500">❌</button>
              </div>
              <input className="radius-input font-mono text-sm mb-3" value={directoryQuery} onChange={(e) => setDirectoryQuery(e.target.value)} placeholder="Search contacts..." />
              {directoryEntries.length === 0 && (
                <p className="rounded-2xl bg-white/55 p-3 text-xs text-zinc-500">No saved contacts yet.</p>
              )}
              {directoryEntries.length > 0 && (
                <div className="space-y-2">
                  {directoryEntries.map((entry) => entry.address && <button key={`${entry.kind}-${entry.address}`} type="button" onClick={() => handleSelectDirectoryEntry(entry)} className="w-full rounded-2xl bg-white/60 p-3 text-left text-sm"><ProfileChip contact={entry.kind === "contact" ? { id: entry.address, name: entry.name, address: entry.address, handle: entry.handle, avatar: entry.avatar, note: entry.note } : undefined} address={entry.address} /></button>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
