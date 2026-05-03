import { verifyMessage } from "viem";

export type RegistryAction = "profile" | "contacts" | "activity";

export interface RegistryProof {
  owner: string;
  action: RegistryAction;
  issuedAt: string;
  signature: `0x${string}`;
}

export function registryProofMessage(owner: string, action: RegistryAction, issuedAt: string) {
  return [
    "Radius registry write",
    `Owner: ${owner.toLowerCase()}`,
    `Action: ${action}`,
    `Issued: ${issuedAt}`,
    "Only sign this if you want Radius to sync this data.",
  ].join("\n");
}

function validIssuedAt(value: string) {
  const issued = Date.parse(value);
  if (!Number.isFinite(issued)) return false;
  const ageMs = Math.abs(Date.now() - issued);
  return ageMs <= 15 * 60 * 1000;
}

export async function verifyRegistryProof(owner: string, action: RegistryAction, proof: unknown) {
  if (!proof || typeof proof !== "object") return false;
  const p = proof as Partial<RegistryProof>;
  if (!p.owner || !p.action || !p.issuedAt || !p.signature) return false;
  if (p.owner.toLowerCase() !== owner.toLowerCase()) return false;
  if (p.action !== action) return false;
  if (!validIssuedAt(p.issuedAt)) return false;
  return verifyMessage({
    address: owner as `0x${string}`,
    message: registryProofMessage(owner, action, p.issuedAt),
    signature: p.signature,
  }).catch(() => false);
}
