"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useAccount, useDisconnect } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { AppShell } from "@/components/AppShell";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { LandingScreen } from "@/components/LandingScreen";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { TokenLogo } from "@/components/TokenLogo";
import { AvatarImage } from "@/components/AvatarImage";
import { QuickActionIcon } from "@/components/QuickActionIcon";
import { useEurUsdRate } from "@/lib/fx-rate";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { searchRegistryProfiles, type RegistryProfile } from "@/lib/registry-client";
import { arcTestnet } from "@/config/wagmi";
import { ChainLogo } from "@/components/ChainLogo";
import { CHAIN_METADATA, CHAIN_USDC_ADDRESSES, type CrosschainChain } from "@/config/crosschain";
import { RADIUSD_RAD_TOKEN_ADDRESS } from "@/config/radiusdex";
import { createPublicClient, formatUnits, http, type Chain } from "viem";
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
import { showRadiusNotification } from "@/lib/notifications";
import { useIncomingPaymentNotifications, requestNotificationPermission } from "@/lib/incoming-payments";
import { formatAmount, getContacts, getIdentityProfile, getLocalTransfers, getPaymentRequests, saveLocalTransfers, savePaymentRequests, formatContactLabel, markMatchingPaymentRequestPaid, saveLocalTransfer } from "@/lib/utils";
import { UnifiedBalanceCard } from "@/components/UnifiedBalanceCard";
import { dueSchedules, type ScheduledPaymentRecord } from "@/lib/scheduled-payments";
import { fetchRemoteActivity, mergePaymentRequests, mergeTransfers, pushRemoteActivity } from "@/lib/activity-sync";

type DashboardAsset = {
  id: string;
  symbol: string;
  name: string;
  balance: string;
  valueLabel?: string;
  chainKey: CrosschainChain;
  chainLabel: string;
  kind: "stable" | "native" | "radius";
  rawBalance: bigint;
};

