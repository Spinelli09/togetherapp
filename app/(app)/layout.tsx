import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { BottomNav } from "./bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      {/*
        dvh rather than vh so the layout doesn't jump when mobile browser
        chrome collapses. The bottom padding clears the fixed tab bar plus
        the iPhone home indicator, so page content is never hidden behind it.
      */}
      <div className="min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
