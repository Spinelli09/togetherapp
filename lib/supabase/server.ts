import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./types";

// Next.js 15's cookies() is async, so this factory is async too. Every
// caller (Server Components, Server Actions, Route Handlers) must await it.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies can't be
            // written. Safe to ignore because middleware refreshes the
            // session on every request anyway.
          }
        },
      },
    },
  );
}