const ASSET_CHAIN_MAP: Record<CrosschainChain, Chain> = {
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

const ASSET_CHAINS = Object.keys(CHAIN_METADATA) as CrosschainChain[];
const ASSET_PUBLIC_CLIENTS = Object.fromEntries(
  ASSET_CHAINS.map((chainKey) => [
    chainKey,
    createPublicClient({ chain: ASSET_CHAIN_MAP[chainKey], transport: http() }),
  ])
) as Record<CrosschainChain, ReturnType<typeof createPublicClient>>;

const MULTICHAIN_TOKEN_ASSETS = [
  ...ASSET_CHAINS.map((chainKey) => ({
    id: `usdc-${chainKey}`,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: CHAIN_USDC_ADDRESSES[chainKey],
    chainKey,
    kind: "stable" as const,
  })),
  {
    id: "eurc-arc",
    symbol: "EURC",
    name: "Euro Coin",
    decimals: TOKENS.EURC.decimals,
    address: TOKENS.EURC.address,
    chainKey: "Arc_Testnet" as const,
    kind: "stable" as const,
  },
  {
    id: "rad-arc",
    symbol: "RAD",
    name: "Radius Token",
    decimals: 18,
    address: RADIUSD_RAD_TOKEN_ADDRESS,
    chainKey: "Arc_Testnet" as const,
    kind: "radius" as const,
  },
] as const;

function compactDisplay(raw: bigint, decimals: number) {
  const formatted = formatUnits(raw, decimals);
  const numeric = Number(formatted);
  if (!Number.isFinite(numeric)) return formatted;
  if (numeric === 0) return "0";
  if (numeric < 0.0001) return "<0.0001";
  return numeric.toLocaleString(undefined, { maximumFractionDigits: numeric >= 1 ? 4 : 6 });
}

function stableValueLabel(symbol: string, balance: string, eurUsdRate: number) {
  if (symbol !== "USDC" && symbol !== "EURC") return undefined;
  const numeric = Number(balance.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return undefined;
  const usdValue = symbol === "EURC" ? numeric * eurUsdRate : numeric;
  return `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function shortAddress(value?: string) {
  if (!value) return "0x0000...0000";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function contactInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "R";
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M24 11C12.5 11 5 24 5 24s7.5 13 19 13 19-13 19-13-7.5-13-19-13Zm0 20.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <circle cx="24" cy="24" r="4.2" fill="white" opacity=".92" />
      {hidden && <path d="M8 42 42 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}

function LoginScreen() {
  return <AppShell requireAuth={false}><LandingScreen /></AppShell>;
}

export function DashboardClient() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { initialized, authenticated, address: authAddress, logout } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const [hideBalance, setHideBalance] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [showReceiveAddress, setShowReceiveAddress] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { rate: eurUsdRate } = useEurUsdRate();
  const [identity, setIdentity] = useState<{ displayName?: string; authMode?: string; avatar?: string }>({ displayName: "Arc user", authMode: "wallet" });
  const [contacts, setContacts] = useState<{ id: string; name: string; handle?: string; address: string; avatar?: string }[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<ReturnType<typeof getLocalTransfers>>([]);
  const [desktopSearch, setDesktopSearch] = useState("");
  const [desktopRegistryResults, setDesktopRegistryResults] = useState<RegistryProfile[]>([]);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [waveKey, setWaveKey] = useState(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage on mount (client-only) to avoid SSR mismatch */
  useEffect(() => {
    setIdentity(getIdentityProfile());
    setContacts(getContacts().slice(0, 5));
    setWaveKey((k) => k + 1);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate recentTransfers on address change (client-only) */
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setRecentTransfers(getLocalTransfers(address).slice(0, 3));
    fetchRemoteActivity(address).then((remote) => {
      if (!remote || cancelled) return;
      const mergedRequests = mergePaymentRequests(getPaymentRequests(), remote.requests);
      const mergedTransfers = mergeTransfers(getLocalTransfers(), remote.transfers);
      savePaymentRequests(mergedRequests);
      saveLocalTransfers(mergedTransfers);
      setRecentTransfers(getLocalTransfers(address).slice(0, 3));
      void pushRemoteActivity(address, { requests: mergedRequests, transfers: mergedTransfers });
    });
    return () => { cancelled = true; };
  }, [address]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [multichainAssets, setMultichainAssets] = useState<DashboardAsset[]>([]);
  const [assetScanStatus, setAssetScanStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!address) {
      setMultichainAssets([]);
      setAssetScanStatus("idle");
      return;
    }

    let cancelled = false;
    setAssetScanStatus("loading");

    async function scanAssets() {
      const [tokenResults, nativeResults] = await Promise.all([
        Promise.allSettled(
          MULTICHAIN_TOKEN_ASSETS.map(async (asset) => {
            const balance = await ASSET_PUBLIC_CLIENTS[asset.chainKey].readContract({
              address: asset.address,
              abi: ERC20_TRANSFER_ABI,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            });
            return {
              id: asset.id,
              symbol: asset.symbol,
              name: asset.name,
              balance: compactDisplay(balance as bigint, asset.decimals),
              valueLabel: stableValueLabel(asset.symbol, compactDisplay(balance as bigint, asset.decimals), eurUsdRate),
              chainKey: asset.chainKey,
              chainLabel: CHAIN_METADATA[asset.chainKey].label,
              kind: asset.kind,
              rawBalance: balance as bigint,
            };
          })
        ),
        Promise.allSettled(
          ASSET_CHAINS.map(async (chainKey) => {
            const chain = ASSET_CHAIN_MAP[chainKey];
            const balance = await ASSET_PUBLIC_CLIENTS[chainKey].getBalance({ address: address as `0x${string}` });
            return {
              id: `native-${chainKey}`,
              symbol: chain.nativeCurrency.symbol,
              name: `${chain.nativeCurrency.name} gas`,
              balance: compactDisplay(balance, chain.nativeCurrency.decimals),
              chainKey,
              chainLabel: CHAIN_METADATA[chainKey].label,
              kind: "native" as const,
              rawBalance: balance,
            };
          })
        ),
      ]);

      if (cancelled) return;
      const rows = [...tokenResults, ...nativeResults]
        .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
        .filter((asset) => asset.rawBalance > BigInt(0))
        .sort((a, b) => {
          const order = { stable: 0, radius: 1, native: 2 } as const;
          return order[a.kind] - order[b.kind] || a.chainLabel.localeCompare(b.chainLabel) || a.symbol.localeCompare(b.symbol);
        });

      setMultichainAssets(rows);
      setAssetScanStatus("idle");
    }

    scanAssets().catch(() => {
      if (!cancelled) setAssetScanStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const arcUsdcAsset = multichainAssets.find((asset) => asset.id === "usdc-Arc_Testnet");
  const arcEurcAsset = multichainAssets.find((asset) => asset.id === "eurc-arc");
  const totalValue = multichainAssets.reduce((sum, asset) => {
    if (asset.symbol !== "USDC" && asset.symbol !== "EURC") return sum;
    const numeric = Number(asset.balance.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return sum;
    return sum + (asset.symbol === "EURC" ? numeric * eurUsdRate : numeric);
  }, 0);
  const totalDisplay = totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const profileName = identity.displayName || "Arc user";
  const visibleTotal = hideBalance ? "••••••" : totalDisplay;
  const [activityNotice, setActivityNotice] = useState("");
  const [dueScheduleList, setDueScheduleList] = useState<ScheduledPaymentRecord[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(() => {
    if (typeof Notification === "undefined") return null;
    return Notification.permission;
  });
  useIncomingPaymentNotifications();
  useEffect(() => {
    if (!isConnected) return;
    const update = () => setDueScheduleList(dueSchedules());
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [isConnected]);
  const balanceSnapshot = useMemo(() => {
    const usdcRaw = arcUsdcAsset?.rawBalance;
    const eurcRaw = arcEurcAsset?.rawBalance;
    if (!address || usdcRaw === undefined || eurcRaw === undefined) return null;
    return { USDC: usdcRaw, EURC: eurcRaw };
  }, [address, arcUsdcAsset?.rawBalance, arcEurcAsset?.rawBalance]);

  useEffect(() => {
    queueMicrotask(() => setHideBalance(localStorage.getItem("radius-hide-balance") === "true"));
  }, []);

  useEffect(() => {
    localStorage.setItem("radius-hide-balance", String(hideBalance));
  }, [hideBalance]);

  async function copyReceiveAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 1500);
  }

  async function disconnectAll() {
    setDisconnecting(true);
    try {
      disconnect();
      await logout();
      try { localStorage.removeItem("radius-login-pending"); } catch { /* ignore */ }
      setAccountMenuOpen(false);
      window.location.replace("/");
    } finally {
      window.setTimeout(() => setDisconnecting(false), 1000);
    }
  }

  const desktopQuery = desktopSearch.trim().toLowerCase();
  const desktopContactMatches = desktopQuery
    ? contacts.filter((contact) => [contact.name, contact.handle, contact.address].some((value) => value?.toLowerCase().includes(desktopQuery))).slice(0, 4)
    : [];
  const desktopActivityMatches = desktopQuery
    ? recentTransfers.filter((transfer) => [transfer.token, transfer.txHash, transfer.direction, transfer.to, transfer.from, transfer.routeLabel].some((value) => value?.toLowerCase().includes(desktopQuery))).slice(0, 3)
    : [];
  const desktopActionMatches = desktopQuery
    ? [
        { label: "Send stablecoins", href: `/send?to=${encodeURIComponent(desktopSearch.trim())}`, icon: "send" },
        { label: "Contacts", href: `/contacts?search=${encodeURIComponent(desktopSearch.trim())}`, icon: "contacts" },
        { label: "History", href: "/history", icon: "history" },
        { label: "Swap", href: "/swap", icon: "swap" },
        { label: "Bridge", href: "/bridge", icon: "bridge" },
      ].filter((item) => item.label.toLowerCase().includes(desktopQuery) || desktopQuery.length >= 2).slice(0, 3)
    : [];

  useEffect(() => {
    const q = desktopSearch.trim().replace(/^@+/, "");
    if (q.length < 2) {
      setDesktopRegistryResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchRegistryProfiles(q)
        .then((profiles) => { if (!cancelled) setDesktopRegistryResults(profiles.slice(0, 4)); })
        .catch(() => { if (!cancelled) setDesktopRegistryResults([]); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [desktopSearch]);

  useEffect(() => {
    if (!address || !balanceSnapshot) return;
    (["USDC", "EURC"] as const).forEach((symbol) => {
      const key = `radius-last-balance-${address}-${symbol}`;
      const previous = localStorage.getItem(key);
      const current = balanceSnapshot[symbol];
      if (previous && current > BigInt(previous)) {
        const tokenInfo = TOKENS[symbol];
        const delta = current - BigInt(previous);
        const message = `Received ${formatAmount(delta, tokenInfo.decimals)} ${symbol}`;
        saveLocalTransfer({
          from: "0x0000000000000000000000000000000000000000",
          to: address,
          value: delta.toString(),
          token: symbol,
          txHash: `balance-${symbol.toLowerCase()}-${Date.now()}`,
          direction: "received",
          routeLabel: "Balance update",
        });
        const paidRequest = markMatchingPaymentRequestPaid(symbol, delta, tokenInfo.decimals, address);
        void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
        setActivityNotice(paidRequest ? `Request paid: ${paidRequest.amount} ${symbol}` : message);
        window.setTimeout(() => setActivityNotice(""), 4200);
        void showRadiusNotification("Radius activity", { body: message });
      }
      localStorage.setItem(key, current.toString());
    });
  }, [address, balanceSnapshot]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) setAccountMenuOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountMenuOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [accountMenuOpen]);

  if (!initialized) {
    return (
      <AppShell>
        <div className="screen-pad flex min-h-screen flex-col items-center justify-center text-center">
          <div className="orb mb-6 h-20 w-20 rounded-full" />
          <p className="text-sm font-semibold text-[#8b8795]">Restoring your Radius session…</p>
        </div>
      </AppShell>
    );
  }

  if (!isConnected) return <LoginScreen />;

  async function handleEnableNotifications() {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  }

  return (
    <AppShell>
      <OnboardingWizard />
      {notifPermission === "default" && (
        <div className="dashboard-alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>Enable browser notifications to get alerts for incoming payments.</span>
          <button type="button" onClick={handleEnableNotifications} className="primary-btn" style={{ whiteSpace: "nowrap", padding: "6px 14px", fontSize: 12 }}>Enable</button>
        </div>
      )}
      <div className="dashboard-reference-screen">
        <div className="desktop-dashboard-topbar">
          <h1>Hello, {profileName} <span key={waveKey} className="dashboard-wave" aria-hidden="true">👋</span></h1>
          <div className="desktop-topbar-actions">
            <div className="desktop-search-wrap">
              <form
                className="desktop-search"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = desktopSearch.trim();
                  if (!q) return;
                  window.location.href = `/send?to=${encodeURIComponent(q)}`;
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input
                  type="search"
                  value={desktopSearch}
                  onChange={(e) => { setDesktopSearch(e.target.value); setDesktopSearchOpen(true); }}
                  onFocus={() => setDesktopSearchOpen(true)}
                  placeholder="Search username / address / contact..."
                />
              </form>
              {desktopSearchOpen && desktopQuery && (
                <div className="desktop-search-popover">
                  {desktopRegistryResults.length > 0 && <p className="desktop-search-heading">Radius users</p>}
                  {desktopRegistryResults.map((profile) => (
                    <Link key={`registry-${profile.address}`} href={`/send?to=${encodeURIComponent(profile.handle || profile.address)}`} onClick={() => setDesktopSearchOpen(false)} className="desktop-search-result">
                      <span>{profile.avatar ? <img src={profile.avatar} alt="" /> : profile.displayName.slice(0, 1).toUpperCase()}</span>
                      <div><strong>{profile.displayName}</strong><small>{profile.handle ? `@${profile.handle}` : shortAddress(profile.address)}</small></div>
                    </Link>
                  ))}
                  {desktopContactMatches.length > 0 && <p className="desktop-search-heading">Contacts</p>}
                  {desktopContactMatches.map((contact) => (
                    <Link key={`contact-${contact.id}`} href={`/send?to=${encodeURIComponent(contact.handle ? contact.handle.replace(/^@/, "") : contact.address)}`} onClick={() => setDesktopSearchOpen(false)} className="desktop-search-result">
                      <span>{contact.avatar ? <img src={contact.avatar} alt="" /> : contactInitials(contact.name).slice(0, 1)}</span>
                      <div><strong>{contact.name}</strong><small>{contact.handle ? `@${contact.handle.replace(/^@/, "")}` : shortAddress(contact.address)}</small></div>
                    </Link>
                  ))}
                  {desktopActivityMatches.length > 0 && <p className="desktop-search-heading">Recent history</p>}
                  {desktopActivityMatches.map((transfer) => (
                    <Link key={`activity-${transfer.id}`} href="/history" onClick={() => setDesktopSearchOpen(false)} className="desktop-search-result">
                      <span><QuickActionIcon name={transfer.direction === "sent" ? "send" : "request"} /></span>
                      <div><strong>{transfer.direction === "sent" ? "Sent" : "Received"} {transfer.token}</strong><small>{shortAddress(transfer.txHash)}</small></div>
                    </Link>
                  ))}
                  <p className="desktop-search-heading">Actions</p>
                  {desktopActionMatches.map((item) => (
                    <Link key={`action-${item.href}`} href={item.href} onClick={() => setDesktopSearchOpen(false)} className="desktop-search-result">
                      <span><QuickActionIcon name={item.icon as "send" | "contacts" | "history" | "swap" | "bridge"} /></span>
                      <div><strong>{item.label}</strong><small>Open</small></div>
                    </Link>
                  ))}
                  {desktopRegistryResults.length === 0 && desktopContactMatches.length === 0 && desktopActivityMatches.length === 0 && desktopActionMatches.length === 0 && (
                    <p className="desktop-search-empty">No matches. Press Enter to send by username/address.</p>
                  )}
                </div>
              )}
            </div>
            <ThemeToggle />
            <NotificationBell />
            <div
              className={`desktop-account-menu-wrap${accountMenuOpen ? " is-open" : ""}`}
              ref={accountMenuRef}
            >
              <button
                type="button"
                className="desktop-profile-chip"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span>{identity.avatar ? <img src={identity.avatar} alt="" /> : contactInitials(profileName).slice(0, 1)}</span>
                <strong>{profileName}</strong>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {accountMenuOpen && (
                <div className="desktop-account-popover is-open" role="menu">
                  <div className="desktop-account-popover-head">
                    <span>{identity.avatar ? <img src={identity.avatar} alt="" /> : contactInitials(profileName).slice(0, 1)}</span>
                    <div><strong>{profileName}</strong><small>{address ? shortAddress(address) : "No wallet"}</small></div>
                  </div>
                  <button type="button" role="menuitem" onClick={copyReceiveAddress}>{copiedAddress ? "Copied address" : "Copy address"}</button>
                  <button type="button" role="menuitem" onClick={disconnectAll} disabled={disconnecting}>{disconnecting ? "Disconnecting…" : "Disconnect"}</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <header className="dashboard-reference-header">
          <div>
            <div className="dashboard-logo">Radius</div>
            <h1>Hello, {profileName} <span key={waveKey} className="dashboard-wave" aria-hidden="true">👋</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/scan" aria-label="Scan QR" className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-[var(--brand)] shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
            </Link>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {activityNotice && (
          <div className="dashboard-alert success">{activityNotice}</div>
        )}

        {dueScheduleList.length > 0 && (
          <Link href="/scheduled" className="dashboard-alert warning">
            <span>{dueScheduleList.length === 1 ? `1 scheduled payment is due` : `${dueScheduleList.length} scheduled payments are due`}</span>
            <span>Review →</span>
          </Link>
        )}

        <section className="dashboard-balance-card">
          <div className="dashboard-balance-top">
            <span>Total Balance</span>
            <button type="button" aria-label={hideBalance ? "Show balance" : "Hide balance"} onClick={() => setHideBalance((v) => !v)}><EyeIcon hidden={hideBalance} /></button>
          </div>
          <p className={`dashboard-total tracking-wide ${hideBalance ? "balance-hidden" : ""}`}><span className="mr-1">$</span>{"\u00A0"}{visibleTotal}</p>
          <div className="dashboard-balance-actions">
            <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-white/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.8s6 6.4 6 10.5a6 6 0 0 1-12 0C6 10.2 12 3.8 12 3.8Z"/><path d="M9.5 15.2a2.8 2.8 0 0 0 2.8 2.8"/></svg>
              Faucets
            </a>
            <button type="button" onClick={() => setShowReceiveAddress(true)} className="rounded-2xl bg-white/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
              Receive
            </button>
          </div>
        </section>

        <UnifiedBalanceCard />

        <section className="dashboard-actions-grid">
          {[
            { href: "/request", icon: "request", label: "Request" },
            { href: "/history", icon: "history", label: "History" },
            { href: "/pool", icon: "pool", label: "Pool" },
            { href: "/yield", icon: "yield", label: "Yield" },
            { href: "/contacts", icon: "contacts", label: "Contacts" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="dashboard-action-item rounded-2xl">
              <span><QuickActionIcon name={item.icon as "send" | "request" | "swap" | "contacts" | "bridge" | "wallet" | "pool" | "yield" | "history"} /></span>{item.label}
            </Link>
          ))}
        </section>

        <aside className="desktop-dashboard-side">
          <section className="desktop-panel desktop-shortcuts-panel">
            <h2>Quick Shortcuts</h2>
            <div>
              {[
                { href: "/request", icon: "request", label: "Request" },
                { href: "/send", icon: "send", label: "Send" },
                { href: "/swap", icon: "swap", label: "Swap" },
                { href: "/bridge", icon: "bridge", label: "Bridge" },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="desktop-shortcut-tile">
                  <QuickActionIcon name={item.icon as "send" | "request" | "swap" | "bridge"} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="desktop-panel desktop-activities-panel">
            <div className="desktop-panel-title"><h2>Recent Activities</h2><Link href="/history">View all</Link></div>
            <div className="desktop-notification-list">
              {recentTransfers.slice(0, 2).length === 0 ? (
                <div className="desktop-notification-row">
                  <span><QuickActionIcon name="wallet" /></span>
                  <p>No recent activity yet.<small>Start by receiving or sending funds.</small></p>
                  <i />
                </div>
              ) : recentTransfers.slice(0, 2).map((transfer) => (
                <Link href="/history" key={`activity-card-${transfer.id}`} className="desktop-notification-row">
                  <span><QuickActionIcon name={transfer.direction === "sent" ? "send" : "request"} /></span>
                  <p>{transfer.direction === "sent" ? "Sent" : "Received"} {formatAmount(BigInt(transfer.value), TOKENS[transfer.token].decimals)} {transfer.token}<small>{new Date(transfer.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></p>
                  <i />
                </Link>
              ))}
            </div>
          </section>

          <section className="desktop-panel desktop-contacts-panel">
            <div className="desktop-panel-title"><h2>Recent Contacts</h2><Link href="/contacts">View all</Link></div>
            <div className="desktop-contact-row">
              {contacts.slice(0, 4).map((c, index) => (
                <Link href={`/send?to=${encodeURIComponent(c.handle ? c.handle.replace(/^@/, "") : c.address)}`} key={`desktop-${c.id}`}>
                  <span data-tone={index % 4}>
                    {c.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar} alt={c.name} className="desktop-contact-avatar-img" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    ) : contactInitials(c.name)}
                  </span>
                  <strong>{c.name}</strong>
                  <small>{shortAddress(c.address)}</small>
                </Link>
              ))}
              <Link href="/contacts" className="desktop-add-contact"><span>+</span><strong>Add New</strong><small>&nbsp;</small></Link>
            </div>
          </section>
        </aside>

        <section className="dashboard-section dashboard-latest-section">
          <div className="dashboard-section-title"><h2>Latest Activities</h2><Link href="/history">View all</Link></div>
          <div className="dashboard-list-card">
            {recentTransfers.length === 0 ? (
              <p className="dashboard-empty">No latest activities yet.</p>
            ) : (
              <div>
                {recentTransfers.slice(0, 3).map((transfer) => {
                  const isSent = transfer.direction === "sent";
                  return (
                    <Link href="/history" key={transfer.id} className="dashboard-activity-row">
                      <div>
                        <span className={`activity-pill ${isSent ? "sent" : "received"}`} aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {isSent ? <><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></> : <><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></>}
                          </svg>
                        </span>
                        <div><p>{isSent ? "Sent" : "Received"} {formatAmount(BigInt(transfer.value), TOKENS[transfer.token].decimals)} {transfer.token}</p><small>{new Date(transfer.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
                      </div>
                      <small>{formatContactLabel(isSent ? transfer.to : transfer.from)}</small>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-title"><h2>Recent Contacts</h2><Link href="/contacts">View all</Link></div>
          <div className="dashboard-list-card">
            {contacts.length === 0 ? (
              <div className="dashboard-contact-empty"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><p>No contacts saved yet.<br />Add a contact to get started.</p></div>
            ) : (
              <div className="dashboard-contact-strip">
                {contacts.slice(0, 4).map((c) => <Link href={`/send?to=${encodeURIComponent(c.handle ? c.handle.replace(/^@/, "") : c.address)}`} key={c.id}><span><AvatarImage src={c.avatar} fallback={c.name} /></span><p>{c.name}</p></Link>)}
              </div>
            )}
          </div>
        </section>

        <section className="desktop-feature-banner">
          <span><QuickActionIcon name="wallet" /></span>
          <div><strong>Secure. Fast. Borderless.</strong><p>Manage your digital assets across chains with Radius.</p></div>
          <Link href="https://github.com/frianowzki/radius" target="_blank" rel="noopener noreferrer" aria-label="Visit Radius on GitHub">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 8.36 22.9c.58.1.8-.25.8-.56v-2.18c-3.26.7-3.95-1.38-3.95-1.38-.53-1.36-1.3-1.72-1.3-1.72-1.07-.73.08-.72.08-.72 1.18.08 1.8 1.22 1.8 1.22 1.05 1.8 2.75 1.28 3.42.98.1-.76.41-1.28.75-1.57-2.6-.3-5.34-1.3-5.34-5.8 0-1.28.46-2.33 1.21-3.15-.12-.3-.53-1.5.12-3.1 0 0 .99-.32 3.25 1.2a11.2 11.2 0 0 1 5.9 0c2.26-1.52 3.25-1.2 3.25-1.2.65 1.6.24 2.8.12 3.1.75.82 1.2 1.87 1.2 3.15 0 4.5-2.74 5.5-5.35 5.8.42.36.8 1.08.8 2.18v3.23c0 .31.21.67.81.56A11.5 11.5 0 0 0 12 .5Z"/></svg>
            Visit GitHub <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
        </section>

        <section className="dashboard-section dashboard-assets-section">
          <div className="dashboard-section-title"><h2>My Assets</h2><button type="button" onClick={() => setShowAssets(true)}>Manage</button></div>
          <div className="dashboard-list-card asset-card">
            {assetScanStatus === "loading" && multichainAssets.length === 0 ? (
              <p className="dashboard-empty">Scanning assets across supported chains…</p>
            ) : multichainAssets.length === 0 ? (
              <p className="dashboard-empty">No supported assets detected yet.</p>
            ) : multichainAssets.slice(0, 5).map((asset, i) => (
              <div key={asset.id} className={`dashboard-asset-row ${i ? "with-border" : ""}`}>
                <div>
                  <span className="relative inline-flex">
                    {asset.kind === "native" ? <ChainLogo chainKey={asset.chainKey} size={38} /> : <TokenLogo symbol={asset.symbol} size={38} />}
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-[1px] shadow-sm"><ChainLogo chainKey={asset.chainKey} size={16} /></span>
                  </span>
                  <div><p>{asset.symbol}</p><small>{asset.chainLabel} · {asset.name}</small></div>
                </div>
                <div><p>{hideBalance ? "••••••" : asset.balance}</p>{!hideBalance && asset.valueLabel && <small>{asset.valueLabel}</small>}</div>
              </div>
            ))}
          </div>
        </section>

        {showReceiveAddress && address && (
          <div role="dialog" aria-modal="true" className="modal-backdrop fixed inset-0 z-[80] grid place-items-end bg-slate-950/55 p-4 backdrop-blur-md" onClick={() => setShowReceiveAddress(false)}>
            <div className="assets-modal-card receive-address-modal w-full max-w-sm rounded-[30px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between text-left">
                <div>
                  <h3 className="text-lg font-bold">Receive to Address</h3>
                  <p className="mt-1 text-xs text-[#8b8795]">Arc Testnet wallet address</p>
                </div>
                <button type="button" aria-label="Close receive address" onClick={() => setShowReceiveAddress(false)} className="modal-close-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <div className="mx-auto w-fit rounded-[26px] bg-white p-4 shadow-[0_14px_38px_rgba(37,99,235,.14)]">
                <QRCodeSVG value={address} size={220} level="M" bgColor="#ffffff" fgColor="#050505" includeMargin />
              </div>
              <div className="receive-address-box mt-4 rounded-2xl bg-[#f7f9ff] px-3 py-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Full address</p>
                <p className="mt-2 break-all font-mono text-xs leading-5 text-[#475569]">{address}</p>
              </div>
              <button type="button" onClick={copyReceiveAddress} className="primary-btn mt-4 w-full text-sm">
                {copiedAddress ? "Copied address" : "Copy address"}
              </button>
            </div>
          </div>
        )}

        {showAssets && (
          <div role="dialog" aria-modal="true" className="modal-backdrop fixed inset-0 z-[80] grid place-items-end bg-slate-950/55 p-4 backdrop-blur-md" onClick={() => setShowAssets(false)}>
            <div className="assets-modal-card w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">My Assets</h3><button type="button" aria-label="Close assets" onClick={() => setShowAssets(false)} className="modal-close-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
              <div className="space-y-3">
                {assetScanStatus === "loading" && multichainAssets.length === 0 ? (
                  <p className="dashboard-empty">Scanning supported chains…</p>
                ) : multichainAssets.length === 0 ? (
                  <p className="dashboard-empty">No USDC, EURC, RAD, or native gas balances found.</p>
                ) : multichainAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between rounded-2xl bg-white/55 p-3">
                    <div className="flex items-center gap-3">
                      <span className="relative inline-flex">
                        {asset.kind === "native" ? <ChainLogo chainKey={asset.chainKey} size={36} /> : <TokenLogo symbol={asset.symbol} />}
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-[1px] shadow-sm"><ChainLogo chainKey={asset.chainKey} size={15} /></span>
                      </span>
                      <div><p className="text-sm font-bold">{asset.symbol}</p><p className="text-xs text-[#8b8795]">{asset.chainLabel} · {asset.name}</p></div>
                    </div>
                    <div className="text-right"><p className="text-sm font-semibold">{hideBalance ? "••••••" : asset.balance}</p>{!hideBalance && asset.valueLabel && <p className="text-xs text-[#8b8795]">{asset.valueLabel}</p>}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
