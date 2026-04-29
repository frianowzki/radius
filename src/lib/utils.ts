import { type TokenKey } from "@/config/tokens";

export interface Contact {
  id: string;
  name: string;
  address: string;
  handle?: string;
  avatar?: string;
  note?: string;
}

export interface UserIdentityProfile {
  displayName: string;
  handle?: string;
  avatar?: string;
  bio?: string;
  authMode?: "wallet" | "social-coming-soon";
}

const CONTACTS_KEY = "arc-p2p-contacts";
const IDENTITY_KEY = "arc-p2p-identity";
const LOCAL_TRANSFERS_KEY = "arc-p2p-local-transfers";
const PAYMENT_REQUESTS_KEY = "radius-payment-requests";


export type PaymentRequestStatus = "pending" | "paid" | "expired";

export interface PaymentRequestRecord {
  id: string;
  recipient: string;
  amount: string;
  token: TokenKey;
  memo?: string;
  url: string;
  status: PaymentRequestStatus;
  createdAt: number;
  paidAt?: number;
  /** When set, this is a split-bill request that aggregates partial payments until paidUnits >= targetUnits. */
  split?: {
    /** Total target in raw token units (string for bigint serialization). */
    targetUnits: string;
    /** Cumulative paid in raw token units. */
    paidUnits: string;
    /** Optional headcount for display. */
    participants?: number;
  };
}

export interface LocalTransferRecord {
  id: string;
  from: string;
  to: string;
  value: string;
  token: TokenKey;
  txHash: string;
  direction: "sent" | "received";
  routeLabel?: string;
  createdAt: number;
}


export function getContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CONTACTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveContacts(contacts: Contact[]) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function getIdentityProfile(): UserIdentityProfile {
  if (typeof window === "undefined") {
    return { displayName: "Arc user", authMode: "wallet" };
  }

  const raw = localStorage.getItem(IDENTITY_KEY);
  if (!raw) return { displayName: "Arc user", authMode: "wallet" };

  try {
    const parsed = JSON.parse(raw) as UserIdentityProfile;
    return {
      displayName: parsed.displayName || "Arc user",
      handle: parsed.handle ? normalizeHandle(parsed.handle) : undefined,
      avatar: parsed.avatar || undefined,
      bio: parsed.bio || undefined,
      authMode: parsed.authMode || "wallet",
    };
  } catch {
    return { displayName: "Arc user", authMode: "wallet" };
  }
}

export function saveIdentityProfile(profile: UserIdentityProfile) {
  localStorage.setItem(
    IDENTITY_KEY,
    JSON.stringify({
      ...profile,
      handle: profile.handle ? normalizeHandle(profile.handle) : undefined,
      authMode: profile.authMode || "wallet",
    })
  );
}

export function clearRadiusLocalSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(IDENTITY_KEY);
  localStorage.removeItem(CONTACTS_KEY);
  localStorage.removeItem("pfpUrl");
}

export function addContact(
  name: string,
  address: string,
  extras?: { handle?: string; avatar?: string; note?: string }
): Contact {
  const contacts = getContacts();
  const contact: Contact = {
    id: crypto.randomUUID(),
    name,
    address,
    handle: extras?.handle?.trim() || undefined,
    avatar: extras?.avatar?.trim() || undefined,
    note: extras?.note?.trim() || undefined,
  };
  contacts.push(contact);
  saveContacts(contacts);
  return contact;
}

export function removeContact(id: string) {
  const contacts = getContacts().filter((c) => c.id !== id);
  saveContacts(contacts);
}

export function updateContact(
  id: string,
  data: { name: string; address: string; handle?: string; avatar?: string; note?: string }
): Contact | undefined {
  const contacts = getContacts();
  const index = contacts.findIndex((contact) => contact.id === id);
  if (index < 0) return undefined;

  const updated: Contact = {
    id,
    name: data.name.trim(),
    address: data.address,
    handle: data.handle?.trim() || undefined,
    avatar: data.avatar?.trim() || undefined,
    note: data.note?.trim() || undefined,
  };

  contacts[index] = updated;
  saveContacts(contacts);
  return updated;
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function findContactByAddress(address: string): Contact | undefined {
  return getContacts().find(
    (contact) => contact.address.toLowerCase() === address.toLowerCase()
  );
}

export function getIdentityLabel(profile: UserIdentityProfile): string {
  return profile.handle ? `${profile.displayName} (@${profile.handle})` : profile.displayName;
}

export function formatContactLabel(address: string): string {
  const contact = findContactByAddress(address);
  if (!contact) return formatAddress(address);

  if (contact.handle) return `${contact.name} (@${normalizeHandle(contact.handle)})`;
  return contact.name;
}

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@+/, "");
}

