// Expediente digital de fabricación: el historial completo de un proyecto en
// una sola página (datos técnicos, archivos, propuesta, responsables, línea de
// tiempo y entrega). Lo abre el cliente desde su liga o el taller elegido desde
// su panel. Se imprime o se guarda como PDF desde el navegador.
// Backend: packages/api/src/lib/expediente.ts
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Imprimir } from "@/components/hetna/expediente/Imprimir"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { verExpediente } from "@/lib/cotizar/expediente"

export const dynamic = "force-dynamic"

const metadataEs: Metadata = {
  title: "Expediente del proyecto",
  robots: { index: false, follow: false },
}

const fecha = (s: string | null | undefined, conHora = true) =>
  s
    ? new Date(s).toLocaleString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "America/Mexico_City",
      })
    : "—"
const pesos = (n: number, moneda = "MXN") => n.toLocaleString("es-MX", { style: "currency", currency: moneda })
const peso = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

const ICONO: Record<string, string> = {
  solicitud: "📝",
  etapa: "📍",
  nota: "💬",
  pago: "💳",
  mensaje: "✉️",
  pregunta: "❓",
  descarga: "⬇️",
  contrato: "📄",
  firma: "✍️",
  resena: "⭐",
  disputa: "⚠️",
}

const TRABAJO: [string, string][] = [
  ["servicio", "Proceso"],
  ["material", "Material"],
  ["cantidad", "Cantidad"],
  ["medidas", "Medidas"],
  ["tolerancia", "Tolerancia"],
  ["acabado", "Acabado"],
  ["para", "Para cuándo"],
]

