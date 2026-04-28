import { LoginForm } from "./_components/login-form"
import { Metadata } from "next"
import { Suspense } from "react"
import { cn } from "../../../../lib/utils";

export const metadata: Metadata = {
  title: "Login - SWASANA wedding",
  description: "Login to your account",
}

export default function LoginPage() {
  return (
    <div className={cn('bg-muted', 'flex', 'min-h-svh', 'flex-col', 'items-center', 'justify-center', 'p-6', 'md:p-10')}>
      <div className={cn('w-full', 'max-w-sm', 'md:max-w-3xl')}>
        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
