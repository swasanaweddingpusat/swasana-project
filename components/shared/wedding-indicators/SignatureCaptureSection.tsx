"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Pen, Eraser } from "@solar-icons/react";

interface SignatureSlot {
  name: string;
  signature: string | null;
}

export interface SignaturesData {
  signatureDate: string;
  slots: Record<string, SignatureSlot>;
}

interface SignatureCaptureSectionProps {
  data: SignaturesData;
  onChange: (data: SignaturesData) => void;
  disabled?: boolean;
}

const SIGNATURE_SLOTS = [
  { key: "pasangan", label: "Pasangan" },
  { key: "manager_event", label: "Manager Event" },
  { key: "manager_pm", label: "Manager PM" },
  { key: "general_manager", label: "General Manager" },
  { key: "director_finance", label: "Director Finance" },
  { key: "operational_director", label: "Operational Director" },
] as const;

export function SignatureCaptureSection({
  data,
  onChange,
  disabled,
}: SignatureCaptureSectionProps) {
  const [editingSlot, setEditingSlot] = useState<string | null>(null);

  const updateSlotName = (key: string, name: string) => {
    onChange({
      ...data,
      slots: {
        ...data.slots,
        [key]: { ...data.slots[key], name, signature: data.slots[key]?.signature || null },
      },
    });
  };

  const updateSlotSignature = (key: string, signature: string | null) => {
    onChange({
      ...data,
      slots: {
        ...data.slots,
        [key]: { ...data.slots[key], name: data.slots[key]?.name || "", signature },
      },
    });
    if (signature) {
      setEditingSlot(null);
    }
  };

  const clearSlotSignature = (key: string) => {
    onChange({
      ...data,
      slots: {
        ...data.slots,
        [key]: { ...data.slots[key], name: data.slots[key]?.name || "", signature: null },
      },
    });
    setEditingSlot(null);
  };

  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 border">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold text-foreground">
            Tanda Tangan
          </h3>
          <p className="text-sm text-muted-foreground">
            Tanda tangan pihak terkait
          </p>
        </div>
        <div className="w-48">
          <Label htmlFor="signatureDate" className="text-xs">
            Tanggal
          </Label>
          <Input
            id="signatureDate"
            type="date"
            value={data.signatureDate}
            onChange={(e) => onChange({ ...data, signatureDate: e.target.value })}
            disabled={disabled}
            className="mt-1 h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SIGNATURE_SLOTS.map(({ key, label }) => {
          const slot = data.slots[key] || { name: "", signature: null };
          const isEditing = editingSlot === key;
          const hasExistingSignature =
            typeof slot.signature === "string" &&
            slot.signature.startsWith("data:image");

          return (
            <div
              key={key}
              className="space-y-3 rounded-xl border bg-muted/20 p-4"
            >
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  {label}
                </Label>
                <Input
                  type="text"
                  value={slot.name}
                  onChange={(e) => updateSlotName(key, e.target.value)}
                  placeholder={`Nama ${label}`}
                  disabled={disabled}
                  className="mt-1 h-8 text-sm"
                />
              </div>

              {hasExistingSignature && !isEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted bg-white p-2 min-h-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slot.signature!}
                      alt={`Tanda tangan ${label}`}
                      className="max-h-24 max-w-full object-contain"
                    />
                  </div>
                  {!disabled && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSlot(key)}
                        className="h-7 text-xs flex-1"
                      >
                        <Pen weight="BoldDuotone" className="h-3.5 w-3.5 mr-1" />
                        Ganti
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => clearSlotSignature(key)}
                        className="h-7 text-xs text-destructive hover:text-destructive flex-1"
                      >
                        <Eraser weight="BoldDuotone" className="h-3.5 w-3.5 mr-1" />
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
              ) : isEditing || !hasExistingSignature ? (
                <SignaturePad
                  label=""
                  onSignature={(sig) => updateSlotSignature(key, sig)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
