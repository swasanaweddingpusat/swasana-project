import { SettingsNav } from "./_components/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-8 p-6">
      <aside className="w-48 shrink-0">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </h2>
        <SettingsNav />
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
