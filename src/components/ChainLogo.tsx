"use client";

import { useState } from "react";
import type { CrosschainChain } from "@/config/crosschain";

const CHAIN_LOGOS: Record<CrosschainChain, string> = {
  Arc_Testnet: "/chains/arc.svg",
  Ethereum_Sepolia: "/chains/ethereum.svg",
  Base_Sepolia: "/chains/base.jpg",
  Arbitrum_Sepolia: "/chains/arbitrum.jpg",
  Avalanche_Fuji: "/chains/avalanche.jpg",
  Optimism_Sepolia: "/chains/optimism.jpg",
  Polygon_Amoy_Testnet: "/chains/polygon.jpg",
  Linea_Sepolia: "/chains/linea.jpg",
  Unichain_Sepolia: "/chains/unichain.jpg",
  World_Chain_Sepolia: "/chains/world.svg",
  Ink_Testnet: "/chains/ink.jpg",
  Monad_Testnet: "/chains/monad.jpg",
  HyperEVM_Testnet: "/chains/hyperliquid.jpg",
  Plume_Testnet: "/chains/plume.jpg",
  Sei_Testnet: "/chains/sei.jpg",
  XDC_Apothem: "/chains/xdc.jpg",
  Codex_Testnet: "/chains/codex.svg",
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
        className="rounded-full object-cover"
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
