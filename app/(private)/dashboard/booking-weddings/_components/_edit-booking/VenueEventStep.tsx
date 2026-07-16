"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon, DangerTriangle } from "@solar-icons/react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { cn, toDateOnly, parseDateOnly } from "@/lib/utils";
import { LBL } from "./useEditBookingForm";
import type { EditBookingForm } from "./useEditBookingForm";

// ─── VenueEventStep ───────────────────────────────────────────────────────────

export function VenueEventStep({ form }: { form: EditBookingForm }) {
  const {
    venueId, setVenueId,
    packageId, setPackageId,
    bookingDate, setBookingDate,
    weddingSession, setWeddingSession,
    weddingType, setWeddingType,
    time, setTime,
    noteDateEvent, setNoteDateEvent,
    setVisibleMonth,
    venues,
    packages,
    packagesError,
    sessionLabels,
    willResetApproval,
    getDateStatus,
    getAvailableSessions,
    errors,
    clearError,
  } = form;

  return (
    <div className="space-y-3">

      {/* Re-approval warning banner */}
      {willResetApproval && (
        <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive">
          <DangerTriangle weight="BoldDuotone" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            Booking ini sudah ditandatangani klien. Mengubah venue, paket, atau tanggal event akan{" "}
            me-reset approval ke <span className="font-semibold">Pending</span> dan klien harus tanda tangan ulang.
          </span>
        </div>
      )}

      {/* Venue */}
      <div>
        <label className={LBL}>Venue <span className="text-destructive">*</span></label>
        <SearchableSelect
          options={venues}
          value={venueId}
          onChange={(id) => {
            setVenueId(id);
            setPackageId("");
            clearError("venueId");
          }}
          placeholder="Pilih venue..."
          searchPlaceholder="Cari venue..."
          emptyText="Tidak ada venue"
        />
        {errors.venueId && <p className="mt-1 text-sm text-destructive">{errors.venueId}</p>}
      </div>

      {/* Package */}
      <div>
        <label className={LBL}>Pilih Paket <span className="text-destructive">*</span></label>
        <SearchableSelect
          options={packages.map((p) => ({ id: p.id, name: `${p.packageName}${p.pax ? ` · ${p.pax} PAX` : ""}` }))}
          value={packageId}
          onChange={(id) => { setPackageId(id); clearError("packageId"); }}
          placeholder={venueId ? "Pilih paket..." : "Pilih venue dulu"}
          disabled={!venueId}
          searchPlaceholder="Cari paket..."
          emptyText="Tidak ada paket"
        />
        {packagesError && <p className="text-xs text-destructive mt-1">Gagal memuat paket. Coba pilih venue ulang.</p>}
        {errors.packageId && <p className="mt-1 text-sm text-destructive">{errors.packageId}</p>}
      </div>

      {/* Event Type */}
      <div>
        <label className={LBL}>Tipe Event <span className="text-destructive">*</span></label>
        <Select value={weddingType} onValueChange={(v) => { setWeddingType(v); clearError("weddingType"); }}>
          <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="R">Resepsi</SelectItem>
            <SelectItem value="AR">Akad &amp; Resepsi</SelectItem>
            <SelectItem value="TR">Teapai &amp; Resepsi</SelectItem>
            <SelectItem value="PR">Pemberkatan Resepsi</SelectItem>
            <SelectItem value="VO">Venue Only</SelectItem>
          </SelectContent>
        </Select>
        {errors.weddingType && <p className="mt-1 text-sm text-destructive">{errors.weddingType}</p>}
      </div>

      {/* Event Date */}
      <div>
        <label className={LBL}>Tanggal Event <span className="text-destructive">*</span></label>
        <Popover>
          <PopoverTrigger render={
            <Button
              variant="outline"
              disabled={!venueId}
              className={cn("w-full mt-1 justify-start text-left font-normal", !bookingDate && "text-muted-foreground")}
            >
              <CalendarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
              {bookingDate ? format(parseDateOnly(bookingDate), "PPP") : "Pilih tanggal event"}
            </Button>
          } />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={bookingDate ? parseDateOnly(bookingDate) : undefined}
              onSelect={(date) => { setBookingDate(date ? toDateOnly(date) : ""); setWeddingSession(""); clearError("eventDate"); }}
              fromYear={new Date().getFullYear() - 10}
              toYear={new Date().getFullYear() + 10}
              defaultMonth={bookingDate ? parseDateOnly(bookingDate) : new Date()}
              onMonthChange={setVisibleMonth}
              disabled={(d) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isExistingDate = bookingDate && toDateOnly(d) === bookingDate;
                if (isExistingDate) return false;
                return d < today || (!!venueId && getDateStatus(d) === "unavailable");
              }}
              modifiers={{
                available: (d) => !!venueId && getDateStatus(d) === "available",
                partial: (d) => !!venueId && getDateStatus(d) === "partial",
                unavailable: (d) => !!venueId && getDateStatus(d) === "unavailable",
              }}
              modifiersClassNames={{ available: "day-available", partial: "day-partial", unavailable: "day-unavailable" }}
            />
          </PopoverContent>
        </Popover>
        {errors.eventDate && <p className="mt-1 text-sm text-destructive">{errors.eventDate}</p>}
      </div>

      {/* Event Session */}
      <div>
        <label className={LBL}>Sesi Event <span className="text-destructive">*</span></label>
        <Select value={weddingSession} onValueChange={(v) => { setWeddingSession(v); clearError("weddingSession"); }}>
          <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Pilih session" /></SelectTrigger>
          <SelectContent>
            {(bookingDate ? getAvailableSessions(bookingDate) : ["morning", "evening", "fullday"]).map((s) => (
              <SelectItem key={s} value={s}>{sessionLabels[s] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.weddingSession && <p className="mt-1 text-sm text-destructive">{errors.weddingSession}</p>}
      </div>

      {/* Time */}
      <div>
        <label className={LBL}>Time (Jam Acara)</label>
        <div className="mt-1">
          <TimeRangePicker
            value={time}
            onChange={setTime}
            placeholder="Pilih waktu (bisa rentang)..."
          />
        </div>
      </div>

      {/* Note Date Event */}
      <div>
        <label className={LBL}>Note Date Event</label>
        <Textarea
          placeholder="Add note for date event"
          value={noteDateEvent}
          onChange={(e) => setNoteDateEvent(e.target.value)}
          rows={3}
          className="mt-1"
        />
      </div>

    </div>
  );
}
