"use client";

import * as React from "react";
import { DangerTriangle } from "@solar-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BitrixDealSelect } from "./BitrixDealSelect";

interface BitrixIdFieldProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

type ProbeStatus = "checking" | "ok" | "failed";

/**
 * Bitrix ID picker with automatic manual fallback.
 *
 * On mount it probes GET /api/bitrix/deals to check whether the Bitrix bridge is
 * healthy. While probing → disabled placeholder. On success → searchable
 * {@link BitrixDealSelect} dropdown. On ANY failure (network throw, non-2xx,
 * an `error` field in a 200 body, or a non-array `items`) → a plain manual text
 * input with a warning, so the form never gets blocked when Bitrix is down or
 * the webhook lacks permission. An empty result set is NOT a failure — that
 * stays in the dropdown.
 */
export function BitrixIdField({ value, onChange, disabled = false }: BitrixIdFieldProps) {
  const [status, setStatus] = React.useState<ProbeStatus>("checking");

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/bitrix/deals?start=0", { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setStatus("failed");
          return;
        }
        const json = (await res.json()) as { items?: unknown; error?: unknown };
        if (controller.signal.aborted) return;
        // A 200 response can still carry an error shape, or an unexpected body.
        if (json.error != null || !Array.isArray(json.items)) {
          setStatus("failed");
          return;
        }
        setStatus("ok");
      } catch {
        if (!controller.signal.aborted) setStatus("failed");
      }
    })();
    return () => controller.abort();
  }, []);

  if (status === "checking") {
    return (
      <div
        className={cn(
          "mt-1 flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground",
          "cursor-not-allowed select-none",
        )}
      >
        Memeriksa koneksi Bitrix…
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mt-1 space-y-1">
        <Input
          placeholder="Masukkan Bitrix ID"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <DangerTriangle weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
          Data Bitrix tidak tersedia, masukkan Bitrix ID secara manual.
        </p>
      </div>
    );
  }

  return (
    <BitrixDealSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="mt-1"
    />
  );
}
