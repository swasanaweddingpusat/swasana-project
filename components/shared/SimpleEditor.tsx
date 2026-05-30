"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextBold, TextItalic, TextUnderline as UnderlineIcon, List } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface SimpleEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarBtn({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn("p-1.5 rounded hover:bg-muted transition-colors", active && "bg-muted text-foreground")}
    >
      {children}
    </button>
  );
}

export function SimpleEditor({ value, onChange, placeholder, className }: SimpleEditorProps) {
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
        placeholder: placeholder || "Tulis sesuatu...",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-20 px-3 py-2 text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className={cn("border border-border rounded-md bg-muted overflow-hidden", className)}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-card">
        <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <TextBold weight="BoldDuotone" className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <TextItalic weight="BoldDuotone" className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <UnderlineIcon weight="BoldDuotone" className="h-4 w-4" />
        </ToolbarBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <List weight="BoldDuotone" className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
          <List weight="BoldDuotone" className="h-4 w-4" />
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
