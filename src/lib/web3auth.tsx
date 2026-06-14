"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PrivyProvider,
  getEmbeddedConnectedWallet,
  useLogin,
  useLogout,
  usePrivy,
  useSignMessage,
  useSignTransaction,
  useWallets,
  type ConnectedWallet,
  type LoginModalOptions,
  type UnsignedTransactionRequest,
  type User,
} from "@privy-io/react-auth";
import type { EIP1193Provider } from "viem";
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
import { arcTestnet } from "@/config/wagmi";
import { getBrowserRpcUrl } from "@/config/rpc";

// Override Privy's default RPC proxy (sepolia.rpc.privy.systems) with our
// /api/rpc/<slug> proxy so background nonce/balance pings don't hit Privy's
// rate-limited public endpoint.
function withOurRpc<C extends { id: number; rpcUrls: { default: { http: readonly string[] } } }>(chain: C): C {
  const url = getBrowserRpcUrl(chain.id);
  if (!url) return chain;
  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: { http: [url] },
      public: { http: [url] },
    },
  } as C;
}

export type SocialLoginMethod = "email" | "google" | "github" | "twitter" | "apple";

type RadiusUser = {
  id?: string;
  name?: string;
  email?: string;
  raw?: User;
};

type RadiusAuthContextValue = {
  initialized: boolean;
  authenticated: boolean;
  walletReady: boolean;
  address?: `0x${string}`;
  chainId?: number;
  provider: EIP1193Provider | null;
  user: RadiusUser | null;
  login: (method?: SocialLoginMethod) => Promise<void>;
  logout: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  signTransaction: (request: UnsignedTransactionRequest) => Promise<`0x${string}`>;
};

const RadiusAuthContext = createContext<RadiusAuthContextValue | null>(null);

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";
const privyClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim() ?? "";
const hasConfiguredPrivy = Boolean(privyAppId);

