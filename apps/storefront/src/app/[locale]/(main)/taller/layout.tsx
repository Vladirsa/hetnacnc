import { redirect } from "next/navigation"

import { NavTaller } from "@/components/hetna/taller/NavTaller"
import { retrieveCustomer } from "@/lib/data/customer"

// Todo el cotizador vive detrás de la sesión de cliente de la tienda: las
// rutas /store/cotizador/* exigen authenticate("customer"), así que una
// pantalla sin sesión sólo podría mostrar errores. El guardia va en el layout
// para no repetirlo en cada página.
export default async function TallerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const [cliente, { locale }] = await Promise.all([retrieveCustomer(), params])

  if (!cliente) {
    // El destino lleva el idioma: LoginForm hace router.push con lo que venga
    // en volver, y sin prefijo el navegador da un salto de más por el
    // middleware antes de llegar.
    redirect(`/login?volver=${encodeURIComponent(`/${locale}/taller`)}`)
  }

  return (
    <main className="w-full bg-[#FAF9F6] min-h-[70vh]">
      <NavTaller />
      <div className="px-4 lg:px-16 pb-16">{children}</div>
    </main>
  )
}
