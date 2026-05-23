"use client";

import { useEffect } from "react";

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

type BlobNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  currentColor: Rgb;
  targetColor: Rgb;
};

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
  useEffect(() => {
    const canvasEl = document.getElementById("fluid-canvas") as HTMLCanvasElement | null;
    const context = canvasEl?.getContext("2d");
    if (!canvasEl || !context) return;

    const canvas = canvasEl;
    const ctx = context;
    let blobs: BlobNode[] = [];
    let animationId = 0;
    let activeTheme = document.documentElement.classList.contains("dark") ? THEMES.dark : THEMES.light;
    const currentBgColor = hexToRgb(activeTheme.bg);

    function resize() {
      canvas.width = window.innerWidth / 2;
      canvas.height = window.innerHeight / 2;
    }

    function initBlobs() {
      blobs = [];

      for (let i = 0; i < 6; i += 1) {
        const rgb = hexToRgb(activeTheme.colors[i % activeTheme.colors.length]);
        const angle = Math.random() * Math.PI * 2;

        blobs.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: Math.cos(angle) * 0.2,
          vy: Math.sin(angle) * 0.2,
          radius: Math.random() * 150 + 150,
          currentColor: { ...rgb },
          targetColor: { ...rgb },
        });
      }
    }

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      activeTheme = isDark ? THEMES.dark : THEMES.light;

      blobs.forEach((blob, i) => {
        blob.targetColor = hexToRgb(activeTheme.colors[i % activeTheme.colors.length]);
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", resize);
    resize();
    initBlobs();

    function draw() {
      const targetBg = hexToRgb(activeTheme.bg);
      currentBgColor.r += (targetBg.r - currentBgColor.r) * 0.04;
      currentBgColor.g += (targetBg.g - currentBgColor.g) * 0.04;
      currentBgColor.b += (targetBg.b - currentBgColor.b) * 0.04;

      ctx.fillStyle = `rgb(${Math.round(currentBgColor.r)}, ${Math.round(currentBgColor.g)}, ${Math.round(currentBgColor.b)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      blobs.forEach((blob) => {
        blob.x += blob.vx;
        blob.y += blob.vy;

        const limit = -blob.radius;
        if (blob.x < limit || blob.x > canvas.width - limit) blob.vx *= -1;
        if (blob.y < limit || blob.y > canvas.height - limit) blob.vy *= -1;

        blob.currentColor.r += (blob.targetColor.r - blob.currentColor.r) * 0.04;
        blob.currentColor.g += (blob.targetColor.g - blob.currentColor.g) * 0.04;
        blob.currentColor.b += (blob.targetColor.b - blob.currentColor.b) * 0.04;

        const colorStr = `rgba(${Math.round(blob.currentColor.r)}, ${Math.round(blob.currentColor.g)}, ${Math.round(blob.currentColor.b)}, 0.72)`;
        const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius);
        grad.addColorStop(0, colorStr);
        grad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <>
      <div className="fluid-bg-container" aria-hidden="true">
        <canvas id="fluid-canvas" />
      </div>
      <style>{`
        .fluid-bg-container {
          position: fixed;
          inset: 0;
          z-index: -10;
          overflow: hidden;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
        }

        #fluid-canvas {
          width: 100%;
          height: 100%;
          filter: blur(120px) saturate(145%);
          transform: scale(1.15);
        }
      `}</style>
    </>
  );
}
