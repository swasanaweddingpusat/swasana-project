import { ResetPasswordWrapper } from "./components/reset-password-form"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reset Password - SWASANA wedding",
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gray-200">
      <div className="w-full max-w-sm bg-white rounded-2xl p-12">
        <ResetPasswordWrapper />
      </div>
    </div>
  )
}
