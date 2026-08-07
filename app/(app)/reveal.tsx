"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";

// The product's single easing curve and entrance duration. 240ms sits just
// inside the ≤250ms rule; 280ms was over it and read a touch sluggish on
// the anchor, which is the first thing the eye waits for.
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_MS = 0.24;

// Home's only client component. Children pass straight through, so every
// widget inside stays a Server Component — this never touches data.
//
// LazyMotion + `m` rather than the full `motion` import: Home is the most
// opened screen in the app and the full bundle costs ~39kB there for a fade.
//
// Motion here guides attention rather than decorating. The hero does not
// move — it is the anchor, and anchors that drift undermine the calm. Only
// the beats beneath it rise into place, so the eye is led downward through
// the screen in the order the story is told.
export function Reveal({
  children,
  index = 0,
  rise = true,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  rise?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={{ opacity: 0, y: rise ? 8 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: EASE_MS, delay: index * 0.06, ease: EASE }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

// The one animation carrying meaning: the bar fills from empty, because the
// fill *is* the information. Everything else just fades.
//
// Tone matters semantically (§05). Green is progress toward something
// chosen — a goal. A budget filling toward its limit is consumption, not
// achievement, so it stays neutral until it needs attention.
export function ProgressFill({
  percent,
  tone = "success",
}: {
  percent: number;
  tone?: "success" | "neutral" | "warning";
}) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="h-[3px] overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <LazyMotion features={domAnimation} strict>
        <m.div
          className={
            "h-full rounded-full " +
            (tone === "warning" ? "bg-warning" : tone === "neutral" ? "bg-foreground" : "bg-success")
          }
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
        />
      </LazyMotion>
    </div>
  );
}
