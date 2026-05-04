import { verifyMessage } from "viem";

export type RegistryAction = "profile" | "contacts" | "activity";

export interface RegistryProof {
  owner: string;
  action: RegistryAction;
  issuedAt: string;
  nonce: string;
  signature: `0x${string}`;
}

export function registryProofMessage(owner: string, action: RegistryAction, issuedAt: string, nonce: string) {
  return [
    "Radius registry write",
    `Owner: ${owner.toLowerCase()}`,
    `Action: ${action}`,
    `Issued: ${issuedAt}`,
    `Nonce: ${nonce}`,
    "Only sign this if you want Radius to sync this data.",
  ].join("\n");
}

function validIssuedAt(value: string) {
  const issued = Date.parse(value);
  if (!Number.isFinite(issued)) return false;
  const ageMs = Math.abs(Date.now() - issued);
  return ageMs <= 15 * 60 * 1000;
}

// In-memory nonce tracking — nonces expire after 20 minutes
const usedNonces = new Map<string, number>();
const NONCE_EXPIRY_MS = 20 * 60 * 1000;

function pruneNonces() {
  const now = Date.now();
  for (const [key, ts] of usedNonces) {
    if (now - ts > NONCE_EXPIRY_MS) usedNonces.delete(key);
  }
}

function isNonceUsed(key: string): boolean {
  return usedNonces.has(key);
}

function markNonceUsed(key: string) {
  if (usedNonces.size > 10_000) pruneNonces();
  usedNonces.set(key, Date.now());
}

export async function verifyRegistryProof(owner: string, action: RegistryAction, proof: unknown) {
  if (!proof || typeof proof !== "object") return false;
  const p = proof as Partial<RegistryProof>;
  if (!p.owner || !p.action || !p.issuedAt || !p.nonce || !p.signature) return false;
  if (p.owner.toLowerCase() !== owner.toLowerCase()) return false;
  if (p.action !== action) return false;
  if (!validIssuedAt(p.issuedAt)) return false;
  if (typeof p.nonce !== "string" || p.nonce.length < 8 || p.nonce.length > 128) return false;

  // Check nonce hasn't been used already
  const nonceKey = `${owner.toLowerCase()}:${action}:${p.nonce}`;
  if (isNonceUsed(nonceKey)) return false;

  const valid = await verifyMessage({
    address: owner as `0x${string}`,
    message: registryProofMessage(owner, action, p.issuedAt, p.nonce),
    signature: p.signature,
  }).catch(() => false);

  if (valid) markNonceUsed(nonceKey);
  return valid;
}
