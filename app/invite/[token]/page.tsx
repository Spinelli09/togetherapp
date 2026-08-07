import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { primaryButtonClass } from "@/app/(app)/ui";

import { AcceptForm } from "./accept-form";

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

  const isCorrectUser = user?.email?.toLowerCase() === preview.invited_email.toLowerCase();

  if (!user || !isCorrectUser) {
    const loginUrl = `/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(preview.invited_email)}`;

    return (
      <Shell>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          You&apos;ve been invited to join {preview.household_name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in as {preview.invited_email} to accept.
        </p>
        <Link
          href={loginUrl}
          className={"mt-10 inline-block " + primaryButtonClass}
        >
          Sign in to accept
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
        Join {preview.household_name}?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;ll be added as a member alongside the household&apos;s owner.
      </p>
      <AcceptForm token={token} householdName={preview.household_name} />
    </Shell>
  );
}
