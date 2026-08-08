"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { createClient } from "@/lib/supabase/server";

// Email + password, and nothing else. Together is a two-person product that
// gets opened every morning; the previous magic-link flow cost a trip to the
// Mail app on every single sign-in, which is the kind of friction that ends
// a daily habit long before anyone decides they dislike the product.
//
// Sessions are unchanged: @supabase/ssr cookies, refreshed by middleware on
// every request. Signing in once on a phone keeps you signed in.

export type AuthState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_HOUSEHOLD_NAME = "Our Household";

// Only same-site relative paths (e.g. "/invite/<token>") may be used as a
// post-login redirect target, never an absolute URL — otherwise this field
// is an open redirect.
function sanitizeNextPath(next: FormDataEntryValue | null): string | null {
  const value = String(next ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/**
 * First-sign-in household provisioning.
 *
 * This is household logic, not authentication — it previously lived in the
 * magic-link callback purely because that was the only place that knew a
 * sign-in had just succeeded. It is reproduced here unchanged so that
 * deleting the callback does not silently change what happens to a user
 * with no household: without it they authenticate fine and then every
 * screen renders empty, because every page bails on a missing membership.
 */
async function ensureHousehold(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: existing, error: lookupError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (lookupError) return false;
  if (existing) return true;

  // No RETURNING: RLS requires the SELECT policy to pass for a RETURNING
  // result, and no household_members row exists at this instant, so the
  // household would not be visible. Generating the id here avoids needing
  // it back.
  const householdId = randomUUID();
  const displayName = user.email?.split("@")[0] ?? "Owner";

  const { error: householdError } = await supabase
    .from("households")
    .insert({ id: householdId, name: DEFAULT_HOUSEHOLD_NAME });

  if (householdError) return false;

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: householdId,
    user_id: user.id,
    display_name: displayName,
    role: "owner",
  });

  return !memberError;
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(formData.get("next"));

  if (!EMAIL_PATTERN.test(email) || password.length === 0) {
    return { status: "error", message: "Enter your email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("signInWithPassword failed:", error.code ?? error.status, error.message);

    if (error.code === "over_request_rate_limit") {
      return {
        status: "error",
        message: "Too many attempts. Please wait a moment and try again.",
      };
    }

    // Deliberately identical whether the address is unknown or the password
    // is wrong: distinguishing them tells an attacker which emails exist.
    return { status: "error", message: "That email and password don't match." };
  }

  // Accepting an invite joins an existing household, so provisioning must be
  // skipped or the invitee owns a phantom household before they ever reach
  // the accept screen — and accept_household_invite then rejects them with
  // "already_in_household". Same guard the magic-link callback carried.
  if (!next?.startsWith("/invite/")) {
    const provisioned = await ensureHousehold();
    if (!provisioned) {
      return {
        status: "error",
        message:
          "We couldn't finish setting up your account. Please try again in a moment.",
      };
    }
  }

  redirect(next ?? "/");
}

export async function requestPasswordReset(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  // NEXT_PUBLIC_* values are inlined at build time, so a missing value means
  // the deployed bundle was built without it. Falling back to localhost
  // silently produced a link whose redirect_to Supabase rejects; Supabase
  // then substitutes the Site URL and the user lands back here with no
  // explanation. Fail visibly rather than send a link that cannot work.
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredAppUrl && process.env.NODE_ENV === "production") {
    console.error(
      "requestPasswordReset: NEXT_PUBLIC_APP_URL is not set in this build — refusing to send a reset link that would redirect to localhost.",
    );
    return {
      status: "error",
      message: "Password reset isn't configured correctly. Please try again later.",
    };
  }

  const appUrl = configuredAppUrl ?? "http://localhost:3000";
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/auth/callback", appUrl).toString(),
  });

  if (error) {
    console.error("resetPasswordForEmail failed:", error.code ?? error.status, error.message);
  }

  // Always the same answer, error or not: a different response for unknown
  // addresses would turn this form into an account-existence oracle.
  return {
    status: "success",
    message: `If ${email} has an account, a reset link is on its way.`,
  };
}

export async function updatePassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const supabase = await createClient();

  // Reaching this form means the recovery token_hash was already verified
  // into a session by /auth/callback, so this is an ordinary authenticated
  // update.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "That reset link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("updateUser(password) failed:", error.code ?? error.status, error.message);
    return { status: "error", message: "Couldn't set that password. Please try again." };
  }

  await ensureHousehold();

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
