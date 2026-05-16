"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/config/wagmi";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletError = Error & {
  code?: number | string;
  data?: { code?: number | string; originalError?: WalletError };
  cause?: WalletError;
};

const ARC_CHAIN_ID_HEX = `0x${arcTestnet.id.toString(16)}`;

const ARC_CHAIN_PARAMS = {
  chainId: ARC_CHAIN_ID_HEX,
  chainName: arcTestnet.name,
  nativeCurrency: arcTestnet.nativeCurrency,
  rpcUrls: [...arcTestnet.rpcUrls.default.http],
  blockExplorerUrls: [arcTestnet.blockExplorers.default.url],
};

function errorCode(error: unknown): number | string | undefined {
  const err = error as WalletError | undefined;
  return err?.code ?? err?.data?.code ?? err?.data?.originalError?.code ?? err?.cause?.code;
}

async function getConnectorProvider(connector: ReturnType<typeof useAccount>["connector"]) {
  if (!connector?.getProvider) return null;
  const provider = await connector.getProvider();
  return provider && typeof (provider as Eip1193Provider).request === "function" ? (provider as Eip1193Provider) : null;
}

async function addAndSwitchArc(provider: Eip1193Provider) {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [ARC_CHAIN_PARAMS],
  });
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: ARC_CHAIN_ID_HEX }],
  });
}

export function ArcNetworkSync() {
  const pathname = usePathname();
  const { address, connector, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const inFlight = useRef(false);

  useEffect(() => {
    if (pathname?.startsWith("/bridge")) return;
    if (!isConnected || !address || chainId === arcTestnet.id || inFlight.current) return;

    inFlight.current = true;

    const switchToArc = async () => {
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
      } catch (switchError) {
        const provider = await getConnectorProvider(connector);
        if (!provider) throw switchError;

        const code = errorCode(switchError);
        if (code === 4902 || code === "4902" || code === -32603 || code === "-32603") {
          await addAndSwitchArc(provider);
          return;
        }

        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ARC_CHAIN_ID_HEX }],
          });
        } catch (providerSwitchError) {
          const providerCode = errorCode(providerSwitchError);
          if (providerCode === 4902 || providerCode === "4902" || providerCode === -32603 || providerCode === "-32603") {
            await addAndSwitchArc(provider);
            return;
          }
          throw providerSwitchError;
        }
      }
    };

    void switchToArc()
      .catch((error) => {
        // User rejection is expected if the wallet prompt is dismissed.
        console.warn("Arc Testnet switch/add prompt was not completed", error);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [address, chainId, connector, isConnected, pathname, switchChainAsync]);

  return null;
}
