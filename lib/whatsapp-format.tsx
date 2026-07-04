import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Public types ─────────────────────────────────────────────────────────────

export type FormatType = "bold" | "italic" | "strike" | "mono" | "bullet" | "numbered" | "quote";

export interface FormatResult {
  text: string;
  selStart: number;
  selEnd: number;
}

// ─── applyFormat ──────────────────────────────────────────────────────────────

/**
 * Pure function: apply (or toggle) a WhatsApp-style format to the text.
 * Inline (bold/italic/strike/mono): wraps the selected range with markers.
 * Line-prefix (bullet/numbered/quote): prefixes each affected line.
 * Toggle: if the selection is already wrapped/prefixed, removes the format.
 */
export function applyFormat(
  text: string,
  selStart: number,
  selEnd: number,
  type: FormatType,
): FormatResult {
  if (
    type === "bold" ||
    type === "italic" ||
    type === "strike" ||
    type === "mono"
  ) {
    return applyInlineFormat(text, selStart, selEnd, type);
  }
  return applyLinePrefix(text, selStart, selEnd, type);
}

// ─── Inline format helper ─────────────────────────────────────────────────────

const INLINE_MARKERS: Record<"bold" | "italic" | "strike" | "mono", string> = {
  bold: "*",
  italic: "_",
  strike: "~",
  mono: "```",
};

function applyInlineFormat(
  text: string,
  selStart: number,
  selEnd: number,
  type: "bold" | "italic" | "strike" | "mono",
): FormatResult {
  const marker = INLINE_MARKERS[type];
  const mLen = marker.length;

  // Caret only — insert empty pair and place caret between them
  if (selStart === selEnd) {
    const newText = text.slice(0, selStart) + marker + marker + text.slice(selStart);
    return { text: newText, selStart: selStart + mLen, selEnd: selStart + mLen };
  }

  // Trim whitespace inside the selection so markers hug the text (no "*bro *")
  const rawSel = text.slice(selStart, selEnd);
  const leadWs = rawSel.length - rawSel.trimStart().length;
  const trailWs = rawSel.length - rawSel.trimEnd().length;
  if ((leadWs > 0 || trailWs > 0) && rawSel.trim().length > 0) {
    selStart += leadWs;
    selEnd -= trailWs;
  }

  // Toggle: check if markers already surround the selection (outside the selection range)
  const hasBefore = selStart >= mLen && text.slice(selStart - mLen, selStart) === marker;
  const hasAfter =
    selEnd + mLen <= text.length && text.slice(selEnd, selEnd + mLen) === marker;

  if (hasBefore && hasAfter) {
    // Unwrap: remove markers from outside
    const newText =
      text.slice(0, selStart - mLen) +
      text.slice(selStart, selEnd) +
      text.slice(selEnd + mLen);
    return {
      text: newText,
      selStart: selStart - mLen,
      selEnd: selEnd - mLen,
    };
  }

  // Wrap
  const newText =
    text.slice(0, selStart) + marker + text.slice(selStart, selEnd) + marker + text.slice(selEnd);
  return {
    text: newText,
    selStart: selStart + mLen,
    selEnd: selEnd + mLen,
  };
}

// ─── Line-prefix format helper ────────────────────────────────────────────────

