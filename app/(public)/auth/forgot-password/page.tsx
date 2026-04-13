import { ForgotPasswordForm } from "./components/forgot-password-form"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Forgot Password - SWASANA wedding",
  description: "Forgot your password",
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gray-200">
      <div className="w-full max-w-sm bg-white rounded-2xl p-12">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
