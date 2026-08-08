"use client";

import { useEffect, useRef } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";

// The product's single easing curve and entrance duration. 240ms sits just
// inside the ≤250ms rule; 280ms was over it and read a touch sluggish on
// the anchor, which is the first thing the eye waits for.
export const EASE = [0.22, 1, 0.36, 1] as const;
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

// The one animation carrying meaning: the fill *is* the information.
// Everything else in this file just fades.
//
// The bar tells two different stories and needs two different motions. On
// first paint it fills from empty — it is establishing where you are, so it
// takes its time and lets the page settle first. When the percentage
// *changes*, because you just contributed to a goal, it travels from where
// it was to where it is, immediately: the distance covered is the
// acknowledgement. Replaying the fill from zero would say "here is 62%"
// when what happened was "you moved to 62%", and the 300ms entrance delay
// would put a dead beat between the tap and any sign it worked.
//
// Tone matters semantically (§05). Green is progress toward something
// chosen — a goal. A budget filling toward its limit is consumption, not
// achievement, so it stays neutral until it needs attention.
//
// `bleed` breaks the −24px page gutter so the rule reaches the edges of the
// column. On a phone the column *is* the viewport, so it renders as a true
// full-bleed line and the goal reads as something the whole screen sits on
// rather than one more item in the stack; on a wide window it stops at the
// 40rem edge instead of ruling across 1900px of nothing. Bled ends are
// square — a pill floating to the screen edge looks like a mistake.
export function ProgressFill({
  percent,
  tone = "success",
  bleed = false,
}: {
  percent: number;
  tone?: "success" | "neutral" | "warning";
  bleed?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, percent));
  const round = bleed ? "" : "rounded-full ";

  // Survives re-renders from revalidatePath, which is exactly when the
  // distinction matters: the component instance persists, so a changed
  // percent after a server action is an update, not a mount.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const settled = mounted.current;

  return (
    <div
      className={"h-[3px] overflow-hidden bg-muted " + round + (bleed ? "-mx-6" : "")}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <LazyMotion features={domAnimation} strict>
        <m.div
          className={
            "h-full " +
            round +
            (tone === "warning" ? "bg-warning" : tone === "neutral" ? "bg-foreground" : "bg-success")
          }
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={
            settled
              ? { duration: 0.5, ease: EASE }
              : { duration: 0.7, delay: 0.3, ease: EASE }
          }
        />
      </LazyMotion>
    </div>
  );
}

/* ── A row arriving in a list ──────────────────────────────────────────
   Same motion as <Settle>, but renders an <li> so it is legal inside a
   <ul>, and staggers by position so a page of appended rows reads as one
   arrival. The rows already on screen are never wrapped in this — nothing
   the user is mid-read should move. */
export function Arrival({
  children,
  index,
  className,
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <li className={className}>{children}</li>;
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.li
        className={className}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: index * 0.035, ease: EASE }}
      >
        {children}
      </m.li>
    </LazyMotion>
  );
}

/* ── Something appeared because you did something ──────────────────────
   For confirmations, errors and rows arriving after the page has settled.
   Faster and shorter than <Reveal>: an entrance you are already looking at
   needs to acknowledge, not perform. 4px of travel, not 8. */
export function Settle({
  children,
  className,
}: {
  children: React.ReactNode;
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
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: EASE }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
