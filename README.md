This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and set the env needed for mobile-friendly social/email auth:

```bash
npm install
cp .env.example .env.local
```

Then set:

```bash
NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id
```

Without that env, the app still works in wallet-first mode, but the social/email auth entry stays disabled on purpose.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Mobile browser note

For the cleanest mobile onboarding:
- use the social/email auth entry once `NEXT_PUBLIC_REOWN_PROJECT_ID` is configured
- or open the app inside a wallet in-app browser that injects Ethereum support
- plain mobile browsers may not expose any injected wallet at all

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and APIs.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
