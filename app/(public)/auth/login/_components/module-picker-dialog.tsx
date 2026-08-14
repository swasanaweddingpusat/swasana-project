"use client"

import { useRouter } from "next/navigation"
import { Wallet, UsersGroupRounded, TicketSale, CartLarge, Widget } from "@solar-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { AccessibleModule } from "@/lib/queries/modules"

const ICONS: Record<string, typeof Widget> = {
  Wallet,
  UsersGroupRounded,
  TicketSale,
  CartLarge,
}

export function ModulePickerDialog({
  modules,
  open,
}: {
  modules: AccessibleModule[]
  open: boolean
}) {
  const router = useRouter()

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg"
      >
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-heading text-xl">Pilih Module</DialogTitle>
          <DialogDescription>Pilih area kerja yang ingin Anda buka.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {modules.map((m) => {
            const Icon = ICONS[m.icon ?? ""] ?? Widget
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => router.push(`/${m.key}/overview`)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm",
                  "transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  "cursor-pointer",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <Icon weight="BoldDuotone" className="size-6 text-foreground" />
                </span>
                <span className="font-medium text-foreground">{m.name}</span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
