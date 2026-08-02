"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = new URL(
    `/auth/callback?next=${encodeURIComponent(`/invite/${invite.token}`)}`,
    appUrl,
  ).toString();

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

export async function acceptInvite(
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "");

  const supabase = await createClient();
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