export function isHandleAvailable(handle: string, excludeAddress?: string): boolean {
  const normalized = normalizeHandle(handle);
  if (!normalized) return true;

  return !getContacts().some((contact) => {
    if (!contact.handle) return false;
    if (excludeAddress && contact.address.toLowerCase() === excludeAddress.toLowerCase()) {
      return false;
    }
    return normalizeHandle(contact.handle) === normalized;
  });
}

export function findContactByHandle(handle: string): Contact | undefined {
  const normalized = normalizeHandle(handle);
  if (!normalized) return undefined;

  return getContacts().find((contact) => {
    if (!contact.handle) return false;
    return normalizeHandle(contact.handle) === normalized;
  });
}

export function upsertContactByAddress(
  address: string,
  data: { name: string; handle?: string; avatar?: string; note?: string }
): Contact {
  const contacts = getContacts();
  const existingIndex = contacts.findIndex(
    (contact) => contact.address.toLowerCase() === address.toLowerCase()
  );

  const nextContact: Contact = {
    id: existingIndex >= 0 ? contacts[existingIndex].id : crypto.randomUUID(),
    address,
    name: data.name,
    handle: data.handle?.trim() || undefined,
    avatar: data.avatar?.trim() || undefined,
    note: data.note?.trim() || undefined,
  };

  if (existingIndex >= 0) contacts[existingIndex] = nextContact;
  else contacts.push(nextContact);

  saveContacts(contacts);
  return nextContact;
}

export function resolveRecipientInput(input: string): {
  address?: string;
  contact?: Contact;
  inputType: "address" | "handle" | "unknown";
} {
  const trimmed = input.trim();
  if (!trimmed) return { inputType: "unknown" };

  if (trimmed.startsWith("@") || !trimmed.startsWith("0x")) {
    const contact = findContactByHandle(trimmed);
    return {
      address: contact?.address,
      contact,
      inputType: "handle",
    };
  }

  const contact = findContactByAddress(trimmed);
  return {
    address: trimmed,
    contact,
    inputType: trimmed.startsWith("0x") ? "address" : "unknown",
  };
}

export interface DirectoryEntry {
  kind: "self" | "contact";
  name: string;
  handle?: string;
  avatar?: string;
  address?: string;
  note?: string;
  bio?: string;
}

export function getDirectoryEntries(currentAddress?: string): DirectoryEntry[] {
  const identity = getIdentityProfile();
  const contacts = getContacts();

  const selfEntry: DirectoryEntry = {
    kind: "self",
    name: identity.displayName,
    handle: identity.handle,
    avatar: identity.avatar,
    address: currentAddress,
    bio: identity.bio,
  };

  const contactEntries: DirectoryEntry[] = contacts.map((contact) => ({
    kind: "contact",
    name: contact.name,
    handle: contact.handle,
    avatar: contact.avatar,
    address: contact.address,
    note: contact.note,
  }));

  return [selfEntry, ...contactEntries];
}

export function searchDirectoryEntries(query: string, currentAddress?: string): DirectoryEntry[] {
  const normalized = normalizeHandle(query);
  const raw = query.trim().toLowerCase();

  return getDirectoryEntries(currentAddress).filter((entry) => {
    if (!query.trim()) return true;

    return [
      entry.name.toLowerCase(),
      entry.handle?.toLowerCase(),
      entry.address?.toLowerCase(),
      entry.note?.toLowerCase(),
      entry.bio?.toLowerCase(),
      normalized,
    ].some((value) => value?.includes(raw));
  });
}


export function decimalToUnits(value: string, decimals: number): bigint {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || Number(normalized) <= 0) return BigInt(0);
  const [whole = "0", fraction = ""] = normalized.split(".");
  const padded = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(`${whole || "0"}${padded}`);
}

export function getPaymentRequests(currentAddress?: string): PaymentRequestRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(PAYMENT_REQUESTS_KEY);
    const requests = raw ? (JSON.parse(raw) as PaymentRequestRecord[]) : [];
    if (!currentAddress) return requests;

    const normalized = currentAddress.toLowerCase();
    return requests.filter((request) => request.recipient.toLowerCase() === normalized || request.recipient.toLowerCase() === `@${normalized}`);
  } catch {
    return [];
  }
}

