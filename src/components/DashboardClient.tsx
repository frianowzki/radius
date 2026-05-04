"use client";


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRadiusAuth } from "@/lib/web3auth";
import { AppShell } from "@/components/AppShell";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { TokenLogo } from "@/components/TokenLogo";
import { AvatarImage } from "@/components/AvatarImage";
import { QuickActionIcon } from "@/components/QuickActionIcon";
import { arcTestnet } from "@/config/wagmi";
import { showRadiusNotification } from "@/lib/notifications";
import { useIncomingPaymentNotifications, requestNotificationPermission } from "@/lib/incoming-payments";
import { formatAmount, getContacts, getIdentityProfile, getLocalTransfers, getPaymentRequests, saveLocalTransfers, savePaymentRequests, formatContactLabel, markMatchingPaymentRequestPaid, saveLocalTransfer } from "@/lib/utils";
import { dueSchedules, type ScheduledPaymentRecord } from "@/lib/scheduled-payments";
import { fetchRemoteActivity, mergePaymentRequests, mergeTransfers, pushRemoteActivity } from "@/lib/activity-sync";


function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.2 8.1h13.9a2.2 2.2 0 0 1 2.2 2.2v7.1a2.2 2.2 0 0 1-2.2 2.2H5.9a2.2 2.2 0 0 1-2.2-2.2V6.8a2.2 2.2 0 0 1 2.2-2.2h10.2" />
      <path d="M4 8.2 17.1 8" />
      <path d="M16.3 13.9h4" />
      <path d="M16.3 13.9a.25.25 0 1 0 0 .5.25.25 0 0 0 0-.5" />
    </svg>
  );
}

function WalletLoginButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <button
            type="button"
            onClick={connected ? (chain.unsupported ? openChainModal : openAccountModal) : openConnectModal}
            className="radius-auth-button secondary justify-center"
          >
            <span className="login-action-icon" aria-hidden="true"><WalletIcon /></span>
            <span>{connected ? (chain.unsupported ? "Switch Network" : account.displayName) : "Connect Wallet"}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
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
  return (
    <AppShell>
      <div className="login-reference-shell">
        <section className="login-hero" aria-label="Radius welcome">
          <div className="login-planet-wrap" aria-hidden="true">
            <span className="login-orbit login-orbit-a" />
            <span className="login-orbit login-orbit-b" />
            <span className="login-orbit-dot dot-a" />
            <span className="login-orbit-dot dot-b" />
            <span className="login-orbit-dot dot-c" />
            <span className="login-planet" />
          </div>

          <h1 className="login-title">Radius</h1>
          <p className="login-subtitle">P2P stablecoin payments on Arc Testnet</p>
        </section>

        <div className="login-actions">
          <SocialLoginButton icon="users" method="modal" label="Social Wallets Login" className="login-action login-action-secondary login-social-action disabled:cursor-not-allowed disabled:opacity-50" />
          <div className="login-wallet-action"><WalletLoginButton /></div>
        </div>
      </div>
    </AppShell>
  );
}

