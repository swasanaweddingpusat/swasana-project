"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
];

const LANGUAGES = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

export default function ProfileSettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile Settings</h1>
        <p className="text-sm text-muted-foreground">Perbarui informasi profil Anda.</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Informasi Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nama Lengkap</Label>
            <Input
              id="fullName"
              defaultValue={session?.user?.name ?? ""}
              placeholder="Nama lengkap"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              defaultValue={session?.user?.email ?? ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Nomor Telepon</Label>
            <Input id="phoneNumber" placeholder="+62..." />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select defaultValue="Asia/Jakarta">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bahasa</Label>
            <Select defaultValue="id">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full">Simpan Perubahan</Button>
        </CardContent>
      </Card>
    </div>
  );
}
