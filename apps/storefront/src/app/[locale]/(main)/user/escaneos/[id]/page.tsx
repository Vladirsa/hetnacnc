import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ProgresoEscaneo } from "@/components/hetna/escaneos/ProgresoEscaneo"
import { Estudio3D } from "@/components/hetna/estudio3d/Estudio3D"
import { cargarEscaneo } from "@/lib/escaneos/acciones"
import {
  ESTATUS_CLASE,
  ESTATUS_ETIQUETA,
  fechaHora,
  miles,
  MODO_ETIQUETA,
} from "@/lib/escaneos/formato"

const metadataEs: Metadata = {
  title: "Escaneo 3D",
}

export default async function TallerEscaneoDetalle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await cargarEscaneo(id)

  if (!res.ok) {
    if (!res.noAutenticado) notFound()
    return (
      <section className="pt-10 max-w-[620px]">
        <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>No se pudo abrir el escaneo</TS></h1>
        <p className="mt-2 text-[15px] text-[#4A4943]"><TS>{res.mensaje}</TS></p>
      </section>
    )
  }

  const { escaneo: e, descargas } = res.datos
  const enProceso = e.estatus === "pendiente" || e.estatus === "procesando"

  return (
    <section className="pt-8 max-w-[860px]">
      <LocalizedClientLink
        href="/user/escaneos"
        className="text-[14px] font-semibold text-[#6B6A63] hover:text-[#B34D07]"
      >
        <TS>← Escaneos</TS>
      </LocalizedClientLink>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">
          <TS>{e.titulo || "Sin nombre"}</TS>
        </h1>
        <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${ESTATUS_CLASE[e.estatus]}`}>
          <TS>{ESTATUS_ETIQUETA[e.estatus]}</TS>
        </span>
      </div>
      <p className="mt-1.5 text-[14px] text-[#6B6A63]">
        <TS>{MODO_ETIQUETA[e.modo]}</TS> · <TS>{e.n_fotos}</TS> <TS>{e.n_fotos === 1 ? "foto" : "fotos"}</TS> <TS>· pedido</TS><TS>{" "}</TS>
        {fechaHora(e.created_at)}
      </p>

      {enProceso && <ProgresoEscaneo modo={e.modo} desde={e.created_at} />}

      {e.estatus === "fallido" && (
        <div className="mt-6 rounded-[12px] border border-[#E6C4BE] bg-[#FBF0EE] px-4 py-3.5 text-[14px] text-[#9B3225] leading-relaxed">
          <strong><TS>El escaneo no se pudo completar.</TS></strong>
          {e.error ? <span className="block mt-1 font-mono text-[12px]"><TS>{e.error}</TS></span> : null}
          {e.creditos_cobrados > 0 && (
            <span className="block mt-2">
              <TS>Se te devolvieron</TS> <TS>{e.creditos_cobrados}</TS><TS>{" "}</TS>
              <TS>{e.creditos_cobrados === 1 ? "crédito" : "créditos"}</TS>.
            </span>
          )}
        </div>
      )}

      {e.estatus === "listo" && (
        <div className="mt-6">
          <Estudio3D
            titulo={e.titulo || "Escaneo"}
            subtitulo={`${MODO_ETIQUETA[e.modo]} · ${e.n_fotos} ${e.n_fotos === 1 ? "foto" : "fotos"}`}
            urlGlb={descargas.glb ? `/api/escaneos/${e.id}/modelo?formato=glb` : undefined}
            urlStl={!descargas.glb && descargas.stl ? `/api/escaneos/${e.id}/modelo` : undefined}
            escalaReal={!!e.escala_real}
            descargas={[
              ...(descargas.glb ? [{ etiqueta: "Descargar GLB", href: descargas.glb, nota: "Con textura y color" }] : []),
              ...(descargas.stl ? [{ etiqueta: "Descargar STL", href: descargas.stl, nota: "Impresión 3D y CAM" }] : []),
              ...(descargas.obj ? [{ etiqueta: "Descargar OBJ", href: descargas.obj, nota: "Diseño y render" }] : []),
            ]}
            avisos={[
              ...(e.modo === "preview"
                ? [
                    "Modelo con IA hecho con una sola foto: la forma es una reconstrucción, no una medición. El STL sale a 100 mm por su lado más largo; escálalo a tu medida.",
                  ]
                : []),
              ...(e.watertight === false ? ["La malla no cierra por completo: repárala antes de imprimir o maquinar."] : []),
            ]}
          />
          {!descargas.stl && !descargas.glb && (
            <p className="mt-3 text-[14px] text-[#6B6A63]"><TS>Este escaneo no tiene archivo STL para mostrar en 3D.</TS></p>
          )}
        </div>
      )}
    </section>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
