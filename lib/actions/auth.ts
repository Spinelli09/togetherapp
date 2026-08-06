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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const next = sanitizeNextPath(formData.get("next"));
  const callbackUrl = new URL("/auth/callback", appUrl);
  if (next) {
    callbackUrl.searchParams.set("next", next);
  }

  const supabase = await createClient();

  // TEMPORARY DIAGNOSTIC — remove once redirect_to is confirmed. Uses
  // console.error so Vercel captures it, and JSON.stringify so an unset
  // variable (undefined) is distinguishable from an empty string.
  console.error(
    "[magic-link diagnostic] NEXT_PUBLIC_APP_URL=",
    JSON.stringify(process.env.NEXT_PUBLIC_APP_URL),
    "| callbackUrl=",
    callbackUrl.toString(),
  );

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
