/* eslint-disable */
// Injected into the page before any app script runs. Exposes a synthetic
// EIP-1193 + EIP-6963 provider that proxies RPC calls to a local Anvil node.
// Configuration is read from window.__RADIUS_TEST_WALLET__ (set by the fixture).

(() => {
  const cfg = window.__RADIUS_TEST_WALLET__;
  if (!cfg) return;

  let nextId = 1;
  const listeners = new Map();

  function emit(event, ...args) {
    const set = listeners.get(event);
    if (!set) return;
    set.forEach((cb) => { try { cb(...args); } catch { /* swallow */ } });
  }

  async function rpcCall(method, params) {
    const res = await fetch(cfg.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params: params || [] }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error.message || "RPC error");
    return body.result;
  }

  const provider = {
    isMetaMask: false,
    isRadiusTestWallet: true,
    chainId: cfg.chainIdHex,
    selectedAddress: cfg.address,
    request: async ({ method, params }) => {
      switch (method) {
        case "eth_chainId": return cfg.chainIdHex;
        case "eth_accounts":
        case "eth_requestAccounts":
          return [cfg.address];
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "personal_sign":
        case "eth_signTypedData_v4":
          return "0x" + "00".repeat(65);
        default:
          return rpcCall(method, params);
      }
    },
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
    },
    removeListener(event, cb) {
      const set = listeners.get(event);
      if (set) set.delete(cb);
    },
  };

  Object.defineProperty(window, "ethereum", { value: provider, configurable: true });

  const info = {
    uuid: "00000000-0000-4000-8000-000000000001",
    name: "Radius Test Wallet",
    icon: "data:image/svg+xml;base64,PHN2Zy8+",
    rdns: "test.radius.wallet",
  };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  setTimeout(() => emit("connect", { chainId: cfg.chainIdHex }), 0);
})();
