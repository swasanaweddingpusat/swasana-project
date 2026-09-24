import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getActiveAiProviders } from "@/lib/queries/aiProviders";
import { CHAT_AI_ALLOWED_EMAIL } from "@/lib/ai/chat-access";

/** Daftar model yang bisa dipilih di Chat AI. Credential tidak pernah ikut. */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.email?.toLowerCase() !== CHAT_AI_ALLOWED_EMAIL) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!apiLimiter.check(`chat-ai-models:${session.user.id}`)) return rateLimitResponse();

  const providers = await getActiveAiProviders();

  return Response.json({
    models: providers.map((provider) => ({
      id: provider.id,
      label: provider.name,
      modelId: provider.modelId,
      kind: provider.kind,
      isDefault: provider.isDefault,
    })),
  });
}
