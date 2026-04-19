import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PdfConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">PDF Configuration</h1>
        <p className="text-sm text-muted-foreground">Konfigurasi template PDF.</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">PDF Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Segera hadir.</p>
        </CardContent>
      </Card>
    </div>
  );
}
