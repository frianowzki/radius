# Radius E2E tests

Two test suites live here:

## 1. Smoke tests (no wallet)

`tests/smoke.spec.ts` — verifies every public route renders, the manifest + service worker are reachable, and no fatal client error fires. Wallet-free.

```bash
npm run test:e2e:install   # one-time browser download
npm run test:e2e
```

## 2. Wallet tests (Anvil + injected provider)

`tests/wallet/` — exercises the connected-wallet UI by injecting a synthetic EIP-1193 + EIP-6963 provider that proxies RPC calls to a local Anvil node.

### Run

```bash
# Terminal 1 — start Anvil with Arc Testnet's chain id
npm run anvil:test
# Or forked from Arc Testnet (so USDC + EURC contracts exist locally):
npm run anvil:test:fork

# Terminal 2 — run the wallet specs (auto-skips when RPC isn't reachable)
npm run test:e2e:wallet
```

### Configuration

Override the defaults via env:

| Env var            | Default                                             |
| ------------------ | --------------------------------------------------- |
| `WALLET_RPC_URL`   | `http://127.0.0.1:8545`                             |
| `WALLET_CHAIN_ID`  | `5042002` (Arc Testnet)                             |
| `WALLET_ADDRESS`   | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (anvil[0]) |

### How it works

1. `tests/wallet/fixtures.ts` registers two `addInitScript` calls: the first seeds the wallet config global, the second injects `inject.js` before any app script runs.
2. `inject.js` exposes a `window.ethereum` provider that handles `eth_chainId`, `eth_accounts`, `wallet_*` requests synthetically and forwards everything else (`eth_call`, `eth_sendTransaction`, etc.) over HTTP to Anvil. It also announces itself via EIP-6963 so RainbowKit's "Browser Wallet" detection picks it up.
3. `personal_sign` / `eth_signTypedData_v4` return a deterministic stub signature — sufficient for non-SIWE flows. Add real signing here if you start testing SIWE.
