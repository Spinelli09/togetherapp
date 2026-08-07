// Shared presentational vocabulary. Server Component — no client code, so
// these are safe to import from client components too.
//
// This file exists because four sequential redesigns each invented their
// own button, field and label. Eight primary-button variants and two field
// shapes were in the codebase at once. One definition per element is the
// difference between a product authored by one designer and four screens
// that merely resemble each other.

/* ── Layout ────────────────────────────────────────────────────────────
   Every authenticated screen opens the same way: 96px of air, a 40rem
   column, 96px of bottom clearance for the tab bar. */
export const pageClass = "mx-auto max-w-[40rem] px-6 pb-16 pt-24";

/* ── Type ──────────────────────────────────────────────────────────────
   Screen titles for pages that need one. Home, Spending and Budgets are
   titled by the tab bar instead. */
export const titleClass =
  "text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground";

/* ── Controls ──────────────────────────────────────────────────────────
   One primary action per screen (§09). Pill, filled, sentence case — never
   two side by side, never a bordered "secondary" button competing with it. */
export const primaryButtonClass =
  "rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

// One documented size variant, for a primary action sitting inline beside
// a field. Two named sizes is a system; a one-off literal is not.
export const primaryButtonSmallClass =
  "rounded-full bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

// Secondary actions are text, not buttons. A bordered secondary button is
// a card in disguise.
export const quietLinkClass =
  "inline-block py-3 -my-3 text-[0.8125rem] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

// Underline rather than a box: a boxed input is a container, and §08 spends
// containers only on controls that genuinely need a boundary.
export const fieldClass =
  "w-full border-0 border-b border-border bg-transparent px-0 py-2 text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-foreground disabled:opacity-50";

export const fieldLabelClass = "text-[0.8125rem] text-muted-foreground";

/* ── Messages ──────────────────────────────────────────────────────────
   Errors and confirmations read at the same size wherever they appear, so
   a failure on Settings doesn't feel louder than one on Goals. */
export function messageClass(isError: boolean) {
  // Success reads in the success colour rather than as muted grey — an
  // unstyled "Goal created." next to a still-filled form looks like a
  // caption, not a confirmation.
  return "text-[0.8125rem] " + (isError ? "text-destructive" : "text-success");
}

/* ── Text ─────────────────────────────────────────────────────────────
   Bank descriptions arrive with the card number and FX small print glued
   on: "Silverdale C Card number: 4835 **** **** 6286". 58% of this
   household's transactions carry that suffix, and 47% have no merchant
   name at all — so it is what renders in the merchant slot. Nothing makes
   a product look more like a database dump.

   Conservative on purpose: it only cuts at phrases banks append, never at
   anything that could be part of a real name. */
const DESCRIPTION_NOISE = [" Card number:", " This includes", " converted at "];

export function cleanDescription(value: string): string {
  let out = value;
  for (const marker of DESCRIPTION_NOISE) {
    const at = out.indexOf(marker);
    if (at > 0) out = out.slice(0, at);
  }
  out = out.replace(/\s+/g, " ").trim();
  return out.length > 0 ? out : value;
}

/* ── Label ─────────────────────────────────────────────────────────────
   Group names only, never a sentence. 11px is the floor of the type scale
   and the only place uppercase is permitted (§01).

   Prominence is reduced by weight and opacity rather than size — 11px is
   already the accessibility floor, so shrinking further is not available. */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-normal uppercase tracking-[0.1em] text-muted-foreground/80">
      {children}
    </p>
  );
}
