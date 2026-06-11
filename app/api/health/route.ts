// Liveness probe for Docker/Dokploy. Intentionally does NOT touch the DB —
// it reports that the Node process is up and serving, not that every
// dependency is healthy. Keep it cheap and unauthenticated (allow-listed in
// proxy.ts) so the orchestrator can poll it frequently.
export function GET(): Response {
  return Response.json({ ok: true, service: "swasana", ts: new Date().toISOString() });
}
