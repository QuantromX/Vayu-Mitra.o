import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { APP_CONFIG } from '../lib/config';
import type { ThemeTokens } from '../types';

interface HeroParticleCanvasProps {
  theme: ThemeTokens;
  pm25: number;
  sunXPercent: number;
  sunYPercent: number;
}

interface HazeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}

interface RainParticle {
  x: number;
  y: number;
  len: number;
  vy: number;
  alpha: number;
}

interface StarParticle {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

/**
 * Lightweight atmospheric <canvas> overlay rendered inside the Hero scene.
 * Renders PM2.5 particulate haze, rain streaks, fog drift, night stars, and soft sun/moon bloom.
 * Caps particle count (<= 120 on mobile), pauses when tab is hidden, cleans up RAF on unmount,
 * and disables completely under prefers-reduced-motion.
 */
const HeroParticleCanvas: React.FC<HeroParticleCanvasProps> = ({
  theme,
  pm25,
  sunXPercent,
  sunYPercent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const stateRef = useRef({ theme, pm25, sunXPercent, sunYPercent });

  useEffect(() => {
    stateRef.current = { theme, pm25, sunXPercent, sunYPercent };
  }, [theme, pm25, sunXPercent, sunYPercent]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let timerId = 0;
    let width = 0;
    let height = 0;
    let isMobile = false;

    let hazeParticles: HazeParticle[] = [];
    let rainParticles: RainParticle[] = [];
    let starParticles: StarParticle[] = [];

    function initParticles() {
      const lowEndDevice =
        typeof navigator !== 'undefined' &&
        typeof navigator.hardwareConcurrency === 'number' &&
        navigator.hardwareConcurrency <= APP_CONFIG.lowEndCoreThreshold;
      const particleCap = lowEndDevice ? 64 : isMobile ? 120 : 160;
      const pmNorm = Math.max(0.15, Math.min(1, stateRef.current.pm25 / 260));
      const isRain =
        stateRef.current.theme.weatherScene === 'rain' ||
        stateRef.current.theme.weatherScene === 'thunder';
      const isFog = stateRef.current.theme.weatherScene === 'fog';

      const rainCount = isRain ? (lowEndDevice ? 24 : isMobile ? 42 : 70) : 0;
      const starCount =
        !stateRef.current.theme.isDay && !isFog
          ? lowEndDevice
            ? 16
            : isMobile
              ? 28
              : 42
          : 0;
      const maxHazeBudget = Math.max(18, particleCap - rainCount - starCount);
      const hazeCount = Math.min(
        maxHazeBudget,
        Math.round((isFog ? 0.9 : pmNorm) * maxHazeBudget)
      );

      const speedScale = 0.25 + pmNorm * 0.55;
      hazeParticles = Array.from({ length: hazeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.35) * speedScale,
        vy: (Math.random() - 0.5) * 0.16,
        r: isFog ? 2.6 + Math.random() * 4.2 : 1.1 + Math.random() * 2.2,
        alpha: 0.14 + Math.random() * (isFog ? 0.32 : 0.28),
      }));

      rainParticles = Array.from({ length: rainCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        len: 14 + Math.random() * 14,
        vy: 5.5 + Math.random() * 3.5,
        alpha: 0.2 + Math.random() * 0.25,
      }));

      starParticles = Array.from({ length: starCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.58,
        r: Math.random() > 0.78 ? 1.5 : 0.95,
        phase: Math.random() * Math.PI * 2,
        speed: 0.015 + Math.random() * 0.02,
      }));
    }

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(300, Math.round(rect.width));
      height = Math.max(240, Math.round(rect.height));
      isMobile = width < 768;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function scheduleNextFrame() {
      timerId = window.setTimeout(() => {
        if (!document.hidden) {
          rafId = window.requestAnimationFrame(drawFrame);
        }
      }, 42);
    }

    function drawFrame() {
      if (!ctx || document.hidden) return;
      const {
        theme: curTheme,
        pm25: curPm,
        sunXPercent: sx,
        sunYPercent: sy,
      } = stateRef.current;

      ctx.clearRect(0, 0, width, height);

      // Soft sun/moon atmospheric halo (lightweight layered discs, no per-frame gradient allocation)
      const cx = (sx / 100) * width;
      const cy = (sy / 100) * height;
      const bloomR = isMobile ? 74 : 106;
      ctx.fillStyle = curTheme.sunGlow;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomR * 0.56, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Night stars
      if (!curTheme.isDay && curTheme.weatherScene !== 'fog') {
        for (const s of starParticles) {
          s.phase += s.speed;
          const a = 0.25 + (Math.sin(s.phase) + 1) * 0.3;
          ctx.fillStyle = `rgba(248, 250, 252, ${a.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // PM2.5 particulate / fog drift
      const tint =
        curPm >= 121
          ? '251, 146, 60'
          : curPm >= 61
            ? '253, 224, 71'
            : curTheme.weatherScene === 'fog'
              ? '226, 232, 240'
              : '167, 243, 208';

      for (const p of hazeParticles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x > width + 8) p.x = -8;
        if (p.x < -8) p.x = width + 8;
        if (p.y > height + 8) p.y = -8;
        if (p.y < -8) p.y = height + 8;

        ctx.fillStyle = `rgba(${tint}, ${p.alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rain streaks
      if (curTheme.weatherScene === 'rain' || curTheme.weatherScene === 'thunder') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.38)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        for (const r of rainParticles) {
          r.y += r.vy;
          r.x -= 0.9;
          if (r.y > height + 20) {
            r.y = -20;
            r.x = Math.random() * width;
          }
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x - 2.2, r.y + r.len);
        }
        ctx.stroke();
      }

      scheduleNextFrame();
    }

    function handleVisibility() {
      if (document.hidden) {
        window.clearTimeout(timerId);
        window.cancelAnimationFrame(rafId);
        rafId = 0;
        timerId = 0;
      } else if (!rafId && !timerId) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    if (!document.hidden) {
      rafId = window.requestAnimationFrame(drawFrame);
    }

    return () => {
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibility);
      ro.disconnect();
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      data-testid="hero-particle-canvas"
      className="pointer-events-none absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
};

export default React.memo(HeroParticleCanvas);
