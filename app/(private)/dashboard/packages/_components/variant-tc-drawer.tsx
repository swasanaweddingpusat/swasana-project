"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Drawer } from "@/components/shared/drawer";
import { updateVariantTC } from "@/actions/package";
import { cn } from "@/lib/utils";
import type { PackageQueryItem } from "@/lib/queries/packages";

// ─── Variable Definitions ────────────────────────────────────────────────────

interface Variable {
  key: string;
  label: string;
  description: string;
}

interface VariableGroup {
  name: string;
  variables: Variable[];
}

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    name: "Data Booking",
    variables: [
      { key: "venue", label: "Nama Brand Venue", description: "Brand name venue (e.g. GUNAWARMAN HALLMARK & EVENT)" },
      { key: "venue_location", label: "Nama Lokasi Venue", description: "Nama spesifik ballroom/gedung" },
      { key: "customer_name", label: "Nama Customer", description: "Nama lengkap penyewa" },
      { key: "booking_date", label: "Tanggal Acara", description: "Tanggal pelaksanaan acara" },
      { key: "po_number", label: "Nomor PO", description: "Nomor Purchase Order" },
      { key: "wedding_type", label: "Tipe Acara", description: "Jenis acara (Wedding, Engagement, dll)" },
    ],
  },
  {
    name: "Paket & Harga",
    variables: [
      { key: "package_name", label: "Nama Paket", description: "Nama paket yang dipilih" },
      { key: "package_price", label: "Harga Paket", description: "Harga total paket" },
      { key: "discount_amount", label: "Diskon", description: "Nominal diskon" },
    ],
  },
  {
    name: "Pembayaran",
    variables: [
      { key: "term_of_payment", label: "Jadwal Pembayaran", description: "Tabel jadwal pembayaran lengkap" },
      { key: "booking_fee", label: "Booking Fee", description: "Nominal booking fee" },
      { key: "total_paid", label: "Total Dibayar", description: "Total yang sudah dibayar" },
      { key: "remaining_balance", label: "Sisa Pembayaran", description: "Sisa yang harus dibayar" },
    ],
  },
  {
    name: "Pihak",
    variables: [
      { key: "sales_name", label: "Nama Sales", description: "Nama sales yang menangani" },
      { key: "manager_name", label: "Nama Manager", description: "Nama manager yang menangani" },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  pkg: PackageQueryItem | null;
}

export function VariantTCDrawer({ open, onClose, pkg }: Props) {
  const qc = useQueryClient();
  const variants = pkg?.variants ?? [];
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [draftMap, setDraftMap] = useState<Record<string, string>>({});

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const initialTC = (selectedVariant as { termAndCondition?: string | null } | undefined)?.termAndCondition ?? "";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({ placeholder: "Tulis Term & Condition di sini..." }),
    ],
    content: initialTC,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-full px-4 py-3 text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
      },
    },
  });

  // Auto-select first variant & sync editor when drawer opens or pkg changes
  useEffect(() => {
    if (!open || variants.length === 0) return;
    const first = variants[0];
    setSelectedVariantId(first.id); // eslint-disable-line react-hooks/set-state-in-effect
    const tc = (first as { termAndCondition?: string | null }).termAndCondition ?? "";
    editor?.commands.setContent(tc);
  }, [open, pkg, editor]);

  const insertVariable = useCallback(
    (key: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`{${key}}`).run();
    },
    [editor]
  );

  function handleCopyFromVariant(sourceId: string) {
    const source = variants.find((v) => v.id === sourceId);
    const tc = (source as { termAndCondition?: string | null } | undefined)?.termAndCondition ?? "";
    editor?.commands.setContent(tc);
    setDraftMap((prev) => ({ ...prev, [selectedVariantId]: tc }));
  }

  function handleVariantChange(id: string) {
    if (editor && selectedVariantId) {
      setDraftMap((prev) => ({ ...prev, [selectedVariantId]: editor.getHTML() }));
    }
    setSelectedVariantId(id);
    const variant = variants.find((v) => v.id === id);
    const dbTC = (variant as { termAndCondition?: string | null } | undefined)?.termAndCondition ?? "";
    editor?.commands.setContent(draftMap[id] ?? dbTC);
  }

  async function handleSave() {
    if (!editor || !selectedVariantId) return;
    setSaving(true);
    const html = editor.getHTML();
    const value = html.trim() && html !== "<p></p>" ? html : null;
    const res = await updateVariantTC(selectedVariantId, value);
    setSaving(false);
    if (res.success) {
      toast.success("T&C berhasil disimpan.");
      setDraftMap((prev) => {
        const next = { ...prev };
        delete next[selectedVariantId];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["packages"] });
    } else {
      toast.error(res.error);
    }
  }

  function handleClose() {
    setDraftMap({});
    onClose();
  }

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title={`Term & Condition — ${pkg?.packageName ?? ""}`}
      maxWidth="sm:max-w-full"
      childrenClassName="overflow-hidden flex flex-col"
      headerActions={
        <Button
          onClick={handleSave}
          disabled={saving || !selectedVariantId}
          size="sm"
          className={cn("bg-gray-900 hover:bg-gray-800 text-white cursor-pointer")}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
        {/* Variant Selector */}
        <div className="shrink-0">
          <Label className="text-sm font-medium mb-1 block">Variant</Label>
          <div className="flex items-center gap-2">
            <Select value={selectedVariantId} onValueChange={handleVariantChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Pilih variant" />
              </SelectTrigger>
              <SelectContent>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.variantName} — {v.pax} PAX
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {variants.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0">
                    <Copy className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Salin dari varian</DropdownMenuLabel>
                  {variants
                    .filter((v) => v.id !== selectedVariantId)
                    .map((v) => (
                      <DropdownMenuItem key={v.id} onSelect={() => handleCopyFromVariant(v.id)}>
                        {v.variantName} — {v.pax} PAX
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Editor + Variable Panel */}
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left — Editor */}
          <div className="flex-1 flex flex-col min-w-0 border rounded-lg overflow-hidden">
            {editor && (
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-white">
                <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
                  <Bold className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
                  <Italic className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
                  <UnderlineIcon className="h-4 w-4" />
                </ToolbarButton>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
                  <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
                  <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
              </div>
            )}
            <div className="flex-1 overflow-y-auto bg-white">
              <EditorContent editor={editor} className="h-full" />
            </div>
          </div>

          {/* Right — Variable Panel */}
          <div className="w-72 shrink-0 border rounded-lg flex flex-col overflow-hidden max-h-full">
            <div className="px-4 py-3 border-b bg-white">
              <h3 className="text-sm font-semibold">Variable</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Klik untuk insert ke editor</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-3 space-y-4">
                {VARIABLE_GROUPS.map((group) => (
                  <div key={group.name}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      {group.name}
                    </p>
                    <div className="space-y-1">
                      {group.variables.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => insertVariable(v.key)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm hover:bg-muted transition-colors cursor-pointer group"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground">{v.label}</span>
                            <span className="block text-xs text-muted-foreground truncate">{`{${v.key}}`}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn("p-1.5 rounded hover:bg-gray-200 transition-colors", active && "bg-gray-200 text-black")}
    >
      {children}
    </button>
  );
}
