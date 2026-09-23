"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextBold, TextItalic, TextUnderline as UnderlineIcon, List, ListArrowDown, AltArrowRight, AltArrowLeft, AddCircle } from "@solar-icons/react";
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

interface TermConditionEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showVariablePanel?: boolean;
  /**
   * Opt-in: renders a compact editor box the user can drag-resize vertically
   * (native CSS resize handle, bottom-right corner) instead of the default
   * flex-1-stretch-to-parent sizing. Off by default so existing call sites
   * (e.g. PackageTCDrawer, which relies on the editor filling its flex
   * parent) are unaffected.
   */
  resizable?: boolean;
}

export function TermConditionEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Tulis Term & Condition di sini...",
  className,
  showVariablePanel = true,
  resizable = false,
}: TermConditionEditorProps) {
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
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-full px-4 py-3 text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange(html.trim() && html !== "<p></p>" ? html : "");
    },
  });

  // Sync editor content when value changes externally (e.g. drawer opened with different data)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value ?? "";
    const currentIsEmpty = current === "<p></p>" || current === "";
    const nextIsEmpty = next === "";
    if (current === next) return;
    if (currentIsEmpty && nextIsEmpty) return;
    editor.commands.setContent(next);
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const insertVariable = useCallback(
    (key: string) => {
      if (!editor || disabled) return;
      editor.chain().focus().insertContent(`{${key}}`).run();
    },
    [editor, disabled]
  );

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row gap-4",
        resizable ? "overflow-visible" : "flex-1 min-h-0 overflow-hidden",
        className,
      )}
    >
      {/* Editor */}
      <div
        className={cn(
          "flex flex-col w-full min-w-0 border rounded-lg",
          resizable ? "resize-y overflow-auto h-44 min-h-32 max-h-96" : "flex-1 overflow-hidden min-h-48 md:min-h-0",
        )}
      >
        {editor && (
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-card">
            <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" disabled={disabled}>
              <TextBold weight="BoldDuotone" className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" disabled={disabled}>
              <TextItalic weight="BoldDuotone" className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" disabled={disabled}>
              <UnderlineIcon weight="BoldDuotone" className="h-4 w-4" />
            </ToolbarButton>
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List" disabled={disabled}>
              <List weight="BoldDuotone" className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List" disabled={disabled}>
              <ListArrowDown weight="BoldDuotone" className="h-4 w-4" />
            </ToolbarButton>
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton active={false} onClick={() => editor.chain().focus().sinkListItem("listItem").run()} title="Indent (Sub-list)" disabled={disabled}>
              <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton active={false} onClick={() => editor.chain().focus().liftListItem("listItem").run()} title="Outdent" disabled={disabled}>
              <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
            </ToolbarButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto bg-card">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>

      {/* Variable Panel — chip wrap on mobile (<md), vertical list on desktop (md+) */}
      {showVariablePanel && (
        <div className="md:w-72 w-full shrink-0 border rounded-xl overflow-hidden md:flex md:flex-col md:max-h-full">
          <div className="px-4 py-3 border-b bg-card">
            <h3 className="text-sm font-semibold">Variable</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Klik untuk insert ke editor</p>
          </div>

          {/* Mobile: horizontal chip wrap */}
          <div className="md:hidden p-3 flex flex-wrap gap-1.5">
            {VARIABLE_GROUPS.flatMap((group) =>
              group.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <AddCircle weight="BoldDuotone" className="h-3 w-3 text-muted-foreground" />
                  {v.label}
                </button>
              ))
            )}
          </div>

          {/* Desktop: vertical scrollable list */}
          <div className="hidden md:flex flex-1 overflow-y-auto min-h-0">
            <div className="p-3 space-y-4 w-full">
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
                        disabled={disabled}
                        onClick={() => insertVariable(v.key)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm hover:bg-muted transition-colors cursor-pointer group disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
      )}
    </div>
  );
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn("p-1.5 rounded hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50", active && "bg-muted text-foreground")}
    >
      {children}
    </button>
  );
}
