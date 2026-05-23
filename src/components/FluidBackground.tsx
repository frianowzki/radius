"use client";

import { useEffect, useRef } from "react";

// Light and dark mode premium palette arrays matching Radius layout.
const THEMES = {
  light: {
    bg: "#fafbfc",
    colors: ["#8a70f4", "#a5b4fc", "#c084fc", "#6366f1", "#e0e7ff"],
  },
  dark: {
    bg: "#030712",
    colors: ["#3b0764", "#1e1b4b", "#4f46e5", "#581c87", "#111827"],
  },
};

type Rgb = { r: number; g: number; b: number };

interface BlobNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  colorHex: string;
  currentColor: Rgb;
  targetColor: Rgb;
}

function hexToRgb(hex: string): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 138, g: 112, b: 244 };
}

export default function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let blobs: BlobNode[] = [];

    // Determine current theme state based on root HTML class markup (standard Tailwind dark mode).
    const getActiveTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      return isDark ? THEMES.dark : THEMES.light;
    };

    let activeTheme = getActiveTheme();
    const currentBgColor = hexToRgb(activeTheme.bg);

    const resize = () => {
      const width = Math.max(1, Math.floor(window.innerWidth / 2));
      const height = Math.max(1, Math.floor(window.innerHeight / 2));

      canvas.width = width;
      canvas.height = height;
    };

    const initBlobs = () => {
      blobs = [];
      const totalBlobs = 6;

      for (let i = 0; i < totalBlobs; i += 1) {
        const targetHex = activeTheme.colors[i % activeTheme.colors.length];
        const rgb = hexToRgb(targetHex);
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.3 + 0.15;
        const baseRadius = Math.random() * 150 + 150;

        blobs.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: baseRadius,
          baseRadius,
          colorHex: targetHex,
          currentColor: { ...rgb },
          targetColor: { ...rgb },
        });
      }
    };

    resize();
    initBlobs();
    window.addEventListener("resize", resize);

    // Watch for class updates from theme toggles on documentElement.
    const observer = new MutationObserver(() => {
      const nextTheme = getActiveTheme();
      activeTheme = nextTheme;

      blobs.forEach((blob, idx) => {
        const nextColorHex = nextTheme.colors[idx % nextTheme.colors.length];
        blob.colorHex = nextColorHex;
        blob.targetColor = hexToRgb(nextColorHex);
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const render = () => {
      const targetBg = hexToRgb(activeTheme.bg);
      currentBgColor.r += (targetBg.r - currentBgColor.r) * 0.04;
      currentBgColor.g += (targetBg.g - currentBgColor.g) * 0.04;
      currentBgColor.b += (targetBg.b - currentBgColor.b) * 0.04;

      ctx.fillStyle = `rgb(${Math.round(currentBgColor.r)}, ${Math.round(currentBgColor.g)}, ${Math.round(currentBgColor.b)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      blobs.forEach((blob) => {
        blob.x += blob.vx;
        blob.y += blob.vy;

        const border = -blob.radius;
        if (blob.x < border || blob.x > canvas.width - border) blob.vx *= -1;
        if (blob.y < border || blob.y > canvas.height - border) blob.vy *= -1;

        blob.currentColor.r += (blob.targetColor.r - blob.currentColor.r) * 0.04;
        blob.currentColor.g += (blob.targetColor.g - blob.currentColor.g) * 0.04;
        blob.currentColor.b += (blob.targetColor.b - blob.currentColor.b) * 0.04;

        const r = Math.round(blob.currentColor.r);
        const g = Math.round(blob.currentColor.g);
        const b = Math.round(blob.currentColor.b);
        const colorStr = `rgba(${r}, ${g}, ${b}, 0.72)`;
        const transparentStr = `rgba(${r}, ${g}, ${b}, 0)`;

        const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius);
        grad.addColorStop(0, colorStr);
        grad.addColorStop(1, transparentStr);

        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 z-0 h-full w-full overflow-hidden pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full scale-[1.15] blur-[110px] saturate-[140%]"
      />
    </div>
  );
}