function applyLinePrefix(
  text: string,
  selStart: number,
  selEnd: number,
  type: "bullet" | "numbered" | "quote",
): FormatResult {
  const lines = text.split("\n");

  // Build per-line character ranges (start inclusive, end exclusive of \n)
  const lineRanges: { start: number; end: number }[] = [];
  let pos = 0;
  for (const line of lines) {
    lineRanges.push({ start: pos, end: pos + line.length });
    pos += line.length + 1; // +1 for \n
  }

  // Find which lines are "touched" by the selection
  const affectedIndices: number[] = [];
  for (let i = 0; i < lineRanges.length; i++) {
    const { start, end } = lineRanges[i];
    if (selStart === selEnd) {
      // Caret: affect only the line containing the caret
      if (selStart >= start && selStart <= end) {
        affectedIndices.push(i);
      }
    } else {
      // Range: any line that overlaps [selStart, selEnd]
      if (end >= selStart && start <= selEnd) {
        affectedIndices.push(i);
      }
    }
  }

  if (affectedIndices.length === 0) {
    return { text, selStart, selEnd };
  }

  const affectedSet = new Set(affectedIndices);

  // Toggle detection: all affected lines already have this prefix → remove
  const allHavePrefix = affectedIndices.every((i) => {
    const line = lines[i];
    if (type === "bullet") return line.startsWith("- ");
    if (type === "quote") return line.startsWith("> ");
    return /^\d+\.\s/.test(line);
  });

  let orderedCount = 0;
  const newLines = lines.map((line, i) => {
    if (!affectedSet.has(i)) return line;

    if (allHavePrefix) {
      // Remove prefix
      if (type === "bullet") return line.startsWith("- ") ? line.slice(2) : line;
      if (type === "quote") return line.startsWith("> ") ? line.slice(2) : line;
      // numbered
      return line.replace(/^\d+\.\s/, "");
    }

    // Add prefix
    if (type === "bullet") {
      return line.startsWith("- ") ? line : "- " + line;
    }
    if (type === "quote") {
      return line.startsWith("> ") ? line : "> " + line;
    }
    // numbered: strip existing number if any, then renumber
    orderedCount++;
    const stripped = line.replace(/^\d+\.\s/, "");
    return `${orderedCount}. ${stripped}`;
  });

  const newText = newLines.join("\n");

  // Rebuild line ranges for new text to compute result selection
  const newLineRanges: { start: number; end: number }[] = [];
  let newPos = 0;
  for (const l of newLines) {
    newLineRanges.push({ start: newPos, end: newPos + l.length });
    newPos += l.length + 1;
  }

  const firstIdx = affectedIndices[0];
  const lastIdx = affectedIndices[affectedIndices.length - 1];

  return {
    text: newText,
    selStart: newLineRanges[firstIdx].start,
    selEnd: Math.min(newLineRanges[lastIdx].end, newText.length),
  };
}

// ─── renderWhatsappContent ────────────────────────────────────────────────────

type LineGroup =
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "quote"; items: string[] }
  | { type: "plain"; lines: string[] };

/**
 * Parse WhatsApp-style formatting markers in `content` and return React nodes.
 * Supports: *bold*, _italic_, ~strike~, ```mono```, - bullet, 1. numbered, > quote, @mention.
 * Robust: unclosed markers render as plain text, no crash on malformed input.
 */
