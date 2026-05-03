"use client";

import type { EIP1193Provider } from "viem";
import { registryProofMessage, type RegistryAction, type RegistryProof } from "@/lib/registry-proof-core";

function cacheKey(owner: string, action: RegistryAction) {
  return `radius-registry-proof-${owner.toLowerCase()}-${action}`;
}

function getInjectedProvider(): EIP1193Provider | null {
  return (globalThis as typeof globalThis & { ethereum?: EIP1193Provider }).ethereum ?? null;
}

function parseCached(raw: string | null): RegistryProof | null {
  if (!raw) return null;
  try {
    const proof = JSON.parse(raw) as RegistryProof;
    if (!proof.issuedAt || Math.abs(Date.now() - Date.parse(proof.issuedAt)) > 14 * 60 * 1000) return null;
    return proof;
  } catch {
    return null;
  }
}

export async function getRegistryProof(owner: string, action: RegistryAction, options?: { provider?: EIP1193Provider | null; prompt?: boolean; signMessage?: (message: string) => Promise<string> }): Promise<RegistryProof | null> {
  if (typeof window === "undefined") return null;
  const key = cacheKey(owner, action);
  const cached = parseCached(sessionStorage.getItem(key));
  if (cached) return cached;
  if (!options?.prompt) return null;

  const issuedAt = new Date().toISOString();
  const message = registryProofMessage(owner, action, issuedAt);
  let signature: string;

  if (options?.signMessage) {
    signature = await options.signMessage(message);
  } else {
    const provider = options?.provider ?? getInjectedProvider();
    if (!provider?.request) throw new Error("Wallet signer unavailable for registry sync");
    const request = provider.request as (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    try {
      signature = await request({ method: "personal_sign", params: [message, owner] }) as string;
    } catch {
      signature = await request({ method: "personal_sign", params: [owner, message] }) as string;
    }
  }

  const proof: RegistryProof = { owner, action, issuedAt, signature: signature as `0x${string}` };
  sessionStorage.setItem(key, JSON.stringify(proof));
  return proof;
}
