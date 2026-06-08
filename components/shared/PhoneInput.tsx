"use client";

/**
 * PhoneInput — reusable phone input with country code picker.
 *
 * DB storage format: "<dialCode><nationalNumber>" (no "+" prefix).
 * Example: "+62 812-3456-7890" → stored as "6281234567890"
 *
 * Usage (single phone, uncontrolled string):
 *   <PhoneInput value={stored} onChange={(v) => set("phone", v)} />
 *
 * Usage inside multi-contact popover:
 *   <CountryCodePicker value={country} onChange={setCountry} />
 *   + <input value={national} onChange={...} />
 *
 * All exported utilities are pure functions — safe to use in server-side
 * logic (normalizePhone, composeStoredPhone, parseStoredPhone, formatPhoneDisplay).
 */

import { useState } from "react";
import { AltArrowDown } from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  COUNTRIES,
  parseStoredPhone,
  composeStoredPhone,
  type CountryData,
} from "@/lib/constants/countries";

// Re-export utilities so consumers can import from a single place
export { parseStoredPhone, composeStoredPhone } from "@/lib/constants/countries";
export type { CountryData } from "@/lib/constants/countries";

// ─── CountryCodePicker ────────────────────────────────────────────────────────

interface CountryCodePickerProps {
  value: CountryData;
  onChange: (country: CountryData) => void;
  disabled?: boolean;
  className?: string;
  /** Trigger button size variant: "sm" (compact, for inline use) | "default" */
  size?: "sm" | "default";
}

export function CountryCodePicker({
  value,
  onChange,
  disabled,
  className,
  size = "default",
}: CountryCodePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center gap-1 rounded-l-md border border-r-0 border-input bg-muted px-2 text-sm text-foreground transition-colors hover:bg-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 shrink-0 self-stretch",
              size === "sm" ? "px-1.5 text-xs" : "px-2 text-sm",
              className
            )}
            aria-label={`Country code: +${value.dialCode} ${value.name}`}
          >
            <span className="text-base leading-none">{value.flag}</span>
            <span className={cn("font-mono text-muted-foreground", size === "sm" ? "text-xs" : "text-xs")}>
              +{value.dialCode}
            </span>
            <AltArrowDown weight="BoldDuotone" className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        }
      />
      <PopoverContent
        className="w-72 p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Cari negara..." />
          <CommandList>
            <CommandEmpty>Negara tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.iso2}
                  value={`${c.name} ${c.dialCode} ${c.iso2}`}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  data-checked={value.iso2 === c.iso2 ? "true" : undefined}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground shrink-0">
                    +{c.dialCode}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── PhoneInput ───────────────────────────────────────────────────────────────

interface PhoneInputProps {
  /**
   * Stored value: "<dialCode><nationalNumber>" e.g. "6281234567890".
   * Empty string is valid (no number entered).
   */
  value: string;
  onChange: (stored: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra class applied to the outer wrapper div */
  wrapperClassName?: string;
  id?: string;
  name?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  /** Max national number digits (default 13) */
  maxNationalDigits?: number;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  size?: "sm" | "default";
}

export function PhoneInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  wrapperClassName,
  id,
  name,
  inputMode = "tel",
  maxNationalDigits = 13,
  onBlur,
  size = "default",
}: PhoneInputProps) {
  // Fully controlled — derive country and national number from value prop on
  // every render. parseStoredPhone is a pure synchronous function so this is
  // always cheap. No internal state needed: whenever country or national number
  // changes we call onChange(), which causes the parent to update value, which
  // causes React to re-render with the new parsed result.
  const { country, nationalNumber: national } = parseStoredPhone(value);

  function handleCountryChange(c: CountryData) {
    const composed = composeStoredPhone(c, national);
    onChange(composed);
  }

  function handleNationalChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/\D/g, "");
    // Strip leading 0 (local convention) and dial code if typed accidentally
    if (raw.startsWith("0")) raw = raw.slice(1);
    // If user pastes full number starting with country's dial code, strip it
    if (raw.startsWith(country.dialCode)) {
      raw = raw.slice(country.dialCode.length);
    }
    const capped = raw.slice(0, maxNationalDigits);
    const composed = composeStoredPhone(country, capped);
    onChange(composed);
  }

  const ph = placeholder ?? (country.iso2 === "ID" ? "812-3456-7890" : "xxx-xxxx-xxxx");

  return (
    <div
      className={cn(
        "flex w-full rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
        disabled && "opacity-50 cursor-not-allowed",
        wrapperClassName
      )}
    >
      <CountryCodePicker
        value={country}
        onChange={handleCountryChange}
        disabled={disabled}
        size={size}
      />
      <input
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        value={national}
        onChange={handleNationalChange}
        onBlur={onBlur}
        placeholder={ph}
        disabled={disabled}
        className={cn(
          "flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          size === "sm" && "py-1.5 text-xs px-2",
          className
        )}
        autoComplete="tel-national"
      />
    </div>
  );
}

// ─── Multi-contact entry (used in popover add-contact flow) ──────────────────

/**
 * ContactEntry — a mini form (name label + PhoneInput) used in popovers
 * for adding a contact to a multi-contact list.
 *
 * Label is REQUIRED — the "Tambah" button is disabled until both label and a
 * valid national number (≥ 7 digits) are filled in.
 *
 * @returns stored phone string (e.g. "6281234567890") via onAdd callback
 */
interface ContactEntryProps {
  nameValue: string;
  onNameChange: (v: string) => void;
  phoneValue: string;
  onPhoneChange: (v: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}

export function ContactEntry({
  nameValue,
  onNameChange,
  phoneValue,
  onPhoneChange,
  onAdd,
  disabled,
}: ContactEntryProps) {
  const { nationalNumber } = parseStoredPhone(phoneValue);
  const labelMissing = !nameValue.trim();
  const phoneTooShort = nationalNumber.length < 7;
  const canAdd = !labelMissing && !phoneTooShort;

  return (
    <div className="space-y-2">
      <div>
        <input
          type="text"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Label wajib: cpw, cpp, ortu..."
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        {labelMissing && nameValue !== "" && (
          <p className="mt-0.5 text-xs text-destructive">Label wajib diisi</p>
        )}
      </div>
      <PhoneInput
        value={phoneValue}
        onChange={onPhoneChange}
        placeholder="812-3456-7890"
        size="sm"
      />
      {!canAdd && (nameValue !== "" || phoneValue !== "") && (
        <p className="text-xs text-muted-foreground">
          {labelMissing ? "Isi label terlebih dahulu" : "Nomor terlalu pendek (min. 7 digit)"}
        </p>
      )}
      <button
        type="button"
        disabled={disabled || !canAdd}
        onClick={onAdd}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Tambah
      </button>
    </div>
  );
}