function parsePrivyChainId(chainId?: string) {
  if (!chainId) return undefined;
  const raw = chainId.includes(":") ? chainId.split(":").at(-1) : chainId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickWallet(wallets: ConnectedWallet[]) {
  return getEmbeddedConnectedWallet(wallets) ?? wallets.find((wallet) => wallet.type === "ethereum") ?? null;
}

function normalizeUser(user: User | null | undefined): RadiusUser | null {
  if (!user) return null;
  const name =
    user.google?.name ||
    user.twitter?.name ||
    user.twitter?.username ||
    user.github?.name ||
    user.github?.username ||
    user.email?.address ||
    user.apple?.email ||
    undefined;
  const email = user.email?.address || user.google?.email || user.github?.email || user.apple?.email || undefined;
  return { id: user.id, name, email, raw: user };
}

function RadiusPrivyBridgeProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { logout: privyLogout } = useLogout();
  const { signMessage: privySignMessage } = useSignMessage();
  const { signTransaction: privySignTx } = useSignTransaction();
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [address, setAddress] = useState<`0x${string}` | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const wallet = useMemo(() => pickWallet(wallets), [wallets]);

  const refreshWallet = useCallback(async () => {
    if (!ready || !authenticated) {
      setProvider(null);
      setAddress(undefined);
      setChainId(undefined);
      return;
    }

    // When Privy has authenticated but the embedded wallet hasn't appeared yet
    // (common on first social login), skip clearing state — the useEffect will
    // re-run once `wallet` becomes non-null via the reactive wallets list.
    if (!wallet) return;

    try {
      const nextProvider = (await wallet.getEthereumProvider()) as unknown as EIP1193Provider;
      setProvider(nextProvider);
      setAddress(wallet.address as `0x${string}`);
      setChainId(parsePrivyChainId(wallet.chainId));
    } catch (error) {
      console.error("Privy provider unavailable", error);
      setProvider(null);
      setAddress(undefined);
      setChainId(undefined);
    }
  }, [authenticated, ready, wallet]);

  // Safety: if authenticated but wallet never appears within 8 s, clear state.
  useEffect(() => {
    if (!ready || !authenticated || wallet) return;
    const timeout = setTimeout(() => {
      setProvider(null);
      setAddress(undefined);
      setChainId(undefined);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [ready, authenticated, wallet]);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate Privy wallet/provider state from SDK callbacks */
  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { login: openPrivyLogin } = useLogin({
    onComplete: () => {
      if (typeof window !== "undefined" && localStorage.getItem("radius-login-pending") === "true") {
        localStorage.removeItem("radius-login-pending");
        window.location.replace("/");
      }
    },
    onError: (error) => {
      console.error("Privy login failed", error);
      if (typeof window !== "undefined") localStorage.removeItem("radius-login-pending");
    },
  });

  const login = useCallback(
    async (method?: SocialLoginMethod) => {
      if (!hasConfiguredPrivy) throw new Error("Privy is not configured");
      const options: LoginModalOptions | undefined = method ? { loginMethods: [method] } : undefined;
      openPrivyLogin(options);
    },
    [openPrivyLogin]
  );

  const logout = useCallback(async () => {
    await privyLogout();
    setProvider(null);
    setAddress(undefined);
    setChainId(undefined);
  }, [privyLogout]);

  const signMessage = useCallback(
    async (message: string) => {
      if (!address) throw new Error("Wallet unavailable");
      const { signature } = await privySignMessage({ message }, { address });
      return signature;
    },
    [address, privySignMessage]
  );

  const signTransaction = useCallback(
    async (request: UnsignedTransactionRequest) => {
      if (!address) throw new Error("Wallet unavailable");
      const { signature } = await privySignTx(request, { address });
      return signature as `0x${string}`;
    },
    [address, privySignTx]
  );

  const switchChain = useCallback(
    async (targetChainId: number) => {
      if (!wallet) throw new Error("Privy wallet unavailable");
      await wallet.switchChain(targetChainId);
      const nextProvider = (await wallet.getEthereumProvider()) as unknown as EIP1193Provider;
      // Poll until the embedded provider actually reports the target chain.
      // Privy's switchChain resolves before the EIP-1193 provider updates,
      // which leads to "wallet still on chain X" errors on the first send.
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        try {
          const hex = (await nextProvider.request({ method: "eth_chainId" })) as string;
          if (parseInt(hex, 16) === targetChainId) break;
        } catch {
          /* ignore and retry */
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      setProvider(nextProvider);
      setChainId(targetChainId);
    },
    [wallet]
  );

  const value = useMemo<RadiusAuthContextValue>(
    () => ({
      initialized: ready,
      authenticated: authenticated && Boolean(address),
      walletReady: ready && authenticated && Boolean(address),
      address,
      chainId,
      provider,
      user: normalizeUser(user),
      login,
      logout,
      switchChain,
      signMessage,
      signTransaction,
    }),
    [address, authenticated, chainId, login, logout, provider, ready, switchChain, signMessage, signTransaction, user]
  );

  return <RadiusAuthContext.Provider value={value}>{children}</RadiusAuthContext.Provider>;
}

export function RadiusAuthProvider({ children }: { children: ReactNode }) {
  if (!hasConfiguredPrivy) {
    return (
      <RadiusAuthContext.Provider
        value={{
          initialized: true,
          authenticated: false,
          walletReady: false,
          provider: null,
          user: null,
          login: async () => {
            throw new Error("Privy is not configured");
          },
          logout: async () => undefined,
          switchChain: async () => {
            throw new Error("Privy is not configured");
          },
          signMessage: async () => {
            throw new Error("Privy is not configured");
          },
          signTransaction: async () => {
            throw new Error("Privy is not configured");
          },
        }}
      >
        {children}
      </RadiusAuthContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId || undefined}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#8f7cff",
          logo: "https://radius-gules.vercel.app/icon.png",
          landingHeader: "Continue to Radius",
          loginMessage: "Create an embedded wallet that can bridge across Arc routes.",
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only",
        },
        loginMethods: ["google", "email", "github", "twitter", "apple"],
        supportedChains: [
          arcTestnet,
          sepolia,
          baseSepolia,
          arbitrumSepolia,
          avalancheFuji,
          optimismSepolia,
          polygonAmoy,
          lineaSepolia,
          unichainSepolia,
          worldchainSepolia,
          inkSepolia,
          monadTestnet,
          hyperliquidEvmTestnet,
          plumeSepolia,
          seiTestnet,
          xdcTestnet,
          codexTestnet,
        ].map(withOurRpc),
        defaultChain: withOurRpc(arcTestnet),
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <RadiusPrivyBridgeProvider>{children}</RadiusPrivyBridgeProvider>
    </PrivyProvider>
  );
}

export function useRadiusAuth() {
  const ctx = useContext(RadiusAuthContext);
  if (!ctx) throw new Error("useRadiusAuth must be used inside RadiusAuthProvider");
  return ctx;
}

export { hasConfiguredPrivy, hasConfiguredPrivy as hasConfiguredWeb3Auth };
