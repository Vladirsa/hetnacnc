// Expediente digital de fabricación: el historial completo de un proyecto en
// una sola página (datos técnicos, archivos, propuesta, responsables, línea de
// tiempo y entrega). Lo abre el cliente desde su liga o el taller elegido desde
// su panel. Se imprime o se guarda como PDF desde el navegador.
// Backend: packages/api/src/lib/expediente.ts
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Imprimir } from "@/components/hetna/expediente/Imprimir"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { verExpediente } from "@/lib/cotizar/expediente"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
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
          <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]">Expediente digital de fabricación</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#142033]">Proyecto {e.folio}</h1>
          <p className="mt-1 text-sm text-[#6B675C]">
            {e.etapa_nombre} · creado el {fecha(e.creada, false)} · {e.visor === "taller" ? "vista del taller" : "vista del cliente"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {e.visor === "cliente" && (
            <LocalizedClientLink href={`/cotizar/propuestas/${clave}`} className="rounded-xl border border-[#E7E4DC] px-4 py-2 text-sm font-semibold text-[#142033]">
              Volver a mi solicitud
            </LocalizedClientLink>
          )}
          <Imprimir />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4 md:col-span-2">
          <h2 className="text-base font-extrabold text-[#142033]">El trabajo</h2>
          {e.trabajo.descripcion && <p className="mt-2 whitespace-pre-line text-sm text-[#40403A]">{e.trabajo.descripcion}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {TRABAJO.filter(([k]) => e.trabajo[k]).map(([k, l]) => (
              <div key={k}>
                <dt className="text-[#6B675C]">{l}</dt>
                <dd className="font-semibold text-[#142033]">{e.trabajo[k]}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
          <h2 className="text-base font-extrabold text-[#142033]">Responsables</h2>
          <dl className="mt-2 grid gap-2 text-sm">
            <div>
              <dt className="text-[#6B675C]">Cliente</dt>
              <dd className="font-semibold text-[#142033]">{e.responsables.cliente}</dd>
            </div>
            <div>
              <dt className="text-[#6B675C]">Taller</dt>
              <dd className="font-semibold text-[#142033]">
                {e.responsables.taller ? (
                  <LocalizedClientLink href={`/talleres/${e.responsables.taller.handle}`} className="hover:text-[#C2560A]">
                    {e.responsables.taller.nombre}
                  </LocalizedClientLink>
                ) : (
                  "Sin elegir todavía"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[#6B675C]">Plataforma</dt>
              <dd className="font-semibold text-[#142033]">{e.responsables.plataforma}</dd>
            </div>
          </dl>
        </section>
      </div>

      {e.propuesta && (
        <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4">
          <h2 className="text-base font-extrabold text-[#142033]">Propuesta acordada</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[#6B675C]">Precio</dt>
              <dd className="font-semibold text-[#142033]">{pesos(e.propuesta.precio, e.propuesta.moneda)}</dd>
            </div>
            <div>
              <dt className="text-[#6B675C]">Entrega</dt>
              <dd className="font-semibold text-[#142033]">{e.propuesta.fecha_entrega ? fecha(e.propuesta.fecha_entrega, false) : `${e.propuesta.dias} días`}</dd>
            </div>
            <div>
              <dt className="text-[#6B675C]">Anticipo</dt>
              <dd className="font-semibold text-[#142033]">{e.propuesta.anticipo_pct != null ? `${e.propuesta.anticipo_pct} %` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6B675C]">Envío</dt>
              <dd className="font-semibold text-[#142033]">{e.propuesta.incluye_envio ? "Incluido" : "Aparte"}</dd>
            </div>
          </dl>
          {e.propuesta.garantia && <p className="mt-2 text-sm text-[#40403A]"><strong>Garantía:</strong> {e.propuesta.garantia}</p>}
          {e.propuesta.condiciones && <p className="mt-1 text-sm text-[#40403A]"><strong>Condiciones:</strong> {e.propuesta.condiciones}</p>}
          {e.contrato && (
            <p className="mt-2 text-sm text-[#40403A]">
              <strong>Acuerdo SafeDeal</strong> v{e.contrato.version}: {e.contrato.estado}
              {e.contrato.firmado_en ? ` (firmado el ${fecha(e.contrato.firmado_en, false)})` : ""}
            </p>
          )}
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4">
        <h2 className="text-base font-extrabold text-[#142033]">Archivos</h2>
        {e.archivos.length === 0 ? (
          <p className="mt-2 text-sm text-[#6B675C]">Sin archivos.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-[#6B675C]">
              <tr>
                <th className="py-1 pr-2 font-normal">Archivo</th>
                <th className="py-1 pr-2 font-normal">De</th>
                <th className="py-1 pr-2 font-normal">Fecha</th>
                <th className="py-1 font-normal">Huella</th>
              </tr>
            </thead>
            <tbody>
              {e.archivos.map((a, i) => (
                <tr key={i} className="border-t border-[#E7E4DC]">
                  <td className="py-1.5 pr-2 text-[#142033]">
                    {a.nombre} <span className="text-[#6B675C]">({peso(a.tamano)})</span>
                    {a.borrado && <span className="ml-1 text-xs text-[#B3261E]">borrado</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-[#40403A]">{a.de}</td>
                  <td className="py-1.5 pr-2 text-[#40403A]">{fecha(a.fecha, false)}</td>
                  <td className="py-1.5 font-mono text-xs text-[#6B675C]">{a.huella || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {e.visor === "cliente" && e.archivos.some((a) => !a.borrado) && (
          <p className="mt-2 text-xs text-[#6B675C] print:hidden">Las descargas de tus archivos aparecen en la línea de tiempo.</p>
        )}
      </section>

      {(e.entrega.paqueteria || e.entrega.guia) && (
        <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4 text-sm">
          <h2 className="text-base font-extrabold text-[#142033]">Entrega</h2>
          <p className="mt-1 text-[#40403A]">
            {e.entrega.paqueteria || "Paquetería"} · guía <span className="font-mono">{e.entrega.guia || "—"}</span>
          </p>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-[#E7E4DC] bg-white p-4">
        <h2 className="text-base font-extrabold text-[#142033]">Línea de tiempo</h2>
        <ol className="mt-3 grid gap-2.5">
          {e.linea.map((s, i) => (
            <li key={i} className="grid grid-cols-[28px_1fr] gap-2 text-sm">
              <span aria-hidden="true">{ICONO[s.tipo] || "•"}</span>
              <span>
                <span className="text-xs text-[#6B675C]">{fecha(s.fecha)} · {s.quien}</span>
                <span className="block text-[#142033]">{s.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 text-xs text-[#6B675C]">
        Generado el {fecha(e.generado)} por HETNA CNC. Huella del expediente: <span className="break-all font-mono">{e.huella}</span>. Si dos copias tienen la misma
        huella, dicen lo mismo.
      </p>
    </main>
  )
}
