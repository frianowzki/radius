'use client';
import { useEffect, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { TOKENS, type TokenKey } from '@/config/tokens';
import { arcTestnet } from '@/config/wagmi';
import { formatAmount, formatContactLabel } from '@/lib/utils';

const LAST_SEEN_KEY = 'radius-last-incoming-hash';
const POLL_MS = 30_000;

function getLastSeen(): string {
  try { return localStorage.getItem(LAST_SEEN_KEY) || ''; } catch { return ''; }
}
function setLastSeen(hash: string) {
  try { localStorage.setItem(LAST_SEEN_KEY, hash); } catch {}
}

export function useIncomingPaymentNotifications() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const lastRef = useRef(getLastSeen());

  useEffect(() => {
    if (!address || !publicClient) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    let timer: ReturnType<typeof setInterval>;
    let running = false;

    const currentAddress = address;

    async function check() {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        for (const [symbol, info] of Object.entries(TOKENS)) {
          const logs = await publicClient!.getLogs({
            address: info.address,
            event: {
              type: 'event', name: 'Transfer',
              inputs: [
                { type: 'address', name: 'from', indexed: true },
                { type: 'address', name: 'to', indexed: true },
                { type: 'uint256', name: 'value', indexed: false },
              ],
            },
            args: { to: currentAddress as `0x${string}` },
            fromBlock: 'earliest',
            toBlock: 'latest',
          });

          for (const log of logs) {
            const hash = log.transactionHash;
            if (!hash || hash <= lastRef.current) continue;
            const args = log.args as { from?: string; to?: string; value?: bigint };
            if (!args.from || !args.value) continue;
            if (args.from.toLowerCase() === currentAddress.toLowerCase()) continue;

            const amount = formatAmount(args.value, info.decimals);
            const label = formatContactLabel(args.from);
            new Notification('Payment received', {
              body: `+${amount} ${symbol} from ${label}`,
              icon: '/icon.svg',
              tag: hash,
            });
            lastRef.current = hash;
            setLastSeen(hash);
          }
        }
      } catch {}
      running = false;
    }

    timer = setInterval(check, POLL_MS);
    check();
    return () => clearInterval(timer);
  }, [address, publicClient]);
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}
