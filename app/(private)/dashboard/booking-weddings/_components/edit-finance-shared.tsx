"use client";

import React, { useState, useEffect } from "react";

export const STORAGE_BASE = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "";

export function toFullUrl(raw: string): string {
  if (raw.startsWith("http")) return raw;
  return STORAGE_BASE ? `${STORAGE_BASE}/${raw}` : raw;
}

export function EvidencePreview({ src, onOpen }: { src: File | string; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof src === "string") {
      setUrl(toFullUrl(src));
      return;
    }
    if (!src.type.startsWith("image/")) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(src);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [src]);

  if (!url) return null;
  const isImage = typeof src === "string" ? /\.(webp|jpe?g|png|gif)(\?|$)/i.test(src) : src.type.startsWith("image/");
  if (!isImage) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="relative z-10 h-10 w-10 object-cover rounded border shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpen(); }} />;
}

export function fmtRp(n: number): string {
  return n.toLocaleString("id-ID");
}

export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

// "refund" is a system-set status (created on takeout overpayment). It is shown
// read-only and never user-selectable, so it is intentionally not offered in
// the Select; the type below still allows it so refund terms render correctly.
export const PAYMENT_STATUS = ["paid", "partial", "unpaid"] as const;

export interface PartialPayment {
  tempId: string;
  dbId?: string;
  amount: number;
  paidAt: string;
  evidence: File | string | null;
  notes: string;
}

export interface FinanceTerm {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  paymentStatus: "unpaid" | "paid" | "partial" | "refund";
  ackStatus: string | null;
  paymentEvidence: string | null;
  paymentMethodId?: string | null;
  notes: string | null;
  partialPayments?: {
    id: string;
    amount: number;
    paidAt: Date | string;
    evidence: string | null;
    notes: string | null;
  }[];
}

export interface FinanceCategoryRow {
  id: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  isTakeout: boolean;
  takeoutNominal: number;
}
