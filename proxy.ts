import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Exact auth pages (no dynamic suffix) — must NOT match /auth/login-something
const PUBLIC_EXACT = new Set<string>([
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify",
  "/client-agreement",
]);

// API roots that carry dynamic segments — allow anything beneath them
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/send-email/",
  "/api/client-agreement/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // JWT cookie check — edge-safe, no DB access
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (isPublicPath(pathname)) {
    // Already-logged-in users never see /auth/* — bounce to dashboard
    if (sessionToken && PUBLIC_EXACT.has(pathname) && pathname.startsWith("/auth/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!sessionToken) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session-content checks (status, mustChangePassword, isEmailVerified) happen in
  // app/(private)/_components/auth-gate.tsx — proxy cannot hit the DB reliably.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|ttf|woff|woff2)).*)",
  ],
  skipProxyUrlNormalize: true,
};
