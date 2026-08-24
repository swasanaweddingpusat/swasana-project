import { type Instrumentation } from "next";

/**
 * Server-side error observability.
 *
 * Next.js already pipes server `stdout`/`stderr` to the container logs (Railway),
 * but the default output for a captured error is a bare stack with framework
 * frames elided ("at ignore-listed frames") — no route, no client context. This
 * hook re-emits every captured server error as a single structured JSON line so
 * Railway logs are greppable: which route, which method, which client.
 *
 * Special-cased: `Failed to find Server Action "..."`. This is EXPECTED churn,
 * not a crash — it means a client is running an older/newer HTML shell than this
 * deployment (version skew). Common when a customer opens the client-agreement
 * link inside an in-app browser (WhatsApp/IG) that cached the old page, then we
 * redeploy. We still log it, but tag it `kind: "version-skew"` so it can be
 * filtered out of real-incident noise in Railway. Setting a stable
 * NEXT_SERVER_ACTIONS_ENCRYPTION_KEY reduces these to only genuine action-code
 * changes; the public error boundary auto-heals the client for the rest.
 */

function isVersionSkew(message: string): boolean {
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("older or newer deployment")
  );
}

function headerValue(
  headers: { [key: string]: string | string[] | undefined },
  key: string,
): string | undefined {
  const raw = headers[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
): void => {
  const err = error as Error & { digest?: string };
  const message = err.message ?? "";
  const versionSkew = isVersionSkew(message);

  const entry = {
    level: versionSkew ? "warn" : "error",
    kind: versionSkew ? "version-skew" : "server-error",
    at: new Date().toISOString(),
    message,
    digest: err.digest,
    path: request.path,
    method: request.method,
    userAgent: headerValue(request.headers, "user-agent"),
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  };

  // console.error is the only console call permitted in runtime code (AGENTS.md);
  // here it is the intended observability channel, surfaced in Railway logs.
  console.error(`[onRequestError] ${JSON.stringify(entry)}`);
};
