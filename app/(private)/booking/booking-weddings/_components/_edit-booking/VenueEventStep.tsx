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
import { usePermissions } from "@/hooks/use-permissions";
import { cn, formatRupiah, toDateOnly, parseDateOnly } from "@/lib/utils";
import { LBL } from "./useEditBookingForm";
import type { EditBookingForm } from "./useEditBookingForm";

function getPackagePrice(p: { sellingPrice?: number; margin?: number; categoryPrices?: Array<{ basePrice: number | string }> }) {
  const sellingPrice = Number(p.sellingPrice ?? 0);
  if (sellingPrice > 0) return sellingPrice;
  const base = (p.categoryPrices ?? []).reduce((sum, c) => sum + Number(c.basePrice ?? 0), 0);
  return base + Math.round(base * ((p.margin ?? 0) / 100));
}

// ─── VenueEventStep ───────────────────────────────────────────────────────────

export function VenueEventStep({ form }: { form: EditBookingForm }) {
  const {
    venueId, setVenueId,
    packageId, setPackageId,
    bookingDate, setBookingDate,
    dealingDate, setDealingDate,
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

  const { can } = usePermissions();
  const canEditDealingDate = can("booking", "dealing-date");

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
          placeholder="Select venue..."
          searchPlaceholder="Search venue..."
          emptyText="No venue"
        />
        {errors.venueId && <p className="mt-1 text-sm text-destructive">{errors.venueId}</p>}
      </div>

      {/* Package */}
      <div>
        <label className={LBL}>Select Package <span className="text-destructive">*</span></label>
        <SearchableSelect
          options={packages.map((p) => ({
            id: p.id,
            name: `${p.packageName}${p.pax ? ` — ${p.pax} pax` : ""} — ${formatRupiah(getPackagePrice(p))}`,
          }))}
          value={packageId}
          onChange={(id) => { setPackageId(id); clearError("packageId"); }}
          placeholder={venueId ? "Select package..." : "Select venue first"}
          disabled={!venueId}
          searchPlaceholder="Search package..."
          emptyText="No package"
        />
        {packagesError && <p className="text-xs text-destructive mt-1">Failed to load packages. Try selecting a venue again.</p>}
        {errors.packageId && <p className="mt-1 text-sm text-destructive">{errors.packageId}</p>}
      </div>

      {/* Event Type */}
      <div>
        <label className={LBL}>Event Type <span className="text-destructive">*</span></label>
        <Select value={weddingType} onValueChange={(v) => { setWeddingType(v); clearError("weddingType"); }}>
          <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="R">Reception</SelectItem>
            <SelectItem value="AR">Akad &amp; Reception</SelectItem>
            <SelectItem value="TR">Teapai &amp; Reception</SelectItem>
            <SelectItem value="PR">Blessing &amp; Reception</SelectItem>
            <SelectItem value="VO">Venue Only</SelectItem>
          </SelectContent>
        </Select>
        {errors.weddingType && <p className="mt-1 text-sm text-destructive">{errors.weddingType}</p>}
      </div>

      {/* Event Date */}
      <div>
        <label className={LBL}>Event Date <span className="text-destructive">*</span></label>
        <Popover>
          <PopoverTrigger render={
            <Button
              variant="outline"
              disabled={!venueId}
              className={cn("w-full mt-1 justify-start text-left font-normal", !bookingDate && "text-muted-foreground")}
            >
              <CalendarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
              {bookingDate ? format(parseDateOnly(bookingDate), "PPP") : "Select event date"}
            </Button>
          } />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={bookingDate ? parseDateOnly(bookingDate) : undefined}
              onSelect={(date) => { setBookingDate(date ? toDateOnly(date) : ""); setWeddingSession(""); clearError("eventDate"); }}
              startMonth={new Date(new Date().getFullYear() - 10, 0)}
              endMonth={new Date(new Date().getFullYear() + 10, 11)}
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

      {/* Dealing Date (super-admin only) */}
      {canEditDealingDate && (
        <div>
          <label className={LBL}>Dealing Date <span className="text-destructive">*</span></label>
          <Popover>
            <PopoverTrigger render={
              <Button
                variant="outline"
                className={cn("w-full mt-1 justify-start text-left font-normal", !dealingDate && "text-muted-foreground")}
              >
                <CalendarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                {dealingDate ? format(parseDateOnly(dealingDate), "PPP") : "Select dealing date"}
              </Button>
            } />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={dealingDate ? parseDateOnly(dealingDate) : undefined}
                onSelect={(date) => { setDealingDate(date ? toDateOnly(date) : ""); clearError("dealingDate"); }}
                startMonth={new Date(new Date().getFullYear() - 10, 0)}
                endMonth={new Date(new Date().getFullYear() + 10, 11)}
                defaultMonth={dealingDate ? parseDateOnly(dealingDate) : new Date()}
              />
            </PopoverContent>
          </Popover>
          <p className="mt-1 text-xs text-muted-foreground">
            The date this booking officially closed a deal with the customer. Only super-admin can edit this field.
          </p>
          {errors.dealingDate && <p className="mt-1 text-sm text-destructive">{errors.dealingDate}</p>}
        </div>
      )}

      {/* Event Session */}
      <div>
        <label className={LBL}>Event Session <span className="text-destructive">*</span></label>
        <Select value={weddingSession} onValueChange={(v) => { setWeddingSession(v); clearError("weddingSession"); }}>
          <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select session" /></SelectTrigger>
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
        <label className={LBL}>Time</label>
        <div className="mt-1">
          <TimeRangePicker
            value={time}
            onChange={setTime}
            placeholder="Select time (can be range)..."
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
