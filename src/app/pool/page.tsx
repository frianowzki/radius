"use client";

import { useMemo, useState } from "react";
import { createWalletClient, custom, formatUnits, type EIP1193Provider } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContracts, useSwitchChain, useWalletClient } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { TokenLogo } from "@/components/TokenLogo";
import { TOKENS } from "@/config/tokens";
import { arcTestnet } from "@/config/wagmi";
import { RADIUSD_ERC20_ABI, RADIUSD_LP_TOKEN_ADDRESS, RADIUSD_POOL_ABI, RADIUSD_POOL_ADDRESS } from "@/config/radiusdex";
import { decimalToUnits, formatAmount } from "@/lib/utils";
import { useRadiusAuth } from "@/lib/web3auth";

type PoolStatus = "idle" | "approving-usdc" | "approving-eurc" | "adding" | "removing" | "success" | "error";
type PoolTab = "add" | "remove";

export default function PoolPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { authenticated, address: authAddress, provider: authProvider, chainId: authChainId, switchChain: switchAuthChain } = useRadiusAuth();
  const address = wagmiAddress ?? authAddress;
  const isConnected = wagmiConnected || authenticated;
  const wagmiChainId = useChainId();
  const activeChainId = wagmiConnected ? wagmiChainId : authChainId;
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  const [tab, setTab] = useState<PoolTab>("add");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [eurcAmount, setEurcAmount] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [status, setStatus] = useState<PoolStatus>("idle");
  const [message, setMessage] = useState("");

  const isOnArc = activeChainId === arcTestnet.id;
  const usdcRaw = Number(usdcAmount) > 0 ? decimalToUnits(usdcAmount, TOKENS.USDC.decimals) : BigInt(0);
  const eurcRaw = Number(eurcAmount) > 0 ? decimalToUnits(eurcAmount, TOKENS.EURC.decimals) : BigInt(0);
  const lpRaw = Number(lpAmount) > 0 ? decimalToUnits(lpAmount, 18) : BigInt(0);
  const busy = ["approving-usdc", "approving-eurc", "adding", "removing"].includes(status);

  const { data: poolData, refetch } = useReadContracts({
    contracts: [
      { address: RADIUSD_POOL_ADDRESS, abi: RADIUSD_POOL_ABI, functionName: "balances", args: [BigInt(0)], chainId: arcTestnet.id },
      { address: RADIUSD_POOL_ADDRESS, abi: RADIUSD_POOL_ABI, functionName: "balances", args: [BigInt(1)], chainId: arcTestnet.id },
      { address: RADIUSD_POOL_ADDRESS, abi: RADIUSD_POOL_ABI, functionName: "totalSupply", chainId: arcTestnet.id },
      { address: RADIUSD_LP_TOKEN_ADDRESS, abi: RADIUSD_ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, chainId: arcTestnet.id },
      { address: TOKENS.USDC.address, abi: RADIUSD_ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, chainId: arcTestnet.id },
      { address: TOKENS.EURC.address, abi: RADIUSD_ERC20_ABI, functionName: "balanceOf", args: address ? [address] : undefined, chainId: arcTestnet.id },
      { address: TOKENS.USDC.address, abi: RADIUSD_ERC20_ABI, functionName: "allowance", args: address ? [address, RADIUSD_POOL_ADDRESS] : undefined, chainId: arcTestnet.id },
      { address: TOKENS.EURC.address, abi: RADIUSD_ERC20_ABI, functionName: "allowance", args: address ? [address, RADIUSD_POOL_ADDRESS] : undefined, chainId: arcTestnet.id },
    ],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const usdcReserve = (poolData?.[0]?.result as bigint) ?? BigInt(0);
  const eurcReserve = (poolData?.[1]?.result as bigint) ?? BigInt(0);
  const totalLp = (poolData?.[2]?.result as bigint) ?? BigInt(0);
  const lpBalance = (poolData?.[3]?.result as bigint) ?? BigInt(0);
  const usdcBalance = (poolData?.[4]?.result as bigint) ?? BigInt(0);
  const eurcBalance = (poolData?.[5]?.result as bigint) ?? BigInt(0);
  const usdcAllowance = (poolData?.[6]?.result as bigint) ?? BigInt(0);
  const eurcAllowance = (poolData?.[7]?.result as bigint) ?? BigInt(0);
  const poolShare = useMemo(() => totalLp > BigInt(0) && lpBalance > BigInt(0) ? (Number(lpBalance) / Number(totalLp)) * 100 : 0, [lpBalance, totalLp]);

  async function getClient() {
    if (walletClient) return walletClient;
    if (!authProvider || !address) return null;
    return createWalletClient({ account: address, chain: arcTestnet, transport: custom(authProvider as EIP1193Provider) });
  }

  async function switchToArc() {
    if (wagmiConnected) await switchChainAsync({ chainId: arcTestnet.id });
    else await switchAuthChain(arcTestnet.id);
  }

  function minMint() {
    if (totalLp === BigInt(0)) return ((usdcRaw + eurcRaw) * BigInt(1_000_000_000_000) * BigInt(99)) / BigInt(100);
    if (usdcReserve === BigInt(0) || eurcReserve === BigInt(0)) return BigInt(0);
    const byUsdc = (usdcRaw * totalLp) / usdcReserve;
    const byEurc = (eurcRaw * totalLp) / eurcReserve;
    return ((byUsdc < byEurc ? byUsdc : byEurc) * BigInt(99)) / BigInt(100);
  }

  async function addLiquidity() {
    if (!address || !publicClient) return;
    if (!isOnArc) return switchToArc();
    const wc = await getClient();
    if (!wc) return setMessage("Wallet signer unavailable. Reconnect and try again.");
    try {
      setMessage("");
      if (usdcAllowance < usdcRaw) {
        setStatus("approving-usdc");
        const h = await wc.writeContract({ address: TOKENS.USDC.address, abi: RADIUSD_ERC20_ABI, functionName: "approve", args: [RADIUSD_POOL_ADDRESS, usdcRaw] });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }
      if (eurcAllowance < eurcRaw) {
        setStatus("approving-eurc");
        const h = await wc.writeContract({ address: TOKENS.EURC.address, abi: RADIUSD_ERC20_ABI, functionName: "approve", args: [RADIUSD_POOL_ADDRESS, eurcRaw] });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }
      setStatus("adding");
      const hash = await wc.writeContract({ address: RADIUSD_POOL_ADDRESS, abi: RADIUSD_POOL_ABI, functionName: "add_liquidity", args: [[usdcRaw, eurcRaw], minMint()] });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      setMessage("Liquidity added. radLP received.");
      setUsdcAmount(""); setEurcAmount("");
      void refetch();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message.slice(0, 220) : "Add liquidity failed.");
    }
  }

  async function removeLiquidity() {
    if (!address || !publicClient) return;
    if (!isOnArc) return switchToArc();
    const wc = await getClient();
    if (!wc) return setMessage("Wallet signer unavailable. Reconnect and try again.");
    try {
      setStatus("removing"); setMessage("");
      const minUsdc = totalLp > BigInt(0) ? ((usdcReserve * lpRaw) / totalLp) * BigInt(99) / BigInt(100) : BigInt(0);
      const minEurc = totalLp > BigInt(0) ? ((eurcReserve * lpRaw) / totalLp) * BigInt(99) / BigInt(100) : BigInt(0);
      const hash = await wc.writeContract({ address: RADIUSD_POOL_ADDRESS, abi: RADIUSD_POOL_ABI, functionName: "remove_liquidity", args: [lpRaw, [minUsdc, minEurc]] });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("success");
      setMessage("Liquidity removed.");
      setLpAmount("");
      void refetch();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message.slice(0, 220) : "Remove liquidity failed.");
    }
  }

  const addDisabled = !isConnected || !isOnArc || busy || usdcRaw <= BigInt(0) || eurcRaw <= BigInt(0) || usdcRaw > usdcBalance || eurcRaw > eurcBalance;
  const removeDisabled = !isConnected || !isOnArc || busy || lpRaw <= BigInt(0) || lpRaw > lpBalance;

  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <div className="send-hero-card glass-panel-strong rounded-[32px] p-6">
          <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">RadiusDex Pool</p>
          <h2 className="text-2xl font-black tracking-tight text-glow">Provide USDC + EURC</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Add liquidity to the RadiusDex pool and receive radLP tokens.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="USDC reserves" value={`${formatAmount(usdcReserve, 6)} USDC`} />
          <Stat label="EURC reserves" value={`${formatAmount(eurcReserve, 6)} EURC`} />
          <Stat label="Your radLP" value={`${Number(formatUnits(lpBalance, 18)).toFixed(4)} LP`} />
          <Stat label="Pool share" value={`${poolShare.toFixed(2)}%`} />
        </div>

        {!isOnArc && isConnected && <button type="button" onClick={switchToArc} className="primary-btn w-full">Switch to Arc Testnet</button>}

        <div className="glass-panel rounded-[28px] p-5">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-white/40 p-1 text-sm font-semibold">
            <button type="button" onClick={() => setTab("add")} className={`rounded-xl py-2 ${tab === "add" ? "bg-white text-[var(--brand)] shadow-sm" : "text-zinc-500"}`}>Add</button>
            <button type="button" onClick={() => setTab("remove")} className={`rounded-xl py-2 ${tab === "remove" ? "bg-white text-[var(--brand)] shadow-sm" : "text-zinc-500"}`}>Remove</button>
          </div>

          {tab === "add" ? (
            <div className="space-y-4">
              <AmountInput label="USDC amount" symbol="USDC" value={usdcAmount} balance={formatAmount(usdcBalance, 6)} onChange={setUsdcAmount} onMax={() => setUsdcAmount(formatAmount(usdcBalance, 6).replace(/,/g, ""))} />
              <AmountInput label="EURC amount" symbol="EURC" value={eurcAmount} balance={formatAmount(eurcBalance, 6)} onChange={setEurcAmount} onMax={() => setEurcAmount(formatAmount(eurcBalance, 6).replace(/,/g, ""))} />
              <button type="button" disabled={addDisabled} onClick={addLiquidity} className="primary-btn flow-primary-action w-full disabled:opacity-40">
                {status === "approving-usdc" ? "Approving USDC…" : status === "approving-eurc" ? "Approving EURC…" : status === "adding" ? "Adding liquidity…" : !isConnected ? "Connect wallet first" : "Add liquidity"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <AmountInput label="radLP amount" symbol="LP" value={lpAmount} balance={formatAmount(lpBalance, 18)} onChange={setLpAmount} onMax={() => setLpAmount(formatAmount(lpBalance, 18).replace(/,/g, ""))} />
              <button type="button" disabled={removeDisabled} onClick={removeLiquidity} className="primary-btn flow-primary-action w-full disabled:opacity-40">
                {status === "removing" ? "Removing liquidity…" : !isConnected ? "Connect wallet first" : "Remove liquidity"}
              </button>
            </div>
          )}
          {message && <p className={`mt-4 rounded-2xl p-3 text-sm ${status === "error" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600"}`}>{message}</p>}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="glass-panel rounded-[24px] p-4"><p className="text-xs font-medium text-zinc-500">{label}</p><p className="mt-2 font-mono text-lg font-bold text-zinc-800">{value}</p></div>;
}

function AmountInput({ label, symbol, value, balance, onChange, onMax }: { label: string; symbol: string; value: string; balance: string; onChange: (v: string) => void; onMax: () => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500"><span>{label}</span><button type="button" onClick={onMax} className="font-semibold text-[var(--brand)]">Max: {balance}</button></div>
      <div className="flex items-center gap-3 rounded-[24px] bg-white/55 p-4">
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 border-0 bg-transparent text-4xl font-semibold outline-none" />
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-zinc-700">
          {symbol === "LP" ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--brand)] text-[10px] text-white">LP</span> : <TokenLogo symbol={symbol} size={20} />}{symbol}
        </span>
      </div>
    </div>
  );
}
