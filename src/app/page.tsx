"use client";

import Link from "next/link";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AppShell } from "@/components/AppShell";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { TOKENS, ERC20_TRANSFER_ABI } from "@/config/tokens";
import { formatAmount, getIdentityProfile } from "@/lib/utils";

const contacts = [
  { name: "Jamie", avatar: "J", color: "#83cfff" },
  { name: "Taylor", avatar: "T", color: "#f5c06d" },
  { name: "Sam", avatar: "S", color: "#9b7cff" },
  { name: "Morgan", avatar: "M", color: "#9bd4be" },
  { name: "Casey", avatar: "C", color: "#8f7cff" },
];

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
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const address = wagmiAddress ?? (wallets[0]?.address as `0x${string}` | undefined);
  const isConnected = wagmiConnected || authenticated;
  const identity = getIdentityProfile();

  const { data: nativeBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: eurcBalance } = useReadContract({
    address: TOKENS.EURC.address,
    abi: ERC20_TRANSFER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!isConnected) return <LoginScreen />;

  const usdcDisplay = nativeBalance?.value !== undefined ? formatAmount(nativeBalance.value, 18) : "2,458.75";
  const eurcDisplay = eurcBalance !== undefined ? formatAmount(eurcBalance as bigint, TOKENS.EURC.decimals) : "320.00";

  return (
    <AppShell>
      <div className="screen-pad">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <div className="mb-3 text-2xl font-black text-[#7a70d8]">R</div>
            <h1 className="text-base font-semibold text-[#17151f]">Good morning, {identity.displayName || "Alex"} 👋</h1>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm">♧</button>
        </header>

        <section className="gradient-card rounded-[24px] p-5">
          <div className="flex items-center justify-between text-xs text-white/75">
            <span>Total Balance ◉</span><span>USD ⊙</span>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.06em]">${usdcDisplay}</p>
          <p className="mt-1 text-xs text-white/75">≈ {usdcDisplay} USDC</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/faucet" className="rounded-2xl bg-white/18 py-3 text-center text-sm font-semibold">＋ Add Funds</Link>
            <Link href="/request" className="rounded-2xl bg-white/18 py-3 text-center text-sm font-semibold">⇩ Receive</Link>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-4 gap-4 text-center">
          {[['/send','✈','Send'],['/request','⇩','Request'],['/contacts','⌗','Scan'],['/send','⇄','Swap']].map(([href, icon, label]) => (
            <Link key={label} href={href} className="text-xs font-semibold text-[#595465]">
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-white text-lg text-[#6f60d5] shadow-sm">{icon}</span>{label}
            </Link>
          ))}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Active Requests</h2><Link href="/request" className="text-xs text-[#8f7cff]">View all</Link></div>
          <div className="soft-card rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm"><span>↓ $250.00 USDC from Jamie</span><span className="rounded-full bg-[#fff5da] px-3 py-1 text-[10px] text-[#c49322]">Awaiting</span></div>
            <p className="mt-2 text-xs text-[#9a94a3]">Requested 2m ago • Expires in 23:47:12</p>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Recent Contacts</h2><Link href="/contacts" className="text-xs text-[#8f7cff]">View all</Link></div>
          <div className="flex justify-between">
            {contacts.map((c) => <div key={c.name} className="text-center text-[10px] font-medium text-[#595465]"><div style={{background:c.color}} className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full text-white shadow-sm">{c.avatar}</div>{c.name}</div>)}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">My Wallets</h2><span className="text-xs text-[#8f7cff]">Manage</span></div>
          <div className="soft-card overflow-hidden rounded-2xl">
            {[["USDC","USD Coin",usdcDisplay],["USDT","Tether",eurcDisplay],["DAI","Dai Stablecoin","246.40"]].map(([s,n,b], i) => (
              <div key={s} className={`flex items-center justify-between px-4 py-3 ${i ? 'border-t' : ''}`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef1ff] text-[#6f60d5] text-xs font-bold">{s[0]}</span><div><p className="text-sm font-bold">{s}</p><p className="text-xs text-[#9a94a3]">{n}</p></div></div><p className="text-sm font-semibold">{b}</p></div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
