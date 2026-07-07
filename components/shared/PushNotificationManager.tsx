"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff } from "@solar-icons/react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

interface PushNotificationManagerProps {
  onClose?: () => void;
}

export function PushNotificationManager({ onClose }: PushNotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Browser tidak mendukung push notification");
      return;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Izin notifikasi ditolak");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error("Push notification belum dikonfigurasi");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            auth: subJson.keys?.auth,
            p256dh: subJson.keys?.p256dh,
          },
        }),
      });

      if (!res.ok) throw new Error("Subscribe failed");
      setIsSubscribed(true);
      toast.success("Push notification aktif");
    } catch {
      toast.error("Gagal mengaktifkan push notification");
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success("Push notification dinonaktifkan");
    } catch {
      toast.error("Gagal menonaktifkan push notification");
    } finally {
      setLoading(false);
    }
  }, []);

  if (!supported) return null;

  if (permission === "denied") {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground opacity-50"
      >
        <BellOff weight="BoldDuotone" className="h-3.5 w-3.5" />
        Notifikasi diblokir browser
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        if (isSubscribed) {
          await unsubscribe();
        } else {
          await subscribe();
        }
        onClose?.();
      }}
      className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-primary hover:text-primary/80 hover:bg-accent transition-colors cursor-pointer"
    >
      {isSubscribed ? (
        <>
          <BellOff weight="BoldDuotone" className="h-3.5 w-3.5" />
          {loading ? "Menonaktifkan..." : "Nonaktifkan push notification"}
        </>
      ) : (
        <>
          <Bell weight="BoldDuotone" className="h-3.5 w-3.5" />
          {loading ? "Mengaktifkan..." : "Aktifkan push notification"}
        </>
      )}
    </button>
  );
}
