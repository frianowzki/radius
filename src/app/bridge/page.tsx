"use client";

import { useMemo, useState } from "react";
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
import type { EIP1193Provider } from "viem";
import { AppShell } from "@/components/AppShell";
import { ReceiptCard } from "@/components/ReceiptCard";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { ProfileChip } from "@/components/ProfileChip";
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
  type BridgeSpeed,
} from "@/lib/appkit";
import {
  formatAddress,
  formatAmount,
  formatContactLabel,
  getDirectoryEntries,
  getIdentityLabel,
  getIdentityProfile,
  resolveRecipientInput,
  saveLocalTransfer,
  upsertContactByAddress,
} from "@/lib/utils";
import type { DirectoryEntry } from "@/lib/utils";

type SendStatus = "idle" | "sending" | "confirming" | "success" | "error";

export default function BridgePage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const isSocialWalletOnly = authenticated && !wagmiConnected;
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
  const identity = getIdentityProfile();
  const senderLabel = getIdentityLabel(identity);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [showDirectory, setShowDirectory] = useState(true);
  const [showSaveRecipient, setShowSaveRecipient] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveHandle, setSaveHandle] = useState("");
  const [saveAvatar, setSaveAvatar] = useState("");
  const bridgeRoutes = CROSSCHAIN_ROUTES.filter((route) => route.mode === "bridge");
  const [selectedRoute, setSelectedRoute] = useState<CrosschainRoute["id"]>(
    bridgeRoutes[0]?.id ?? CROSSCHAIN_ROUTES[0].id
  );
  const [bridgeEstimateText, setBridgeEstimateText] = useState("");
  const [bridgeDetails, setBridgeDetails] = useState<string[]>([]);
  const [bridgeSpeed, setBridgeSpeed] = useState<BridgeSpeed>("FAST");
  const [bridgeProgress, setBridgeProgress] = useState("");

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
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const isOnExpectedSourceChain = activeChainId === expectedSourceChainId;
  const canSwitchSourceChain = !isOnExpectedSourceChain && !!switchChainAsync;

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

  const directoryEntries = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return getDirectoryEntries(address).filter((entry) => {
      if (!query) return entry.kind === "contact";
      return [
        entry.name.toLowerCase(),
        entry.handle?.toLowerCase(),
        entry.address?.toLowerCase(),
        entry.note?.toLowerCase(),
        entry.bio?.toLowerCase(),
      ].some((value) => value?.includes(query));
    });
  }, [address, directoryQuery]);

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
    !isSocialWalletOnly &&
    (!isBridgeRoute || token === "USDC");

  function resetBridgeFeedback() {
    setBridgeEstimateText("");
    setBridgeDetails([]);
    setBridgeProgress("");
    setError("");
  }

  async function getActiveWalletClient() {
    if (walletClient) return walletClient;
    if (!authProvider || !address) return null;
    return createWalletClient({
      account: address,
      chain: arcTestnet,
      transport: custom(authProvider),
    });
  }

  async function getActiveProvider() {
    if (authProvider) return authProvider as EIP1193Provider;

    const injectedProvider = (globalThis as typeof globalThis & {
      ethereum?: EIP1193Provider;
    }).ethereum;

    return injectedProvider ?? null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!publicClient || !address) return;
    if (isSocialWalletOnly) {
      setStatus("error");
      setError("Bridge currently requires an external wallet. Web3Auth social wallets can still send Arc → Arc, but Arc App Kit bridge is not stable with the embedded social provider yet.");
      return;
    }

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
          bridgeSpeed
        );
        const estimateSummary = summarizeBridgeEstimate(estimate);
        setBridgeEstimateText(
          estimateSummary.feeCount || estimateSummary.gasFeeCount
            ? `Estimated ${estimateSummary.feeCount} fee item(s), ${estimateSummary.gasFeeCount} gas item(s)`
            : "Estimate ready"
        );
        setBridgeDetails([...estimateSummary.feeLabels, ...estimateSummary.gasLabels]);
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
            if (event.txHash) setTxHash(event.txHash);
          }
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

  function handleSelectDirectoryEntry(entry: DirectoryEntry) {
    if (entry.kind !== "contact" || !entry.address) return;
    setRecipient(entry.handle ? `@${entry.handle}` : entry.address);
    setShowDirectory(false);
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
      <div className="mx-auto max-w-6xl">
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
                    className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/20"
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
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <form onSubmit={handleSend} className="space-y-5">
              <div className="glass-panel-strong rounded-[32px] p-8">
                <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                  Bridge USDC
                </p>
                <h2 className="text-4xl font-semibold tracking-tight text-glow">
                  Bridge USDC across testnets cleanly.
                </h2>
                <p className="mt-4 text-base leading-7 text-zinc-400">
                  Arc App Kit bridge flow separated from same-network payments so sending stays simple.
                </p>
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <label className="mb-3 block text-sm font-medium text-zinc-400">Token</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setToken(key);
                        resetBridgeFeedback();
                      }}
                      className={`rounded-2xl px-4 py-4 text-sm font-medium transition-all ${
                        token === key
                          ? "border border-indigo-400/30 bg-indigo-500/15 text-indigo-300"
                          : "border border-white/6 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="font-semibold">{TOKENS[key].symbol}</div>
                      {currentBalance !== undefined && token === key && (
                        <div className="mt-1 text-xs opacity-70">
                          Balance: {formatAmount(currentBalance, currentDecimals)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-400">Route</label>
                  <span className="text-xs text-zinc-500">Arc App Kit Bridge</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {bridgeRoutes.map((route) => (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoute(route.id);
                        resetBridgeFeedback();
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                        selectedRoute === route.id
                          ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-300"
                          : "border-white/6 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="font-medium">{route.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{route.token} • {route.mode}</div>
                    </button>
                  ))}
                </div>
                {isBridgeRoute && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-2 text-xs font-medium text-zinc-500">Bridge speed</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(["FAST", "SLOW"] as BridgeSpeed[]).map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => {
                              setBridgeSpeed(speed);
                              resetBridgeFeedback();
                            }}
                            className={`rounded-2xl border px-4 py-3 text-left text-xs transition-all ${
                              bridgeSpeed === speed
                                ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-300"
                                : "border-white/6 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.06]"
                            }`}
                          >
                            <span className="block font-semibold">{speed === "FAST" ? "Fast" : "Standard"}</span>
                            <span className="mt-1 block text-zinc-500">
                              {speed === "FAST" ? "Faster relay, may be less wallet-friendly" : "Slower, usually more reliable"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-zinc-500">Source USDC</p>
                        <p className="mt-1 break-all font-mono text-zinc-300">{sourceUsdcAddress}</p>
                      </div>
                      <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-zinc-500">Destination USDC</p>
                        <p className="mt-1 break-all font-mono text-zinc-300">{destinationUsdcAddress}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-xs leading-6">
                  <p className="text-zinc-400">Source wallet network</p>
                  <p className={`mt-1 font-medium ${isOnExpectedSourceChain ? "text-emerald-300" : "text-amber-300"}`}>
                    {isOnExpectedSourceChain
                      ? `Connected to ${expectedSourceChainLabel}`
                      : `Need ${expectedSourceChainLabel}`}
                  </p>
                  {canSwitchSourceChain && (
                    <button
                      type="button"
                      onClick={() => {
                        resetBridgeFeedback();
                        switchChainAsync({ chainId: expectedSourceChainId }).catch((err) => {
                          setError(err instanceof Error ? err.message.slice(0, 160) : "Failed to switch network");
                        });
                      }}
                      className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/14"
                    >
                      Switch to {expectedSourceChainLabel}
                    </button>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-400">Recipient</label>
                  <span className="text-xs text-zinc-500">Directory-first</span>
                </div>

                <div className="mb-3 rounded-[24px] border border-white/8 bg-white/[0.03] p-3">
                  <input
                    type="text"
                    placeholder="Search people or @username"
                    value={directoryQuery}
                    onChange={(e) => {
                      setDirectoryQuery(e.target.value);
                      setShowDirectory(true);
                      resetBridgeFeedback();
                    }}
                    className="mb-3 w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />

                  {showDirectory && (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {directoryEntries.map((entry) => (
                      <button
                        key={`${entry.kind}-${entry.handle || entry.address || entry.name}`}
                        type="button"
                        onClick={() => handleSelectDirectoryEntry(entry)}
                        disabled={entry.kind === "self" || !entry.address}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/6 bg-white/[0.04] px-4 py-3 text-left text-sm transition-colors hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-60"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-200">{entry.name}</span>
                            {entry.handle && (
                              <span className="text-xs text-zinc-500">@{entry.handle}</span>
                            )}
                          </div>
                          {(entry.note || entry.bio) && (
                            <p className="mt-1 text-xs text-zinc-500">{entry.note || entry.bio}</p>
                          )}
                        </div>
                        <span className="text-xs text-zinc-500">
                          {entry.kind === "self" ? "You" : entry.address ? formatAddress(entry.address) : ""}
                        </span>
                      </button>
                    ))}
                      {directoryEntries.length === 0 && (
                        <div className="rounded-2xl border border-white/6 bg-white/[0.04] px-4 py-4 text-sm text-zinc-500">
                          No matching people yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="0x... or @username"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    resetBridgeFeedback();
                  }}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
                {recipient && !validRecipient && (
                  <p className="mt-2 text-xs text-red-400">Enter a valid address or a saved @username</p>
                )}
                {isSocialWalletOnly && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Bridge currently requires an external wallet. Social wallets can still use Send on Arc.
                  </div>
                )}

                {isBridgeRoute && token !== "USDC" && (
                  <p className="mt-2 text-xs text-amber-400">Crosschain route currently supports USDC only.</p>
                )}
              </div>

              <div className="glass-panel rounded-[28px] p-5">
                <label className="mb-3 block text-sm font-medium text-zinc-400">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      resetBridgeFeedback();
                    }}
                    min="0"
                    step="any"
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 pr-16 text-lg font-medium text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400">
                    {token}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSend}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-4 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {status === "sending" || status === "confirming" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {status === "sending" ? "Sending..." : isBridgeRoute ? "Bridging..." : "Confirming..."}
                  </span>
                ) : (
                  `Send ${token}`
                )}
              </button>

              {isBridgeRoute && bridgeProgress && status !== "error" && (
                <p className="text-center text-sm text-zinc-400">
                  {bridgeProgress}. CCTP attestation can take a few minutes, especially on testnets.
                </p>
              )}

              {status === "error" && error && (
                <p className="text-center text-sm text-red-400">{error}</p>
              )}
            </form>

            <div className="space-y-5">
              <PrivacyBadge />

              <div className="glass-panel rounded-[32px] p-6">
                <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                  Payment story
                </p>
                <div className="mb-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4 text-sm">
                  <p className="text-zinc-500">Selected route</p>
                  <p className="mt-1 font-medium text-zinc-200">
                    {selectedRouteConfig.label}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-500">
                    {isBridgeRoute
                      ? "This route uses Arc App Kit’s CCTP bridge flow: estimate fees, burn on source, wait for Circle attestation, then mint on destination."
                      : "This route uses Arc App Kit-style same-chain send behavior on Arc Testnet."}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    {isBridgeRoute
                      ? `You are moving value from ${expectedSourceChainLabel} to ${destinationChainLabel} for the recipient.`
                      : "You are sending directly on Arc without a bridge step."}
                  </p>
                  {isBridgeRoute && (
                    <p className="mt-2 text-xs leading-6 text-zinc-400">
                      Speed: {bridgeSpeed === "FAST" ? "Fast" : "Standard"}
                    </p>
                  )}
                  {bridgeProgress && (
                    <p className="mt-2 text-xs leading-6 text-indigo-300">{bridgeProgress}</p>
                  )}
                  {bridgeEstimateText && (
                    <p className="mt-2 text-xs leading-6 text-indigo-300">{bridgeEstimateText}</p>
                  )}
                  {bridgeDetails.length > 0 && (
                    <div className="mt-3 space-y-2 text-xs leading-6 text-zinc-400">
                      {bridgeDetails.map((detail) => (
                        <p key={detail} className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2">
                          {detail}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                {resolvedRecipient.contact && resolvedRecipientAddress && (
                  <div className="mb-4">
                    <ProfileChip
                      contact={resolvedRecipient.contact}
                      address={resolvedRecipientAddress}
                    />
                  </div>
                )}
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
                  This should feel snappy and decisive.
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-500">
                  Arc’s speed should show up in the interface. No endless pending energy, no cluttered wallet panels, just a fast send flow with strong visual confirmation and a receipt worth sharing.
                </p>
              </div>

              <div className="glass-panel rounded-[32px] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-400">Live preview</p>
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                    Receipt-ready
                  </span>
                </div>
                <ReceiptCard
                  title="Bridge preview"
                  amount={amount && Number(amount) > 0 ? amount : "0.00"}
                  token={token}
                  status={isBridgeRoute ? "Bridge preview" : "Preview"}
                  fromLabel={address ? senderLabel : "Connect wallet"}
                  toLabel={validRecipient && resolvedRecipientAddress ? formatContactLabel(resolvedRecipientAddress) : "Waiting for address"}
                  note={isBridgeRoute ? `${expectedSourceChainLabel} → ${destinationChainLabel}` : "Arc Testnet"}
                  shareText={validRecipient && resolvedRecipientAddress ? isBridgeRoute ? `Planned bridge: ${amount && Number(amount) > 0 ? amount : "0.00"} ${token} from ${expectedSourceChainLabel} to ${destinationChainLabel} for ${formatContactLabel(resolvedRecipientAddress)}` : `Planned payment: ${amount && Number(amount) > 0 ? amount : "0.00"} ${token} to ${formatContactLabel(resolvedRecipientAddress)}` : undefined}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
