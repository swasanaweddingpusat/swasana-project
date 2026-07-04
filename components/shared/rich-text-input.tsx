"use client";

/**
 * rich-text-input.tsx
 *
 * A contenteditable input that renders WhatsApp-style inline formatting LIVE
 * (bold *x*, italic _x_, strike ~x~, monospace ```x```) while the user types,
 * with no visible markers and a perfectly aligned caret.
 *
 * Source of truth = markdown string with markers (the `value` prop). The DOM
 * shows formatted text (no markers); markers are (de)serialized on the fly.
 * Line-prefix formats (- bullet, 1. numbered, > quote) stay as literal text in
 * the editor — they render as lists only in the sent bubble.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

export interface RichTextInputHandle {
  focus: () => void;
  applyInline: (type: "bold" | "italic" | "strike" | "mono") => void;
  insertText: (text: string) => void;
  /** Replace whole value (caret goes to end). Used for list/quote toggles & clear. */
  setValue: (value: string) => void;
  /** Remove `queryLen` chars + the leading "@" before caret, then insert `@name `. */
  replaceMention: (name: string, queryLen: number) => void;
  getElement: () => HTMLDivElement | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called with the visible text before the caret (for mention detection). */
  onCaret?: (textBeforeCaret: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

// ─── Markdown ⇄ HTML ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineToHtml(text: string): string {
  let i = 0;
  let out = "";
  let buf = "";
  const flush = () => {
    if (!buf) return;
    out += escapeHtml(buf).replace(/(@\w+(?:\s\w+)?)/g, '<span class="text-primary font-semibold">$1</span>');
    buf = "";
  };
  while (i < text.length) {
    if (text.slice(i, i + 3) === "```") {
      const end = text.indexOf("```", i + 3);
      if (end !== -1) {
        flush();
        out += `<code class="font-mono text-[0.9em] px-1 rounded bg-black/10">${escapeHtml(text.slice(i + 3, end))}</code>`;
        i = end + 3;
        continue;
      }
    }
    const c = text[i];
    if (c === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1) { flush(); out += `<strong class="font-semibold">${escapeHtml(text.slice(i + 1, end))}</strong>`; i = end + 1; continue; }
    }
    if (c === "_") {
      const end = text.indexOf("_", i + 1);
      if (end > i + 1) { flush(); out += `<em class="italic">${escapeHtml(text.slice(i + 1, end))}</em>`; i = end + 1; continue; }
    }
    if (c === "~") {
      const end = text.indexOf("~", i + 1);
      if (end > i + 1) { flush(); out += `<s class="line-through">${escapeHtml(text.slice(i + 1, end))}</s>`; i = end + 1; continue; }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

function toHtml(md: string): string {
  if (!md) return "";
  return md.split("\n").map((line) => {
    // Line-prefix formats → styled block with marker hidden (data-prefix keeps it for serialize)
    if (line.startsWith("> ")) {
      return `<div data-prefix="&gt; " class="border-l-2 border-primary/50 pl-2 italic opacity-90">${inlineToHtml(line.slice(2)) || "<br>"}</div>`;
    }
    if (line.startsWith("- ")) {
      return `<div data-prefix="- " class="pl-3 relative before:content-['•'] before:absolute before:left-0 before:opacity-60">${inlineToHtml(line.slice(2)) || "<br>"}</div>`;
    }
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      return `<div data-prefix="${numMatch[0]}" class="pl-4 relative"><span class="absolute left-0 opacity-60 font-mono text-xs">${numMatch[1]}.</span>${inlineToHtml(line.slice(numMatch[0].length)) || "<br>"}</div>`;
    }
    return inlineToHtml(line);
  }).join("<br>");
}

function serialize(node: Node): string {
  let s = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      s += (child.textContent ?? "").replace(/​/g, ""); // strip zero-width space anchors
    } else if (child instanceof HTMLElement) {
      const tag = child.tagName;
      if (tag === "BR") s += "\n";
      else if (tag === "STRONG" || tag === "B") s += "*" + serialize(child) + "*";
      else if (tag === "EM" || tag === "I") s += "_" + serialize(child) + "_";
      else if (tag === "S" || tag === "STRIKE" || tag === "DEL") s += "~" + serialize(child) + "~";
      else if (tag === "CODE") s += "```" + serialize(child) + "```";
      else if (tag === "DIV") {
        if (s && !s.endsWith("\n")) s += "\n";
        const prefix = child.getAttribute("data-prefix") ?? "";
        s += prefix + serialize(child);
      }
      else s += serialize(child);
    }
  });
  return s;
}

