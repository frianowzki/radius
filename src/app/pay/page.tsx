"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { createWalletClient, custom, parseUnits, isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { TokenLogo } from "@/components/TokenLogo";
import { TOKENS, ERC20_TRANSFER_ABI, type TokenKey } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import {
  formatContactLabel,
  findContactByAddress,
  resolveRecipientInput,
  markMatchingPaymentRequestPaid,
  saveLocalTransfer,
  upsertContactByAddress,
} from "@/lib/utils";

type PayStatus = "idle" | "sending" | "confirming" | "success" | "error";

function PayContent() {
  const searchParams = useSearchParams();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const recipient = searchParams.get("to") || "";
  const amount = searchParams.get("amount") || "";
  const token = (searchParams.get("token") as TokenKey) || "USDC";
  const memo = searchParams.get("memo") || "";
  const requestId = searchParams.get("rid");

  const [status, setStatus] = useState<PayStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [showSaveRecipient, setShowSaveRecipient] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveHandle, setSaveHandle] = useState("");
  const [saveAvatar, setSaveAvatar] = useState("");

  const resolvedRecipient = resolveRecipientInput(recipient);
  const recipientAddress = resolvedRecipient.address || "";
  const matchedRecipient = recipientAddress ? findContactByAddress(recipientAddress) : undefined;

  const validRequest =
    isAddress(recipientAddress) &&
    amount &&
    Number(amount) > 0 &&
    token in TOKENS;

  async function getActiveWalletClient() {
    if (walletClient) return walletClient;
    if (!authProvider || !address) return null;
    return createWalletClient({
      account: address,
      chain: arcTestnet,
      transport: custom(authProvider),
    });
  }

  async function handlePay() {
    if (!publicClient || !address) return;
    const activeWalletClient = await getActiveWalletClient();
    if (!activeWalletClient) {
      setStatus("error");
      setError("Wallet signer unavailable. Reconnect your social wallet and try again.");
      return;
    }

    setStatus("sending");
    setError("");

    try {
      const tokenInfo = TOKENS[token];
      const parsedAmount = parseUnits(amount, tokenInfo.decimals);
      const hash = await activeWalletClient.writeContract({
        address: tokenInfo.address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [recipientAddress as `0x${string}`, parsedAmount],
      });

      setTxHash(hash);
      setStatus("confirming");

      await publicClient.waitForTransactionReceipt({ hash });
      saveLocalTransfer({
        from: address,
        to: recipientAddress,
        value: parsedAmount.toString(),
        token,
        txHash: hash,
        direction: "sent",
        routeLabel: "Payment request",
      });
      markMatchingPaymentRequestPaid(token, parsedAmount, tokenInfo.decimals, recipientAddress, requestId);
      setShowSaveRecipient(!matchedRecipient);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      if (err instanceof Error) {
        setError(
          err.message.includes("User rejected")
            ? "Transaction rejected"
            : err.message.slice(0, 200)
        );
      } else {
        setError("Payment failed");
      }
    }
  }

  function handleSaveRecipient() {
    if (!recipientAddress || !saveName.trim()) return;
    upsertContactByAddress(recipientAddress, {
      name: saveName.trim(),
      handle: saveHandle,
      avatar: saveAvatar,
    });
    setShowSaveRecipient(false);
    setSaveName("");
    setSaveHandle("");
    setSaveAvatar("");
  }

  if (!validRequest) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl">
          <div className="glass-panel-strong rounded-[32px] p-12 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[24px] bg-red-500/12 text-red-400">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h3 className="text-2xl font-semibold mb-2">Invalid payment request</h3>
            <p className="text-sm text-zinc-400">
              This payment link is missing required information.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="screen-pad">
        {status === "success" ? (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="glass-panel-strong rounded-[32px] p-8">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">Payment complete</p>
              <h2 className="text-4xl font-semibold tracking-tight text-glow">
                Clean handoff, clean receipt.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                You paid {amount} {token} to {formatContactLabel(recipientAddress)} on Arc Testnet.
              </p>

              <div className="pay-success-summary mt-8 rounded-[28px] border border-white/8 bg-white/[0.04] p-6">
                <div className="flex items-center justify-between border-b border-white/8 pb-4">
                  <div>
                    <p className="text-sm text-zinc-500">Amount</p>
                    <p className="mt-1 text-3xl font-semibold text-zinc-100">
                      {amount} {token}
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    Settled
                  </div>
                </div>
                <div className="space-y-4 pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Recipient</span>
                    <span className="text-zinc-300">{formatContactLabel(recipientAddress)}</span>
                  </div>
                  {memo && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="pay-muted">Memo</span>
                      <span className="pay-value">{memo}</span>
                    </div>
                  )}
                </div>
              </div>

              {showSaveRecipient && (
                <div className="pay-save-card mt-6 rounded-[28px] border border-white/8 bg-white/[0.04] p-5 space-y-3">
                  <p className="text-sm font-medium text-zinc-200">Save this recipient</p>
                  <input
                    type="text"
                    placeholder="Name"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="pay-save-input w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="@username"
                      value={saveHandle}
                      onChange={(e) => setSaveHandle(e.target.value)}
                      className="pay-save-input w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Avatar"
                      value={saveAvatar}
                      onChange={(e) => setSaveAvatar(e.target.value)}
                      maxLength={4}
                      className="pay-save-input w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSaveRecipient}
                    className="pay-save-button w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/14"
                  >
                    Save recipient
                  </button>
                </div>
              )}

              {txHash && (
                <a
                  href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pay-success-link primary-btn mt-6 inline-flex rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                >
                  View on ArcScan
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
              <div className="glass-panel-strong rounded-[32px] p-6">
                <div className="flex items-start gap-4">
                  <div className="bridge-header-icon shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">Pay request</p>
                    <h2 className="text-2xl font-black tracking-tight text-glow">Confirm payment</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">Review the details, then confirm in your wallet.</p>
                  </div>
                </div>
              </div>

              <div className="pay-request-card glass-panel rounded-[28px] p-6">
                <div className="text-center mb-6">
                  <p className="pay-muted text-sm mb-1">Amount requested</p>
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <TokenLogo symbol={token} size={42} />
                    <p className="pay-amount text-4xl font-bold">
                      {amount} <span className="pay-token text-2xl">{token}</span>
                    </p>
                  </div>
                </div>

                <div className="pay-detail-list space-y-4 text-sm">
                  <div className="flex justify-between py-3 border-t border-white/8">
                    <span className="pay-muted">To</span>
                    <span className="pay-value font-mono">
                      {formatContactLabel(recipientAddress)}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-t border-white/8">
                    <span className="pay-muted">Token</span>
                    <span className="pay-value flex items-center gap-2"><TokenLogo symbol={token} size={22} />{TOKENS[token].name}</span>
                  </div>
                  {memo && (
                    <div className="flex justify-between py-3 border-t border-white/8">
                      <span className="pay-muted">Memo</span>
                      <span className="pay-value">{memo}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-t border-white/8">
                    <span className="pay-muted">Network</span>
                    <span className="pay-value">Arc Testnet</span>
                  </div>
                </div>
              </div>

              {!isConnected ? (
                <div className="glass-panel rounded-[28px] p-5 text-center text-sm text-amber-300">
                  Connect your wallet to pay this request.
                </div>
              ) : (
                <button
                  onClick={handlePay}
                  disabled={status === "sending" || status === "confirming"}
                  className="pay-submit-button primary-btn w-full rounded-2xl px-4 py-4 font-semibold text-white disabled:opacity-60"
                >
                  {status === "sending" || status === "confirming" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {status === "sending" ? "Sending..." : "Confirming..."}
                    </span>
                  ) : (
                    `Pay ${amount} ${token}`
                  )}
                </button>
              )}

              {status === "error" && error && (
                <p className="text-center text-sm text-red-400">{error}</p>
              )}
            </div>
        )}
      </div>
    </AppShell>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)]/30 border-t-[var(--brand)]" />
          </div>
        </AppShell>
      }
    >
      <PayContent />
    </Suspense>
  );
}
