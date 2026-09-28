import { ForgotPasswordForm } from "@/components/molecules/ForgotPasswordForm/ForgotPasswordForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Olvidé mi contraseña",
  description: "Crea una nueva contraseña",
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {

  return (
    <main className="container">
      <ForgotPasswordForm />
    </main>
  )
}
