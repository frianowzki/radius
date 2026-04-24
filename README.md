# radius

I'm building Radius on Arc testnet.

Radius is a Next.js app focused on fast stablecoin payments, request flows, receipts, contacts, and mobile-friendly onboarding.

## Getting Started

Install dependencies and set the env needed for mobile-friendly social or email auth:

```bash
npm install
cp .env.example .env.local
```

Then set:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
# Optional depending on your Privy setup
NEXT_PUBLIC_PRIVY_CLIENT_ID=your_privy_client_id
```

Without a real `NEXT_PUBLIC_PRIVY_APP_ID`, the app still works in wallet-first mode, but the social or email auth entry stays disabled on purpose.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Mobile browser note

For the cleanest mobile onboarding:
- use the Privy social or email auth entry once `NEXT_PUBLIC_PRIVY_APP_ID` is configured (and `NEXT_PUBLIC_PRIVY_CLIENT_ID` too if your Privy setup requires it)
- or open the app inside a wallet in-app browser that injects Ethereum support
- plain mobile browsers may not expose any injected wallet at all

## Current product direction

- Arc-native stablecoin payments
- request-first UX with QR and shareable payment links
- receipt-first transaction surfaces
- local app identity and directory layer
- crosschain-ready send flow groundwork
- mobile-friendly wallet plus auth onboarding
