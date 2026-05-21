"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SocialLoginButton } from "@/components/SocialLoginButton";
import { ThemeToggle } from "@/components/ThemeToggle";

const LANDING_LINKS = [
  { label: "Email", href: "mailto:friology@gmail.com", icon: "email" },
  { label: "GitHub", href: "https://github.com/frianowzki/radius", icon: "github" },
  { label: "Twitter", href: "https://x.com/widyakrnwn", icon: "x" },
  { label: "Docs", href: "https://docs.arc.io", icon: "docs" },
  { label: "Community", href: "https://community.arc.io", icon: "community" },
] as const;

function LandingLinkIcon({ name }: { name: (typeof LANDING_LINKS)[number]["icon"] }) {
  if (name === "github") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.7a9.3 9.3 0 0 0-2.94 18.12c.47.08.64-.2.64-.45v-1.6c-2.6.56-3.15-1.12-3.15-1.12-.42-1.07-1.03-1.35-1.03-1.35-.84-.58.06-.56.06-.56.94.06 1.43.96 1.43.96.82 1.42 2.17 1.01 2.7.77.08-.6.32-1.01.58-1.24-2.08-.24-4.27-1.04-4.27-4.63 0-1.02.36-1.86.96-2.52-.1-.23-.42-1.2.09-2.48 0 0 .79-.25 2.56.96A8.8 8.8 0 0 1 12 6.22c.8 0 1.59.11 2.34.32 1.77-1.2 2.55-.96 2.55-.96.51 1.29.19 2.25.1 2.48.6.66.96 1.5.96 2.52 0 3.6-2.2 4.39-4.29 4.62.33.29.63.86.63 1.74v2.58c0 .25.17.54.65.45A9.3 9.3 0 0 0 12 2.7Z" /></svg>;
  }
  if (name === "x") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 10.8 22 3h-1.6l-5.9 6.8L9.8 3H4.4l7.1 10.3L4.4 21h1.6l6.2-7.1 5 7.1h5.4l-7.4-10.2Zm-2.2 2.5-.7-1L6.6 4.2H9l4.6 6.5.7 1 6 8.5h-2.4L13 13.3Z" /></svg>;
  }
  if (name === "docs") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M7 3.8h6.2L18 8.6v11.6H7a1.8 1.8 0 0 1-1.8-1.8V5.6A1.8 1.8 0 0 1 7 3.8Z"/><path d="M13 4v5h5"/><path d="M8.6 12.7h6.8M8.6 16h6.8"/></svg>;
  }
  if (name === "community") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M8.4 11.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM15.9 10.6a2.7 2.7 0 1 0 0-5.4"/><path d="M3.8 19.2a4.6 4.6 0 0 1 9.2 0"/><path d="M13.6 14.5a4 4 0 0 1 6.6 3v1.7"/></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M4.8 6.4h14.4a1.8 1.8 0 0 1 1.8 1.8v7.6a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 15.8V8.2a1.8 1.8 0 0 1 1.8-1.8Z"/><path d="m4 7.7 8 5.6 8-5.6"/></svg>;
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.2 8.1h13.9a2.2 2.2 0 0 1 2.2 2.2v7.1a2.2 2.2 0 0 1-2.2 2.2H5.9a2.2 2.2 0 0 1-2.2-2.2V6.8a2.2 2.2 0 0 1 2.2-2.2h10.2" />
      <path d="M4 8.2 17.1 8" />
      <path d="M16.3 13.9h4" />
      <path d="M16.3 13.9a.25.25 0 1 0 0 .5.25.25 0 0 0 0-.5" />
    </svg>
  );
}

function WalletLoginButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <button
            type="button"
            onClick={connected ? (chain.unsupported ? openChainModal : openAccountModal) : openConnectModal}
            className="radius-auth-button secondary justify-center"
          >
            <span className="login-action-icon" aria-hidden="true"><WalletIcon /></span>
            <span>{connected ? (chain.unsupported ? "Switch Network" : account.displayName) : "Connect Wallet"}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function LandingScreen({ registrationRequired = false }: { registrationRequired?: boolean }) {
  return (
    <div className="landing-shell">
      <section className="landing-hero" aria-label="Radius welcome">
        <div className="landing-copy">
          <p className="landing-kicker">Radius on Arc Testnet</p>
          <h1>Stablecoin payments without the noise.</h1>
          <p className="landing-subtitle">Send, request, swap, bridge, and manage USDC/EURC from one wallet-first app.</p>
          <div className="landing-points" aria-label="Radius features">
            <span>USDC-native gas</span>
            <span>Global username</span>
            <span>Fast P2P payments</span>
          </div>
        </div>
        <div className="login-planet-wrap landing-planet-wrap" aria-hidden="true">
          <span className="login-orbit login-orbit-a" />
          <span className="login-orbit login-orbit-b" />
          <span className="login-orbit-dot dot-a" />
          <span className="login-orbit-dot dot-b" />
          <span className="login-orbit-dot dot-c" />
          <span className="login-planet" />
        </div>
      </section>

      <section className="landing-card" aria-label="Connect to Radius">
        <div className="landing-card-head">
          <div>
            <p className="landing-card-kicker">Get started</p>
          </div>
          <div className="landing-theme-toggle"><ThemeToggle /></div>
        </div>
        <div>
          <h2>{registrationRequired ? "Register your Radius username" : "Connect your wallet"}</h2>
          <p>{registrationRequired ? "You need a permanent username before opening Radius pages." : "Connect first. Radius pages stay locked until your wallet is connected and registered."}</p>
        </div>
        <div className="login-actions landing-actions">
          <SocialLoginButton icon="users" method="modal" label="Social Wallets Login" className="login-action login-action-secondary login-social-action disabled:cursor-not-allowed disabled:opacity-50" />
          <div className="login-wallet-action"><WalletLoginButton /></div>
        </div>
      </section>

      <nav className="landing-links" aria-label="Radius links">
        {LANDING_LINKS.map((item) => (
          <a key={item.label} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined} aria-label={item.label} title={item.label}>
            <LandingLinkIcon name={item.icon} />
            <span className="landing-link-label">{item.label}</span>
            <span className="landing-link-arrow" aria-hidden="true">›</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
