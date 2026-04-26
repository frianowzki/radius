"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useDisconnect, useReadContract } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AppShell } from "@/components/AppShell";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { formatAddress, formatAmount, getContacts, getIdentityProfile, getLocalTransfers, formatContactLabel } from "@/lib/utils";



function WalletConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        return (
          <button
            type="button"
            onClick={connected ? (chain.unsupported ? openChainModal : openAccountModal) : openConnectModal}
            className="radius-auth-button"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#eef1ff] text-[#6f60d5]">◈</span>
            <span className="flex-1 text-center">
              {connected ? (chain.unsupported ? "Wrong network" : account.displayName) : "Connect Wallet"}
            </span>
            <span className="text-[#b8b3c0]">›</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

function LoginScreen() {
  return (
    <AppShell>
      <div className="screen-pad flex min-h-screen flex-col justify-between pb-8 text-center">
        <div className="flex justify-end"><ThemeToggle /></div>
        <div className="flex flex-1 flex-col justify-center">
          <div className="orb mx-auto mb-12 h-28 w-28 rounded-full" />
          <h1 className="text-5xl font-semibold tracking-[-0.06em] text-[#181521]">Radius</h1>
          <p className="mx-auto mt-4 max-w-52 text-sm leading-6 text-[#5f5a68]">P2P stablecoin payments on Arc Testnet</p>
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-[11px] font-semibold text-[#7a70d8] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#8f7cff]" /> Arc Testnet
          </div>

          <div className="mt-10 space-y-3 text-left">
            <SocialLoginButton method="email" label="Continue with Email" icon={<span className="grid h-8 w-8 place-items-center rounded-xl bg-[#f2efff] text-[#6f60d5]">✉</span>} />
            <SocialLoginButton method="google" label="Continue with Google" icon={<span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-lg">G</span>} />
            <WalletConnectButton />
          </div>
        </div>
        <div className="space-y-7 text-[10px] leading-5 text-[#8f8998]">
          <p>♡ Your keys stay in your control.<br />We never access your funds.</p>
          <p>By continuing, you agree to our Terms and Privacy Policy.</p>
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, logout } = useRadiusAuth();
  const { disconnect } = useDisconnect();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const identity = getIdentityProfile();
  const [hideBalance, setHideBalance] = useState(() => typeof window !== "undefined" && localStorage.getItem("radius-hide-balance") === "true");
  const [copiedAddress, setCopiedAddress] = useState(false);

  const { data: nativeBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: eurcBalance } = useReadContract({
    address: TOKENS.EURC.address,
    abi: ERC20_TRANSFER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const usdcDisplay = nativeBalance?.value !== undefined ? formatAmount(nativeBalance.value, 18) : "0.00";
  const eurcDisplay = eurcBalance !== undefined ? formatAmount(eurcBalance as bigint, TOKENS.EURC.decimals) : "0.00";
  const contacts = getContacts().slice(0, 5);
  const recentTransfers = address ? getLocalTransfers(address).slice(0, 3) : [];
  const profileName = identity.handle ? `@${identity.handle}` : identity.displayName || "Arc user";
  const visibleUsdc = hideBalance ? "••••••" : usdcDisplay;
  const visibleEurc = hideBalance ? "••••••" : eurcDisplay;

  useEffect(() => {
    localStorage.setItem("radius-hide-balance", String(hideBalance));
  }, [hideBalance]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 1500);
  }

  async function disconnectAll() {
    disconnect();
    await logout();
  }

  if (!isConnected) return <LoginScreen />;

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <div className="mb-3 text-2xl font-black text-[#7a70d8]">R</div>
            <h1 className="text-base font-semibold text-[#17151f]">Hello, {profileName} 👋</h1>
          </div>
          <ThemeToggle />
        </header>

        <section className="gradient-card rounded-[24px] p-5">
          <div className="flex items-center justify-between text-xs text-white/75">
            <span>Total Balance ◉</span><button type="button" onClick={() => setHideBalance((v) => !v)} className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white">{hideBalance ? "Show" : "Hide"}</button>
          </div>
          <p className={`mt-3 text-4xl font-semibold tracking-[-0.06em] ${hideBalance ? "balance-hidden" : ""}`}>${visibleUsdc}</p>
          <p className="mt-1 text-xs text-white/75">≈ {visibleUsdc} USDC</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/faucet" className="rounded-2xl bg-white/18 py-3 text-center text-sm font-semibold">＋ Add Funds</Link>
            <Link href="/request" className="rounded-2xl bg-white/18 py-3 text-center text-sm font-semibold">⇩ Receive</Link>
          </div>
          {address && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
              <button type="button" onClick={copyAddress} className="rounded-2xl bg-white/14 py-3 text-white/90">{copiedAddress ? "Copied" : `Copy ${formatAddress(address)}`}</button>
              <button type="button" onClick={disconnectAll} className="rounded-2xl bg-white/14 py-3 text-white/90">Disconnect</button>
            </div>
          )}
        </section>

        <section className="mt-6 grid grid-cols-4 gap-4 text-center">
          {[['/send','✈','Send'],['/request','⇩','Request'],['/scan','⌗','Scan'],['/bridge','⇄','Bridge']].map(([href, icon, label]) => (
            <Link key={label} href={href} className="text-xs font-semibold text-[#595465]">
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-white text-lg text-[#6f60d5] shadow-sm">{icon}</span>{label}
            </Link>
          ))}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Active Requests</h2><Link href="/request" className="text-xs text-[#8f7cff]">View all</Link></div>
          <div className="soft-card rounded-2xl p-4">
            {recentTransfers.length === 0 ? (
              <p className="text-sm text-[#8b8795]">No active requests yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTransfers.map((transfer) => (
                  <div key={transfer.id} className="flex items-center justify-between text-sm">
                    <span>{transfer.direction === "sent" ? "↑" : "↓"} {formatAmount(BigInt(transfer.value), TOKENS[transfer.token].decimals)} {transfer.token}</span>
                    <span className="text-xs text-[#8b8795]">{formatContactLabel(transfer.direction === "sent" ? transfer.to : transfer.from)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Recent Contacts</h2><Link href="/contacts" className="text-xs text-[#8f7cff]">View all</Link></div>
          {contacts.length === 0 ? (
            <div className="soft-card rounded-2xl p-4 text-sm text-[#8b8795]">No contacts saved yet.</div>
          ) : (
            <div className="flex justify-between gap-2">
              {contacts.map((c) => <div key={c.id} className="min-w-0 text-center text-[10px] font-medium text-[#595465]"><div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#8f7cff] text-white shadow-sm">{(c.avatar || c.name).slice(0,1).toUpperCase()}</div><span className="block truncate">{c.name}</span></div>)}
            </div>
          )}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">My Wallets</h2><span className="text-xs text-[#8f7cff]">Manage</span></div>
          <div className="soft-card overflow-hidden rounded-2xl">
            {[["USDC","USD Coin",visibleUsdc],["EURC","Euro Coin",visibleEurc]].map(([s,n,b], i) => (
              <div key={s} className={`flex items-center justify-between px-4 py-3 ${i ? 'border-t' : ''}`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef1ff] text-[#6f60d5] text-xs font-bold">{s[0]}</span><div><p className="text-sm font-bold">{s}</p><p className="text-xs text-[#9a94a3]">{n}</p></div></div><p className="text-sm font-semibold">{b}</p></div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
