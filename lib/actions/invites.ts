"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { createClient } from "@/lib/supabase/server";

export type InviteState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type AcceptInviteState = {
  status: "idle" | "error";
  message?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCEPT_ERROR_MESSAGES: Record<string, string> = {
  invite_not_found: "This invite doesn't exist.",
  invite_already_accepted: "This invite has already been used.",
  invite_expired: "This invite has expired. Ask for a new one.",
  email_mismatch:
    "This invite was sent to a different email address. Sign in with that address to accept it.",
  already_in_household: "You already belong to a household.",
};

export async function invitePartner(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const householdId = String(formData.get("householdId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }

  if (email === user.email?.toLowerCase()) {
    return { status: "error", message: "You can't invite yourself." };
  }

  // Flips any of this household's own past-expiry invites to 'expired'
  // first, so a stale row never blocks re-inviting the same email — see
  // the Milestone 4 migration notes for why this can't happen inside
  // accept_household_invite itself.
  await supabase.rpc("expire_stale_household_invites", {
    target_household_id: householdId,
  });

  const { data: existingInvite } = await supabase
    .from("household_invites")
    .select("id")
    .eq("household_id", householdId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) {
    return {
      status: "error",
      message: "There's already a pending invite for that email.",
    };
  }

  const { data: invite, error: insertError } = await supabase
    .from("household_invites")
    .insert({ household_id: householdId, email, invited_by: user.id })
    .select("token")
    .single();

  if (insertError || !invite) {
    return {
      status: "error",
      message: "Couldn't create the invite. Please try again.",
    };
  }

  // redirectTo only has to satisfy GoTrue's redirect allow-list — the
  // invite email template (supabase/templates/invite.html) links straight
  // to /auth/callback with token_hash + type and doesn't read
  // {{ .RedirectTo }}, so this doesn't need to encode the destination
  // invite. That travels through `data.invite_path` instead, set by the
  // invite-partner Edge Function below.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = appUrl;

  // supabase.functions.invoke reuses this client's session, so it
  // automatically sends the caller's access token — the Edge Function
  // uses that to re-verify the caller before doing anything privileged.
  const { data: result, error: invokeError } = await supabase.functions.invoke<{
    ok: boolean;
    message?: string;
  }>("invite-partner", {
    body: { token: invite.token, redirectTo },
  });

  if (invokeError || !result?.ok) {
    return {
      status: "error",
      message: result?.message ?? "Couldn't send the invite email.",
    };
  }

  revalidatePath("/settings/household");

  return { status: "success", message: `Invite sent to ${email}.` };
}

/**
 * Setting a password for the first time, while accepting an invite.
 *
 * Reached only from /invite/<token> after the invited address has clicked
 * the emailed link — /auth/callback has already verified that link's
 * token_hash and established a session, so this is an authenticated user
 * choosing a password, not an anonymous sign-up. That's why this calls
 * auth.updateUser() directly rather than anything account-creating: the
 * account was created the moment the invite was sent, by
 * admin.inviteUserByEmail in the invite-partner Edge Function.
 *
 * Deliberately its own action rather than reusing lib/actions/auth.ts's
 * updatePassword(): that action also calls ensureHousehold(), which for a
 * brand-new user with no membership row would provision a phantom household
 * with them as its owner *before* accept_household_invite runs below — and
 * that RPC would then reject them with "already_in_household". Household
 * membership here comes only from accepting the invite.
 *
 * The only entry point for accepting an invite — there's no separate
 * "I already have a password" path. Re-setting a password you already know
 * is harmless for an authenticated user, so this stays a single form rather
 * than two near-identical ones distinguished by a state we can't cheaply
 * observe from the client anyway (Supabase doesn't expose "has a password
 * been set" as a queryable property).
 */
export async function setPasswordAndAcceptInvite(
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "Your invite link has expired. Ask for a new one.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    console.error("updateUser(password) failed:", updateError.code ?? updateError.status, updateError.message);
    return { status: "error", message: "Couldn't set that password. Please try again." };
  }

  const { error } = await supabase.rpc("accept_household_invite", {
    invite_token: token,
  });

  if (error) {
    return {
      status: "error",
      message: ACCEPT_ERROR_MESSAGES[error.message] ?? "Couldn't accept the invite.",
    };
  }

  redirect("/");
}
