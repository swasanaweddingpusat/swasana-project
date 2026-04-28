import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { VerifyForm } from "./_components/verify-form"
import { Metadata } from "next"
import { cn } from "../../../../lib/utils";

export const metadata: Metadata = {
  title: "Verifikasi Email - SWASANA wedding",
}

export default function VerifyEmailPage() {
  return (
    <div className={cn('flex', 'min-h-svh', 'w-full', 'items-center', 'justify-center', 'p-6', 'md:p-10', 'bg-gray-200')}>
      <Suspense
        fallback={
          <div className={cn('flex', 'flex-col', 'items-center', 'gap-3')}>
            <Loader2 className={cn('h-8', 'w-8', 'animate-spin', 'text-blue-600')} />
            <p className="text-muted-foreground">Memuat...</p>
          </div>
        }
      >
        <VerifyForm />
      </Suspense>
    </div>
  )
}