export default async function PaginaExpediente({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params
  const e = await verExpediente(clave)
  if (!e) notFound()

  return (
    <main className="mx-auto w-full max-w-[960px] px-4 pb-16 pt-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]"><TS>Expediente digital de fabricación</TS></p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#142033]"><TS>Proyecto</TS> <TS>{e.folio}</TS></h1>
          <p className="mt-1 text-sm text-[#6B675C]">
            <TS>{e.etapa_nombre}</TS> <TS>· creado el</TS> {fecha(e.creada, false)} · <TS>{e.visor === "taller" ? "vista del taller" : "vista del cliente"}</TS>
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {e.visor === "cliente" && (
            <LocalizedClientLink href={`/cotizar/propuestas/${clave}`} className="rounded-xl border border-[#E7E4DC] px-4 py-2 text-sm font-semibold text-[#142033]">
              <TS>Volver a mi solicitud</TS>
            </LocalizedClientLink>
          )}
          <Imprimir />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4 md:col-span-2">
          <h2 className="text-base font-extrabold text-[#142033]"><TS>El trabajo</TS></h2>
          {e.trabajo.descripcion && <p className="mt-2 whitespace-pre-line text-sm text-[#40403A]"><TS>{e.trabajo.descripcion}</TS></p>}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {TRABAJO.filter(([k]) => e.trabajo[k]).map(([k, l]) => (
              <div key={k}>
                <dt className="text-[#6B675C]"><TS>{l}</TS></dt>
                <dd className="font-semibold text-[#142033]"><TS>{e.trabajo[k]}</TS></dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
          <h2 className="text-base font-extrabold text-[#142033]"><TS>Responsables</TS></h2>
          <dl className="mt-2 grid gap-2 text-sm">
            <div>
              <dt className="text-[#6B675C]"><TS>Cliente</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{e.responsables.cliente}</TS></dd>
            </div>
            <div>
              <dt className="text-[#6B675C]"><TS>Taller</TS></dt>
              <dd className="font-semibold text-[#142033]">
                <TS>{e.responsables.taller ? (
                  <LocalizedClientLink href={`/talleres/${e.responsables.taller.handle}`} className="hover:text-[#C2560A]">
                    <TS>{e.responsables.taller.nombre}</TS>
                  </LocalizedClientLink>
                ) : (
                  "Sin elegir todavía"
                )}</TS>
              </dd>
            </div>
            <div>
              <dt className="text-[#6B675C]"><TS>Plataforma</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{e.responsables.plataforma}</TS></dd>
            </div>
          </dl>
        </section>
      </div>

      {e.propuesta && (
        <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4">
          <h2 className="text-base font-extrabold text-[#142033]"><TS>Propuesta acordada</TS></h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[#6B675C]"><TS>Precio</TS></dt>
              <dd className="font-semibold text-[#142033]">{pesos(e.propuesta.precio, e.propuesta.moneda)}</dd>
            </div>
            <div>
              <dt className="text-[#6B675C]"><TS>Entrega</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{e.propuesta.fecha_entrega ? fecha(e.propuesta.fecha_entrega, false) : `${e.propuesta.dias} días`}</TS></dd>
            </div>
            <div>
              <dt className="text-[#6B675C]"><TS>Anticipo</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{e.propuesta.anticipo_pct != null ? `${e.propuesta.anticipo_pct} %` : "—"}</TS></dd>
            </div>
            <div>
              <dt className="text-[#6B675C]"><TS>Envío</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{e.propuesta.incluye_envio ? "Incluido" : "Aparte"}</TS></dd>
            </div>
          </dl>
          {e.propuesta.garantia && <p className="mt-2 text-sm text-[#40403A]"><strong><TS>Garantía:</TS></strong> <TS>{e.propuesta.garantia}</TS></p>}
          {e.propuesta.condiciones && <p className="mt-1 text-sm text-[#40403A]"><strong><TS>Condiciones:</TS></strong> <TS>{e.propuesta.condiciones}</TS></p>}
          {e.contrato && (
            <p className="mt-2 text-sm text-[#40403A]">
              <strong><TS>Acuerdo SafeDeal</TS></strong> v<TS>{e.contrato.version}</TS>: <TS>{e.contrato.estado}</TS>
              <TS>{e.contrato.firmado_en ? ` (firmado el ${fecha(e.contrato.firmado_en, false)})` : ""}</TS>
            </p>
          )}
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4">
        <h2 className="text-base font-extrabold text-[#142033]"><TS>Archivos</TS></h2>
        {e.archivos.length === 0 ? (
          <p className="mt-2 text-sm text-[#6B675C]"><TS>Sin archivos.</TS></p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-[#6B675C]">
              <tr>
                <th className="py-1 pr-2 font-normal"><TS>Archivo</TS></th>
                <th className="py-1 pr-2 font-normal"><TS>De</TS></th>
                <th className="py-1 pr-2 font-normal"><TS>Fecha</TS></th>
                <th className="py-1 font-normal"><TS>Huella</TS></th>
              </tr>
            </thead>
            <tbody>
              {e.archivos.map((a, i) => (
                <tr key={i} className="border-t border-[#E7E4DC]">
                  <td className="py-1.5 pr-2 text-[#142033]">
                    <TS>{a.nombre}</TS> <span className="text-[#6B675C]">({peso(a.tamano)})</span>
                    {a.borrado && <span className="ml-1 text-xs text-[#B3261E]"><TS>borrado</TS></span>}
                  </td>
                  <td className="py-1.5 pr-2 text-[#40403A]"><TS>{a.de}</TS></td>
                  <td className="py-1.5 pr-2 text-[#40403A]">{fecha(a.fecha, false)}</td>
                  <td className="py-1.5 font-mono text-xs text-[#6B675C]"><TS>{a.huella || "—"}</TS></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {e.visor === "cliente" && e.archivos.some((a) => !a.borrado) && (
          <p className="mt-2 text-xs text-[#6B675C] print:hidden"><TS>Las descargas de tus archivos aparecen en la línea de tiempo.</TS></p>
        )}
      </section>

      {(e.entrega.paqueteria || e.entrega.guia) && (
        <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4 text-sm">
          <h2 className="text-base font-extrabold text-[#142033]"><TS>Entrega</TS></h2>
          <p className="mt-1 text-[#40403A]">
            <TS>{e.entrega.paqueteria || "Paquetería"}</TS> <TS>· guía</TS> <span className="font-mono"><TS>{e.entrega.guia || "—"}</TS></span>
          </p>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4">
        <h2 className="text-base font-extrabold text-[#142033]"><TS>Línea de tiempo</TS></h2>
        <ol className="mt-3 grid gap-2.5">
          {e.linea.map((s, i) => (
            <li key={i} className="grid grid-cols-[28px_1fr] gap-2 text-sm">
              <span aria-hidden="true"><TS>{ICONO[s.tipo] || "•"}</TS></span>
              <span>
                <span className="text-xs text-[#6B675C]">{fecha(s.fecha)} · <TS>{s.quien}</TS></span>
                <span className="block text-[#142033]"><TS>{s.texto}</TS></span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 text-xs text-[#6B675C]">
        <TS>Generado el</TS> {fecha(e.generado)} <TS>por HETNA CNC. Huella del expediente:</TS> <span className="break-all font-mono"><TS>{e.huella}</TS></span><TS>. Si dos copias tienen la misma
        huella, dicen lo mismo.</TS>
      </p>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
