# Radius Agent Per-User Wallets Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a future `/agent` page where each Radius user can run natural-language send/swap/bridge actions from their own Circle Agent Wallet, not from one shared server-controlled wallet.

**Architecture:** Radius should treat Circle Agent Wallets as per-user wallets. The app stores only user wallet metadata and session/status state; each user authenticates their own Circle Agent Wallet session and funds/operates their own wallet under their own policies. Radius parses commands, resolves Radius usernames, previews the action, then calls a per-user execution backend that uses that user's Circle Agent Wallet address/session.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Circle Agent Stack / Circle CLI, Arc Testnet (`ARC-TESTNET`), existing Radius registry/contact APIs, existing Circle App Kit helpers for comparison/fallback.

---

## Non-negotiable Product Decision

Do **not** use `CIRCLE_AGENT_WALLET_ADDRESS` as one global execution wallet for all users.

Every user must have their own Circle Agent Wallet:

- User A prompt executes from User A's agent wallet.
- User B prompt executes from User B's agent wallet.
- Radius may help parse, quote, and route actions, but Radius must not custody or pool user funds.
- Any server-side Circle CLI/API call must be scoped by authenticated Radius user + their wallet address/session.

The existing `/agent-wallet` page and `src/lib/agent-wallet.ts` are global-wallet oriented. Keep them only as admin/dev diagnostics or migrate them away from user-facing flows.

---

## Target User Flow

1. User opens `/agent`.
2. If no personal Circle Agent Wallet is linked, show onboarding:
   - Explain user-owned agent wallet.
   - Start Circle wallet login/create flow.
   - Store wallet address associated with the current Radius wallet/profile.
3. User types a command:
   - `send 5 USDC to @alice for lunch`
   - `swap 2 USDC to EURC`
   - `bridge 5 USDC from Arc Testnet to Ethereum Sepolia`
4. Radius parses intent into strict JSON.
5. Radius resolves usernames with existing registry.
6. Radius shows preview/quote.
7. User clicks confirm.
8. Server executes using that user's Circle Agent Wallet session/address.
9. Radius shows tx hash/status and writes activity/history.

---

## Circle CLI mappings

Send USDC on Arc Testnet:

```bash
circle wallet transfer 0xRecipient --amount 5.0 --address 0xUserAgentWallet --chain ARC-TESTNET
```

Swap on Arc Testnet:

```bash
circle wallet swap USDC 2 EURC --address 0xUserAgentWallet --chain ARC-TESTNET
circle wallet swap USDC 2 EURC --chain ARC-TESTNET --quote
```

Bridge USDC Arc Testnet → Ethereum Sepolia:

```bash
circle bridge transfer ETH-SEPOLIA --amount 5.0 --address 0xUserAgentWallet --chain ARC-TESTNET
circle bridge get-fee ETH-SEPOLIA --chain ARC-TESTNET
```

---

## Task 1: Add per-user agent wallet data model

**Objective:** Define how Radius records each user's Circle Agent Wallet metadata without storing shared secrets.

**Files:**
- Create: `src/lib/user-agent-wallets.ts`
- Create: `src/app/api/agent/wallet/route.ts`

**Implementation notes:**

Data should be keyed by the connected Radius owner address, not global env vars.

Suggested type:

```ts
export type UserAgentWalletRecord = {
  ownerAddress: `0x${string}`;
  agentWalletAddress: `0x${string}`;
  chain: "ARC-TESTNET";
  createdAt: string;
  updatedAt: string;
  label?: string;
};
```

For v1 storage, use the existing registry/blob pattern if appropriate. Do not expose Circle sessions, OTPs, or secrets to the browser.

**Verification:**

- `GET /api/agent/wallet?owner=0x...` returns only that owner's wallet metadata.
- Missing owner returns 400.
- Unknown owner returns `{ wallet: null }`.

---

## Task 2: Build per-user Circle CLI wrapper

**Objective:** Replace global agent-wallet execution assumptions with functions that require a user wallet address argument.

**Files:**
- Create: `src/lib/circle-agent-cli.ts`
- Leave existing: `src/lib/agent-wallet.ts` as dev/admin-only until migrated.

**Required API:**

```ts
export async function getUserAgentWalletBalance(params: {
  address: `0x${string}`;
  chain?: "ARC-TESTNET";
}): Promise<CircleCliResult>;

export async function quoteUserAgentSwap(params: {
  sellToken: "USDC" | "EURC";
  sellAmount: string;
  buyToken: "USDC" | "EURC";
  chain?: "ARC-TESTNET";
}): Promise<CircleCliResult>;

export async function transferFromUserAgentWallet(params: {
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  amount: string;
  chain?: "ARC-TESTNET";
  token?: string;
  idempotencyKey?: string;
}): Promise<CircleCliResult>;
```

**Rules:**

- Every execution function must require `fromAddress`.
- No fallback to `process.env.CIRCLE_AGENT_WALLET_ADDRESS` for user actions.
- Use `execFile`, not shell string concatenation.
- Validate amounts and addresses before execution.

