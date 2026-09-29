"use client";

import { useState, useTransition } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AddCircle, CheckCircle, CloseCircle, PenNewSquare, PlugCircle, TrashBinTrash } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAiProvider, deleteAiProvider, testAiProvider, updateAiProvider } from "@/actions/aiProvider";
import type { AiProviderItem } from "@/lib/queries/aiProviders";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  kind: "anthropic" | "router9";
  baseUrl: string;
  authScheme: "api_key" | "bearer";
  modelId: string;
  credential: string;
  isActive: boolean;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  kind: "anthropic",
  baseUrl: "",
  authScheme: "api_key",
  modelId: "claude-sonnet-5",
  credential: "",
  isActive: true,
  isDefault: false,
};

export function AiModelManager({
  initialProviders,
}: {
  initialProviders: AiProviderItem[];
}): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AiProviderItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<AiProviderItem | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  function openCreate(): void {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(provider: AiProviderItem): void {
    setEditing(provider);
    setForm({
      name: provider.name,
      kind: provider.kind,
      baseUrl: provider.baseUrl ?? "",
      authScheme: provider.authScheme,
      modelId: provider.modelId,
      // Credential tidak pernah dikirim ke client — kosong berarti "pertahankan yang lama".
      credential: "",
      isActive: provider.isActive,
      isDefault: provider.isDefault,
    });
    setDialogOpen(true);
  }

  function handleKindChange(kind: "anthropic" | "router9"): void {
    setForm((prev) => ({
      ...prev,
      kind,
      // 9router memakai bearer token + base URL gateway sendiri.
      authScheme: kind === "router9" ? "bearer" : "api_key",
    }));
  }

  function handleSubmit(): void {
    const payload = {
      name: form.name,
      kind: form.kind,
      baseUrl: form.baseUrl,
      authScheme: form.authScheme,
      modelId: form.modelId,
      isActive: form.isActive,
      isDefault: form.isDefault,
      credential: form.credential,
    };

    startTransition(async () => {
      const result = editing
        ? await updateAiProvider({ ...payload, id: editing.id })
        : await createAiProvider(payload);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(editing ? "Koneksi AI diperbarui." : "Koneksi AI ditambahkan.");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleDelete(): void {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteAiProvider({ id: deleting.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Koneksi AI dihapus.");
      setDeleting(null);
      router.refresh();
    });
  }

  function handleTest(provider: AiProviderItem): void {
    setTestingId(provider.id);
    startTransition(async () => {
      const result = await testAiProvider({ id: provider.id });
      if (result.success) {
        toast.success(`Koneksi "${provider.name}" berhasil.`);
      } else {
        toast.error(result.error);
      }
      setTestingId(null);
      router.refresh();
    });
  }

  const isCredentialRequired = editing === null;
  const canSubmit =
    form.name.trim().length > 0 &&
    form.modelId.trim().length > 0 &&
    (!isCredentialRequired || form.credential.trim().length >= 8) &&
    (form.kind !== "router9" || form.baseUrl.trim().length > 0);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-foreground">AI Model</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Kelola koneksi model AI untuk Chat AI — Anthropic langsung atau gateway 9router.
                API key disimpan terenkripsi dan tidak pernah ditampilkan kembali.
              </p>
            </div>
            <Button className="shrink-0" onClick={openCreate}>
              <AddCircle weight="BoldDuotone" className="mr-2 size-4" />
              Tambah Koneksi
            </Button>
          </div>

          <div className="divide-y">
            {initialProviders.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                Belum ada koneksi AI. Tambahkan minimal satu agar Chat AI bisa dipakai.
              </p>
            ) : (
              initialProviders.map((provider) => (
                <div className="flex items-center gap-4 px-6 py-4" key={provider.id}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{provider.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {provider.kind === "router9" ? "9router" : "Anthropic"}
                      </span>
                      {provider.isDefault ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                          Default
                        </span>
                      ) : null}
                      {!provider.isActive ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Nonaktif
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {provider.modelId}
                      {provider.baseUrl ? ` · ${provider.baseUrl}` : ""}
                    </p>
                    {provider.lastTestedAt ? (
                      <p
                        className={cn(
                          "mt-1 flex items-center gap-1 text-xs",
                          provider.lastTestOk ? "text-muted-foreground" : "text-destructive",
                        )}
                      >
                        {provider.lastTestOk ? (
                          <CheckCircle aria-hidden="true" className="size-3.5" weight="BoldDuotone" />
                        ) : (
                          <CloseCircle aria-hidden="true" className="size-3.5" weight="BoldDuotone" />
                        )}
                        Uji terakhir {provider.lastTestOk ? "berhasil" : "gagal"}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      disabled={isPending && testingId === provider.id}
                      onClick={() => handleTest(provider)}
                      size="sm"
                      variant="outline"
                    >
                      <PlugCircle weight="BoldDuotone" className="mr-1.5 size-4" />
                      {isPending && testingId === provider.id ? "Menguji..." : "Uji"}
                    </Button>
                    <button
                      aria-label={`Edit ${provider.name}`}
                      className="rounded-md p-2 hover:bg-muted"
                      onClick={() => openEdit(provider)}
                      type="button"
                    >
                      <PenNewSquare weight="BoldDuotone" className="size-4 text-muted-foreground" />
                    </button>
                    <button
                      aria-label={`Hapus ${provider.name}`}
                      className="rounded-md p-2 hover:bg-destructive/10"
                      onClick={() => setDeleting(provider)}
                      type="button"
                    >
                      <TrashBinTrash weight="BoldDuotone" className="size-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{editing ? "Edit Koneksi AI" : "Tambah Koneksi AI"}</DialogTitle>
          <DialogDescription>
            Untuk 9router, isi base URL gateway dan bearer token yang diberikan.
          </DialogDescription>

          <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="ai-name">Nama koneksi *</Label>
              <Input
                id="ai-name"
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="mis. 9router Produksi"
                value={form.name}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Provider *</Label>
              <Select onValueChange={(value) => handleKindChange(value as FormState["kind"])} value={form.kind}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic (langsung)</SelectItem>
                  <SelectItem value="router9">9router (gateway)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-base-url">
                Base URL {form.kind === "router9" ? "*" : "(opsional)"}
              </Label>
              <Input
                id="ai-base-url"
                onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                placeholder="https://gateway.9router.dev"
                value={form.baseUrl}
              />
              <p className="text-[11px] text-muted-foreground">
                Kosongkan untuk memakai endpoint resmi Anthropic.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Metode autentikasi *</Label>
              <Select
                onValueChange={(value) => setForm((prev) => ({ ...prev, authScheme: value as FormState["authScheme"] }))}
                value={form.authScheme}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API key (header x-api-key)</SelectItem>
                  <SelectItem value="bearer">Bearer token (header Authorization)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Model ID *</Label>
              <Input
                id="ai-model"
                onChange={(event) => setForm((prev) => ({ ...prev, modelId: event.target.value }))}
                placeholder="claude-sonnet-5"
                value={form.modelId}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-credential">
                API key / token {isCredentialRequired ? "*" : "(kosongkan jika tidak diganti)"}
              </Label>
              <Input
                autoComplete="off"
                id="ai-credential"
                onChange={(event) => setForm((prev) => ({ ...prev, credential: event.target.value }))}
                placeholder={isCredentialRequired ? "sk-..." : "••••••••"}
                type="password"
                value={form.credential}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Aktif</p>
                <p className="text-xs text-muted-foreground">Koneksi nonaktif tidak muncul di Chat AI.</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Jadikan default</p>
                <p className="text-xs text-muted-foreground">Model awal yang dipilih saat membuka Chat AI.</p>
              </div>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, isDefault: value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button className="flex-1" onClick={() => setDialogOpen(false)} variant="outline">
              Batal
            </Button>
            <Button className="flex-1" disabled={!canSubmit || isPending} onClick={handleSubmit}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={(open) => { if (!open) setDeleting(null); }} open={deleting !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Koneksi AI</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus koneksi <strong>{deleting?.name}</strong>? Chat AI yang memakai
              koneksi ini akan berhenti berfungsi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
