"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
  id: string;
  name: string;
}

interface AutocompleteInputProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AutocompleteInput({
  options,
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  className,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (value.trim()) setOpen(true); }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("w-full", className)}
      />
      {open && value.trim() && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-75 overflow-auto rounded-md border bg-white shadow-lg">
          <div className="py-1">
            {filtered.map((opt) => (
              <div
                key={opt.id}
                className="relative cursor-pointer select-none py-2 px-3 text-sm hover:bg-gray-100"
                onClick={() => { onSelect(opt); setOpen(false); }}
              >
                {opt.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