// ─── Caret helpers (offset = visible-text index, markers excluded) ───────────

function getCaretOffset(root: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function setCaretOffset(root: HTMLElement, offset: number): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  const sel = window.getSelection();
  if (!sel) return;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
    node = walker.nextNode();
  }
  // Fallback: caret to very end
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const RichTextInput = forwardRef<RichTextInputHandle, Props>(function RichTextInput(
  { value, onChange, onCaret, onKeyDown, placeholder, className, style },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef<string>("");

  // Push external value changes into the DOM (skip when it already matches typed content)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastValue.current) return;
    const savedCaret = document.activeElement === el ? getCaretOffset(el) : null;
    el.innerHTML = toHtml(value);
    lastValue.current = value;
    if (savedCaret !== null) setCaretOffset(el, savedCaret);
  }, [value]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const md = serialize(el);
    lastValue.current = md;
    onChange(md);
    if (onCaret) {
      const off = getCaretOffset(el);
      if (off !== null) onCaret(el.textContent?.slice(0, off) ?? "");
    }
  };

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    getElement: () => editorRef.current,

    applyInline: (type) => {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed || !el.contains(range.commonAncestorContainer)) return;

      const tag = type === "bold" ? "STRONG" : type === "italic" ? "EM" : type === "strike" ? "S" : "CODE";
      const tagClass =
        type === "bold" ? "font-semibold"
        : type === "italic" ? "italic"
        : type === "strike" ? "line-through"
        : "font-mono text-[0.9em] px-1 rounded bg-black/10";

      // Toggle off: if selection sits inside an element of this tag, unwrap it
      let ancestor: Node | null = range.commonAncestorContainer;
      let wrapper: HTMLElement | null = null;
      while (ancestor && ancestor !== el) {
        if (ancestor instanceof HTMLElement && ancestor.tagName === tag) { wrapper = ancestor; break; }
        ancestor = ancestor.parentNode;
      }

      if (wrapper) {
        const parent = wrapper.parentNode;
        if (parent) {
          while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
          parent.removeChild(wrapper);
        }
      } else {
        const wrap = document.createElement(tag.toLowerCase());
        wrap.className = tagClass;
        try {
          wrap.appendChild(range.extractContents());
          range.insertNode(wrap);
          // Collapse caret OUTSIDE the wrapper (after the closing marker) so
          // typing continues in normal text, not inside the format.
          const after = document.createTextNode("​"); // zero-width space anchor
          wrap.parentNode?.insertBefore(after, wrap.nextSibling);
          const r = document.createRange();
          r.setStart(after, 1);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        } catch {
          return;
        }
      }
      el.normalize();
      emitChange();
    },

    insertText: (text) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        el.append(text);
      } else {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      emitChange();
    },

    replaceMention: (name, queryLen) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      // delete the "@query" (queryLen chars + the "@")
      for (let k = 0; k < queryLen + 1; k++) {
        sel.modify("extend", "backward", "character");
      }
      sel.deleteFromDocument();
      const node = document.createTextNode(`@${name} `);
      const r = sel.getRangeAt(0);
      r.insertNode(node);
      r.setStartAfter(node);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      emitChange();
    },

    setValue: (next) => {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = toHtml(next);
      lastValue.current = next;
      onChange(next);
      el.focus();
      setCaretOffset(el, el.textContent?.length ?? 0);
    },
  }), [onChange, onCaret]);

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={emitChange}
      onKeyDown={onKeyDown}
      onKeyUp={() => {
        const el = editorRef.current;
        if (el && onCaret) {
          const off = getCaretOffset(el);
          if (off !== null) onCaret(el.textContent?.slice(0, off) ?? "");
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      className={cn(
        "whitespace-pre-wrap break-words outline-none",
        "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
        className,
      )}
      style={style}
    />
  );
});
