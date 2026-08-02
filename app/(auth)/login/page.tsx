"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { requestMagicLink, type MagicLinkState } from "@/lib/actions/auth";

const initialState: MagicLinkState = { status: "idle" };

const LINK_ERROR_MESSAGE =
  "That link expired or was already used. Request a new one below.";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    requestMagicLink,
    initialState,
  );
  const [linkError, setLinkError] = useState(false);
  const [next, setNext] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setLinkError(true);
    }
    setNext(params.get("next") ?? "");
    setPrefillEmail(params.get("email") ?? "");
  }, []);

  useEffect(() => {
    if (state.status !== "idle" || linkError) {
      messageRef.current?.focus();
    }
  }, [state, linkError]);

  const displayMessage = state.message ?? (linkError ? LINK_ERROR_MESSAGE : undefined);
  const displayIsError = state.status === "error" || linkError;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
          Household Ledger
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in with a magic link — no password needed.
        </p>

        <form
          action={formAction}
          onSubmit={() => setLinkError(false)}
          className="mt-8 space-y-4"
        >
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
              defaultValue={prefillEmail}
              aria-describedby={displayMessage ? "auth-message" : undefined}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send magic link"}
          </button>

          {displayMessage ? (
            <p
              id="auth-message"
              ref={messageRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className={
                displayIsError
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {displayMessage}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
