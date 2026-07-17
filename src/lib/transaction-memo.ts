"use client";

/**
 * Arc Transaction Memos
 *
 * Structured context attached to onchain transactions for better UX,
 * receipts, and analytics. Memos are stored onchain as calldata.
 *
 * See: https://www.arc.io/blog/arc-transaction-memos
 */

export type MemoType =
  | "PAYMENT"
  | "INVOICE"
  | "TRANSFER"
  | "SWAP"
  | "BRIDGE"
  | "P2P"
  | "SUBSCRIPTION"
  | "TIP"
  | "CUSTOM";

export interface TransactionMemo {
  /** Type of transaction */
  type: MemoType;
  /** Human-readable content (max 128 bytes) */
  content: string;
  /** Optional structured metadata */
  metadata?: Record<string, string>;
  /** Optional invoice/reference ID */
  referenceId?: string;
  /** Optional sender display name */
  senderName?: string;
  /** Optional recipient display name */
  recipientName?: string;
}

/**
 * Encode a transaction memo into hex calldata suffix.
 * The memo is appended to the transaction's data field.
 */
export function encodeMemo(memo: TransactionMemo): `0x${string}` {
  const payload = JSON.stringify({
    v: 1, // version
    t: memo.type,
    c: memo.content.slice(0, 128),
    ...(memo.metadata && { m: memo.metadata }),
    ...(memo.referenceId && { r: memo.referenceId }),
    ...(memo.senderName && { s: memo.senderName.slice(0, 32) }),
    ...(memo.recipientName && { d: memo.recipientName.slice(0, 32) }),
  });

  // Convert to hex bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `0x${hex}` as `0x${string}`;
}

/**
 * Decode a transaction memo from hex calldata suffix.
 */
export function decodeMemo(hexData: `0x${string}`): TransactionMemo | null {
  try {
    // Strip the first 4 bytes (function selector) and decode
    const payloadHex = hexData.slice(10); // Remove "0x" + 4 byte selector
    const bytes = new Uint8Array(
      payloadHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    );
    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    const parsed = JSON.parse(json);

    return {
      type: parsed.t || "CUSTOM",
      content: parsed.c || "",
      metadata: parsed.m,
      referenceId: parsed.r,
      senderName: parsed.s,
      recipientName: parsed.d,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a memo before attaching to a transaction.
 */
export function validateMemo(memo: TransactionMemo): {
  valid: boolean;
  error?: string;
} {
  if (!memo.content || memo.content.trim().length === 0) {
    return { valid: false, error: "Memo content cannot be empty" };
  }
  if (memo.content.length > 128) {
    return { valid: false, error: "Memo content must be 128 characters or less" };
  }
  const validTypes: MemoType[] = [
    "PAYMENT",
    "INVOICE",
    "TRANSFER",
    "SWAP",
    "BRIDGE",
    "P2P",
    "SUBSCRIPTION",
    "TIP",
    "CUSTOM",
  ];
  if (!validTypes.includes(memo.type)) {
    return { valid: false, error: `Invalid memo type: ${memo.type}` };
  }
  return { valid: true };
}

/**
 * Create a quick P2P payment memo.
 */
export function createP2PMemo(
  senderName: string,
  recipientName: string,
  note?: string
): TransactionMemo {
  return {
    type: "P2P",
    content: note || `Payment from ${senderName} to ${recipientName}`,
    senderName,
    recipientName,
  };
}

/**
 * Create an invoice payment memo.
 */
export function createInvoiceMemo(
  invoiceId: string,
  amount: string,
  note?: string
): TransactionMemo {
  return {
    type: "INVOICE",
    content: note || `Invoice ${invoiceId} — ${amount} USDC`,
    referenceId: invoiceId,
    metadata: { amount },
  };
}
