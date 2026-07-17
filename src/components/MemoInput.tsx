"use client";

import { useState } from "react";
import type { MemoType, TransactionMemo } from "@/lib/transaction-memo";

interface MemoInputProps {
  onChange: (memo: TransactionMemo | null) => void;
  disabled?: boolean;
}

const MEMO_TYPES: { value: MemoType; label: string }[] = [
  { value: "P2P", label: "Peer-to-Peer" },
  { value: "PAYMENT", label: "Payment" },
  { value: "INVOICE", label: "Invoice" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "TIP", label: "Tip" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "CUSTOM", label: "Custom" },
];

/**
 * Input component for attaching transaction memos.
 * Allows users to add structured context to their onchain transactions.
 */
export function MemoInput({ onChange, disabled }: MemoInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [memoType, setMemoType] = useState<MemoType>("P2P");
  const [content, setContent] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const handleChange = () => {
    if (!content.trim()) {
      onChange(null);
      return;
    }
    const memo: TransactionMemo = {
      type: memoType,
      content: content.trim(),
      ...(referenceId.trim() && { referenceId: referenceId.trim() }),
    };
    onChange(memo);
  };

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      onChange(null);
      setContent("");
      setReferenceId("");
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors disabled:opacity-50"
      >
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-45" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        {isOpen ? "Remove memo" : "Add memo"}
      </button>

      {isOpen && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex gap-2">
            <select
              value={memoType}
              onChange={(e) => setMemoType(e.target.value as MemoType)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
            >
              {MEMO_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              // Auto-update memo on change
              if (e.target.value.trim()) {
                const memo: TransactionMemo = {
                  type: memoType,
                  content: e.target.value.trim(),
                  ...(referenceId.trim() && { referenceId: referenceId.trim() }),
                };
                onChange(memo);
              } else {
                onChange(null);
              }
            }}
            placeholder="Add a note (optional)"
            maxLength={128}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          />

          {memoType === "INVOICE" && (
            <input
              type="text"
              value={referenceId}
              onChange={(e) => {
                setReferenceId(e.target.value);
                if (content.trim()) {
                  const memo: TransactionMemo = {
                    type: memoType,
                    content: content.trim(),
                    ...(e.target.value.trim() && {
                      referenceId: e.target.value.trim(),
                    }),
                  };
                  onChange(memo);
                }
              }}
              placeholder="Invoice/Reference ID"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          )}

          <p className="text-xs text-white/30">
            {content.length}/128 characters
          </p>
        </div>
      )}
    </div>
  );
}
