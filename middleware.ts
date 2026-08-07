import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - app icon + manifest metadata routes
     * - image/font files
     *
     * apple-icon and manifest.webmanifest must be listed explicitly: the
     * browser requests both while signed out, and without these exclusions
     * middleware redirects them to /login, which silently breaks the
     * home-screen icon and the install manifest. (icon.svg is already
     * covered by the extension rule below.)
     */
    "/((?!_next/static|_next/image|favicon.ico|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
