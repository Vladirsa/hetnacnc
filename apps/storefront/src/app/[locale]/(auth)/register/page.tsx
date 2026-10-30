import { RegisterForm } from "@/components/molecules/RegisterForm/RegisterForm"
import { retrieveCustomer } from "@/lib/data/customer"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Crear cuenta",
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ volver?: string }> }

export default async function Pagina({ searchParams }: Props) {
  const user = await retrieveCustomer()
  const { volver } = await searchParams

  if (user) {
    // HETNA: si ya tiene sesion, regresa a donde iba (p. ej. el Cotizador CNC)
    redirect(volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : "/user")
  }

  return <RegisterForm />
}
