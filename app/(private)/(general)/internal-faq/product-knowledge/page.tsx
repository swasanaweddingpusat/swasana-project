import type { Metadata } from "next";

export const metadata: Metadata = { title: "Product Knowledge — Internal FAQ" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Product Knowledge</h1>
        <p className="text-sm text-muted-foreground">Kelola dokumen product knowledge</p>
      </div>
      <div className="flex items-center justify-center min-h-60 rounded-2xl border bg-card shadow-sm">
        <p className="text-muted-foreground text-sm">Coming soon</p>
      </div>
    </div>
  );
}
