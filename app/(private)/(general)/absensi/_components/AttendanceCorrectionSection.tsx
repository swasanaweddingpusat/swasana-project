"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClockSquare } from "@solar-icons/react";
import { AttendanceCorrectionForm } from "./AttendanceCorrectionForm";
import { AttendanceCorrectionHistory } from "./AttendanceCorrectionHistory";

export function AttendanceCorrectionSection() {
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Koreksi Absen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lupa clock-in/out? Ajukan koreksi untuk tanggal yang bersangkutan.
          </p>
        </div>
        <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogTrigger
            render={
              <Button className="w-full rounded-xl sm:w-auto">
                <ClockSquare weight="BoldDuotone" className="h-4 w-4" />
                Ajukan Koreksi Absen
              </Button>
            }
          />
          <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-2xl">
            <DialogHeader className="border-b px-6 py-5 sm:px-7">
              <DialogTitle className="font-heading text-xl">Ajukan Koreksi Absen</DialogTitle>
              <DialogDescription>
                Isi tanggal, jam yang benar, dan alasan pengajuan koreksi Anda.
              </DialogDescription>
            </DialogHeader>
            <AttendanceCorrectionForm
              inDialog
              onSubmitted={() => setIsRequestDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <AttendanceCorrectionHistory />
    </div>
  );
}
