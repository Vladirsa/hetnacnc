import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FormNuevaCotizacion } from "@/components/hetna/taller/FormNuevaCotizacion"
import { cargarPerfil } from "@/lib/cotizador/acciones"
import { frasePlan, PLAN_ETIQUETA } from "@/lib/cotizador/formato"

export const metadata: Metadata = {
  title: "Nueva cotización — HETNA CNC",
  description: "Arma una cotización formal con partidas, condiciones y totales.",
}

export default async function TallerNuevaCotizacionPage() {
  const res = await cargarPerfil()

  if (!res.ok) {
    return (
      <section className="pt-10 max-w-[620px]">
        <h1 className="text-[24px] font-bold text-[#1B1B18]">No se pudo abrir el formulario</h1>
        <p className="mt-2 text-[15px] text-[#4A4943]">{res.mensaje}</p>
      </section>
    )
  }

  // El backend rechaza cotizar sin perfil (el folio sale del consecutivo del
  // taller), así que no tiene caso mostrar el formulario: va al alta.
  if (!res.datos.perfil) {
    redirect("/taller/perfil")
  }

  const { perfil, plan } = res.datos

  return (
    <section className="pt-8">
      <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">Nueva cotización</h1>
      {plan && (
        <p className="mt-1.5 text-[14px] text-[#6B6A63]">
          Plan {PLAN_ETIQUETA[plan.plan]} · {frasePlan(plan)}
        </p>
      )}

      <FormNuevaCotizacion
        moneda={perfil.moneda || "MXN"}
        ivaPct={Number(perfil.iva_pct) || 16}
        condicionesPago={perfil.condiciones_pago_default || ""}
        diasEntrega={perfil.dias_entrega_default ? String(perfil.dias_entrega_default) : ""}
      />
    </section>
  )
}
