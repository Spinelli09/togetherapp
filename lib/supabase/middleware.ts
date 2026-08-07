import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./types";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/invite"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the session cookie if it's expired. Must be called before
  // any other logic below, per @supabase/ssr's documented contract.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));

    // Carry over any cookies written during getUser() — in particular the
    // session-clearing cookies @supabase/ssr sets when a refresh token is
    // rejected. Returning a fresh response without them leaves the stale
    // cookies in the browser, so every later request retries the same
    // failing refresh instead of starting clean.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  // A session refresh writes the new JWT to this response via Set-Cookie. If
  // an edge cache ever stored and replayed that response, another user's
  // browser would receive it and be signed in as this user. Supabase's SSR
  // guide calls for this header on any response that can carry a refreshed
  // session.
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}
