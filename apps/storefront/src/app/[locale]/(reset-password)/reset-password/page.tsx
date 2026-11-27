import { metaEnIdioma } from "@/i18n/servidor"
import { Card } from "@/components/atoms/Card/Card"
import { ProfilePasswordForm } from "@/components/molecules/ProfilePasswordForm/ProfilePasswordForm"
import type { Metadata } from "next"

const metadataEs: Metadata = {
  title: "Restablecer contraseña",
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token: string }>
}) {
  const { token } = await searchParams

  return (
    <main className="container flex justify-center py-16">
      <Card className="w-full max-w-lg">
        <ProfilePasswordForm token={token} />
      </Card>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
