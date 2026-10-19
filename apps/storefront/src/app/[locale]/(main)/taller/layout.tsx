import { redirect } from "next/navigation"

import { NavTaller } from "@/components/hetna/taller/NavTaller"
import { retrieveCustomer } from "@/lib/data/customer"

// Todo el cotizador vive detrás de la sesión de cliente de la tienda: las
// rutas /store/cotizador/* exigen authenticate("customer"), así que una
// pantalla sin sesión sólo podría mostrar errores. El guardia va en el layout
// para no repetirlo en cada página.
export default async function TallerLayout({ children }: { children: React.ReactNode }) {
  const cliente = await retrieveCustomer()

  if (!cliente) {
    redirect("/login?volver=/taller")
  }

  return (
    <main className="w-full bg-[#FAF9F6] min-h-[70vh]">
      <NavTaller />
      <div className="px-4 lg:px-16 pb-16">{children}</div>
    </main>
  )
}
