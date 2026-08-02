import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_HOUSEHOLD_NAME = "Our Household";

// Same-site relative paths only — never treat this as an open redirect.
function sanitizeNextPath(next: string | null): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const user = data.user;

  // Signing in to accept an invite joins an existing household — skip
  // the first-login auto-provisioning below entirely, or this user would
  // become the owner of a brand new phantom household before ever
  // reaching the invite-accept screen.
  if (next?.startsWith("/invite/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const { data: existingMembership, error: membershipLookupError } =
    await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (membershipLookupError) {
    return NextResponse.redirect(`${origin}/login?error=provisioning_failed`);
  }

  if (!existingMembership) {
    // No RETURNING here: RLS requires the SELECT policy to pass for a
    // RETURNING result, and no household_members row exists yet at this
    // instant, so the household wouldn't be visible for RETURNING to
    // return it. Generating the id ourselves avoids needing it back.
    const householdId = randomUUID();
    const displayName = user.email?.split("@")[0] ?? "Owner";

    const { error: householdError } = await supabase
      .from("households")
      .insert({ id: householdId, name: DEFAULT_HOUSEHOLD_NAME });

    if (householdError) {
      return NextResponse.redirect(
        `${origin}/login?error=provisioning_failed`,
      );
    }

    const { error: memberError } = await supabase
      .from("household_members")
      .insert({
        household_id: householdId,
        user_id: user.id,
        display_name: displayName,
        role: "owner",
      });

    if (memberError) {
      return NextResponse.redirect(
        `${origin}/login?error=provisioning_failed`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
