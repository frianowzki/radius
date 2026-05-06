"use client";

import { useState } from "react";
import type { CrosschainChain } from "@/config/crosschain";

const CHAIN_LOGOS: Record<CrosschainChain, string> = {
  Arc_Testnet: "https://cdn.jsdelivr.net/gh/nicepkg/cdn@main/radius/arc.svg",
  Ethereum_Sepolia: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  Base_Sepolia: "https://raw.githubusercontent.com/base/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg",
  Arbitrum_Sepolia: "https://raw.githubusercontent.com/OffchainLabs/arbitrum-token-lists/main/assets/logo.svg",
  Avalanche_Fuji: "https://raw.githubusercontent.com/ava-labs/avalanche-docs/master/static/img/avax-logo.svg",
  Optimism_Sepolia: "https://raw.githubusercontent.com/ethereum-optimism/brand-kit/main/assets/Optimism/SVG/Optimism_Logo_No_Text_Centered.svg",
  Polygon_Amoy_Testnet: "https://raw.githubusercontent.com/maticnetwork/polygon-token-list/main/assets/polygon-token.png",
  Linea_Sepolia: "https://raw.githubusercontent.com/Consensys/linea-brand-kit/refs/heads/main/Logo/SVG/Linea-Logo-Black.svg",
  Unichain_Sepolia: "https://raw.githubusercontent.com/Uniswap/interface/main/packages/ui/src/assets/logos/unichain.svg",
  World_Chain_Sepolia: "https://raw.githubusercontent.com/worldcoin/world-id-docs/main/public/images/icons/worldcoin.svg",
  Ink_Testnet: "https://raw.githubusercontent.com/inkonchain/docs/main/public/ink-logo.svg",
  Monad_Testnet: "https://raw.githubusercontent.com/monad-hq/monad-brand-assets/main/monad-logo.svg",
  HyperEVM_Testnet: "https://raw.githubusercontent.com/hyperliquid-dex/hyperliquid-brand/main/logo.svg",
  Plume_Testnet: "https://raw.githubusercontent.com/plumenetwork/docs/main/static/img/plume-logo.svg",
  Sei_Testnet: "https://raw.githubusercontent.com/sei-protocol/sei-chain/main/logo.svg",
  XDC_Apothem: "https://raw.githubusercontent.com/XDC-Community/docs/main/assets/xdc-logo.svg",
  Codex_Testnet: "https://raw.githubusercontent.com/codex-io/docs/main/logo.svg",
};

const CHAIN_COLORS: Record<CrosschainChain, string> = {
  Arc_Testnet: "#3b82f6",
  Ethereum_Sepolia: "#627EEA",
  Base_Sepolia: "#0052FF",
  Arbitrum_Sepolia: "#28A0F0",
  Avalanche_Fuji: "#E84142",
  Optimism_Sepolia: "#FF0420",
  Polygon_Amoy_Testnet: "#8247E5",
  Linea_Sepolia: "#61D1FA",
  Unichain_Sepolia: "#FF007A",
  World_Chain_Sepolia: "#1A1A1A",
  Ink_Testnet: "#7B3FE4",
  Monad_Testnet: "#181818",
  HyperEVM_Testnet: "#00D4AA",
  Plume_Testnet: "#1F7AFC",
  Sei_Testnet: "#9B1C2C",
  XDC_Apothem: "#F5A623",
  Codex_Testnet: "#7C3AED",
};

const CHAIN_LETTERS: Record<CrosschainChain, string> = {
  Arc_Testnet: "A",
  Ethereum_Sepolia: "E",
  Base_Sepolia: "B",
  Arbitrum_Sepolia: "A",
  Avalanche_Fuji: "AV",
  Optimism_Sepolia: "OP",
  Polygon_Amoy_Testnet: "P",
  Linea_Sepolia: "L",
  Unichain_Sepolia: "U",
  World_Chain_Sepolia: "W",
  Ink_Testnet: "INK",
  Monad_Testnet: "M",
  HyperEVM_Testnet: "HL",
  Plume_Testnet: "P",
  Sei_Testnet: "SEI",
  XDC_Apothem: "XDC",
  Codex_Testnet: "CDX",
};

export function ChainLogo({
  chainKey,
  size = 42,
}: {
  chainKey: CrosschainChain;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const logoUrl = CHAIN_LOGOS[chainKey];
  const color = CHAIN_COLORS[chainKey];
  const letter = CHAIN_LETTERS[chainKey];

  if (!failed && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-contain"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className="grid place-items-center rounded-full font-black text-white uppercase"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.35,
      }}
    >
      {letter}
    </span>
  );
}

export function ChainLogoByLabel({
  label,
  size = 42,
}: {
  label: string;
  size?: number;
}) {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, "_");
  const keyMap: Record<string, CrosschainChain> = {
    arc_testnet: "Arc_Testnet",
    ethereum_sepolia: "Ethereum_Sepolia",
    base_sepolia: "Base_Sepolia",
    arbitrum_sepolia: "Arbitrum_Sepolia",
    avalanche_fuji: "Avalanche_Fuji",
    op_sepolia: "Optimism_Sepolia",
    polygon_amoy: "Polygon_Amoy_Testnet",
    linea_sepolia: "Linea_Sepolia",
    unichain_sepolia: "Unichain_Sepolia",
    world_chain_sepolia: "World_Chain_Sepolia",
    ink_testnet: "Ink_Testnet",
    monad_testnet: "Monad_Testnet",
    hyperevm_testnet: "HyperEVM_Testnet",
    plume_testnet: "Plume_Testnet",
    sei_testnet: "Sei_Testnet",
    xdc_apothem: "XDC_Apothem",
    codex_testnet: "Codex_Testnet",
  };
  const key = keyMap[normalized];
  if (!key) {
    return (
      <span
        className="grid place-items-center rounded-full bg-gray-400 font-black text-white uppercase"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {label.slice(0, 2)}
      </span>
    );
  }
  return <ChainLogo chainKey={key} size={size} />;
}
