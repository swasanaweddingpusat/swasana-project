"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AddCircle,
  CheckCircle,
  CloseCircle,
  Copy,
  Eye,
  Link,
  Refresh,
  UserPlus,
} from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useOnboardingFormLinks,
  useRegenerateOnboardingFormLink,
  useRevokeOnboardingFormLink,
} from "@/hooks/use-employee-onboarding";
import type { OnboardingFormLinkItem } from "@/lib/queries/onboardingFormLinks";
import { OnboardingForm } from "@/app/(private)/hrd/onboarding-karyawan/_components/OnboardingForm";
import { OnboardingFormLinkDrawer } from "@/app/(private)/hrd/onboarding-karyawan/_components/OnboardingFormLinkDrawer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function handleCopyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} berhasil disalin`);
  }).catch(() => {
    toast.error(`Gagal menyalin ${label}`);
  });
}

function getFormUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/onboarding-form?token=${token}`;
}

// ─── LinkFormCell ─────────────────────────────────────────────────────────────

function LinkFormCell({
  item,
  onRegenerate,
  onRevoke,
  isRegenerating,
  isRevoking,
}: {
  item: OnboardingFormLinkItem;
  onRegenerate: (id: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  isRegenerating: boolean;
  isRevoking: boolean;
}) {
  const formUrl = getFormUrl(item.token);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline" className="rounded-full gap-1.5">
            <Link weight="BoldDuotone" className="h-4 w-4" />
            <span>{item.status === "Active" ? "Aktif" : "Nonaktif"}</span>
          </Button>
        }
      />
      <PopoverContent className="w-80" side="left" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">Link Form Onboarding</span>
            <Badge
              variant={item.status === "Active" ? "default" : "secondary"}
              className="rounded-full text-xs"
            >
              {item.status === "Active" ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">URL Form</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {formUrl}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 shrink-0 rounded-full p-0"
                onClick={() => handleCopyToClipboard(formUrl, "URL")}
              >
                <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Access Code */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Kode Akses</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
              <span className="flex-1 font-mono text-sm font-semibold tracking-widest text-foreground">
                {item.accessCode}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 shrink-0 rounded-full p-0"
                onClick={() => handleCopyToClipboard(item.accessCode, "Kode akses")}
              >
                <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.submission ? (
              <div className="flex items-center gap-1">
                <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                <span>Diisi oleh {item.submission.fullName}</span>
              </div>
            ) : item.viewedAt ? (
              <div className="flex items-center gap-1">
                <Eye weight="BoldDuotone" className="h-3.5 w-3.5" />
                <span>Dibuka {formatDate(item.viewedAt)}</span>
              </div>
            ) : (
              <span>Belum dibuka</span>
            )}
            {item.expiresAt ? (
              <span className="ml-auto">Exp: {formatDate(item.expiresAt)}</span>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-border pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-full gap-1.5"
              onClick={() => onRegenerate(item.id)}
              disabled={isRegenerating}
            >
              <Refresh weight="BoldDuotone" className="h-3.5 w-3.5" />
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-full gap-1.5 text-destructive hover:text-destructive"
              onClick={() => onRevoke(item.id)}
              disabled={item.status === "Revoked" || isRevoking}
            >
              <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
              Revoke
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── OnboardingFormLinksClient ────────────────────────────────────────────────

export function OnboardingFormLinksClient() {
  const [activeTab, setActiveTab] = useState("form-internal");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: formLinks = [], isLoading } = useOnboardingFormLinks();
  const regenerateMutation = useRegenerateOnboardingFormLink();
  const revokeMutation = useRevokeOnboardingFormLink();

  async function handleRegenerate(linkId: string) {
    const result = await regenerateMutation.mutateAsync(linkId);
    if (result.success) {
      toast.success("Link form berhasil diperbarui");
      return;
    }
    toast.error(result.error ?? "Gagal memperbarui link form");
  }

  async function handleRevoke(linkId: string) {
    const result = await revokeMutation.mutateAsync(linkId);
    if (result.success) {
      toast.success("Link form berhasil dinonaktifkan");
      return;
    }
    toast.error(result.error ?? "Gagal menonaktifkan link form");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-heading font-semibold text-foreground">
          Onboarding Karyawan
        </h1>
        <p className="text-sm text-muted-foreground">
          Isi formulir internal atau buat link form publik untuk karyawan baru.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-auto rounded-2xl p-1">
          <TabsTrigger value="form-internal" className="rounded-xl gap-2">
            <UserPlus weight="BoldDuotone" className="h-4 w-4" />
            Form Internal
          </TabsTrigger>
          <TabsTrigger value="form-link-publik" className="rounded-xl gap-2">
            <Link weight="BoldDuotone" className="h-4 w-4" />
            Form Link Publik
          </TabsTrigger>
        </TabsList>

        {/* Tab: Form Internal */}
        <TabsContent value="form-internal" className="mt-6">
          <OnboardingForm />
        </TabsContent>

        {/* Tab: Form Link Publik */}
        <TabsContent value="form-link-publik" className="mt-6 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg font-heading font-semibold text-foreground">
                Link Form Onboarding Publik
              </h2>
              <p className="text-sm text-muted-foreground">
                Buat link unik untuk karyawan baru mengisi data secara mandiri.
              </p>
            </div>
            <Button
              className="rounded-full gap-1.5 shrink-0"
              onClick={() => setDrawerOpen(true)}
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Buat Link Form
            </Button>
          </div>

          {/* Table Card */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-base font-heading">Daftar Link Form</CardTitle>
              <p className="text-sm text-muted-foreground">Kelola link form onboarding untuk karyawan baru.</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Onboarding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead>Link Form</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    ) : formLinks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Belum ada link form yang dibuat.
                        </TableCell>
                      </TableRow>
                    ) : formLinks.map((item: OnboardingFormLinkItem) => (
                      <TableRow key={item.id}>
                        {/* Nama Onboarding */}
                        <TableCell>
                          <span className="font-medium text-foreground">{item.name}</span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={item.status === "Active" ? "default" : "secondary"}
                              className="rounded-full w-fit"
                            >
                              {item.status === "Active" ? "Aktif" : "Nonaktif"}
                            </Badge>
                            {item.submission ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="default" className="rounded-full w-fit gap-1">
                                  <CheckCircle weight="BoldDuotone" className="h-3 w-3" />
                                  Terisi
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  oleh {item.submission.fullName}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Dibuat */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(item.createdAt)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.creator.fullName}
                            </span>
                          </div>
                        </TableCell>

                        {/* Link Form */}
                        <TableCell>
                          <LinkFormCell
                            item={item}
                            onRegenerate={handleRegenerate}
                            onRevoke={handleRevoke}
                            isRegenerating={regenerateMutation.isPending}
                            isRevoking={revokeMutation.isPending}
                          />
                        </TableCell>

                        {/* Aksi */}
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-full p-0"
                              title="Regenerate link"
                              onClick={() => handleRegenerate(item.id)}
                              disabled={regenerateMutation.isPending}
                            >
                              <Refresh weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-full p-0"
                              title="Revoke link"
                              onClick={() => handleRevoke(item.id)}
                              disabled={item.status === "Revoked" || revokeMutation.isPending}
                            >
                              <CloseCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drawer */}
      <OnboardingFormLinkDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
