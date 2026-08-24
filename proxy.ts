import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Exact auth pages (no dynamic suffix) — must NOT match /auth/login-something
const PUBLIC_EXACT = new Set<string>([
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify",
  "/client-agreement",
  "/wedding-indicator",
  "/recruitment-form",
  "/onboarding-form",
  "/offline", // PWA offline shell — must never redirect to login (SW precaches it)
]);

// Auth pages that are redundant once logged in — redirect to /select-module.
// /auth/reset-password and /auth/verify are intentionally excluded: AuthGate
// sends mustChangePassword / unverified users there, so bouncing them back to
// the app would create an infinite redirect loop.
const BOUNCE_TO_DASHBOARD = new Set<string>([
  "/auth/login",
  "/auth/forgot-password",
]);

// API roots that carry dynamic segments — allow anything beneath them
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/send-email/",
  "/api/client-agreement/",
  "/api/wedding-indicator-share/",
  "/api/recruitment-form/",
  "/api/onboarding-form/",
  "/api/health", // container/Dokploy liveness probe — must bypass auth redirect
  "/api/client-log", // client-side error sink — public pages report crashes here without a session
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

  // Server Action POSTs are dispatched to the current page URL (e.g. the login
  // form calls resolveLoginDestination() which posts back to /auth/login). Once
  // signIn() has set the session cookie, the BOUNCE_TO_DASHBOARD rule below would
  // redirect that POST to /select-module — the action never runs and the client
  // sees an unparseable response. Let action requests through untouched; they are
  // identified by the `next-action` header Next.js attaches to every action call.
  const isServerAction =
    request.method === "POST" && request.headers.has("next-action");

  if (isPublicPath(pathname)) {
    // Already-logged-in users don't need login/forgot-password — bounce to /select-module.
    // reset-password and verify are intentionally allowed through: AuthGate redirects
    // mustChangePassword / unverified users there, and bouncing them would loop.
    if (sessionToken && !isServerAction && BOUNCE_TO_DASHBOARD.has(pathname)) {
      return NextResponse.redirect(new URL("/select-module", request.url));
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
    // Exclude static assets so the proxy never redirects them to /auth/login.
    // `mjs|js|css|map|wasm` are critical: the pdf.js worker (public/pdf.worker.min.mjs)
    // is requested from the public /client-agreement page WITHOUT a session — without
    // these, the request gets redirected to the HTML login page and the browser rejects
    // the module script for its "text/html" MIME type ("gagal memuat PDF").
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|ttf|woff|woff2|mjs|js|css|map|wasm|txt|xml|json)).*)",
  ],
  skipProxyUrlNormalize: true,
};
