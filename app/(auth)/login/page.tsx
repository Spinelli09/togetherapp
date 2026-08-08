"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { signIn, type AuthState } from "@/lib/actions/auth";
import { fieldClass, fieldLabelClass, primaryButtonClass, quietLinkClass } from "@/app/(app)/ui";

const initialState: AuthState = { status: "idle" };

// Query params are read from window.location rather than useSearchParams so
// this page stays statically rendered — useSearchParams would opt the whole
// route into dynamic rendering or force a Suspense boundary around the form.
// This is the first screen of a cold-cache visit, so that matters.
export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [next, setNext] = useState("");
  // Controlled, because React resets the form once a server action resolves.
  // Left uncontrolled, a mistyped password also wiped the email address, so
  // every fumbled sign-in cost both fields. The password field is deliberately
  // left to clear — that reset is the correct behaviour after a failure.
  const [email, setEmail] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") ?? "");
    setEmail(params.get("email") ?? "");
  }, []);

  useEffect(() => {
    if (state.status === "error") {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          Together
        </h1>

        {/* A real <form> with a named email field, a named password field and
            a submit button, in that order and all present in the DOM at once
            — that is what password managers look for in order to offer to
            fill and to save. */}
        <form action={formAction} className="mt-10 space-y-6">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-2">
            <label htmlFor="email" className={fieldLabelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              disabled={isPending}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={state.status === "error"}
              aria-describedby={state.message ? "auth-message" : undefined}
              className={fieldClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className={fieldLabelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
              aria-invalid={state.status === "error"}
              aria-describedby={state.message ? "auth-message" : undefined}
              className={fieldClass}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className={primaryButtonClass + " w-full"}
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>

          {/* CSS rather than the shared <Settle>: this is the only screen in
              the app that loads no motion library at all, and pulling framer
              in for one fade cost 29 kB of first-load JS on the cold-cache
              screen of a signed-out user. Same 4px rise, same ~180ms. */}
          {state.message ? (
            <p
              id="auth-message"
              ref={messageRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
              className="animate-in fade-in slide-in-from-bottom-1 text-[0.8125rem] text-destructive duration-200 ease-out motion-reduce:animate-none"
            >
              {state.message}
            </p>
          ) : null}
        </form>

        <p className="mt-8 text-center">
          <Link href="/forgot-password" className={quietLinkClass}>
            Forgot password?
          </Link>
        </p>
      </div>
    </main>
  );
}
