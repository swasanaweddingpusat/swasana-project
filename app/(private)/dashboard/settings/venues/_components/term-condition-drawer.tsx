"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/shared/drawer";
import { updateVenueTermCondition } from "@/actions/venue";
import { cn } from "@/lib/utils";

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
      { key: "venue", label: "Nama Venue", description: "Nama venue acara" },
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

interface TermConditionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  venueName: string;
  initialValue: string | null;
  onSaved: (venueId: string, value: string | null) => void;
}

export function TermConditionDrawer({
  isOpen,
  onClose,
  venueId,
  venueName,
  initialValue,
  onSaved,
}: TermConditionDrawerProps) {
  const [saving, setSaving] = useState(false);

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
      Placeholder.configure({
        placeholder: "Tulis Term & Condition di sini...",
      }),
    ],
    content: initialValue ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-full px-4 py-3 text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
      },
    },
  });

  const insertVariable = useCallback(
    (key: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`{${key}}`).run();
    },
    [editor]
  );

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    const html = editor.getHTML();
    const value = html.trim() && html !== "<p></p>" ? html : null;
    const result = await updateVenueTermCondition({ id: venueId, termAndCondition: value });
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Term & Condition berhasil disimpan.");
    onSaved(venueId, value);
    onClose();
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Term & Condition — ${venueName}`}
      maxWidth="sm:max-w-full"
      headerActions={
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className={cn("bg-gray-900", "hover:bg-gray-800", "text-white", "cursor-pointer")}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <div className={cn("flex", "gap-4", "h-full", "min-h-0", "overflow-hidden")}>
        {/* Left — Editor */}
        <div className={cn("flex-1", "flex", "flex-col", "min-w-0", "border", "rounded-lg", "overflow-hidden")}>
          {/* Toolbar */}
          {editor && (
            <div className={cn("flex", "items-center", "gap-0.5", "px-2", "py-1.5", "border-b", "bg-white")}>
              <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
                <Bold className={cn("h-4", "w-4")} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
                <Italic className={cn("h-4", "w-4")} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
                <UnderlineIcon className={cn("h-4", "w-4")} />
              </ToolbarButton>
              <div className={cn("w-px", "h-5", "bg-gray-300", "mx-1")} />
              <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
                <List className={cn("h-4", "w-4")} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
                <ListOrdered className={cn("h-4", "w-4")} />
              </ToolbarButton>
            </div>
          )}
          {/* Editor Content */}
          <div className={cn("flex-1", "overflow-y-auto", "bg-white")}>
            <EditorContent editor={editor} className="h-full" />
          </div>
        </div>

        {/* Right — Widget Panel */}
        <div className={cn("w-72", "shrink-0", "border", "rounded-lg", "flex", "flex-col", "overflow-hidden", "max-h-full")}>
          <div className={cn("px-4", "py-3", "border-b", "bg-white")}>
            <h3 className={cn("text-sm", "font-semibold")}>Variable</h3>
            <p className={cn("text-xs", "text-muted-foreground", "mt-0.5")}>Klik untuk insert ke editor</p>
          </div>
          <div className={cn("flex-1", "overflow-y-auto", "min-h-0")}>
            <div className={cn("p-3", "space-y-4")}>
              {VARIABLE_GROUPS.map((group) => (
                <div key={group.name}>
                  <p className={cn("text-xs", "font-medium", "text-muted-foreground", "uppercase", "tracking-wide", "mb-2", "px-1")}>
                    {group.name}
                  </p>
                  <div className={cn("space-y-1")}>
                    {group.variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        className={cn(
                          "w-full", "flex", "items-center", "gap-2", "px-2.5", "py-2",
                          "rounded-md", "text-left", "text-sm",
                          "hover:bg-muted", "transition-colors", "cursor-pointer", "group"
                        )}
                      >
                        <Plus className={cn("h-3.5", "w-3.5", "text-muted-foreground", "opacity-0", "group-hover:opacity-100", "transition-opacity")} />
                        <div className={cn("flex-1", "min-w-0")}>
                          <span className={cn("font-medium", "text-foreground")}>{v.label}</span>
                          <span className={cn("block", "text-xs", "text-muted-foreground", "truncate")}>{`{${v.key}}`}</span>
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
      className={cn("p-1.5", "rounded", "hover:bg-gray-200", "transition-colors", active && "bg-gray-200 text-black")}
    >
      {children}
    </button>
  );
}
