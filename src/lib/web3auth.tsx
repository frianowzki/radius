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
import { Web3Auth, AUTH_CONNECTION, CHAIN_NAMESPACES, UX_MODE, WEB3AUTH_NETWORK } from "@web3auth/modal";
import type { IProvider, UserInfo } from "@web3auth/base";
import type { EIP1193Provider } from "viem";
import { arcTestnet } from "@/config/wagmi";

export type SocialLoginMethod = "email" | "google" | "github" | "twitter" | "apple";

type RadiusAuthContextValue = {
  initialized: boolean;
  authenticated: boolean;
  address?: `0x${string}`;
  chainId?: number;
  provider: EIP1193Provider | null;
  user: Partial<UserInfo> | null;
  login: (method?: SocialLoginMethod) => Promise<void>;
  logout: () => Promise<void>;
};

const RadiusAuthContext = createContext<RadiusAuthContextValue | null>(null);

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID?.trim() ?? "";
const hasConfiguredWeb3Auth = Boolean(clientId);

const chainIdHex = `0x${arcTestnet.id.toString(16)}`;

function createWeb3Auth() {
  if (!hasConfiguredWeb3Auth) return null;

  return new Web3Auth({
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    defaultChainId: chainIdHex,
    chains: [
      {
        chainNamespace: CHAIN_NAMESPACES.EIP155,
        chainId: chainIdHex,
        rpcTarget: arcTestnet.rpcUrls.default.http[0],
        displayName: arcTestnet.name,
        blockExplorerUrl: arcTestnet.blockExplorers.default.url,
        logo: "https://radius-gules.vercel.app/icon.png",
        ticker: arcTestnet.nativeCurrency.symbol,
        tickerName: arcTestnet.nativeCurrency.name,
      },
    ],
    storageType: "local",
    uiConfig: {
      appName: "Radius",
      mode: "light",
      logoLight: "https://radius-gules.vercel.app/icon.png",
      logoDark: "https://radius-gules.vercel.app/icon.png",
      theme: { primary: "#8f7cff" },
      primaryButton: "socialLogin",
      uxMode: UX_MODE.REDIRECT,
      loginMethodsOrder: ["google", "email_passwordless", "github", "twitter", "apple"],
    },
    modalConfig: {
      connectors: {
        auth: {
          label: "Social login",
          loginMethods: {
            google: { showOnModal: true, mainOption: true },
            email_passwordless: { showOnModal: true, mainOption: true },
            github: { showOnModal: true },
            twitter: { showOnModal: true },
            apple: { showOnModal: true },
          },
        },
      },
    },
  });
}

function authConnectionFor(method?: SocialLoginMethod) {
  if (method === "google") return AUTH_CONNECTION.GOOGLE;
  if (method === "github") return AUTH_CONNECTION.GITHUB;
  if (method === "twitter") return AUTH_CONNECTION.TWITTER;
  if (method === "apple") return AUTH_CONNECTION.APPLE;
  return undefined;
}

async function getProviderAddress(provider: IProvider | null): Promise<`0x${string}` | undefined> {
  if (!provider) return undefined;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] as `0x${string}` | undefined;
}

async function getProviderChainId(provider: IProvider | null): Promise<number | undefined> {
  if (!provider) return undefined;
  const raw = (await provider.request({ method: "eth_chainId" })) as string | undefined;
  return raw ? Number.parseInt(raw, 16) : undefined;
}

export function RadiusAuthProvider({ children }: { children: ReactNode }) {
  const [web3auth] = useState(() => createWeb3Auth());
  const [initialized, setInitialized] = useState(!hasConfiguredWeb3Auth);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [address, setAddress] = useState<`0x${string}` | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const [user, setUser] = useState<Partial<UserInfo> | null>(null);

  const refresh = useCallback(
    async (nextProvider = web3auth?.provider ?? provider) => {
      setProvider(nextProvider ?? null);
      setAddress(await getProviderAddress(nextProvider ?? null));
      setChainId(await getProviderChainId(nextProvider ?? null));
      try {
        setUser(web3auth?.connected ? await web3auth.getUserInfo() : null);
      } catch {
        setUser(null);
      }
    },
    [provider, web3auth]
  );

  useEffect(() => {
    if (!web3auth) return;
    let cancelled = false;

    web3auth
      .init()
      .then(async () => {
        if (cancelled) return;
        setInitialized(true);
        if (!web3auth.provider && web3auth.cachedConnector) {
          try {
            await web3auth.connectTo(web3auth.cachedConnector as Parameters<typeof web3auth.connectTo>[0]);
          } catch (error) {
            console.warn("Web3Auth cached reconnect failed", error);
          }
        }
        await refresh(web3auth.provider);
      })
      .catch((error) => {
        console.error("Web3Auth init failed", error);
        if (!cancelled) setInitialized(true);
      });

    return () => {
      cancelled = true;
    };
  }, [refresh, web3auth]);

  const login = useCallback(
    async (method?: SocialLoginMethod) => {
      if (!web3auth) throw new Error("Web3Auth is not configured");
      const authConnection = authConnectionFor(method);
      const nextProvider = authConnection
        ? await web3auth.connectTo("auth", { authConnection })
        : await web3auth.connect();
      await refresh(nextProvider);
    },
    [refresh, web3auth]
  );

  const logout = useCallback(async () => {
    if (!web3auth) return;
    await web3auth.logout({ cleanup: true });
    setProvider(null);
    setAddress(undefined);
    setChainId(undefined);
    setUser(null);
  }, [web3auth]);

  const value = useMemo<RadiusAuthContextValue>(
    () => ({
      initialized,
      authenticated: Boolean(address),
      address,
      chainId,
      provider: provider as EIP1193Provider | null,
      user,
      login,
      logout,
    }),
    [address, chainId, initialized, login, logout, provider, user]
  );

  return <RadiusAuthContext.Provider value={value}>{children}</RadiusAuthContext.Provider>;
}

export function useRadiusAuth() {
  const ctx = useContext(RadiusAuthContext);
  if (!ctx) throw new Error("useRadiusAuth must be used inside RadiusAuthProvider");
  return ctx;
}

export { hasConfiguredWeb3Auth };
