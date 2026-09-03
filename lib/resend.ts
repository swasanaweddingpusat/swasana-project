import { Resend } from "resend";

let client: Resend | null = null;

// Lazy singleton: RESEND_API_KEY is only present at container runtime, not
// during the Docker build's "collecting page data" step — constructing this
// at module scope crashes the build.
export function getResendClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}
