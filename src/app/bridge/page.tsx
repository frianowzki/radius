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
import {
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  codexTestnet,
  hyperliquidEvmTestnet,
  inkSepolia,
  lineaSepolia,
  monadTestnet,
  optimismSepolia,
  plumeSepolia,
  polygonAmoy,
  seiTestnet,
  sepolia,
  unichainSepolia,
  worldchainSepolia,
  xdcTestnet,
} from "viem/chains";
import { AppShell } from "@/components/AppShell";
import { ReceiptCard } from "@/components/ReceiptCard";
import { ProfileChip } from "@/components/ProfileChip";
import { TokenLogo } from "@/components/TokenLogo";
import { TOKENS, ERC20_TRANSFER_ABI, type TokenKey } from "@/config/tokens";
import {
  CHAIN_METADATA,
  CHAIN_USDC_ADDRESSES,
  CROSSCHAIN_ROUTES,
  type CrosschainChain,
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
  decimalToUnits,
  formatAddress,
  formatAmount,
  formatContactLabel,
  getDirectoryEntries,
  getIdentityLabel,
  getIdentityProfile,
  getLocalTransfers,
  getPaymentRequests,
  resolveRecipientInput,
  saveLocalTransfer,
  upsertContactByAddress,
} from "@/lib/utils";
import { pushRemoteActivity } from "@/lib/activity-sync";
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
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [showBridgeHistory, setShowBridgeHistory] = useState(false);
  const bridgeRoutes = CROSSCHAIN_ROUTES.filter((route) => route.mode === "bridge");
  const [selectedRoute, setSelectedRoute] = useState<CrosschainRoute["id"]>(
    bridgeRoutes[0]?.id ?? CROSSCHAIN_ROUTES[0].id
  );
  const [bridgeEstimateText, setBridgeEstimateText] = useState("");
  const [bridgeDetails, setBridgeDetails] = useState<string[]>([]);
  const [liveEta, setLiveEta] = useState<{ total?: number; attestation?: number }>({});
  const bridgeSpeed: BridgeSpeed = "FAST";
  const [useForwarder, setUseForwarder] = useState(true);
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
  const routeExplorerUrl = sourceChainMeta.explorerUrl;
  const sourceRoutes = bridgeRoutes.filter((route) => route.fromChain === selectedRouteConfig.fromChain);
  const bridgeHistory = mounted
    ? getLocalTransfers(address)
        .filter((transfer) => transfer.routeLabel?.includes("→") && transfer.token === "USDC")
        .slice(0, 8)
    : [];
  const chainByRoute: Partial<Record<CrosschainChain, Chain>> = {
    Arc_Testnet: arcTestnet,
    Ethereum_Sepolia: sepolia,
    Base_Sepolia: baseSepolia,
    Arbitrum_Sepolia: arbitrumSepolia,
    Avalanche_Fuji: avalancheFuji,
    Optimism_Sepolia: optimismSepolia,
    Polygon_Amoy_Testnet: polygonAmoy,
    Linea_Sepolia: lineaSepolia,
    Unichain_Sepolia: unichainSepolia,
    World_Chain_Sepolia: worldchainSepolia,
    Ink_Testnet: inkSepolia,
    Monad_Testnet: monadTestnet,
    HyperEVM_Testnet: hyperliquidEvmTestnet,
    Plume_Testnet: plumeSepolia,
    Sei_Testnet: seiTestnet,
    XDC_Apothem: xdcTestnet,
    Codex_Testnet: codexTestnet,
  };
  const sourceViemChain: Chain = chainByRoute[selectedRouteConfig.fromChain] ?? arcTestnet;
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
  const requestedRaw = amount && Number(amount) > 0 ? decimalToUnits(amount, currentDecimals) : BigInt(0);
  const hasEnoughBalance = typeof currentBalance === "bigint" ? currentBalance >= requestedRaw : false;
  const manualForwarderMessage = "Manual destination minting is temporarily disabled because Circle App Kit is reverting this mobile route with an invalid destination domain. Keep Auto Forwarder on for now.";
  const manualForwarderSupported = false;

  useEffect(() => {
    if (!showDestinationPicker) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [showDestinationPicker]);

  useEffect(() => {
    if (!showBridgeHistory) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [showBridgeHistory]);

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
    hasEnoughBalance &&
    (!isBridgeRoute || (token === "USDC" && (useForwarder || manualForwarderSupported)));
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
    if (!hasEnoughBalance) {
      setStatus("error");
      setError(`Insufficient ${token} balance on ${expectedSourceChainLabel}.`);
      return;
    }
    if (isBridgeRoute && !useForwarder && !manualForwarderSupported) {
      setStatus("error");
      setError(manualForwarderMessage);
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
          setError(`Auto Forwarder fee is ~${estimateSummary.totalUsdcFees.toFixed(6)} USDC, higher than this transfer. Turn Auto Forwarder off below and retry.`);
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
          void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
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
        void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
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

  function switchBridgeDirection() {
    const reverse = bridgeRoutes.find(
      (route) => route.fromChain === selectedRouteConfig.toChain && route.toChain === selectedRouteConfig.fromChain
    );
    if (!reverse) return;
    setSelectedRoute(reverse.id);
    resetBridgeFeedback();
  }

  function shortChainIcon(label: string) {
    return label.slice(0, 1).toUpperCase();
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
          <div className="bridge-redesign">
            <form onSubmit={handleSend} className="space-y-4">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-[#17151f]">Bridge</h2>
                  <p className="mt-1 text-xs text-[#8b8795]">Focused USDC bridge flow</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBridgeHistory(true)}
                  className="bridge-icon-btn"
                  aria-label="Open bridge history"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/></svg>
                </button>
              </div>

              <div className="bridge-premium-card p-3">
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setToken(key);
                        resetBridgeFeedback();
                      }}
                      className={`bridge-token-tab ${token === key ? "is-active" : ""}`}
                    >
                      <TokenLogo symbol={key} size={24} />
                      <span>{TOKENS[key].symbol}</span>
                      {token === key && <span className="ml-auto text-[11px]">✓</span>}
                    </button>
                  ))}
                </div>
                {currentBalance !== undefined && (
                  <p className="mt-3 px-1 text-xs text-[#8b8795]">Balance: {formatAmount(currentBalance, currentDecimals)} {token}</p>
                )}
              </div>

              <div className="bridge-premium-card space-y-3 p-4">
                <div className="bridge-chain-card">
                  <div className="flex items-center gap-3">
                    <span className="bridge-chain-avatar">{shortChainIcon(expectedSourceChainLabel)}</span>
                    <div>
                      <p className="text-[11px] text-[#8b8795]">You send</p>
                      <p className="font-semibold text-[#17151f]">{expectedSourceChainLabel}</p>
                    </div>
                  </div>
                  <span className="bridge-role-pill">Source</span>
                  <div className="mt-3 flex items-center justify-between border-t border-[#1b162b]/5 pt-3 text-xs">
                    <span className="text-[#8b8795]">Network</span>
                    <span className="font-semibold text-[#17151f]">{expectedSourceChainLabel}</span>
                  </div>
                </div>

                <button type="button" onClick={switchBridgeDirection} className="bridge-switch-btn" aria-label="Switch bridge direction">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                </button>

                <div className="bridge-chain-card">
                  <div className="flex items-center gap-3">
                    <span className="bridge-chain-avatar is-destination">{shortChainIcon(destinationChainLabel)}</span>
                    <div>
                      <p className="text-[11px] text-[#8b8795]">You receive</p>
                      <p className="font-semibold text-[#17151f]">{destinationChainLabel}</p>
                    </div>
                  </div>
                  <span className="bridge-role-pill">Destination</span>
                  <button type="button" onClick={() => setShowDestinationPicker(true)} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[#1b162b]/8 bg-white/70 px-4 py-3 text-sm font-semibold text-[#3d3750]">
                    Choose destination
                    <span>›</span>
                  </button>
                </div>

                <div className="bridge-info-card rounded-[18px] p-3 text-xs leading-5">
                  <p className="text-[#8b8795]">Source wallet network</p>
                  <p className={`font-semibold ${isOnExpectedSourceChain ? "text-emerald-600" : "text-amber-600"}`}>
                    {isOnExpectedSourceChain ? `Connected to ${expectedSourceChainLabel}` : `Need ${expectedSourceChainLabel}`}
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
                      className="mt-2 rounded-xl bg-[var(--brand)]/10 px-3 py-2 text-xs font-semibold text-[var(--brand)]"
                    >
                      Switch to {expectedSourceChainLabel}
                    </button>
                  )}
                </div>
              </div>

              <div className="bridge-premium-card p-4">
                <label className="mb-2 block text-xs font-semibold text-[#8b8795]">Recipient</label>
                <div className="bridge-info-card mb-3 rounded-[20px] p-3">
                  <input
                    type="text"
                    placeholder="Search people or @username"
                    value={directoryQuery}
                    onChange={(e) => {
                      setDirectoryQuery(e.target.value);
                      setShowDirectory(true);
                      resetBridgeFeedback();
                    }}
                    className="bridge-input mb-3 w-full rounded-2xl px-4 py-3 text-sm"
                  />
                  {showDirectory && directoryEntries.length > 0 && (
                    <div className="max-h-44 space-y-1.5 overflow-y-auto">
                      {directoryEntries.map((entry) => (
                        <button
                          key={`${entry.kind}-${entry.handle || entry.address || entry.name}`}
                          type="button"
                          onClick={() => handleSelectDirectoryEntry(entry)}
                          disabled={entry.kind === "self" || !entry.address}
                          className="bridge-directory-row flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm disabled:opacity-60"
                        >
                          <span className="font-medium text-[#17151f]">{entry.name}</span>
                          <span className="text-xs text-[#8b8795]">{entry.kind === "self" ? "You" : entry.address ? formatAddress(entry.address) : ""}</span>
                        </button>
                      ))}
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
                  className="bridge-input w-full rounded-2xl px-4 py-3 font-mono text-sm"
                />
                {recipient && !validRecipient && <p className="mt-2 text-xs text-red-500">Enter a valid address or saved @username.</p>}
                {isBridgeRoute && token !== "USDC" && <p className="mt-2 text-xs text-amber-600">Crosschain route currently supports USDC only.</p>}
              </div>

              <div className="bridge-premium-card p-4">
                <label className="mb-2 block text-xs font-semibold text-[#8b8795]">Amount</label>
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
                    className="bridge-input w-full rounded-2xl px-4 py-4 pr-24 text-2xl font-semibold"
                  />
                  <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-xl bg-white/75 px-2 py-1 text-sm font-semibold text-[#3d3750]"><TokenLogo symbol={token} size={20} />{token}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#1b162b]/5 pt-3 text-xs text-[#8b8795]">
                  <span>Est. time<br /><b className="text-[#17151f]">{attestationEta}</b></span>
                  <span>Fee<br /><b className="text-[#17151f]">Estimate on bridge</b></span>
                </div>
                {currentBalance !== undefined && (
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#8b8795]">
                    <span>Available: {formatAmount(currentBalance, currentDecimals)} {token}</span>
                    <button type="button" onClick={() => setAmount(formatAmount(currentBalance, currentDecimals).replace(/,/g, ""))} className="font-semibold text-[var(--brand)]">Max</button>
                  </div>
                )}
                {!hasEnoughBalance && amount && Number(amount) > 0 && <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-xs font-medium text-red-500">Insufficient {token} balance on {expectedSourceChainLabel}.</p>}
              </div>

              {isBridgeRoute && (
                <div className="bridge-premium-card bridge-timeline-card p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b8795]">Bridge timeline</p>
                      <p className="mt-1 text-[11px] text-[#8b8795]">Auto Forwarder pays destination minting for convenience.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!manualForwarderSupported) return;
                        setUseForwarder((v) => !v);
                        resetBridgeFeedback();
                      }}
                      disabled={!manualForwarderSupported}
                      className={`bridge-forwarder-toggle ${useForwarder ? "is-on" : ""}`}
                      aria-pressed={useForwarder}
                      aria-label={manualForwarderSupported ? (useForwarder ? "Disable Auto Forwarder" : "Enable Auto Forwarder") : "Auto Forwarder required"}
                    >
                      <span />
                    </button>
                  </div>
                  <div className="mb-4 rounded-2xl bg-white/60 p-3 text-xs text-[#8b8795]"><b className="text-[#17151f]">Auto Forwarder: {useForwarder ? "On" : "Off"}</b><br />{manualForwarderSupported ? (useForwarder ? "Fastest path, but may add a forwarder fee." : "Lower fee path. You may need to confirm minting on the destination chain.") : "Required for mobile embedded-wallet bridge routes right now."}</div>
                  {!manualForwarderSupported && <p className="mb-4 rounded-2xl bg-amber-500/10 p-3 text-xs font-medium text-amber-600">{manualForwarderMessage}</p>}
                  <div className="space-y-3">
                    {bridgeStepDefs.map((step, index) => {
                      const s = bridgeSteps[step.key];
                      const done = s === "done";
                      const active = s === "active";
                      const errored = s === "error";
                      return (
                        <div key={step.key} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${errored ? "bg-red-500 text-white" : done ? "bg-emerald-500 text-white" : active ? "bg-[var(--brand)] text-white animate-pulse" : "bg-[#eaf0ff] text-[#8b8795]"}`}>{errored ? "!" : done ? "✓" : index + 1}</span>
                            <span className={errored ? "text-red-500" : done ? "text-emerald-600" : active ? "text-[var(--brand)]" : "text-[#8b8795]"}>{step.label}</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8b8795]">{done ? "done" : step.eta}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-xs text-[#8b8795]">{bridgeProgress || "Timeline updates once the bridge starts."}{liveEta.total ? ` · Total ${formatEtaSeconds(liveEta.total)}` : ""}</p>
                </div>
              )}

              <button type="submit" disabled={!canSend} className="primary-btn w-full rounded-2xl px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
                {status === "sending" || status === "confirming" ? (status === "sending" ? "Sending..." : isBridgeRoute ? "Bridging..." : "Confirming...") : isBridgeRoute ? "Bridge Now" : `Send ${token}`}
              </button>
              {bridgeProgress && status !== "error" && <p className="text-center text-sm text-[#8b8795]">{bridgeProgress}. CCTP attestation can take a few minutes on testnets.</p>}
              {status === "error" && error && <p className="text-center text-sm text-red-500">{error}</p>}
            </form>

            {showDestinationPicker && (
              <div className="modal-backdrop fixed inset-0 z-[90] grid place-items-end bg-slate-950/70 p-4" onClick={() => setShowDestinationPicker(false)}>
                <div className="bridge-sheet bridge-destination-sheet w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#17151f]">Choose destination</h3>
                    <button type="button" onClick={() => setShowDestinationPicker(false)} className="bridge-icon-btn">✕</button>
                  </div>
                  <div className="space-y-2">
                    {sourceRoutes.map((route) => {
                      const meta = CHAIN_METADATA[route.toChain];
                      const selected = route.id === selectedRoute;
                      return (
                        <button key={route.id} type="button" onClick={() => { setSelectedRoute(route.id); resetBridgeFeedback(); setShowDestinationPicker(false); }} className={`bridge-destination-row ${selected ? "is-active" : ""}`}>
                          <span className="bridge-chain-avatar is-destination">{shortChainIcon(meta.label)}</span>
                          <span className="min-w-0 flex-1 text-left"><b>{meta.label}</b><small>USDC · Bridge</small></span>
                          <span className="bridge-radio">{selected ? "✓" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setShowDestinationPicker(false)} className="primary-btn mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white">Select destination</button>
                </div>
              </div>
            )}

            {showBridgeHistory && (
              <div className="fixed inset-0 z-[90] grid place-items-end bg-slate-950/55 p-4" onClick={() => setShowBridgeHistory(false)}>
                <div className="bridge-sheet w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between">
                    <div><h3 className="text-lg font-bold text-[#17151f]">Bridge history</h3><p className="text-xs text-[#8b8795]">Ongoing, successful, and failed bridge info</p></div>
                    <button type="button" onClick={() => setShowBridgeHistory(false)} className="bridge-icon-btn">✕</button>
                  </div>
                  <div className="space-y-2">
                    {(status === "sending" || status === "confirming" || status === "error") && (
                      <div className="bridge-history-row">
                        <span className={`bridge-status-dot ${status === "error" ? "is-failed" : "is-ongoing"}`} />
                        <div><b>{status === "error" ? "Failed bridge" : "Ongoing bridge"}</b><small>{selectedRouteConfig.label} · {bridgeProgress || error || "Waiting for update"}</small></div>
                      </div>
                    )}
                    {bridgeHistory.map((transfer) => (
                      <a key={transfer.id} href={`${CHAIN_METADATA[selectedRouteConfig.fromChain].explorerUrl}/tx/${transfer.txHash}`} target="_blank" rel="noopener noreferrer" className="bridge-history-row">
                        <span className="bridge-status-dot is-success" />
                        <div><b>{formatAmount(BigInt(transfer.value), TOKENS.USDC.decimals)} USDC</b><small>{transfer.routeLabel || "Bridge"} · {formatAddress(transfer.txHash)}</small></div>
                      </a>
                    ))}
                    {status === "idle" && bridgeHistory.length === 0 && <div className="rounded-2xl bg-white/60 p-4 text-sm text-[#8b8795]">No bridge activity yet.</div>}
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
