"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

import { EASE } from "./reveal";
import { AmountSymbol, formatAmountParts } from "./ui";

// Its own module rather than living in reveal.tsx: this is the only thing in
// the app that needs framer's imperative `animate`, and Home — the most
// opened screen, which does not use it — was paying ~1.1 kB for the import.

/* ── A figure that moves only when you moved it ────────────────────────
   Deliberately *not* a count-up on load. A balance animating up every time
   the app opens is decoration: the number didn't change, you just looked at
   it, and after six months of mornings it is a tax on reading. This renders
   the value flat on first paint and interpolates only when the value it is
   given actually changes — which, in this app, only happens as the direct
   result of something the user just did.

   Digits are written straight to the node rather than through state: at
   60fps this would otherwise re-render the subtree ~40 times per second. */
export function AnimatedAmount({
  value,
  className = "",
  cents = false,
}: {
  value: number;
  className?: string;
  cents?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const digitsRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  // Only the symbol needs to survive in React's tree; it never changes
  // mid-animation, and re-deriving it per frame would be wasted work.
  const [symbol] = useState(() => formatAmountParts(value, cents).symbol);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    const node = digitsRef.current;
    if (!node || from === value) return;

    if (reduceMotion) {
      node.textContent = formatAmountParts(value, cents).digits;
      return;
    }

    const controls = animate(from, value, {
      duration: 0.55,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = formatAmountParts(v, cents).digits;
      },
    });
    return () => controls.stop();
  }, [value, cents, reduceMotion]);

  return (
    <span className={"tabular-nums " + className}>
      <AmountSymbol symbol={symbol} />
      <span ref={digitsRef}>{formatAmountParts(value, cents).digits}</span>
    </span>
  );
}
