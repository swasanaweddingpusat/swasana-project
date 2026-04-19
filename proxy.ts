import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify",
  "/api/auth",
  "/api/send-email",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check JWT cookie (no DB call)
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  // Public paths
  if (isPublicPath(pathname)) {
    if (sessionToken && pathname.startsWith("/auth")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Redirect to login if no session
  if (!sessionToken) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // mustChangePassword is checked in (private)/layout.tsx via auth() session
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|ttf|woff|woff2)).*)"],
  skipProxyUrlNormalize: true,
};
