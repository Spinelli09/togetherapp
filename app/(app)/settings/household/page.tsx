import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { InviteForm } from "./invite-form";

export default async function HouseholdSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role, households(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const householdId = membership.household_id;
  const isOwner = membership.role === "owner";
  const household = membership.households as { name: string } | null;

  const [{ data: members }, { data: pendingInvites }] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, display_name, role, joined_at")
      .eq("household_id", householdId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("household_invites")
      .select("email, expires_at")
      .eq("household_id", householdId)
      .eq("status", "pending"),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {household?.name ?? "Household"}
      </h1>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Members
        </h2>
        <ul className="mt-3 space-y-2">
          {(members ?? []).map((member) => (
            <li
              key={member.user_id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="text-foreground">{member.display_name}</span>
              <span className="text-muted-foreground capitalize">{member.role}</span>
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Invite a partner
          </h2>
          <div className="mt-3">
            <InviteForm householdId={householdId} />
          </div>

          {(pendingInvites ?? []).length > 0 ? (
            <ul className="mt-4 space-y-2">
              {(pendingInvites ?? []).map((invite) => (
                <li
                  key={invite.email}
                  className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
                >
                  Pending — sent to {invite.email}, expires{" "}
                  {new Date(invite.expires_at).toLocaleDateString()}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
