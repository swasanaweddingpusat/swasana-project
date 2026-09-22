import type { Metadata } from "next";
import { LeaveManagement } from "@/app/(private)/hrd/sistem-cuti/_components/LeaveManagement";

export const metadata: Metadata = {
  title: "Cuti Saya - SWASANA",
  description: "Pengajuan dan saldo cuti",
};

export default function CutiPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-8">
      <header className="relative overflow-hidden rounded-2xl border bg-card px-6 py-7 shadow-sm sm:px-8">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">Employee self-service</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Pengajuan Cuti
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Pantau saldo, ajukan cuti, dan ikuti proses persetujuan dalam satu tempat.
          </p>
        </div>
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/5" />
        <div className="absolute -bottom-24 right-24 h-40 w-40 rounded-full bg-primary/5" />
      </header>
      <LeaveManagement mode="self-service" />
    </div>
  );
}
