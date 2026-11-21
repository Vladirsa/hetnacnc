import type { Metadata } from "next"

import { FormEmpresa } from "@/components/hetna/cuenta/FormEmpresa"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { miEmpresa, miEquipo } from "@/lib/cotizar/solicitud-taller"
import { EquipoEmpresa } from "@/components/hetna/cuenta/EquipoEmpresa"

// Mi empresa (estrategia 2.4): datos de facturación que viajan con cada
// solicitud cuando el cliente marca "Necesito factura". Gratis para todos.
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Mi empresa y facturación", robots: { index: false, follow: false } }

export default async function MiEmpresaPage() {
  const [{ sesion, empresa }, { equipo }] = await Promise.all([miEmpresa(), miEquipo()])
  if (!sesion) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]">Entra a tu cuenta</h1>
          <LocalizedClientLink href="/login" className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white">
            Iniciar sesión
          </LocalizedClientLink>
        </div>
      </main>
    )
  }
  return (
    <main className="container">
      <div className="mx-auto max-w-[640px] py-10">
        <h1 className="text-[26px] font-bold text-[#1B1B18]">Mi empresa y facturación</h1>
        <p className="mb-6 mt-1 text-[15px] text-[#4A4943]">
          Guárdalos una vez: al pedir una pieza marca “Necesito factura” y el taller recibe tu razón social, RFC y uso de CFDI. También puedes poner tu número de
          orden de compra en cada solicitud.
        </p>
        <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
          <FormEmpresa inicial={empresa} />
        </div>
        <h2 className="mt-8 text-[20px] font-bold text-[#1B1B18]">Mi equipo</h2>
        <div className="mt-3 rounded-[14px] border border-[#E7E4DC] bg-white p-5">
          <EquipoEmpresa equipo={equipo} />
        </div>
        <p className="mt-4 text-sm">
          <LocalizedClientLink href="/user/piezas" className="font-semibold text-[#C2560A] hover:underline">Ver mis piezas para repetir pedido →</LocalizedClientLink>
        </p>
      </div>
    </main>
  )
}
