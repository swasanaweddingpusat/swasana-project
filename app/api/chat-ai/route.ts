import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { canUseChatAi } from "@/lib/ai/chat-access";
import { chatAiRequestSchema } from "@/lib/validations/chat-ai";
import { createChatSession, resolveAiProviderConfig } from "@/lib/ai/pi-session";

// Catatan: Pi SDK butuh runtime Node (fs, child_process). Tidak perlu
// `export const runtime` karena Node adalah default dan segment config itu
// tidak kompatibel dengan `cacheComponents` di next.config.ts.

/** Susun konteks percakapan jadi satu prompt — sesi Pi dibuat baru tiap request. */
function buildPrompt(history: { role: string; content: string }[], message: string): string {
  if (history.length === 0) return message;

  const transcript = history
    .map((item) => `${item.role === "user" ? "User" : "Asisten"}: ${item.content}`)
    .join("\n");

  return `Riwayat percakapan sebelumnya:\n${transcript}\n\nPesan user sekarang:\n${message}`;
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Gerbang sebenarnya — menyembunyikan menu di sidebar saja tidak cukup.
  if (!canUseChatAi(session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!mutationLimiter.check(`chat-ai:${session.user.id}`)) return rateLimitResponse();

  const parsed = chatAiRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const config = await resolveAiProviderConfig(parsed.data.providerId);
  if (!config) {
    return Response.json(
      { error: "Belum ada koneksi AI aktif. Atur di Settings > AI Model." },
      { status: 400 },
    );
  }

  let chatSession;
  try {
    chatSession = await createChatSession(config);
  } catch (error) {
    console.error("[chat-ai] gagal membuat sesi", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal menyiapkan sesi AI." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const prompt = buildPrompt(parsed.data.history, parsed.data.message);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const unsubscribe = chatSession.subscribe((event) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.assistantMessageEvent.delta));
        }
      });

      try {
        await chatSession.prompt(prompt);
      } catch (error) {
        console.error("[chat-ai] prompt gagal", error);
        controller.enqueue(
          encoder.encode("\n\n[Maaf, terjadi gangguan saat menghubungi model AI.]"),
        );
      } finally {
        unsubscribe();
        chatSession.dispose();
        controller.close();
      }
    },
    cancel() {
      // Client menutup koneksi (mis. tombol stop) — hentikan run dan lepaskan sesi.
      void chatSession.abort().finally(() => chatSession.dispose());
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "chat-ai.prompt",
    entityType: "AiProviderConfig",
    entityId: config.id,
    description: `Chat AI via koneksi "${config.name}" (${config.modelId})`,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
