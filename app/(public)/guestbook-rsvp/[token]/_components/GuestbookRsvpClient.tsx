"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarMark, CheckCircle, UsersGroupRounded } from "@solar-icons/react";

interface RsvpDisplayData {
  visitorName: string;
  companyName: string | null;
  checkInAt: string;
  confirmedGuestCount: number | null;
  confirmedGuestCountAt: string | null;
}

type LoadState = "loading" | "error" | "ready";

function formatCheckInDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function GuestbookRsvpClient({ token }: { token: string }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [data, setData] = useState<RsvpDisplayData | null>(null);
  const [guestCount, setGuestCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/guestbook-rsvp/${token}`);
        if (!res.ok) {
          if (!cancelled) setLoadState("error");
          return;
        }
        const json = (await res.json()) as RsvpDisplayData;
        if (cancelled) return;
        setData(json);
        setGuestCount(json.confirmedGuestCount ? String(json.confirmedGuestCount) : "");
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedCount = Number(guestCount);
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 1000) {
      toast.error("Jumlah tamu harus berupa angka antara 1 sampai 1000.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/guestbook-rsvp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestCount: parsedCount }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menyimpan konfirmasi.");
        return;
      }
      setData((prev) =>
        prev
          ? { ...prev, confirmedGuestCount: json.confirmedGuestCount, confirmedGuestCountAt: new Date().toISOString() }
          : prev
      );
      setJustConfirmed(true);
      setEditing(false);
    } catch {
      toast.error("Terjadi kesalahan jaringan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  if (loadState === "error" || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm rounded-2xl">
          <CardContent className="text-center py-6">
            <h1 className="font-heading text-xl font-semibold text-foreground">Link Tidak Valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Link konfirmasi ini tidak valid atau sudah kedaluwarsa. Silakan hubungi tim Swasana untuk bantuan lebih lanjut.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showSuccess = data.confirmedGuestCount !== null && !editing;

  if (showSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm rounded-2xl">
          <CardContent className="text-center py-6">
            <CheckCircle weight="BoldDuotone" className="mx-auto mb-4 h-14 w-14 text-primary" />
            <h1 className="font-heading text-xl font-semibold text-foreground">
              {justConfirmed ? "Terima kasih, konfirmasi tersimpan" : "Kehadiran Sudah Dikonfirmasi"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.visitorName}
              {data.companyName ? ` (${data.companyName})` : ""} akan hadir dengan{" "}
              <span className="font-medium text-foreground">{data.confirmedGuestCount} tamu</span>.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => setEditing(true)}>
              Ubah Jumlah Tamu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Konfirmasi Kehadiran</CardTitle>
          <CardDescription>
            Mohon konfirmasi jumlah tamu yang akan hadir pada kunjungan Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-1 rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium text-foreground">
              {data.visitorName}
              {data.companyName ? ` — ${data.companyName}` : ""}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarMark weight="BoldDuotone" className="h-3.5 w-3.5" />
              {formatCheckInDate(data.checkInAt)}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guestCount">
                <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />
                Jumlah Tamu
              </Label>
              <Input
                id="guestCount"
                type="number"
                min={1}
                max={1000}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="Masukkan jumlah tamu"
                disabled={submitting}
                required
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Konfirmasi Kehadiran"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
