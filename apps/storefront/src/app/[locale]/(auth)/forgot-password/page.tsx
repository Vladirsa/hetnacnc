import { metaEnIdioma } from "@/i18n/servidor"
import { ForgotPasswordForm } from "@/components/molecules/ForgotPasswordForm/ForgotPasswordForm"
import { Metadata } from "next"

const metadataEs: Metadata = {
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

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
