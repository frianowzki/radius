"use client";

import { useMemo, useState } from "react";
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

  const directoryEntries = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    if (!mounted) return [] as DirectoryEntry[];
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
  }, [mounted, address, directoryQuery]);

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
          <div>
            <form onSubmit={handleSend} className="space-y-5">
              <div className="glass-panel-strong rounded-[32px] p-8">
                <div className="flex items-start gap-4">
                  <div className="bridge-header-icon shrink-0">A</div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-glow">Crosschains Bridge</h2>
                    <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">Move USDC between supported testnets without mixing it into your simple Arc sends.</p>
                  </div>
                </div>
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
                      className={`bridge-choice relative rounded-2xl px-4 py-4 text-sm font-medium transition-all ${
                        token === key
                          ? "border border-indigo-400/30 bg-indigo-500/15 text-indigo-300"
                          : "border border-white/6 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      {token === key && <span className="card-check">✓</span>}
                      <div className="flex items-center gap-2 font-semibold"><TokenLogo symbol={key} size={26} />{TOKENS[key].symbol}</div>
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
                      className={`bridge-choice relative rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                        selectedRoute === route.id
                          ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-300"
                          : "border-white/6 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      {selectedRoute === route.id && <span className="card-check">✓</span>}
                      <div className="font-medium">{route.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{route.token} • {route.mode}</div>
                    </button>
                  ))}
                </div>
                {isBridgeRoute && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div className="bridge-info-card rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="flex items-center gap-2 text-zinc-500"><TokenLogo symbol="USDC" size={22} />Source USDC</p>
                        <p className="mt-1 break-all font-mono text-zinc-300">{sourceUsdcAddress}</p>
                      </div>
                      <div className="bridge-info-card rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="flex items-center gap-2 text-zinc-500"><TokenLogo symbol="USDC" size={22} />Destination USDC</p>
                        <p className="mt-1 break-all font-mono text-zinc-300">{destinationUsdcAddress}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bridge-info-card mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-xs leading-6">
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
                        const switcher = wagmiConnected
                          ? switchChainAsync({ chainId: expectedSourceChainId })
                          : switchAuthChain(expectedSourceChainId);
                        switcher.catch((err) => {
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
                  <span className="text-xs text-zinc-500"></span>
                </div>

                <div className="bridge-info-card mb-3 rounded-[24px] border border-white/8 bg-white/[0.03] p-3">
                  <input
                    type="text"
                    placeholder="Search people or @username"
                    value={directoryQuery}
                    onChange={(e) => {
                      setDirectoryQuery(e.target.value);
                      setShowDirectory(true);
                      resetBridgeFeedback();
                    }}
                    className="bridge-input mb-3 w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />

                  {showDirectory && (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {directoryEntries.map((entry) => (
                      <button
                        key={`${entry.kind}-${entry.handle || entry.address || entry.name}`}
                        type="button"
                        onClick={() => handleSelectDirectoryEntry(entry)}
                        disabled={entry.kind === "self" || !entry.address}
                        className="bridge-directory-row flex w-full items-center justify-between rounded-2xl border border-white/6 bg-white/[0.04] px-4 py-3 text-left text-sm transition-colors hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-60"
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
                        <div className="bridge-directory-row rounded-2xl border border-white/6 bg-white/[0.04] px-4 py-4 text-sm text-zinc-500">
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
                  className="bridge-input w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
                {recipient && !validRecipient && (
                  <p className="mt-2 text-xs text-red-400">Enter a valid address or a saved @username</p>
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
                    className="bridge-input w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 pr-16 text-lg font-medium text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-sm font-medium text-zinc-400">
                    <TokenLogo symbol={token} size={22} />{token}
                  </span>
                </div>
              </div>


              {isBridgeRoute && (
                <div className="glass-panel rounded-[28px] p-5">
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
                  <p className="mt-4 text-xs text-zinc-500">
                    {bridgeProgress || "Timeline updates once the bridge starts."}
                    {liveEta.total ? ` · Total ${formatEtaSeconds(liveEta.total)}` : ""}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSend}
                className="primary-btn w-full rounded-2xl px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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

          </div>
        )}
      </div>
    </AppShell>
  );
}