**Verification:**

- Unit test confirms missing `fromAddress` throws/refuses.
- Unit test confirms commands are built as argv arrays, not shell strings.

---

## Task 3: Add Radius Agent intent parser

**Objective:** Parse supported natural-language commands locally before adding LLM parsing.

**Files:**
- Create: `src/lib/agent-intents.ts`
- Create: `src/lib/agent-intents.test.ts` if test runner exists, otherwise add focused parser checks to a simple script/test pattern used by the repo.

**Supported intents:**

```ts
type AgentIntent =
  | { type: "send"; amount: string; token: "USDC"; recipient: string; note?: string }
  | { type: "swap"; amount: string; tokenIn: "USDC" | "EURC"; tokenOut: "USDC" | "EURC" }
  | { type: "bridge"; amount: string; token: "USDC"; fromChain: "ARC-TESTNET"; toChain: "ETH-SEPOLIA" };
```

**Examples to pass:**

- `send 5 USDC to @alice for lunch`
- `send 5 usdc to 0xabc...`
- `swap 2 USDC to EURC`
- `bridge 5 USDC from Arc Testnet to Ethereum Sepolia`

**Verification:**

- Parser rejects unsupported tokens.
- Parser rejects zero/negative amounts.
- Parser rejects ambiguous recipients.

---

## Task 4: Add quote/preview API

**Objective:** Convert parsed intents into safe previews using the current user's wallet and Radius registry.

**Files:**
- Create: `src/app/api/agent/quote/route.ts`
- Modify/read existing: `src/lib/registry-client.ts` or server registry helpers as needed.

**Behavior:**

- Send:
  - Resolve `@username` to address.
  - Return recipient address/profile + amount.
- Swap:
  - Call `circle wallet swap ... --quote`.
  - Return estimated output if available.
- Bridge:
  - Call `circle bridge get-fee ETH-SEPOLIA --chain ARC-TESTNET`.
  - Return estimated fee/status.

**Verification:**

- API refuses quote if user has no linked agent wallet.
- API refuses unknown Radius username.
- API never executes a transaction.

---

## Task 5: Add execution API with confirmation boundary

**Objective:** Execute only a previously previewed action for the current user's wallet.

**Files:**
- Create: `src/app/api/agent/execute/route.ts`

**Rules:**

- Require authenticated/connected owner address.
- Require linked per-user agent wallet.
- Require explicit client confirmation payload.
- Re-validate intent server-side; do not trust parsed client JSON blindly.
- Generate idempotency key per execution.
- Return tx hash/status and step data.

**Verification:**

- Cannot execute without wallet.
- Cannot execute from another user's wallet address.
- Cannot execute unsupported route/token.
- Duplicate idempotency key does not double-send.

---

## Task 6: Build `/agent` page

**Objective:** Add the user-facing Radius Agent UI.

**Files:**
- Create: `src/app/agent/page.tsx`
- Modify: `src/components/AppShell.tsx`

**UI requirements:**

- Header: `Radius Agent`
- Explain: `Your commands execute from your own Circle Agent Wallet.`
- Onboarding card if no personal agent wallet linked.
- Prompt input with examples.
- Preview card for parsed intent.
- Confirm button only after successful quote.
- Status/result card after execution.

**Navigation:**

Add Agent to desktop sidebar. Consider replacing one lower-priority mobile nav item later; do not crowd mobile nav unless design is reviewed.

**Verification:**

- `/agent` renders unauthenticated/no-wallet state.
- `/agent` parses example prompts.
- Confirm button disabled until quote succeeds.

---

## Task 7: Deprecate global `/agent-wallet` for normal users

**Objective:** Avoid confusing users into thinking there is one app-owned Radius agent wallet.

**Files:**
- Modify: `src/app/agent-wallet/page.tsx`
- Modify: `src/lib/agent-wallet.ts` comments/docs

**Behavior:**

- Label it as `Developer diagnostics` or hide from normal nav.
- Add warning: `This is not the per-user Radius Agent wallet flow.`
- Link to `/agent` for the actual user flow.

**Verification:**

- No primary user path points to global `CIRCLE_AGENT_WALLET_ADDRESS` as execution wallet.

---

## Task 8: Test, build, deploy

**Objective:** Ship safely after implementation.

**Commands:**

```bash
npm run lint
npm run build
vercel --prod
```

Then commit and push:

```bash
git add -A
git commit -m "feat: add per-user Radius Agent plan/implementation"
git push
```

**Manual verification:**

- Visit `https://radius-gules.vercel.app/agent`.
- Link/create a user agent wallet.
- Quote a send to a Radius username.
- Quote swap USDC → EURC on Arc Testnet.
- Quote bridge Arc Testnet → Ethereum Sepolia.
- Execute only with small testnet amounts.

---

## Later LLM Upgrade

After deterministic v1 works, add `/api/agent/parse` backed by an LLM. The LLM must output only strict JSON matching `AgentIntent`; it must never execute transactions. Keep regex parser as fallback and as safety validation.
