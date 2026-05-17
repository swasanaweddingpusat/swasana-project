"use client";

import * as React from "react";
import { ReceiptText } from "lucide-react";
import { SUMMARY_FINANCIAL_COLORS } from "@/types/catering";
import type { CateringSection, GroupOperationType } from "@/types/catering";

interface Props {
  sections: CateringSection[];
  totalMakanan: number;
  totalPayment: number;
  displayGroups: Array<{ name: string; total: number; type: GroupOperationType; sectionName: string; depth: number; isSelisih?: boolean }>;
  selisihTotal: number;
  pelunasan: number;
}

export function SummaryPanel({ totalMakanan, totalPayment, displayGroups, selisihTotal, pelunasan }: Props) {
  const fmt = (n: number) => `Rp ${Math.abs(n).toLocaleString("id-ID")}`;

  // Group displayGroups by section
  const groupsBySection = React.useMemo(() => {
    const map: Record<string, typeof displayGroups> = {};
    displayGroups.filter((g) => g.type !== "charge" && g.type !== "pembayaran").forEach((g) => {
      if (!map[g.sectionName]) map[g.sectionName] = [];
      map[g.sectionName].push(g);
    });
    return map;
  }, [displayGroups]);

  const chargeGroups = React.useMemo(() => {
    const map: Record<string, typeof displayGroups> = {};
    displayGroups.filter((g) => g.type === "charge").forEach((g) => {
      if (!map[g.sectionName]) map[g.sectionName] = [];
      map[g.sectionName].push(g);
    });
    return map;
  }, [displayGroups]);

  const pembayaranGroups = React.useMemo(() => {
    const map: Record<string, typeof displayGroups> = {};
    displayGroups.filter((g) => g.type === "pembayaran").forEach((g) => {
      if (!map[g.sectionName]) map[g.sectionName] = [];
      map[g.sectionName].push(g);
    });
    return map;
  }, [displayGroups]);

  return (
    <div className="border border-gray-300 rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <ReceiptText className="h-4 w-4 text-gray-500" />
        <p className="text-sm font-bold text-gray-900">Detail Summary</p>
      </div>

      {/* Groups by section */}
      {Object.entries(groupsBySection).map(([sectionName, groups]) => (
        <div key={sectionName} className="mb-1">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{sectionName}</p>
          {groups.map((g, i) => (
            <div key={i} className="flex justify-between text-xs py-0.5" style={{ paddingLeft: `${8 + g.depth * 12}px`, color: g.type === "pengurangan" ? "#c0392b" : g.type === "discount" ? "#15803d" : "#000" }}>
              <span className={g.isSelisih ? "italic" : ""}>{g.name}</span>
              <span>{g.type === "pengurangan" || g.type === "discount" ? "-" : ""}{fmt(g.total)}</span>
            </div>
          ))}
        </div>
      ))}

      {selisihTotal !== 0 && (
        <div className="flex justify-between text-xs py-0.5 italic" style={{ color: selisihTotal < 0 ? "#c0392b" : "#15803d" }}>
          <span>Selisih Menu Pilihan</span>
          <span>{selisihTotal < 0 ? "-" : "+"}{fmt(selisihTotal)}</span>
        </div>
      )}

      <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-300">
        <span>Total Pembayaran Makanan</span>
        <span>{fmt(totalMakanan)}</span>
      </div>

      {/* Charge groups */}
      {Object.keys(chargeGroups).length > 0 && (
        <div className="mb-1">
          {Object.entries(chargeGroups).map(([sectionName, groups]) => (
            <div key={sectionName}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{sectionName}</p>
              {groups.map((g, i) => (
                <div key={i} className="flex justify-between text-xs py-0.5 text-gray-500" style={{ paddingLeft: `${8 + g.depth * 12}px` }}>
                  <span>{g.name}</span>
                  <span>-{fmt(g.total)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-300 mt-1">
        <span>TOTAL PAYMENT</span>
        <span>{fmt(totalPayment)}</span>
      </div>

      {/* Pembayaran groups */}
      {Object.keys(pembayaranGroups).length > 0 && (
        <div className="mt-1 pt-1 border-t border-gray-200">
          {Object.entries(pembayaranGroups).map(([sectionName, groups]) => (
            <div key={sectionName}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{sectionName}</p>
              {groups.map((g, i) => (
                <div key={i} className="flex justify-between text-xs py-0.5 text-gray-500 italic" style={{ paddingLeft: `${8 + g.depth * 12}px` }}>
                  <span>{g.name}</span>
                  <span>-{fmt(g.total)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Pelunasan */}
      <div className="pt-1 mt-1 border-t border-gray-200">
        <div className="flex justify-between text-sm font-bold py-0.5"
          style={{ color: pelunasan < 0 ? SUMMARY_FINANCIAL_COLORS.positive : pelunasan > 0 ? SUMMARY_FINANCIAL_COLORS.negative : SUMMARY_FINANCIAL_COLORS.neutral }}>
          <span>Pelunasan</span>
          <span>{pelunasan < 0 ? "+" : ""}{fmt(pelunasan)}</span>
        </div>
      </div>
    </div>
  );
}
