"use client";

import { useEffect, useRef } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem, type Log } from "viem";
import { arcTestnet } from "@/config/wagmi";
import { TOKENS, type TokenKey } from "@/config/tokens";
import { getLocalTransfers, getPaymentRequests, markMatchingPaymentRequestPaid } from "@/lib/utils";
import { pushRemoteActivity } from "@/lib/activity-sync";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

type TransferLog = Log<bigint, number, false, typeof TRANSFER_EVENT> & {
  args: { from: `0x${string}`; to: `0x${string}`; value: bigint };
};

interface Options {
  address?: string;
  onPaid?: (requestId: string) => void;
}

export function usePaymentRequestWatcher({ address, onPaid }: Options) {
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const onPaidRef = useRef(onPaid);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    if (!publicClient || !address) return;

    const tokenEntries = (Object.keys(TOKENS) as TokenKey[]).map((key) => ({
      key,
      address: TOKENS[key].address,
      decimals: TOKENS[key].decimals,
    }));

    const stops: Array<() => void> = [];
    for (const { key, address: tokenAddress, decimals } of tokenEntries) {
      try {
        const watch = publicClient.watchEvent as unknown as (args: {
          address: `0x${string}`;
          event: typeof TRANSFER_EVENT;
          args?: { to?: `0x${string}` };
          poll?: boolean;
          pollingInterval?: number;
          onLogs: (logs: Log[]) => void;
          onError?: (error: Error) => void;
        }) => () => void;
        const stop = watch({
          address: tokenAddress,
          event: TRANSFER_EVENT,
          args: { to: address as `0x${string}` },
          poll: true,
          pollingInterval: 8000,
          onLogs: (logs: Log[]) => {
            try {
              const pending = getPaymentRequests(address).filter((r) => r.status === "pending");
              if (pending.length === 0) return;
              for (const log of logs as TransferLog[]) {
                const value = log.args.value;
                if (typeof value !== "bigint") continue;
                const matched = markMatchingPaymentRequestPaid(key, value, decimals, address);
                if (matched) {
                  void pushRemoteActivity(address, { requests: getPaymentRequests(), transfers: getLocalTransfers() });
                  if (onPaidRef.current) onPaidRef.current(matched.id);
                }
              }
            } catch (err) {
              console.warn("[paymentWatcher] log handler error", err);
            }
          },
          onError: (err) => console.warn("[paymentWatcher] watch error", err),
        });
        stops.push(stop);
      } catch (err) {
        console.warn("[paymentWatcher] subscribe failed", err);
      }
    }

    return () => {
      stops.forEach((stop) => {
        try { stop(); } catch { /* noop */ }
      });
    };
  }, [publicClient, address]);
}
