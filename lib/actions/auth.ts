"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type MagicLinkState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only allow same-site relative paths (e.g. "/invite/<token>") as a
// post-login redirect target, never an absolute URL — prevents this
// field being turned into an open redirect.
function sanitizeNextPath(next: FormDataEntryValue | null): string | null {
  const value = String(next ?? "");
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return null;
}

export async function requestMagicLink(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  // NEXT_PUBLIC_* values are inlined at build time, so a missing value here
  // means the deployed bundle was built without it. Falling back to
  // localhost silently produced a magic link whose redirect_to Supabase
  // rejects (not on the allow list); Supabase then substitutes the Site URL,
  // and the user lands back on /login with no explanation. Fail visibly
  // instead of sending a link that cannot work.
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredAppUrl && process.env.NODE_ENV === "production") {
    console.error(
      "requestMagicLink: NEXT_PUBLIC_APP_URL is not set in this build — refusing to send a magic link that would redirect to localhost.",
    );
    return {
      status: "error",
      message: "Sign-in isn't configured correctly. Please try again later.",
    };
  }

  const appUrl = configuredAppUrl ?? "http://localhost:3000";
  const next = sanitizeNextPath(formData.get("next"));
  const callbackUrl = new URL("/auth/callback", appUrl);
  if (next) {
    callbackUrl.searchParams.set("next", next);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    // Logged so this is diagnosable from server logs alone — previously
    // the real Supabase error was discarded entirely, which is why a
    // rate-limit condition surfaced as an unexplained generic failure.
    console.error("signInWithOtp failed:", error.code ?? error.status, error.message);

    if (error.code === "over_email_send_rate_limit") {
      return {
        status: "error",
        message:
          "Too many sign-in emails have been sent recently. Please wait a few minutes and try again.",
      };
    }

    return {
      status: "error",
      message: "Couldn't send the link. Please try again in a moment.",
    };
  }

  return {
    status: "success",
    message: `Check ${email} for a sign-in link.`,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
