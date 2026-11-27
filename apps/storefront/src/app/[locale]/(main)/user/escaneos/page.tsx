import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarEscaneos } from "@/lib/escaneos/acciones"
import { ESTATUS_CLASE, ESTATUS_ETIQUETA, fechaHora, MODO_ETIQUETA } from "@/lib/escaneos/formato"

const metadataEs: Metadata = {
  title: "Escaneos 3D",
  description: "Tus piezas escaneadas, con sus archivos listos para descargar.",
}

export default async function TallerEscaneosPage() {
  const res = await listarEscaneos({ limite: 100 })

  if (!res.ok) {
    return (
      <section className="pt-10 max-w-[620px]">
        <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>No se pudieron cargar tus escaneos</TS></h1>
        <p className="mt-2 text-[15px] text-[#4A4943]"><TS>{res.mensaje}</TS></p>
      </section>
    )
  }

  const { escaneos, count } = res.datos

  return (
    <section className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight"><TS>Escaneos 3D</TS></h1>
          <p className="mt-1.5 text-[14px] text-[#6B6A63]">
            <TS>{count === 0
              ? "Convierte una pieza física en un archivo para fabricar."
              : `${count} ${count === 1 ? "escaneo" : "escaneos"} · se quedan aquí, los bajas cuando quieras`}</TS>
          </p>
        </div>
        <LocalizedClientLink
          href="/disenar/imagen-a-3d"
          className="inline-flex bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
        >
          <TS>Escanear una pieza</TS>
        </LocalizedClientLink>
      </div>

      {escaneos.length === 0 ? (
        <div className="mt-8 max-w-[640px] rounded-[14px] border border-[#E7E4DC] bg-white p-6">
          <h2 className="text-[17px] font-bold text-[#1B1B18]"><TS>Dos caminos</TS></h2>
          <p className="mt-3 text-[15px] text-[#4A4943] leading-relaxed">
            <strong><TS>La vista previa</TS></strong> <TS>parte de una sola foto y es gratis. Una IA
            adivina la forma: sirve para enseñarle algo a un cliente, no para fabricar.</TS>
          </p>
          <p className="mt-3 text-[15px] text-[#4A4943] leading-relaxed">
            <strong><TS>El escaneo profesional</TS></strong> <TS>parte de muchas fotos y mide la
            geometría real de la pieza. Ese sí entrega un archivo para maquinar, y
            consume créditos.</TS>
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2.5">
          {escaneos.map((e) => (
            <li key={e.id}>
              <LocalizedClientLink
                href={`/user/escaneos/${e.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3.5 hover:border-[#C2560A] transition-colors"
              >
                <span className="flex-1 min-w-[180px]">
                  <span className="block text-[15px] font-semibold text-[#1B1B18]">
                    <TS>{e.titulo || "Sin nombre"}</TS>
                  </span>
                  <span className="block text-[13px] text-[#6B6A63]">
                    <TS>{MODO_ETIQUETA[e.modo]}</TS> · <TS>{e.n_fotos}</TS> <TS>{e.n_fotos === 1 ? "foto" : "fotos"}</TS>
                  </span>
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${ESTATUS_CLASE[e.estatus]}`}>
                  <TS>{ESTATUS_ETIQUETA[e.estatus]}</TS>
                </span>
                <span className="text-[13px] text-[#6B6A63] w-[130px]">{fechaHora(e.created_at)}</span>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
