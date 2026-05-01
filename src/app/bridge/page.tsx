"use client";

import { useEffect, useMemo, useState } from "react";
import { useMounted } from "@/lib/useMounted";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useReadContracts,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { createWalletClient, custom, parseUnits, isAddress } from "viem";
import type { Chain, EIP1193Provider } from "viem";
import { arbitrumSepolia, baseSepolia, sepolia } from "viem/chains";
import { AppShell } from "@/components/AppShell";
import { ReceiptCard } from "@/components/ReceiptCard";
import { ProfileChip } from "@/components/ProfileChip";
import { TokenLogo } from "@/components/TokenLogo";
import { TOKENS, ERC20_TRANSFER_ABI, type TokenKey } from "@/config/tokens";
import {
  CHAIN_METADATA,
  CHAIN_USDC_ADDRESSES,
  CROSSCHAIN_ROUTES,
  type CrosschainRoute,
} from "@/config/crosschain";
import { arcTestnet } from "@/config/wagmi";
import {
  estimateBridgeTransfer,
  executeBridgeTransfer,
  getBridgeErrorMessage,
  summarizeBridgeEstimate,
  formatEtaSeconds,
  type BridgeSpeed,
} from "@/lib/appkit";
import {
  formatAddress,
  formatAmount,
  formatContactLabel,
  getIdentityLabel,
  getIdentityProfile,
  getLocalTransfers,
  resolveRecipientInput,
  saveLocalTransfer,
  upsertContactByAddress,
} from "@/lib/utils";
import type { LocalTransferRecord } from "@/lib/utils";

type SendStatus = "idle" | "sending" | "confirming" | "success" | "error";

