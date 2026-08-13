export const metadata = { title: "Pilih Module" };

export default function SelectModulePage(): React.JSX.Element {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="font-heading text-xl text-foreground">Pilih Module</h1>
      <p className="mt-2 text-muted-foreground">
        Pilih module untuk mulai bekerja. Daftar module segera hadir.
      </p>
    </div>
  );
}
