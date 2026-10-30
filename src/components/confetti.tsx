import { useEffect, useRef } from 'react';

interface Props {
  /** Whether confetti should be playing right now. Mount under `true` to fire. */
  active: boolean;
  /** Number of particles. Default 80 per spec. */
  count?: number;
  /** Total animation duration in ms. Default 1600 per spec. */
  durationMs?: number;
  /** Optional callback fired when the animation completes. */
  onComplete?: () => void;
}

/** Token-only particle palette — no new colors introduced. All four pulled
 *  from CSS vars at fire time so theme overrides take effect without re-build. */
const COLORS = [
  '--accent-jargon',
  '--accent-jargon-hi',
  '--accent-jargon-lo',
  '--text-primary',
] as const;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle';
}

/**
 * Vanilla-RAF confetti. Fires `count` particles from the screen midpoint upward,
 * applies gravity, eases out as duration approaches end. Uses a fullscreen
 * canvas overlay (pointer-events: none) so it never intercepts taps.
 *
 * Token discipline: particle colors are pulled from CSS variables defined in
 * globals.css (`--accent-jargon`, `--accent-jargon-hi`, `--accent-jargon-lo`,
 * `--text-primary`) — no inline hex literals in the RAF code.
 */
export function Confetti({ active, count = 80, durationMs = 1600, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      if (onComplete) onComplete();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Resolve CSS-var colors at fire time so theme overrides take effect.
    const root = getComputedStyle(document.documentElement);
    // Fallback hex matches v0.1 signature violet (#7C5CFF) so a stripped CSS-var
    // environment (e.g. headless test runner without globals.css loaded) still
    // fires brand-correct particles. Lives here as the single canvas-only
    // literal — no Tailwind-class equivalent can reach into RAF code.
    const palette = COLORS.map((v) => root.getPropertyValue(v).trim() || '#7C5CFF');

    // Fire from the middle horizontally, slightly above the vertical centerline so
    // the gravity arc lands across most of the screen.
    const originX = w / 2;
    const originY = h * 0.45;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const speed = 6 + Math.random() * 6;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.4,
        size: 4 + Math.random() * 6,
        color: palette[i % palette.length]!,
        shape: i % 3 === 0 ? 'circle' : 'rect',
      });
    }

    startRef.current = performance.now();

    function tick(now: number) {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // Eased gravity — accelerates downward as t increases.
      const gravity = 0.35 + t * 0.5;
      // Fade — stay opaque for the first 60%, ease out alpha after.
      const alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;

      ctx!.clearRect(0, 0, w, h);
      ctx!.globalAlpha = Math.max(0, alpha);

      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx!.clearRect(0, 0, w, h);
        rafRef.current = null;
        if (onComplete) onComplete();
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      ctx.clearRect(0, 0, w, h);
    };
    // We intentionally don't depend on `count`/`durationMs`/`onComplete` so the
    // animation only re-fires when `active` flips true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active || reduceMotion) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[60] pointer-events-none"
    />
  );
}
