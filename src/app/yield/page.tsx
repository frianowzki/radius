"use client";

import { useState } from "react";
import { createWalletClient, custom, formatUnits, type EIP1193Provider } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContracts, useSwitchChain, useWalletClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { arcTestnet } from "@/config/wagmi";
import { RADIUSD_ERC20_ABI, RADIUSD_LP_TOKEN_ADDRESS, RADIUSD_RAD_TOKEN_ADDRESS, RADIUSD_STAKING_ABI, RADIUSD_STAKING_ADDRESS, calcRadiusApr } from "@/config/radiusdex";
import { decimalToUnits, formatAmount } from "@/lib/utils";
import { useRadiusAuth } from "@/lib/web3auth";

type YieldStatus = "idle" | "approving" | "staking" | "unstaking" | "claiming" | "success" | "error";
type YieldAction = "stake" | "unstake";

export default function YieldPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId, switchChain: switchAuthChain } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const wagmiChainId = useChainId();
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  const [action, setAction] = useState<YieldAction>("stake");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<YieldStatus>("idle");
  const [message, setMessage] = useState("");

  const isOnArc = activeChainId === arcTestnet.id;
  const amountRaw = Number(amount) > 0 ? decimalToUnits(amount, 18) : BigInt(0);
  const busy = ["approving", "staking", "unstaking", "claiming"].includes(status);

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: RADIUSD_STAKING_ADDRESS, abi: RADIUSD_STAKING_ABI, functionName: "staked", args: address ? [address] : undefined, chainId: arcTestnet.id },
      { address: RADIUSD_STAKING_ADDRESS, abi: RADIUSD_STAKING_ABI, functionName: "earned", args: address ? [address] : undefined, chainId: arcTestnet.id },
      { address: RADIUSD_STAKING_ADDRESS, abi: RADIUSD_STAKING_ABI, functionName: "totalStaked", chainId: arcTestnet.id },
      { address: RADIUSD_STAKING_ADDRESS, abi: RADIUSD_STAKING_ABI, functionName: "rewardRatePerSecond", chainId: arcTestnet.id },
      { address: RADIUSD_LP_TOKEN_ADDRESS, abi: RADIUSD_ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, chainId: arcTestnet.id },
      { address: RADIUSD_LP_TOKEN_ADDRESS, abi: RADIUSD_ERC20_ABI, functionName: "allowance", args: address ? [address, RADIUSD_STAKING_ADDRESS] : undefined, chainId: arcTestnet.id },
      { address: RADIUSD_RAD_TOKEN_ADDRESS, abi: RADIUSD_ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, chainId: arcTestnet.id },
    ],
    query: { enabled: isConnected && !!address, refetchInterval: 3_000 },
  });

  const userStaked = (data?.[0]?.result as bigint) ?? BigInt(0);
  const earned = (data?.[1]?.result as bigint) ?? BigInt(0);
  const totalStaked = (data?.[2]?.result as bigint) ?? BigInt(0);
  const rewardRate = (data?.[3]?.result as bigint) ?? BigInt(0);
  const lpBalance = (data?.[4]?.result as bigint) ?? BigInt(0);
  const lpAllowance = (data?.[5]?.result as bigint) ?? BigInt(0);
  const radBalance = (data?.[6]?.result as bigint) ?? BigInt(0);
  const apr = calcRadiusApr(rewardRate, totalStaked);
  const userShare = totalStaked > BigInt(0) && userStaked > BigInt(0) ? (Number(userStaked) / Number(totalStaked)) * 100 : 0;

  async function getClient() {
    if (walletClient) return walletClient;
    if (!authProvider || !address) return null;
    return createWalletClient({ account: address, chain: arcTestnet, transport: custom(authProvider as EIP1193Provider) });
  }

  async function switchToArc() {
    if (wagmiConnected) await switchChainAsync({ chainId: arcTestnet.id });
    else await switchAuthChain(arcTestnet.id);
  }

  async function stake() {
    if (!address || !publicClient) return;
    if (!isOnArc) return switchToArc();
    const wc = await getClient();
    if (!wc) return setMessage("Wallet signer unavailable. Reconnect and try again.");
    try {
      setMessage("");
      if (lpAllowance < amountRaw) {
        setStatus("approving");
        const approveHash = await wc.writeContract({ address: RADIUSD_LP_TOKEN_ADDRESS, abi: RADIUSD_ERC20_ABI, functionName: "approve", args: [RADIUSD_STAKING_ADDRESS, amountRaw] });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      setStatus("staking");
      const hash = await wc.writeContract({ address: RADIUSD_STAKING_ADDRESS, abi: RADIUSD_STAKING_ABI, functionName: "stake", args: [amountRaw] });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      setMessage("LP staked. RAD rewards are accruing.");
      setAmount("");
      void refetch();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message.slice(0, 220) : "Stake failed.");
    }
  }

  async function unstake() {
    if (!address || !publicClient) return;
    if (!isOnArc) return switchToArc();
    const wc = await getClient();
    if (!wc) return setMessage("Wallet signer unavailable. Reconnect and try again.");
    try {
      setStatus("unstaking"); setMessage("");
      const hash = await wc.writeContract({ address: RADIUSD_STAKING_ADDRESS, abi: RADIUSD_STAKING_ABI, functionName: "withdraw", args: [amountRaw] });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      setMessage("LP unstaked.");
      setAmount("");
      void refetch();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message.slice(0, 220) : "Unstake failed.");
    }
  }

  async function claim() {
    if (!address || !publicClient) return;
    if (!isOnArc) return switchToArc();
    const wc = await getClient();
    if (!wc) return setMessage("Wallet signer unavailable. Reconnect and try again.");
    try {
      setStatus("claiming"); setMessage("");
      const hash = await wc.writeContract({ address: RADIUSD_STAKING_ADDRESS, abi: RADIUSD_STAKING_ABI, functionName: "claim" });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      setMessage("RAD claimed.");
      void refetch();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message.slice(0, 220) : "Claim failed.");
    }
  }

  const canStake = isConnected && isOnArc && !busy && amountRaw > BigInt(0) && amountRaw <= lpBalance;
  const canUnstake = isConnected && isOnArc && !busy && amountRaw > BigInt(0) && amountRaw <= userStaked;

  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <div className="send-hero-card glass-panel-strong rounded-[32px] p-6">
          <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">RadiusDex Yield</p>
          <h2 className="text-2xl font-black tracking-tight text-glow">Stake radLP. Earn RAD.</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Stake your RadiusDex LP tokens and claim RAD rewards anytime.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total staked" value={`${formatAmount(totalStaked, 18)} LP`} />
          <Stat label="APR" value={apr > 0 ? `${Math.min(apr, 999.99).toFixed(2)}${apr > 999.99 ? "%+" : "%"}` : "—"} accent />
          <Stat label="Your staked" value={`${Number(formatUnits(userStaked, 18)).toFixed(4)} LP`} />
          <Stat label="Your RAD" value={Number(formatUnits(radBalance, 18)).toFixed(2)} />
        </div>

        <div className="glass-panel-strong rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--brand)]">Live yield preview</p>
              <p className="mt-2 font-mono text-3xl font-black tracking-tight text-[var(--foreground)]">{Number(formatUnits(earned, 18)).toFixed(6)} RAD</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Updates every few seconds from the staking contract.</p>
            </div>
            <button
              type="button"
              disabled={!isConnected || !isOnArc || earned === BigInt(0) || busy}
              onClick={claim}
              className="primary-btn px-5 text-sm disabled:opacity-40"
            >
              {status === "claiming" ? "Claiming…" : earned > BigInt(0) ? "Claim yield" : "No yield"}
            </button>
          </div>
        </div>

        {userStaked > BigInt(0) && <div className="glass-panel rounded-[24px] p-4 text-sm text-zinc-500">Your staking share: <b className="text-zinc-800">{userShare.toFixed(2)}%</b></div>}
        {!isOnArc && isConnected && <button type="button" onClick={switchToArc} className="primary-btn w-full">Switch to Arc Testnet</button>}

        <div className="glass-panel rounded-[28px] p-5">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-white/40 p-1 text-sm font-semibold">
            <button type="button" onClick={() => { setAction("stake"); setAmount(""); }} className={`rounded-xl py-2 ${action === "stake" ? "bg-white text-[var(--brand)] shadow-sm" : "text-zinc-500"}`}>Stake</button>
            <button type="button" onClick={() => { setAction("unstake"); setAmount(""); }} className={`rounded-xl py-2 ${action === "unstake" ? "bg-white text-[var(--brand)] shadow-sm" : "text-zinc-500"}`}>Unstake</button>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{action === "stake" ? "Amount to stake" : "Amount to unstake"}</span>
            <button type="button" onClick={() => setAmount(formatAmount(action === "stake" ? lpBalance : userStaked, 18).replace(/,/g, ""))} className="font-semibold text-[var(--brand)]">
              Max: {formatAmount(action === "stake" ? lpBalance : userStaked, 18)} LP
            </button>
          </div>
          <div className="flex items-center gap-3 rounded-[24px] bg-white/55 p-4">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 border-0 bg-transparent text-4xl font-semibold outline-none" />
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-zinc-700"><span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--brand)] text-[10px] text-white">LP</span>radLP</span>
          </div>

          <button type="button" disabled={action === "stake" ? !canStake : !canUnstake} onClick={action === "stake" ? stake : unstake} className="primary-btn flow-primary-action mt-5 w-full disabled:opacity-40">
            {!isConnected ? "Connect wallet first" : status === "approving" ? "Approving LP…" : status === "staking" ? "Staking…" : status === "unstaking" ? "Unstaking…" : action === "stake" ? "Stake LP" : "Unstake LP"}
          </button>
          {message && <p className={`mt-4 rounded-2xl p-3 text-sm ${status === "error" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600"}`}>{message}</p>}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="glass-panel rounded-[24px] p-4"><p className="text-xs font-medium text-zinc-500">{label}</p><p className={`mt-2 font-mono text-lg font-bold ${accent ? "text-emerald-600" : "text-zinc-800"}`}>{value}</p></div>;
}
