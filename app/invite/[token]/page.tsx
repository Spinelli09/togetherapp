import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { primaryButtonClass, quietLinkClass } from "@/app/(app)/ui";

import { SetPasswordForm } from "./accept-form";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: previewRows } = await supabase.rpc("get_invite_preview", {
    invite_token: token,
  });
  const preview = previewRows?.[0];

  if (!preview) {
    return (
      <Shell>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">Invite not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite link doesn&apos;t exist. Ask your partner to send a new one.
        </p>
      </Shell>
    );
  }

  const isExpired =
    preview.status === "expired" || new Date(preview.expires_at) < new Date();

  if (preview.status === "accepted") {
    return (
      <Shell>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">Already used</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite has already been accepted.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </Shell>
    );
  }

  if (isExpired) {
    return (
      <Shell>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">Invite expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite has expired. Ask your partner to send a new one.
        </p>
      </Shell>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loginUrl = `/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(preview.invited_email)}`;

  // Signed in as somebody else. Not a set-a-password moment — they have an
  // account, it is just the wrong one for this invite.
  if (user && user.email?.toLowerCase() !== preview.invited_email.toLowerCase()) {
    return (
      <Shell>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          You&apos;ve been invited to join {preview.household_name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite is for {preview.invited_email}, but you&apos;re signed in as{" "}
          {user.email}. Sign in with the invited address to accept.
        </p>
        <Link href={loginUrl} className={"mt-10 inline-block " + primaryButtonClass}>
          Sign in to accept
        </Link>
      </Shell>
    );
  }

  // Signed in as the invited address — the normal outcome of clicking the
  // emailed invite link, which /auth/callback exchanges for a session
  // before redirecting here. Choosing a password both proves nothing more
  // (the emailed link already did that) and finishes the join.
  if (user) {
    return (
      <Shell>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          Join {preview.household_name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a password and you&apos;re in. You&apos;ll stay signed in on this device.
        </p>
        <SetPasswordForm
          token={token}
          email={preview.invited_email}
          householdName={preview.household_name}
        />
      </Shell>
    );
  }

  // No session — the invite email hasn't been clicked yet (or the click
  // hasn't happened on this device/browser). This is not an anonymous
  // sign-up screen: there is no way to prove this visitor owns
  // preview.invited_email except the emailed link itself, so that is what
  // this sends them to do. "Sign in" is only a fallback, for someone who
  // already finished this once before and is revisiting a stale link.
  return (
    <Shell>
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
        You&apos;ve been invited to join {preview.household_name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Check {preview.invited_email} for the invite email, and open the link there to
        continue.
      </p>
      <p className="mt-8 text-sm text-muted-foreground">
        Already chosen a password?{" "}
        <Link href={loginUrl} className={quietLinkClass}>
          Sign in
        </Link>
      </p>
    </Shell>
  );
}
