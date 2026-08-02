// Sends the actual invite email. Only ever called by an authenticated
// household owner from the Next.js Server Action (lib/actions/invites.ts),
// which has already created the household_invites row under normal RLS.
// This function's job is narrower: confirm the caller really owns the
// invite it's being asked to send, then do the one privileged thing a
// Next.js server bundle must never do itself — call the Auth admin API
// with the service-role key.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface InvitePartnerPayload {
  token: string;
  redirectTo: string;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { supabase, supabaseAdmin, userClaims } = ctx;

    if (!userClaims?.id) {
      return Response.json({ ok: false, message: "Not authenticated." }, { status: 401 });
    }

    let payload: InvitePartnerPayload;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ ok: false, message: "Invalid request body." }, { status: 400 });
    }

    if (!payload.token || !payload.redirectTo) {
      return Response.json(
        { ok: false, message: "Missing token or redirectTo." },
        { status: 400 },
      );
    }

    // RLS-scoped: only returns a row if the caller is a member of the
    // invite's household, which is already true by construction (they
    // just created it), but this re-confirms it rather than trusting the
    // request body.
    const { data: invite, error: inviteError } = await supabase
      .from("household_invites")
      .select("email, invited_by, status, households(name)")
      .eq("token", payload.token)
      .single();

    if (inviteError || !invite) {
      return Response.json({ ok: false, message: "Invite not found." }, { status: 404 });
    }

    if (invite.invited_by !== userClaims.id) {
      return Response.json(
        { ok: false, message: "You didn't create this invite." },
        { status: 403 },
      );
    }

    if (invite.status !== "pending") {
      return Response.json(
        { ok: false, message: "This invite is no longer pending." },
        { status: 409 },
      );
    }

    const household = invite.households as { name: string } | null;
    const householdName = household?.name ?? "your household";

    const { error: sendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      invite.email,
      {
        redirectTo: payload.redirectTo,
        data: { household_name: householdName },
      },
    );

    if (sendError) {
      const alreadyRegistered = sendError.message?.toLowerCase().includes("registered");

      return Response.json(
        {
          ok: false,
          message: alreadyRegistered
            ? "This person already has an account. Ask them to sign in and open the invite link you shared with them."
            : "Couldn't send the invite email. Please try again.",
        },
        { status: 502 },
      );
    }

    return Response.json({ ok: true });
  }),
};
