import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ProgresoEscaneo } from "@/components/hetna/escaneos/ProgresoEscaneo"
import { cargarEscaneo } from "@/lib/escaneos/acciones"
import {
  ESTATUS_CLASE,
  ESTATUS_ETIQUETA,
  fechaHora,
  miles,
  MODO_ETIQUETA,
} from "@/lib/escaneos/formato"

export const metadata: Metadata = {
  title: "Escaneo 3D — HETNA CNC",
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
        <h1 className="text-[24px] font-bold text-[#1B1B18]">No se pudo abrir el escaneo</h1>
        <p className="mt-2 text-[15px] text-[#4A4943]">{res.mensaje}</p>
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
        ← Escaneos
      </LocalizedClientLink>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">
          {e.titulo || "Sin nombre"}
        </h1>
        <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${ESTATUS_CLASE[e.estatus]}`}>
          {ESTATUS_ETIQUETA[e.estatus]}
        </span>
      </div>
      <p className="mt-1.5 text-[14px] text-[#6B6A63]">
        {MODO_ETIQUETA[e.modo]} · {e.n_fotos} {e.n_fotos === 1 ? "foto" : "fotos"} · pedido{" "}
        {fechaHora(e.created_at)}
      </p>

      {enProceso && <ProgresoEscaneo modo={e.modo} desde={e.created_at} />}

      {e.estatus === "fallido" && (
        <div className="mt-6 rounded-[12px] border border-[#E6C4BE] bg-[#FBF0EE] px-4 py-3.5 text-[14px] text-[#9B3225] leading-relaxed">
          <strong>El escaneo no se pudo completar.</strong>
          {e.error ? <span className="block mt-1 font-mono text-[12px]">{e.error}</span> : null}
          {e.creditos_cobrados > 0 && (
            <span className="block mt-2">
              Se te devolvieron {e.creditos_cobrados}{" "}
              {e.creditos_cobrados === 1 ? "crédito" : "créditos"}.
            </span>
          )}
        </div>
      )}

      {e.estatus === "listo" && (
        <>
          <div className="mt-6 flex flex-wrap gap-3">
            {descargas.stl && (
              <a
                href={descargas.stl}
                className="inline-flex bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
              >
                Descargar STL
              </a>
            )}
            {descargas.obj && (
              <a
                href={descargas.obj}
                className="inline-flex border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18] font-semibold px-5 py-3 rounded-[10px] text-[15px]"
              >
                Descargar OBJ
              </a>
            )}
          </div>

          {e.modo === "preview" && (
            <p className="mt-4 text-[14px] text-[#6B5A2E] bg-[#FBF5E9] border border-[#E2D3B8] rounded-[12px] px-4 py-3.5 leading-relaxed">
              Esto es una vista previa: la forma la adivinó una IA a partir de una sola
              foto, no se midió la pieza. Sirve para enseñarla, no para fabricarla. Para un
              archivo con medidas reales hace falta el escaneo profesional.
            </p>
          )}

          {e.watertight === false && (
            <p className="mt-4 text-[14px] text-[#6B5A2E] bg-[#FBF5E9] border border-[#E2D3B8] rounded-[12px] px-4 py-3.5 leading-relaxed">
              La malla no cierra por completo. Se puede ver y medir, pero necesita
              reparación antes de mandarla a maquinar o a imprimir.
            </p>
          )}

          <h2 className="mt-8 text-[18px] font-bold text-[#1B1B18]">La malla</h2>
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Dato termino="Vértices" valor={miles(e.vertices)} />
            <Dato termino="Caras" valor={miles(e.caras)} />
            <Dato termino="Cierra" valor={e.watertight === null ? "—" : e.watertight ? "Sí" : "No"} />
            <Dato
              termino={e.escala_real ? "Medidas (mm)" : "Proporciones"}
              valor={e.bounding_box?.length ? e.bounding_box.map((n) => Number(n).toFixed(e.escala_real ? 1 : 2)).join(" × ") : "—"}
              nota={
                e.escala_real
                  ? `Escalado a ${Number(e.medida_mm).toLocaleString("es-MX")} mm en el lado más largo, la medida que capturaste.`
                  : "Sin unidad: la malla no está a escala real."
              }
            />
          </dl>
        </>
      )}
    </section>
  )
}

const Dato = ({ termino, valor, nota }: { termino: string; valor: string; nota?: string }) => (
  <div>
    <dt className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6A63]">{termino}</dt>
    <dd className="mt-0.5 text-[16px] font-bold text-[#1B1B18] tabular-nums">{valor}</dd>
    {nota && <p className="mt-0.5 text-[11px] text-[#6B6A63] leading-snug">{nota}</p>}
  </div>
)
