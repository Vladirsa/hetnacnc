import { metaEnIdioma } from "@/i18n/servidor"
import { RegisterForm } from "@/components/molecules/RegisterForm/RegisterForm"
import { destinoSeguro } from "@/lib/seguridad/destino-seguro"
import { retrieveCustomer } from "@/lib/data/customer"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

const metadataEs: Metadata = {
  title: "Crear cuenta",
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ volver?: string }> }

export default async function Pagina({ searchParams }: Props) {
  const user = await retrieveCustomer()
  const { volver } = await searchParams

  if (user) {
    // HETNA: si ya tiene sesion, regresa a donde iba (p. ej. el Cotizador CNC)
    redirect(destinoSeguro(volver, "/user"))
  }

  return <RegisterForm />
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
