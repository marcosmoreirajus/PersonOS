"use client";
// Adaptado de @beui/tilt-card (beui.dev/components/motion/tilt-card).
// Aqui o padrão é mais sutil que o original: inclinação máxima de 8° (o
// original usa 12°) e brilho (glare) discreto. Sem mouse de verdade (toque)
// ou com movimento reduzido, o efeito não roda e o card fica parado.

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";
import { SPRING_MOUSE } from "@/lib/ease";
import { useHoverCapable } from "@/lib/hooks/use-hover-capable";
import { cn } from "@/lib/utils";

export interface TiltCardProps {
  children: ReactNode;
  /** Inclinação máxima, em graus. */
  max?: number;
  glare?: boolean;
  className?: string;
}

export function TiltCard({ children, max = 8, glare = true, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();
  const enabled = !reduce && canHover;
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);

  const srx = useSpring(rx, SPRING_MOUSE);
  const sry = useSpring(ry, SPRING_MOUSE);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !enabled) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * max);
    rx.set((0.5 - py) * max);
    gx.set(px * 100);
    gy.set(py * 100);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  const transform = useMotionTemplate`perspective(1000px) rotateX(${srx}deg) rotateY(${sry}deg)`;
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, var(--foreground), transparent 50%)`;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transform, transformStyle: "preserve-3d" }}
      className={cn("relative overflow-hidden rounded-xl will-change-transform", className)}
    >
      {children}
      {glare && enabled ? (
        <motion.div
          aria-hidden
          style={{ background: glareBg }}
          className="pointer-events-none absolute inset-0 opacity-10"
        />
      ) : null}
    </motion.div>
  );
}
