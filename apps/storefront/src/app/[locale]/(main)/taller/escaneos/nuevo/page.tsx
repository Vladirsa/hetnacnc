import type { Metadata } from "next"

import { SubirEscaneo } from "@/components/hetna/taller/SubirEscaneo"
import { listarEscaneos } from "@/lib/escaneos/acciones"

export const metadata: Metadata = {
  title: "Escanear una pieza — HETNA CNC",
  description: "Sube fotos de una pieza y recibe su archivo 3D.",
}

export default async function TallerEscaneoNuevoPage() {
  // Se pide el listado sólo por el precio, que el backend devuelve ahí para
  // que la pantalla no tenga una copia propia que se desincronice.
  const res = await listarEscaneos({ limite: 1 })
  const creditos = res.ok ? res.datos.creditos_por_escaneo : 5

  return (
    <section className="pt-8">
      <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">
        Escanear una pieza
      </h1>
      <p className="mt-2 text-[15px] text-[#4A4943] max-w-[640px] leading-relaxed">
        El resultado queda guardado en tu perfil. No se manda por correo ni por un link
        que caduca: entras aquí y lo bajas las veces que quieras.
      </p>

      <SubirEscaneo creditosPorEscaneo={creditos} />
    </section>
  )
}
