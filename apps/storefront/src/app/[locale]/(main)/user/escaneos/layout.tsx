import { redirect } from "next/navigation"

import { UserNavigation } from "@/components/molecules"
import { retrieveCustomer } from "@/lib/data/customer"

// Escaneos 3D dentro de "Mi cuenta" (antes vivían en /taller/escaneos, que se
// quitó). Los escaneos se pagan con créditos de la cuenta, así que piden
// sesión: sin ella el backend sólo devolvería errores.
export default async function EscaneosLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const [cliente, { locale }] = await Promise.all([retrieveCustomer(), params])
  if (!cliente) redirect(`/login?volver=${encodeURIComponent(`/${locale}/user/escaneos`)}`)

  return (
    <main className="container pb-16">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="min-w-0 md:col-span-3">{children}</div>
      </div>
    </main>
  )
}