export function savePaymentRequest(
  request: Omit<PaymentRequestRecord, "status" | "createdAt"> & { id?: string }
): PaymentRequestRecord {
  const requests = getPaymentRequests();
  const existing = requests.find(
    (item) =>
      item.url === request.url &&
      item.amount === request.amount &&
      item.token === request.token &&
      item.status === "pending"
  );
  if (existing) return existing;

  const record: PaymentRequestRecord = {
    ...request,
    id: request.id || crypto.randomUUID(),
    status: "pending",
    createdAt: Date.now(),
  };

  localStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify([record, ...requests]));
  return record;
}

export function markMatchingPaymentRequestPaid(
  token: TokenKey,
  receivedRaw: bigint,
  decimals: number,
  recipient?: string,
  requestId?: string | null
): PaymentRequestRecord | undefined {
  const requests = getPaymentRequests();
  const normalizedRecipient = recipient?.toLowerCase();
  const match = requests.find((request) => {
    if (request.status !== "pending" || request.token !== token) return false;
    if (requestId && request.id !== requestId) return false;
    if (normalizedRecipient && request.recipient.toLowerCase() !== normalizedRecipient) return false;
    if (request.split) {
      // Any non-zero contribution counts toward a split request.
      return receivedRaw > BigInt(0);
    }
    return receivedRaw >= decimalToUnits(request.amount, decimals);
  });

  if (!match) return undefined;

  let updatedRecord: PaymentRequestRecord = match;
  const updated = requests.map((request) => {
    if (request.id !== match.id) return request;
    if (request.split) {
      const target = BigInt(request.split.targetUnits);
      const paid = BigInt(request.split.paidUnits) + receivedRaw;
      const reached = paid >= target;
      updatedRecord = {
        ...request,
        split: { ...request.split, paidUnits: paid.toString() },
        status: reached ? "paid" : request.status,
        paidAt: reached ? Date.now() : request.paidAt,
      };
      return updatedRecord;
    }
    updatedRecord = { ...request, status: "paid" as const, paidAt: Date.now() };
    return updatedRecord;
  });
  localStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify(updated));
  return updatedRecord;
}

export function expirePaymentRequest(id: string): PaymentRequestRecord | undefined {
  const requests = getPaymentRequests();
  let updatedRecord: PaymentRequestRecord | undefined;
  const updated = requests.map((request) => {
    if (request.id !== id) return request;
    updatedRecord = { ...request, status: "expired" };
    return updatedRecord;
  });
  localStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify(updated));
  return updatedRecord;
}

export function getLocalTransfers(currentAddress?: string): LocalTransferRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(LOCAL_TRANSFERS_KEY);
    const transfers = raw ? (JSON.parse(raw) as LocalTransferRecord[]) : [];
    if (!currentAddress) return transfers;

    const normalized = currentAddress.toLowerCase();
    return transfers.filter(
      (transfer) =>
        transfer.from.toLowerCase() === normalized ||
        transfer.to.toLowerCase() === normalized
    );
  } catch {
    return [];
  }
}

export function saveLocalTransfer(
  transfer: Omit<LocalTransferRecord, "id" | "createdAt">
): LocalTransferRecord {
  const transfers = getLocalTransfers();
  const existing = transfers.find(
    (item) =>
      item.txHash &&
      transfer.txHash &&
      item.txHash.toLowerCase() === transfer.txHash.toLowerCase() &&
      item.direction === transfer.direction
  );

  if (existing) return existing;

  const record: LocalTransferRecord = {
    ...transfer,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify([record, ...transfers]));
  return record;
}

export function formatAmount(raw: bigint, decimals: number): string {
  const divisor = 10 ** decimals;
  const num = Number(raw) / divisor;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function formatPreferredRecipientInput(address: string): string {
  const contact = findContactByAddress(address);
  if (contact?.handle) return `@${normalizeHandle(contact.handle)}`;
  return address;
}

export function buildPaymentUrl(
  recipient: string,
  amount: string,
  token: TokenKey,
  memo: string,
  requestId?: string
): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({ to: recipient, amount, token });
  if (requestId) params.set("rid", requestId);
  if (memo.trim()) params.set("memo", memo.trim());
  return `${base}/pay?${params.toString()}`;
}
