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
import { formatAmount, formatContactLabel, getDirectoryEntries, getIdentityLabel, getIdentityProfile, resolveRecipientInput, saveLocalTransfer, upsertContactByAddress } from "@/lib/utils";
import type { DirectoryEntry } from "@/lib/utils";
import { fetchRegistryProfile, type RegistryProfile } from "@/lib/registry-client";

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

  const [token, setToken] = useState<TokenKey>(() => {
    if (typeof window === "undefined") return "USDC";
    const value = new URLSearchParams(window.location.search).get("token") as TokenKey | null;
    return value && value in TOKENS ? value : "USDC";
  });
  const [recipient, setRecipient] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("to") || "" : "");
  const [amount, setAmount] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("amount") || "" : "");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [showDirectory, setShowDirectory] = useState(true);
  const [showSaveRecipient, setShowSaveRecipient] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveHandle, setSaveHandle] = useState("");
  const [saveAvatar, setSaveAvatar] = useState("");
  const [registryRecipient, setRegistryRecipient] = useState<RegistryProfile | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const identity = getIdentityProfile();
  const senderLabel = getIdentityLabel(identity);

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
  const canSend = isConnected && isOnArc && !!amount && Number(amount) > 0 && status !== "sending" && status !== "confirming";

  const directoryEntries = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return getDirectoryEntries(address).filter((entry) => {
      if (!query) return entry.kind === "contact";
      return [entry.name.toLowerCase(), entry.handle?.toLowerCase(), entry.address?.toLowerCase(), entry.note?.toLowerCase(), entry.bio?.toLowerCase()].some((value) => value?.includes(query));
    });
  }, [address, directoryQuery]);

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
    setShowConfirm(true);
  }

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
      saveLocalTransfer({ from: address, to: resolvedRecipientAddress, value: parsedAmount.toString(), token, txHash: hash, direction: "sent", routeLabel: "Arc → Arc" });
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
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Payment sent</p>
              <h2 className="text-3xl font-semibold tracking-tight text-glow">Sent on Arc.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{amount} {token} sent to {recipientLabel}.</p>
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
            <ReceiptCard title="Arc Flow" amount={amount} token={token} status="Settled" fromLabel={address ? senderLabel : "Connected wallet"} toLabel={recipientLabel} note="Arc Testnet" shareText={validRecipient ? `Sent ${amount} ${token} on Arc to ${recipientLabel}` : undefined} txHash={txHash} explorerUrl={txHash ? `${arcTestnet.blockExplorers.default.url}/tx/${txHash}` : undefined} />
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-5">
            <div className="glass-panel-strong rounded-[32px] p-6">
              <h2 className="text-2xl font-black tracking-tight text-glow">SEND ON ARC</h2>
              <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">Send stablecoins to a wallet, saved contact, or global Radius username in seconds.</p>
            </div>

            <div className="glass-panel rounded-[28px] p-5">
              <label className="mb-3 block text-sm font-medium text-zinc-400">Token</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
                  <button key={key} type="button" onClick={() => setToken(key)} className={`frosted-choice ${token === key ? "active" : ""}`}>
                    <div className="flex items-center gap-2 font-semibold"><TokenLogo symbol={key} size={24} />{TOKENS[key].symbol}</div>
                    {balanceByToken[key] !== undefined && <div className="mt-1 text-xs opacity-70">Balance: {formatAmount(balanceByToken[key]!, TOKENS[key].decimals)}</div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[28px] p-5 text-sm">
              <div className="flex items-center justify-between"><span className="text-zinc-500">Network</span><span className={isOnArc ? "text-emerald-500" : "text-amber-500"}>{isOnArc ? "Arc Testnet" : "Switch to Arc Testnet"}</span></div>
              {!isOnArc && <button type="button" onClick={() => switchChainAsync({ chainId: arcTestnet.id }).catch(() => setError("Failed to switch network"))} className="ghost-btn mt-3 w-full text-xs">Switch to Arc</button>}
            </div>

            <div className="glass-panel rounded-[28px] p-5">
              <div className="mb-3 flex items-center justify-between"><label className="text-sm font-medium text-zinc-400">Recipient</label><span className="text-xs text-zinc-500">Address or username</span></div>
              <input className="radius-input font-mono text-sm" value={recipient} onChange={(e) => { setRecipient(e.target.value); setDirectoryQuery(e.target.value); setShowDirectory(true); }} placeholder="0x... or username" />
              <button type="button" onClick={() => { setDirectoryQuery(""); setShowDirectory(true); }} className="ghost-btn mt-3 w-full text-xs">Choose from contacts</button>
              {showDirectory && directoryEntries.length > 0 && (
                <div className="mt-3 space-y-2">
                  {directoryEntries.slice(0, 4).map((entry) => entry.address && <button key={`${entry.kind}-${entry.address}`} type="button" onClick={() => handleSelectDirectoryEntry(entry)} className="w-full rounded-2xl bg-white/60 p-3 text-left text-sm"><ProfileChip contact={entry.kind === "contact" ? { id: entry.address, name: entry.name, address: entry.address, handle: entry.handle, avatar: entry.avatar, note: entry.note } : undefined} address={entry.address} /></button>)}
                </div>
              )}
              {registryRecipient && !resolvedRecipient.contact && (
                <button type="button" onClick={() => { setRecipient(registryRecipient.handle || registryRecipient.address); setShowDirectory(false); }} className="mt-3 w-full rounded-2xl bg-white/60 p-3 text-left text-sm">
                  <ProfileChip contact={{ id: registryRecipient.address, name: registryRecipient.displayName, address: registryRecipient.address, handle: registryRecipient.handle, avatar: registryRecipient.avatar, note: registryRecipient.bio }} address={registryRecipient.address} />
                </button>
              )}
            </div>

            <div className="glass-panel rounded-[28px] p-5">
              <label className="mb-3 block text-sm font-medium text-zinc-400">Amount</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="w-full bg-transparent text-5xl font-semibold tracking-tight outline-none" />
            </div>

            {readyToSend && (
              <div className="glass-panel rounded-[28px] p-5 text-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Review before sending</p>
                <div className="space-y-3">
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Recipient</span><span className="text-right font-medium">{recipientLabel}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Amount</span><span className="font-medium">{amount} {token}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Network</span><span className="font-medium text-emerald-500">Arc Testnet</span></div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-500">Network fee</span><span className="font-medium">Wallet estimate</span></div>
                </div>
              </div>
            )}

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={!readyToSend} className="primary-btn w-full disabled:opacity-40">{status === "sending" ? "Sending..." : status === "confirming" ? "Confirming..." : "Send on Arc"}</button>

            <ReceiptCard title="Send preview" amount={amount || "0.00"} token={token} status="Preview" fromLabel={address ? senderLabel : "Connected wallet"} toLabel={validRecipient ? recipientLabel : recipient || "Recipient"} note="Arc Testnet" preview />
          </form>
        )}

        {showConfirm && (
          <div className="fixed inset-0 z-[90] grid place-items-end bg-black/35 p-4" onClick={() => setShowConfirm(false)}>
            <div className="soft-card w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Confirm send</p>
              <h3 className="mt-2 text-2xl font-bold">Send {amount} {token}?</h3>
              <div className="mt-5 space-y-3 rounded-2xl bg-white/55 p-4 text-sm">
                <div className="flex justify-between gap-4"><span className="text-[#8b8795]">To</span><span className="text-right font-semibold">{recipientLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#8b8795]">Network</span><span className="font-semibold">Arc Testnet</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#8b8795]">Fee</span><span className="font-semibold">Shown in wallet</span></div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowConfirm(false)} className="ghost-btn text-sm">Cancel</button>
                <button type="button" onClick={executeSend} className="primary-btn text-sm">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
