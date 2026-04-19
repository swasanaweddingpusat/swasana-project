"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export default function AccountSettingsPage() {
  const [show, setShow] = useState({ current: false, new: false, confirm: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Ganti password akun Anda.</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Ganti Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["current", "new", "confirm"] as const).map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>
                {key === "current"
                  ? "Password Saat Ini"
                  : key === "new"
                  ? "Password Baru"
                  : "Konfirmasi Password Baru"}
              </Label>
              <div className="relative">
                <Input
                  id={key}
                  type={show[key] ? "text" : "password"}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                >
                  {show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
          <Button className="w-full">Ganti Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}