export default function BridgePage() {
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId, switchChain: switchAuthChain } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const wagmiChainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [token, setToken] = useState<TokenKey>("USDC");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const mounted = useMounted();
  const senderLabel = mounted ? getIdentityLabel(getIdentityProfile()) : "Connected wallet";
  const [showSaveRecipient, setShowSaveRecipient] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveHandle, setSaveHandle] = useState("");
  const [saveAvatar, setSaveAvatar] = useState("");
  const [destPickerOpen, setDestPickerOpen] = useState(false);
  const [showTxDetails, setShowTxDetails] = useState(false);
  const [recipientEditOpen, setRecipientEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- prefill recipient with user's own address for self-bridges */
  useEffect(() => {
    if (address && !recipient) setRecipient(address);
  }, [address, recipient]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const bridgeRoutes = CROSSCHAIN_ROUTES.filter((route) => route.mode === "bridge");
  type PartnerChain = "Ethereum_Sepolia" | "Base_Sepolia" | "Arbitrum_Sepolia";
  type BridgeDirection = "out" | "in"; // out = Arc → partner, in = partner → Arc
  const PARTNER_CHAINS: PartnerChain[] = ["Ethereum_Sepolia", "Base_Sepolia", "Arbitrum_Sepolia"];
  const [partner, setPartner] = useState<PartnerChain>("Ethereum_Sepolia");
  const [direction, setDirection] = useState<BridgeDirection>("out");
  const [bridgeHistory, setBridgeHistory] = useState<LocalTransferRecord[]>([]);
  const [bridgeHistoryNow, setBridgeHistoryNow] = useState(0);
  /* eslint-disable react-hooks/set-state-in-effect -- hydrate localStorage-backed history into state */
  useEffect(() => {
    if (!mounted) return;
    setBridgeHistoryNow(Date.now());
    setBridgeHistory(
      getLocalTransfers(address)
        .filter((t) => t.routeLabel?.includes("→"))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20)
    );
  }, [mounted, address, status, historyOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedRoute = useMemo<CrosschainRoute["id"]>(() => {
    const match = bridgeRoutes.find((r) =>
      direction === "out"
        ? r.fromChain === "Arc_Testnet" && r.toChain === partner
        : r.fromChain === partner && r.toChain === "Arc_Testnet"
    );
    return (match?.id ?? bridgeRoutes[0]?.id) as CrosschainRoute["id"];
  }, [bridgeRoutes, partner, direction]);
  const [bridgeEstimateText, setBridgeEstimateText] = useState("");
  const [bridgeDetails, setBridgeDetails] = useState<string[]>([]);
  const [liveEta, setLiveEta] = useState<{ total?: number; attestation?: number }>({});
  const bridgeSpeed: BridgeSpeed = "FAST";
  const useForwarder = true;
  const [bridgeProgress, setBridgeProgress] = useState("");
  type BridgeStepKey = "approve" | "burn" | "fetchAttestation" | "mint";
  type BridgeStepStatus = "pending" | "active" | "done" | "error";
  const [bridgeSteps, setBridgeSteps] = useState<Record<BridgeStepKey, BridgeStepStatus>>({
    approve: "pending",
    burn: "pending",
    fetchAttestation: "pending",
    mint: "pending",
  });
  void bridgeEstimateText;
  void bridgeDetails;

  const selectedRouteConfig =
    bridgeRoutes.find((route) => route.id === selectedRoute) ?? bridgeRoutes[0] ?? CROSSCHAIN_ROUTES[0];
  const isBridgeRoute = selectedRouteConfig.mode === "bridge";
  const sourceChainMeta = CHAIN_METADATA[selectedRouteConfig.fromChain];
  const destinationChainMeta = CHAIN_METADATA[selectedRouteConfig.toChain];
  const expectedSourceChainId = sourceChainMeta.chainId;
  const expectedSourceChainLabel = sourceChainMeta.label;
  const destinationChainLabel = destinationChainMeta.label;
  const sourceUsdcAddress = CHAIN_USDC_ADDRESSES[selectedRouteConfig.fromChain];
  const destinationUsdcAddress = CHAIN_USDC_ADDRESSES[selectedRouteConfig.toChain];
  const routeExplorerUrl = sourceChainMeta.explorerUrl;
  const sourceViemChain: Chain =
    selectedRouteConfig.fromChain === "Ethereum_Sepolia"
      ? sepolia
      : selectedRouteConfig.fromChain === "Base_Sepolia"
        ? baseSepolia
        : selectedRouteConfig.fromChain === "Arbitrum_Sepolia"
          ? arbitrumSepolia
          : arcTestnet;
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const isOnExpectedSourceChain = activeChainId === expectedSourceChainId;
  const canSwitchSourceChain = !isOnExpectedSourceChain && (wagmiConnected ? !!switchChainAsync : authenticated);

  const { data: balances } = useReadContracts({
    contracts: address
      ? [
          {
            address: sourceUsdcAddress,
            abi: ERC20_TRANSFER_ABI,
            functionName: "balanceOf",
            args: [address],
            chainId: expectedSourceChainId,
          },
          {
            address: TOKENS.EURC.address,
            abi: ERC20_TRANSFER_ABI,
            functionName: "balanceOf",
            args: [address],
            chainId: arcTestnet.id,
          },
        ]
      : [],
    query: { enabled: !!address },
  });

  const usdcBalance = balances?.[0]?.result as bigint | undefined;
  const eurcBalance = balances?.[1]?.result as bigint | undefined;
  const currentBalance = token === "USDC" ? usdcBalance : eurcBalance;
  const currentDecimals = TOKENS[token].decimals;

  const resolvedRecipient = resolveRecipientInput(recipient);
  const resolvedRecipientAddress = resolvedRecipient.address;
  const validRecipient = !!resolvedRecipientAddress && isAddress(resolvedRecipientAddress);
  const successEyebrow = isBridgeRoute ? "Bridge completed" : "Payment sent";
  const successHeadline = isBridgeRoute
    ? "Bridge route submitted cleanly."
    : "Clean receipt, no messy wallet energy.";
  const successDescription = isBridgeRoute
    ? `${amount} ${token} is now routing from ${expectedSourceChainLabel} to ${validRecipient && resolvedRecipientAddress ? formatContactLabel(resolvedRecipientAddress) : recipient} on ${destinationChainLabel}.`
    : `${amount} ${token} sent to ${validRecipient && resolvedRecipientAddress ? formatContactLabel(resolvedRecipientAddress) : recipient} via ${selectedRouteConfig.label}.`;
  const successStatus = isBridgeRoute ? "Bridged" : "Finalized";
  const receiptTitle = isBridgeRoute ? "Arc Bridge" : "Arc Flow";
  const receiptStatus = isBridgeRoute ? "Bridging settled" : "Settled";
  const receiptNote = isBridgeRoute
    ? `${expectedSourceChainLabel} → ${destinationChainLabel}`
    : "Arc Testnet";
  const receiptShareText = validRecipient && resolvedRecipientAddress
    ? isBridgeRoute
      ? `Bridged ${amount} ${token} from ${expectedSourceChainLabel} to ${destinationChainLabel} for ${formatContactLabel(resolvedRecipientAddress)}`
      : `Sent ${amount} ${token} on Arc to ${formatContactLabel(resolvedRecipientAddress)}`
    : undefined;
  const canSend =
    isConnected &&
    validRecipient &&
    amount &&
    Number(amount) > 0 &&
    status !== "sending" &&
    status !== "confirming" &&
    isOnExpectedSourceChain &&
    (!isBridgeRoute || token === "USDC");
  // ETAs prefer the live estimate when the SDK provides one; otherwise fall
  // back to coarse defaults based on testnet observations.
  const isFast = bridgeSpeed === "FAST";
  const attestationEta = liveEta.attestation
    ? formatEtaSeconds(liveEta.attestation)
    : isFast ? "~30s" : "~3-5 min";
  const bridgeStepDefs: { key: BridgeStepKey; label: string; eta: string }[] = [
    { key: "approve", label: "Approve USDC spend", eta: "~10s" },
    { key: "burn", label: "Burn on source chain", eta: "~15s" },
    { key: "fetchAttestation", label: "Wait for Circle attestation", eta: attestationEta },
    { key: "mint", label: useForwarder ? "Forwarder mints on destination" : "Mint on destination chain", eta: useForwarder ? "auto" : "~15s" },
  ];

  function resetBridgeFeedback() {
    setBridgeEstimateText("");
    setBridgeDetails([]);
    setBridgeProgress("");
    setError("");
    setLiveEta({});
    setBridgeSteps({ approve: "pending", burn: "pending", fetchAttestation: "pending", mint: "pending" });
  }

  async function getActiveWalletClient() {
    if (walletClient) return walletClient;
    if (!authProvider || !address) return null;
    return createWalletClient({
      account: address,
      chain: sourceViemChain,
      transport: custom(authProvider),
    });
  }

  async function getActiveProvider() {
    if (wagmiConnected && connector?.getProvider) {
      try {
        const provider = (await connector.getProvider()) as EIP1193Provider | undefined;
        if (provider) return provider;
      } catch {
        // fall through to other sources
      }
    }
    if (authProvider) return authProvider as EIP1193Provider;

    const injectedProvider = (globalThis as typeof globalThis & {
      ethereum?: EIP1193Provider;
    }).ethereum;

    return injectedProvider ?? null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient || !address) return;

    const activeWalletClient = await getActiveWalletClient();
    if (!activeWalletClient) {
      setStatus("error");
      setError("Wallet signer unavailable. Reconnect your social wallet and try again.");
      return;
    }

    setStatus("sending");
    setError("");
    setTxHash("");
    setBridgeEstimateText("");
    setBridgeDetails([]);
    setBridgeProgress("");

    if (isBridgeRoute && !isOnExpectedSourceChain) {
      setStatus("error");
      setError(`Switch wallet to ${expectedSourceChainLabel}.`);
      return;
    }

    try {
      if (isBridgeRoute) {
        const provider = await getActiveProvider();
        if (!provider || !resolvedRecipientAddress) {
          throw new Error("Wallet provider unavailable for crosschain transfer");
        }
        const estimate = await estimateBridgeTransfer(
          provider,
          selectedRouteConfig,
          resolvedRecipientAddress,
          amount,
          bridgeSpeed,
          useForwarder
        );
        const estimateSummary = summarizeBridgeEstimate(estimate);
        setBridgeEstimateText(
          estimateSummary.feeCount || estimateSummary.gasFeeCount
            ? `Estimated ${estimateSummary.feeCount} fee item(s), ${estimateSummary.gasFeeCount} gas item(s)`
            : "Estimate ready"
        );
        setBridgeDetails([...estimateSummary.feeLabels, ...estimateSummary.gasLabels]);
        setLiveEta({ total: estimateSummary.totalEtaSeconds, attestation: estimateSummary.attestationEtaSeconds });
        if (useForwarder && estimateSummary.totalUsdcFees >= Number(amount)) {
          setStatus("error");
          setError(`Forwarder fee is ~${estimateSummary.totalUsdcFees.toFixed(6)} USDC, higher than this transfer. Increase amount or turn off Auto forwarder.`);
          return;
        }
        setBridgeProgress("Waiting for wallet confirmation");
        setStatus("confirming");

        const result = await executeBridgeTransfer(
          provider,
          selectedRouteConfig,
          resolvedRecipientAddress,
          amount,
          bridgeSpeed,
          (event) => {
            setBridgeProgress(event.state ? `${event.label} • ${event.state}` : event.label);
            if (event.state === "error" || event.state === "failed") {
              setError(event.errorMessage || `${event.label} failed`);
            }
            if (event.txHash) setTxHash(event.txHash);
            const key = event.method as BridgeStepKey;
            const order: BridgeStepKey[] = ["approve", "burn", "fetchAttestation", "mint"];
            const idx = order.indexOf(key);
            if (idx >= 0) {
              const isDone = event.state === "completed" || event.state === "success";
              const hasError = event.state === "error" || event.state === "failed";
              setBridgeSteps((prev) => {
                const next = { ...prev };
                // Mark all earlier steps done.
                for (let i = 0; i < idx; i++) next[order[i]] = next[order[i]] === "pending" ? "done" : next[order[i]];
                next[key] = hasError ? "error" : isDone ? "done" : "active";
                return next;
              });
            }
          },
          useForwarder
        );

        const lastStepWithHash = [...(result.steps || [])]
          .reverse()
          .find((step) => {
            const stepRecord = step as { txHash?: string; data?: unknown };
            const stepData = stepRecord.data as { txHash?: string } | undefined;
            return !!(stepRecord.txHash || stepData?.txHash);
          });
        const bridgeStepRecord = lastStepWithHash as { txHash?: string; data?: unknown } | undefined;
        const bridgeStepData = bridgeStepRecord?.data as { txHash?: string } | undefined;
        const bridgeHash = bridgeStepRecord?.txHash || bridgeStepData?.txHash || "";
        setTxHash(bridgeHash);
        setShowSaveRecipient(!resolvedRecipient.contact && !!resolvedRecipientAddress);
        setStatus(result.state === "error" ? "error" : "success");
        if (result.state === "error") {
          setError(getBridgeErrorMessage(result));
        } else if (bridgeHash && resolvedRecipientAddress) {
          saveLocalTransfer({
            from: address,
            to: resolvedRecipientAddress,
            value: parseUnits(amount, TOKENS[token].decimals).toString(),
            token,
            txHash: bridgeHash,
            direction: "sent",
            routeLabel: selectedRouteConfig.label,
          });
        }
        return;
      }

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
      if (resolvedRecipientAddress) {
        saveLocalTransfer({
          from: address,
          to: resolvedRecipientAddress,
          value: parsedAmount.toString(),
          token,
          txHash: hash,
          direction: "sent",
          routeLabel: selectedRouteConfig.label,
        });
      }
      setShowSaveRecipient(!resolvedRecipient.contact && !!resolvedRecipientAddress);
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
        setError("Transaction failed");
      }
    }
  }

  function handleSaveRecipient() {
    if (!resolvedRecipientAddress || !saveName.trim()) return;
    upsertContactByAddress(resolvedRecipientAddress, {
      name: saveName.trim(),
      handle: saveHandle,
      avatar: saveAvatar,
    });
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
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="glass-panel-strong rounded-[32px] p-8">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                {successEyebrow}
              </p>
              <h2 className="text-4xl font-semibold tracking-tight text-glow">
                {successHeadline}
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                {successDescription}
              </p>

              {isBridgeRoute && (
                <div className="mt-8 rounded-[28px] border border-white/8 bg-white/[0.05] p-6">
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Bridge timeline</p>
                  <div className="space-y-3">
                    {bridgeStepDefs.map((step, index) => {
                      const s = bridgeSteps[step.key];
                      const done = s === "done";
                      const active = s === "active";
                      const errored = s === "error";
                      return (
                        <div key={step.key} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${errored ? "bg-red-500 text-white" : done ? "bg-emerald-500 text-white" : active ? "bg-indigo-500 text-white animate-pulse" : "bg-white/10 text-zinc-500"}`}>
                              {errored ? "!" : done ? "✓" : index + 1}
                            </span>
                            <span className={errored ? "text-red-300" : done ? "text-emerald-400" : active ? "text-indigo-300" : "text-zinc-500"}>{step.label}</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{done ? "done" : step.eta}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-8 rounded-[28px] border border-white/8 bg-white/[0.05] p-6">
                <div className="flex items-center justify-between border-b border-white/8 pb-4">
                  <div>
                    <p className="text-sm text-zinc-500">Amount</p>
                    <p className="mt-1 text-3xl font-semibold text-zinc-100">
                      {amount} {token}
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    {successStatus}
                  </div>
                </div>
                <div className="space-y-4 pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Recipient</span>
                    <span className="text-zinc-300">{validRecipient && resolvedRecipientAddress ? formatContactLabel(resolvedRecipientAddress) : recipient}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Route</span>
                    <span className="text-zinc-300">{selectedRouteConfig.label}</span>
                  </div>
                  {isBridgeRoute && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Path</span>
                      <span className="text-right text-zinc-300">
                        {expectedSourceChainLabel} → {destinationChainLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {showSaveRecipient && resolvedRecipientAddress && (
                <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.04] p-5 space-y-3">
                  <p className="text-sm font-medium text-zinc-200">Save this recipient</p>
                  <input
                    type="text"
                    placeholder="Name"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="@username"
                      value={saveHandle}
                      onChange={(e) => setSaveHandle(e.target.value)}
                      className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Avatar"
                      value={saveAvatar}
                      onChange={(e) => setSaveAvatar(e.target.value)}
                      maxLength={4}
                      className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSaveRecipient}
                    className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/14"
                  >
                    Save recipient
                  </button>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={resetForm}
                  className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/12"
                >
                  Bridge another
                </button>
                {txHash && (
                  <a
                    href={`${routeExplorerUrl}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-btn rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white"
                  >
                    View transaction
                  </a>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-8">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                Receipt card
              </p>
              {resolvedRecipient.contact && resolvedRecipientAddress && (
                <div className="mb-4">
                  <ProfileChip
                    contact={resolvedRecipient.contact}
                    address={resolvedRecipientAddress}
                  />
                </div>
              )}
              <ReceiptCard
                title={receiptTitle}
                amount={amount}
                token={token}
                status={receiptStatus}
                fromLabel={address ? senderLabel : "Connected wallet"}
                toLabel={validRecipient && resolvedRecipientAddress ? formatContactLabel(resolvedRecipientAddress) : recipient}
                note={receiptNote}
                shareText={receiptShareText}
                txHash={txHash}
                explorerUrl={txHash ? `${routeExplorerUrl}/tx/${txHash}` : undefined}
              />
              <p className="mt-5 text-sm leading-6 text-zinc-500">
                This is the direction the product should lean into, payment moments and sharable receipts, not dead dashboard panels.
              </p>
            </div>
          </div>
        ) : (
          <div className="bridge-v2">
            <header className="bridge-v2-header">
              <h1>Bridge</h1>
              <button
                type="button"
                aria-label="Bridge history"
                className="bridge-v2-history"
                onClick={() => setHistoryOpen(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 14"/></svg>
                {bridgeHistory.length > 0 && <span className="bridge-history-dot" aria-hidden="true">{bridgeHistory.length}</span>}
              </button>
            </header>

            <form onSubmit={handleSend} className="space-y-4">
              <div className="bridge-token-row">
                {(Object.keys(TOKENS) as TokenKey[]).map((key) => {
                  const isActive = token === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setToken(key); resetBridgeFeedback(); }}
                      className={`bridge-token-pill${isActive ? " active" : ""}`}
                    >
                      <TokenLogo symbol={key} size={22} />
                      <span>{TOKENS[key].symbol}</span>
                      {isActive && (
                        <span className="bridge-token-check" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {currentBalance !== undefined && (
                <p className="bridge-balance-line">Balance: <span>{formatAmount(currentBalance, currentDecimals)} {token}</span></p>
              )}

              <div className="bridge-network-card">
                <p className="bridge-network-eyebrow">You send</p>
                <div className="bridge-network-row">
                  {direction === "out" ? (
                    <div className="bridge-network-icon arc"><span>A</span></div>
                  ) : (
                    <div className="bridge-network-icon"><TokenLogo symbol="USDC" size={26} /></div>
                  )}
                  <div className="bridge-network-name">{expectedSourceChainLabel}</div>
                  <span className="bridge-network-tag">Source</span>
                </div>
                <div className="bridge-network-meta">
                  <span>Network</span>
                  <span>{expectedSourceChainLabel}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setDirection((d) => (d === "out" ? "in" : "out")); resetBridgeFeedback(); }}
                className="bridge-arrow-orb"
                aria-label="Swap bridge direction"
                title="Swap direction"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </button>

              <div className="bridge-network-card">
                <p className="bridge-network-eyebrow">You receive</p>
                <div className="bridge-network-row">
                  {direction === "in" ? (
                    <div className="bridge-network-icon arc"><span>A</span></div>
                  ) : (
                    <div className="bridge-network-icon"><TokenLogo symbol="USDC" size={26} /></div>
                  )}
                  <div className="bridge-network-name">{destinationChainLabel}</div>
                  <span className="bridge-network-tag dest">Destination</span>
                </div>
                <div className="bridge-network-meta">
                  <span>Network</span>
                  <span>{destinationChainLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDestPickerOpen(true)}
                  className="bridge-choose-dest"
                >
                  <span>Choose destination</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <div className="bridge-amount-card">
                <p className="bridge-network-eyebrow">Amount</p>
                <div className="bridge-amount-input-row">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); resetBridgeFeedback(); }}
                    min="0"
                    step="any"
                    inputMode="decimal"
                    className="bridge-amount-input"
                  />
                  <div className="bridge-amount-token">
                    <TokenLogo symbol={token} size={20} />
                    <span>{token}</span>
                  </div>
                </div>
                <p className="bridge-amount-usd">≈ ${amount && Number(amount) > 0 ? Number(amount).toFixed(2) : "0.00"}</p>

                <div className="bridge-meta-row">
                  <div className="bridge-meta-item">
                    <span className="bridge-meta-label">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Est. time
                    </span>
                    <span className="bridge-meta-value">{liveEta.total ? formatEtaSeconds(liveEta.total) : attestationEta}</span>
                  </div>
                  <div className="bridge-meta-divider" aria-hidden="true" />
                  <div className="bridge-meta-item">
                    <span className="bridge-meta-label">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Fee
                    </span>
                    <span className="bridge-meta-value">~0.0001 {token}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTxDetails((v) => !v)}
                  className="bridge-tx-details-toggle"
                  aria-expanded={showTxDetails}
                >
                  <span>Transaction details</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showTxDetails ? "rotate(90deg)" : "none", transition: "transform .2s ease" }}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                {showTxDetails && (
                  <div className="bridge-tx-details">
                    <div className="bridge-tx-row">
                      <span>Route</span>
                      <span>{selectedRouteConfig.label}</span>
                    </div>
                    <div className="bridge-tx-row">
                      <span>Path</span>
                      <span>{expectedSourceChainLabel} → {destinationChainLabel}</span>
                    </div>
                    <div className="bridge-tx-row">
                      <span>Recipient</span>
                      <span className="font-mono text-[11px]">
                        {validRecipient && resolvedRecipientAddress
                          ? (resolvedRecipientAddress.toLowerCase() === address?.toLowerCase() ? "Self" : formatAddress(resolvedRecipientAddress))
                          : "—"}
                        <button type="button" onClick={() => setRecipientEditOpen((v) => !v)} className="bridge-tx-edit">Edit</button>
                      </span>
                    </div>
                    <div className="bridge-tx-row"><span>Source USDC</span><span className="font-mono text-[11px]">{formatAddress(sourceUsdcAddress)}</span></div>
                    <div className="bridge-tx-row"><span>Destination USDC</span><span className="font-mono text-[11px]">{formatAddress(destinationUsdcAddress)}</span></div>
                    {recipientEditOpen && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="0x... or @username"
                          value={recipient}
                          onChange={(e) => { setRecipient(e.target.value); resetBridgeFeedback(); }}
                          className="bridge-recipient-input"
                        />
                        {recipient && !validRecipient && (
                          <p className="mt-2 text-xs text-red-400">Enter a valid address or a saved @username</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isOnExpectedSourceChain && (() => {
                const walletChainMeta = Object.values(CHAIN_METADATA).find((c) => c.chainId === activeChainId);
                const walletIsPartner = walletChainMeta && PARTNER_CHAINS.some((p) => CHAIN_METADATA[p].chainId === activeChainId);
                const walletIsArc = activeChainId === CHAIN_METADATA.Arc_Testnet.chainId;
                // Reverse is only meaningful when the user's wallet is on a chain that's part of the bridge pair (Arc or current partner)
                const canReverse = walletIsArc || walletIsPartner;
                return (
                  <div className="bridge-network-warning">
                    <p>
                      Need <strong>{expectedSourceChainLabel}</strong> in your wallet.
                      {walletChainMeta && <span className="bridge-warn-sub"> Currently on {walletChainMeta.label}.</span>}
                    </p>
                    <div className="bridge-warn-actions">
                      {canReverse && (
                        <button
                          type="button"
                          onClick={() => {
                            // If wallet is on Arc → outbound; if wallet is on a partner → inbound to Arc (and lock that partner)
                            if (walletIsArc) {
                              setDirection("out");
                            } else if (walletChainMeta) {
                              const matched = PARTNER_CHAINS.find((p) => CHAIN_METADATA[p].chainId === activeChainId);
                              if (matched) setPartner(matched);
                              setDirection("in");
                            }
                            resetBridgeFeedback();
                          }}
                          className="bridge-warn-reverse"
                        >
                          ↻ Bridge from {walletChainMeta?.label ?? "current network"}
                        </button>
                      )}
                      {canSwitchSourceChain && (
                        <button
                          type="button"
                          onClick={() => {
                            resetBridgeFeedback();
                            const switcher = wagmiConnected
                              ? switchChainAsync({ chainId: expectedSourceChainId })
                              : switchAuthChain(expectedSourceChainId);
                            switcher.catch((err) => {
                              setError(err instanceof Error ? err.message.slice(0, 160) : "Failed to switch network");
                            });
                          }}
                        >
                          Switch network
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {isBridgeRoute && token !== "USDC" && (
                <p className="text-center text-xs text-amber-400">Crosschain route currently supports USDC only.</p>
              )}

              {(status === "sending" || status === "confirming") && isBridgeRoute && (
                <div className="bridge-progress-card">
                  {bridgeStepDefs.map((step, index) => {
                    const s = bridgeSteps[step.key];
                    const done = s === "done";
                    const active = s === "active";
                    const errored = s === "error";
                    return (
                      <div key={step.key} className="bridge-progress-row">
                        <span className={`bridge-progress-dot ${errored ? "err" : done ? "done" : active ? "active" : ""}`}>
                          {errored ? "!" : done ? "✓" : index + 1}
                        </span>
                        <span className={`bridge-progress-label ${errored ? "err" : done ? "done" : active ? "active" : ""}`}>{step.label}</span>
                        <span className="bridge-progress-eta">{done ? "done" : step.eta}</span>
                      </div>
                    );
                  })}
                  {bridgeProgress && <p className="bridge-progress-note">{bridgeProgress}</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSend}
                className="primary-btn bridge-cta w-full rounded-2xl px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {status === "sending" || status === "confirming" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {status === "sending" ? "Preparing..." : isBridgeRoute ? "Bridging..." : "Confirming..."}
                  </span>
                ) : (
                  "Bridge Now"
                )}
              </button>

              {status === "error" && error && (
                <p className="text-center text-sm text-red-400">{error}</p>
              )}
            </form>

            {destPickerOpen && (
              <div className="bridge-sheet-backdrop" onClick={() => setDestPickerOpen(false)}>
                <div className="bridge-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose destination">
                  <div className="bridge-sheet-handle" aria-hidden="true" />
                  <div className="bridge-sheet-header">
                    <h3>Choose destination</h3>
                    <button type="button" onClick={() => setDestPickerOpen(false)} aria-label="Close">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="bridge-sheet-list">
                    {PARTNER_CHAINS.map((chain) => {
                      const meta = CHAIN_METADATA[chain];
                      const active = partner === chain;
                      return (
                        <button
                          key={chain}
                          type="button"
                          onClick={() => { setPartner(chain); resetBridgeFeedback(); }}
                          className={`bridge-sheet-row${active ? " active" : ""}`}
                        >
                          <div className="bridge-sheet-row-icon"><TokenLogo symbol="USDC" size={28} /></div>
                          <div className="bridge-sheet-row-text">
                            <p className="bridge-sheet-row-name">{meta.label}</p>
                            <p className="bridge-sheet-row-sub">USDC · Bridge</p>
                          </div>
                          <span className={`bridge-sheet-radio${active ? " on" : ""}`} aria-hidden="true">
                            {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setDestPickerOpen(false)} className="primary-btn bridge-sheet-cta w-full rounded-2xl px-4 py-4 font-semibold text-white">
                    Select destination
                  </button>
                </div>
              </div>
            )}

            {historyOpen && (
              <div className="bridge-sheet-backdrop" onClick={() => setHistoryOpen(false)}>
                <div className="bridge-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Bridge history">
                  <div className="bridge-sheet-handle" aria-hidden="true" />
                  <div className="bridge-sheet-header">
                    <h3>Bridge history</h3>
                    <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="bridge-history-list">
                    {bridgeHistory.length === 0 ? (
                      <div className="bridge-history-empty">
                        <div className="bridge-history-empty-orb" aria-hidden="true">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
                        </div>
                        <p className="bridge-history-empty-title">No bridges yet</p>
                        <p className="bridge-history-empty-sub">Your bridge transactions will appear here.</p>
                      </div>
                    ) : (
                      bridgeHistory.map((tx) => {
                        const isOngoing = !tx.txHash;
                        const fromTo = (tx.routeLabel || "").split("→").map((s) => s.trim());
                        const fromLabel = fromTo[0] || "";
                        const toLabel = fromTo[1] || "";
                        const meta = Object.values(CHAIN_METADATA).find((c) => c.label === fromLabel);
                        const explorerBase = meta?.explorerUrl;
                        const ageMs = bridgeHistoryNow - tx.createdAt;
                        const ageMin = Math.max(1, Math.round(ageMs / 60000));
                        const ageLabel = ageMs < 3600000 ? `${ageMin}m ago` : ageMs < 86400000 ? `${Math.round(ageMs / 3600000)}h ago` : `${Math.round(ageMs / 86400000)}d ago`;
                        return (
                          <a
                            key={tx.id}
                            href={tx.txHash && explorerBase ? `${explorerBase}/tx/${tx.txHash}` : undefined}
                            target={tx.txHash ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className={`bridge-history-row${isOngoing ? " ongoing" : ""}`}
                          >
                            <div className="bridge-history-row-icon">
                              <TokenLogo symbol={tx.token} size={28} />
                            </div>
                            <div className="bridge-history-row-text">
                              <p className="bridge-history-row-name">
                                {formatAmount(BigInt(tx.value || "0"), TOKENS[tx.token].decimals)} {tx.token}
                              </p>
                              <p className="bridge-history-row-sub">
                                {fromLabel} <span className="bridge-history-arrow">→</span> {toLabel}
                              </p>
                            </div>
                            <div className="bridge-history-row-side">
                              <span className={`bridge-history-status ${isOngoing ? "ongoing" : "done"}`}>
                                {isOngoing ? "Pending" : "Done"}
                              </span>
                              <span className="bridge-history-age">{ageLabel}</span>
                            </div>
                          </a>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