export function DashboardClient() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { initialized, authenticated, address: authAddress } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const [hideBalance, setHideBalance] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [showReceiveAddress, setShowReceiveAddress] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [identity, setIdentity] = useState<{ displayName?: string; authMode?: string }>({ displayName: "Arc user", authMode: "wallet" });
  const [contacts, setContacts] = useState<{ id: string; name: string; handle?: string; address: string; avatar?: string }[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<ReturnType<typeof getLocalTransfers>>([]);
  const [waveKey, setWaveKey] = useState(0);

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

  const { data: usdcBalance } = useReadContract({
    address: TOKENS.USDC.address,
    abi: ERC20_TRANSFER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const { data: eurcBalance } = useReadContract({
    address: TOKENS.EURC.address,
    abi: ERC20_TRANSFER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const usdcDisplay = usdcBalance !== undefined ? formatAmount(usdcBalance as bigint, TOKENS.USDC.decimals) : "0.00";
  const eurcDisplay = eurcBalance !== undefined ? formatAmount(eurcBalance as bigint, TOKENS.EURC.decimals) : "0.00";
  const numericUsdc = Number(usdcDisplay.replace(/,/g, ""));
  const numericEurc = Number(eurcDisplay.replace(/,/g, ""));
  const totalValue = (Number.isFinite(numericUsdc) ? numericUsdc : 0) + (Number.isFinite(numericEurc) ? numericEurc : 0);
  const totalDisplay = totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const profileName = identity.displayName || "Arc user";
  const visibleTotal = hideBalance ? "••••••" : totalDisplay;
  const visibleUsdc = hideBalance ? "••••••" : usdcDisplay;
  const visibleEurc = hideBalance ? "••••••" : eurcDisplay;
  const [activityNotice, setActivityNotice] = useState("");
  const [dueScheduleList, setDueScheduleList] = useState<ScheduledPaymentRecord[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
  }, []);
  useIncomingPaymentNotifications();
  useEffect(() => {
    if (!isConnected) return;
    const update = () => setDueScheduleList(dueSchedules());
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [isConnected]);
  const balanceSnapshot = useMemo(() => {
    if (!address || usdcBalance === undefined || eurcBalance === undefined) return null;
    return { USDC: usdcBalance as bigint, EURC: eurcBalance as bigint };
  }, [address, usdcBalance, eurcBalance]);

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
        <header className="dashboard-reference-header">
          <div>
            <div className="dashboard-logo">Radius</div>
            <h1>Hello, {profileName} <span key={waveKey} className="dashboard-wave" aria-hidden="true">👋</span></h1>
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

        <section className="dashboard-actions-grid">
          {[
            { href: "/send", icon: "send", label: "Send" },
            { href: "/request", icon: "request", label: "Request" },
            { href: "/scan", icon: "scan", label: "Scan" },
            { href: "/contacts", icon: "contacts", label: "Contacts" },
            { href: "/bridge", icon: "bridge", label: "Bridge" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="dashboard-action-item rounded-2xl">
              <span><QuickActionIcon name={item.icon as "send" | "request" | "scan" | "contacts" | "bridge"} /></span>{item.label}
            </Link>
          ))}
        </section>

        <section className="dashboard-section">
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

        <section className="dashboard-section">
          <div className="dashboard-section-title"><h2>My Assets</h2><button type="button" onClick={() => setShowAssets(true)}>Manage</button></div>
          <div className="dashboard-list-card asset-card">
            {[["USDC","USD Coin",visibleUsdc],["EURC","Euro Coin",visibleEurc]].map(([s,n,b], i) => (
              <div key={s} className={`dashboard-asset-row ${i ? 'with-border' : ''}`}><div><TokenLogo symbol={s} size={38} /><div><p>{s}</p><small>{n}</small></div></div><div><p>{b}</p>{!hideBalance && <small>${Number(String(b).replace(/,/g, "") || 0).toFixed(2)}</small>}</div></div>
            ))}
          </div>
        </section>

        {showReceiveAddress && address && (
          <div className="modal-backdrop fixed inset-0 z-[80] grid place-items-end bg-slate-950/55 p-4" onClick={() => setShowReceiveAddress(false)}>
            <div className="assets-modal-card receive-address-modal w-full max-w-sm rounded-[30px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between text-left">
                <div>
                  <h3 className="text-lg font-bold">Receive to Address</h3>
                  <p className="mt-1 text-xs text-[#8b8795]">Arc Testnet wallet address</p>
                </div>
                <button type="button" aria-label="Close receive address" onClick={() => setShowReceiveAddress(false)} className="grid h-9 w-9 place-items-center rounded-full bg-red-500/10 text-red-500">✕</button>
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
          <div className="modal-backdrop fixed inset-0 z-[80] grid place-items-end bg-slate-950/55 p-4" onClick={() => setShowAssets(false)}>
            <div className="assets-modal-card w-full max-w-sm rounded-[30px] p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">My Assets</h3><button type="button" aria-label="Close assets" onClick={() => setShowAssets(false)} className="grid h-9 w-9 place-items-center rounded-full bg-red-500/10 text-red-500">✕</button></div>
              <div className="space-y-3">
                {[["USDC","USD Coin",visibleUsdc],["EURC","Euro Coin",visibleEurc]].map(([s,n,b]) => (
                  <div key={s} className="flex items-center justify-between rounded-2xl bg-white/55 p-3">
                    <div className="flex items-center gap-3"><TokenLogo symbol={s} /><div><p className="text-sm font-bold">{s}</p><p className="text-xs text-[#8b8795]">{n}</p></div></div><p className="text-sm font-semibold">{b}</p>
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
