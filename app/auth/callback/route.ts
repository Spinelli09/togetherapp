import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every emailed link, and nothing else.
 *
 * Two kinds of link route here: a password-reset request, and an invite —
 * both are one-time tokens Supabase mails on our behalf, and both need
 * verifying for a session before the app can do anything with them. What
 * happens next differs, which is what `next` is for:
 *
 *   - invite email  → lib/actions/invites.ts sets next=/invite/<token>,
 *                      so accepting it lands back on that invite, signed in
 *                      as the invited address but with no password yet.
 *   - recovery email → no `next` at all, so it falls through to the
 *                      password-reset screen.
 *
 * verifyOtp(token_hash, type) rather than exchangeCodeForSession(code) —
 * this is deliberate, not a style choice, and the same mechanism is used
 * for both kinds of link:
 *
 * PKCE (`?code=`) needs a code_verifier stashed in a cookie by whoever
 * *requested* the link, present again in the browser that later opens it.
 * That holds for password reset — request and click happen in the same
 * browser — but not for an invite: Marco's browser makes the request,
 * Georgia's browser opens the email days later. There is no client to hold
 * a verifier across that gap, so an admin-issued invite link can only ever
 * come back as Supabase's *implicit* flow — the session in a URL fragment,
 * which by HTTP spec never reaches a server at all. A Route Handler
 * physically cannot read it.
 *
 * verifyOtp is Supabase's own documented answer for exactly this case
 * (admin-issued link + server-rendered app): the emailed link carries
 * `token_hash` and `type` as ordinary query parameters — never a fragment —
 * and verifying is a ordinary server-side POST that returns the session in
 * its response body, which @supabase/ssr then writes to cookies the same
 * way exchangeCodeForSession did. One mechanism, no branching on which link
 * kind arrived, and no client-side auth code anywhere in the app.
 *
 * This requires both the "Invite user" and "Reset password" email templates
 * to link to token_hash/type/redirect_to rather than the default
 * {{ .ConfirmationURL }} — a one-time Dashboard change, since Supabase
 * templates have no API/CLI path. See supabase/templates/invite.html and
 * supabase/templates/recovery.html.
 *
 * No household provisioning happens here. That used to live in this route
 * when it was the sole magic-link callback; it now lives in
 * lib/actions/auth.ts's ensureHousehold(), called from signIn() — the only
 * place a *daily* sign-in can happen. Provisioning here would be wrong for
 * the invite case: an invited user joins an existing household via
 * accept_household_invite, and must never get a phantom one of their own
 * first.
 */

// Same-site relative paths only — never treat this as an open redirect.
function sanitizeNextPath(next: string | null): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNextPath(searchParams.get("next"));

  // For an invite link specifically, failing back to the invite page itself
  // (rather than to /forgot-password) is the correct recovery: it re-checks
  // the invite by token and explains what's actually wrong — not found,
  // expired, already used — instead of talking about password recovery to
  // someone who has never had a password on this account.
  const invitePath = next?.startsWith("/invite/") ? next : null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      invitePath ? `${origin}${invitePath}` : `${origin}/forgot-password?error=missing_token`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    // Expired, already used, or opened after a fresh one was requested.
    return NextResponse.redirect(
      invitePath ? `${origin}${invitePath}` : `${origin}/forgot-password?error=verify_failed`,
    );
  }

  return NextResponse.redirect(`${origin}${invitePath ?? "/reset-password"}`);
}