export function renderWhatsappContent(
  content: string,
  isSelf: boolean,
  renderMention?: (name: string, key: string) => ReactNode,
): ReactNode {
  if (!content) return null;

  // Built-in mention fallback (replicates existing renderContent logic)
  const mentionFallback = (name: string, key: string): ReactNode => (
    <span
      key={key}
      className={cn(
        "font-semibold rounded px-0.5",
        isSelf ? "text-primary-foreground/80 underline" : "text-primary",
      )}
    >
      {name}
    </span>
  );

  const resolveMention = renderMention ?? mentionFallback;

  const rawLines = content.split("\n");

  // Group consecutive lines of the same type
  const groups: LineGroup[] = [];
  for (const line of rawLines) {
    if (line.startsWith("- ")) {
      const last = groups[groups.length - 1];
      if (last?.type === "bullet") {
        last.items.push(line.slice(2));
      } else {
        groups.push({ type: "bullet", items: [line.slice(2)] });
      }
    } else if (/^\d+\.\s/.test(line)) {
      const last = groups[groups.length - 1];
      const item = line.replace(/^\d+\.\s/, "");
      if (last?.type === "numbered") {
        last.items.push(item);
      } else {
        groups.push({ type: "numbered", items: [item] });
      }
    } else if (line.startsWith("> ")) {
      const last = groups[groups.length - 1];
      if (last?.type === "quote") {
        last.items.push(line.slice(2));
      } else {
        groups.push({ type: "quote", items: [line.slice(2)] });
      }
    } else {
      const last = groups[groups.length - 1];
      if (last?.type === "plain") {
        last.lines.push(line);
      } else {
        groups.push({ type: "plain", lines: [line] });
      }
    }
  }

  return (
    <>
      {groups.map((group, gi) => {
        if (group.type === "bullet") {
          return (
            <ul key={gi} className="list-none pl-0 my-0.5 space-y-0.5">
              {group.items.map((item, ii) => (
                <li key={ii} className="flex items-start gap-1.5">
                  <span
                    className="mt-[0.45em] shrink-0 inline-block w-1 h-1 rounded-full bg-current opacity-60"
                    aria-hidden="true"
                  />
                  <span>{renderInline(item, `g${gi}i${ii}`, isSelf, resolveMention)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (group.type === "numbered") {
          return (
            <ol key={gi} className="list-none pl-0 my-0.5 space-y-0.5">
              {group.items.map((item, ii) => (
                <li key={ii} className="flex items-start gap-1.5">
                  <span className="shrink-0 font-mono text-xs opacity-60 min-w-5 text-right">
                    {ii + 1}.
                  </span>
                  <span>{renderInline(item, `g${gi}n${ii}`, isSelf, resolveMention)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (group.type === "quote") {
          return (
            <div
              key={gi}
              className={cn(
                "my-0.5 pl-2.5 border-l-2 italic text-[0.9em] opacity-85",
                isSelf ? "border-primary-foreground/40" : "border-muted-foreground/40",
              )}
            >
              {group.items.map((item, ii) => (
                <div key={ii}>{renderInline(item, `g${gi}q${ii}`, isSelf, resolveMention)}</div>
              ))}
            </div>
          );
        }

        // plain group: consecutive non-special lines separated by <br />
        return (
          <span key={gi}>
            {group.lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {renderInline(line, `g${gi}l${li}`, isSelf, resolveMention)}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

// ─── Internal inline tokenizer ────────────────────────────────────────────────

/**
 * Scan a single line for WhatsApp inline markers and mention tokens.
 * Produces React nodes (spans, strong, em, code).
 * Unclosed markers are treated as plain text — no crash.
 */
function renderInline(
  text: string,
  keyBase: string,
  isSelf: boolean,
  resolveMention: (name: string, key: string) => ReactNode,
): ReactNode {
  const nodes: ReactNode[] = [];
  let i = 0;
  let buf = "";
  let nodeIdx = 0;

  const nextKey = () => `${keyBase}-${nodeIdx++}`;

  // Flush accumulated plain text, splitting on @mention tokens
  const flushBuf = () => {
    if (!buf) return;
    const saved = buf;
    buf = "";
    const parts = saved.split(/(@\w+(?:\s\w+)?)/g);
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      if (!part) continue;
      const key = nextKey();
      if (part.startsWith("@")) {
        nodes.push(resolveMention(part, key));
      } else {
        nodes.push(<span key={key}>{part}</span>);
      }
    }
  };

  while (i < text.length) {
    // Triple backtick → monospace/code (no nesting, no mention parsing inside)
    if (text.slice(i, i + 3) === "```") {
      flushBuf();
      const end = text.indexOf("```", i + 3);
      if (end !== -1) {
        nodes.push(
          <code
            key={nextKey()}
            className={cn(
              "font-mono text-xs px-1 py-0.5 rounded",
              isSelf ? "bg-white/20" : "bg-black/10",
            )}
          >
            {text.slice(i + 3, end)}
          </code>,
        );
        i = end + 3;
      } else {
        // Unclosed triple backtick — treat as plain
        buf += "`";
        i++;
      }
      continue;
    }

    // Bold: *content*
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && end > i + 1) {
        flushBuf();
        const inner = text.slice(i + 1, end);
        nodes.push(
          <strong key={nextKey()} className="font-semibold">
            {renderInlineSimple(inner, nextKey(), isSelf, resolveMention)}
          </strong>,
        );
        i = end + 1;
        continue;
      }
    }

    // Italic: _content_
    if (text[i] === "_") {
      const end = text.indexOf("_", i + 1);
      if (end !== -1 && end > i + 1) {
        flushBuf();
        const inner = text.slice(i + 1, end);
        nodes.push(
          <em key={nextKey()} className="italic">
            {renderInlineSimple(inner, nextKey(), isSelf, resolveMention)}
          </em>,
        );
        i = end + 1;
        continue;
      }
    }

    // Strikethrough: ~content~
    if (text[i] === "~") {
      const end = text.indexOf("~", i + 1);
      if (end !== -1 && end > i + 1) {
        flushBuf();
        const inner = text.slice(i + 1, end);
        nodes.push(
          <span key={nextKey()} className="line-through">
            {renderInlineSimple(inner, nextKey(), isSelf, resolveMention)}
          </span>,
        );
        i = end + 1;
        continue;
      }
    }

    buf += text[i];
    i++;
  }

  flushBuf();

  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  return nodes;
}

/**
 * Simple inline renderer for content inside bold/italic/strike spans.
 * Handles mentions only — no further nested format markers (WhatsApp behavior).
 */
function renderInlineSimple(
  text: string,
  keyBase: string,
  isSelf: boolean,
  resolveMention: (name: string, key: string) => ReactNode,
): ReactNode {
  const parts = text.split(/(@\w+(?:\s\w+)?)/g);
  const nodes: ReactNode[] = [];
  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    if (!part) continue;
    const key = `${keyBase}-${pi}`;
    if (part.startsWith("@")) {
      nodes.push(resolveMention(part, key));
    } else {
      nodes.push(<span key={key}>{part}</span>);
    }
  }
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  return nodes;
}
