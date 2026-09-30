"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, JSX, KeyboardEvent } from "react";
import {
  AddCircle,
  ChatRoundDots,
  History,
  MagicStick3,
  Plain,
  StopCircle,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type MessageRole = "assistant" | "user";

interface ChatMessage {
  id: number;
  role: MessageRole;
  content: string;
}

interface ChatModelOption {
  id: string;
  label: string;
  modelId: string;
  kind: "anthropic" | "router9";
  isDefault: boolean;
}

const SUGGESTIONS = [
  "Ringkas aktivitas operasional hari ini",
  "Bantu saya menyiapkan agenda meeting",
  "Apa saja yang perlu dicek sebelum event?",
] as const;

/** Jumlah giliran terakhir yang dikirim sebagai konteks (server membatasi 20). */
const HISTORY_LIMIT = 20;

export function ChatAiWorkspace(): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const nextMessageId = useRef(1);
  const abortController = useRef<AbortController | null>(null);
  const conversationEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isResponding]);

  // Ambil daftar koneksi AI aktif dari Settings > AI Model.
  useEffect(() => {
    let cancelled = false;

    async function loadModels(): Promise<void> {
      try {
        const response = await fetch("/api/chat-ai/models");
        if (!response.ok) throw new Error("Gagal memuat daftar model.");
        const data = (await response.json()) as { models: ChatModelOption[] };
        if (cancelled) return;

        setModels(data.models);
        const preferred = data.models.find((model) => model.isDefault) ?? data.models[0];
        if (preferred) setSelectedModelId(preferred.id);
      } catch {
        if (!cancelled) setError("Tidak bisa memuat daftar model AI.");
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => abortController.current?.abort();
  }, []);

  function appendMessage(role: MessageRole, content: string): number {
    const id = nextMessageId.current;
    nextMessageId.current += 1;
    setMessages((current) => [...current, { id, role, content }]);
    return id;
  }

  async function sendMessage(content: string): Promise<void> {
    const normalizedContent = content.trim();
    if (!normalizedContent || isResponding) return;

    setError(null);
    appendMessage("user", normalizedContent);
    setInput("");
    setIsResponding(true);

    // Riwayat dikirim sebelum pesan baru ditambahkan ke state server-side.
    const history = messages.slice(-HISTORY_LIMIT).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const controller = new AbortController();
    abortController.current = controller;
    const assistantId = appendMessage("assistant", "");

    try {
      const response = await fetch("/api/chat-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedModelId || undefined,
          message: normalizedContent,
          history,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Gagal menghubungi Swasana AI.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: message.content + chunk } : message,
          ),
        );
      }
    } catch (caught) {
      const aborted = caught instanceof DOMException && caught.name === "AbortError";
      if (!aborted) {
        setError(caught instanceof Error ? caught.message : "Terjadi kesalahan.");
      }
      // Buang bubble asisten yang masih kosong supaya tidak menyisakan gelembung hampa.
      setMessages((current) =>
        current.filter((message) => message.id !== assistantId || message.content.length > 0),
      );
    } finally {
      abortController.current = null;
      setIsResponding(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function stopResponding(): void {
    abortController.current?.abort();
  }

  function startNewConversation(): void {
    abortController.current?.abort();
    setMessages([]);
    setInput("");
    setError(null);
    setIsResponding(false);
  }

  const hasMessages = messages.length > 0;
  const hasModels = models.length > 0;

  return (
    <section className="grid h-svh min-h-0 overflow-hidden bg-background md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-muted/30 p-4 md:flex md:flex-col">
        <Button className="w-full justify-start rounded-xl" onClick={startNewConversation}>
          <AddCircle aria-hidden="true" weight="BoldDuotone" />
          Percakapan baru
        </Button>

        <div className="mt-6 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History aria-hidden="true" className="size-4" weight="BoldDuotone" />
          Riwayat
        </div>

        <div className="mt-3 rounded-xl border border-border bg-background px-3 py-3">
          <p className="truncate text-sm font-medium text-foreground">Percakapan baru</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasMessages ? `${messages.length} pesan` : "Belum ada pesan"}
          </p>
        </div>

        <div className="mt-auto rounded-xl border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Catatan</span>
          <br />
          Riwayat belum tersimpan permanen dan akan hilang saat halaman dimuat ulang.
        </div>
      </aside>

      <div className="relative flex min-h-0 flex-col">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <Select
            disabled={!hasModels || isResponding}
            onValueChange={setSelectedModelId}
            value={selectedModelId}
          >
            <SelectTrigger aria-label="Pilih model AI" className="h-9 rounded-xl bg-background" size="sm">
              <SelectValue placeholder={hasModels ? "Pilih model" : "Belum ada model"} />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label} · {model.modelId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            aria-label="Mulai percakapan baru"
            className="rounded-xl md:hidden"
            onClick={startNewConversation}
            size="icon-lg"
            variant="outline"
          >
            <AddCircle aria-hidden="true" weight="BoldDuotone" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {!hasMessages ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-8 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <ChatRoundDots aria-hidden="true" className="size-8" weight="BoldDuotone" />
                </div>
                <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mulai percakapan
                </p>
                <h2 className="mt-2 font-heading text-3xl font-semibold text-foreground">
                  Apa yang bisa saya bantu?
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                  {hasModels
                    ? "Tanyakan pekerjaan operasional, minta bantuan menyusun agenda, atau gunakan salah satu prompt awal berikut."
                    : "Belum ada koneksi AI aktif. Tambahkan dulu di Settings > AI Model."}
                </p>

                <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      className="rounded-xl border border-border bg-background p-4 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                      disabled={isResponding || !hasModels}
                      key={suggestion}
                      onClick={() => void sendMessage(suggestion)}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div aria-live="polite" className="mx-auto flex max-w-3xl flex-col gap-5">
                {messages.map((message) => (
                  <article
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                    key={message.id}
                  >
                    {message.role === "assistant" ? (
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <MagicStick3 aria-hidden="true" className="size-4" weight="BoldDuotone" />
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%]",
                        message.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-muted/50 text-foreground",
                      )}
                    >
                      {message.content || "…"}
                    </div>
                  </article>
                ))}
                <div ref={conversationEnd} />
              </div>
            )}
          </div>

          <div className="border-t border-border bg-background/80 p-4 sm:px-6">
            <form className="mx-auto max-w-3xl" onSubmit={handleSubmit}>
              {error ? (
                <p className="mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
                <Textarea
                  aria-label="Pesan untuk Swasana AI"
                  className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                  disabled={isResponding || !hasModels}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={hasModels ? "Tulis pesan Anda..." : "Belum ada koneksi AI aktif"}
                  rows={1}
                  value={input}
                />
                {isResponding ? (
                  <Button
                    aria-label="Hentikan respons"
                    className="size-11 rounded-xl"
                    onClick={stopResponding}
                    size="icon-lg"
                    type="button"
                    variant="outline"
                  >
                    <StopCircle aria-hidden="true" weight="BoldDuotone" />
                  </Button>
                ) : (
                  <Button
                    aria-label="Kirim pesan"
                    className="size-11 rounded-xl"
                    disabled={!input.trim() || !hasModels}
                    size="icon-lg"
                    type="submit"
                  >
                    <Plain aria-hidden="true" weight="BoldDuotone" />
                  </Button>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Tekan Enter untuk mengirim, Shift + Enter untuk baris baru.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
