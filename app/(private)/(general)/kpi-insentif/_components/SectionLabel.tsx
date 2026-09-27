export function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
      {text}
    </p>
  );
}
