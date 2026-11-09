// HETNA Panel → Licitaciones: solicitudes de fabricación por etapa.
import { Etiqueta, Pestanas, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, hace, pesos } from "@/lib/panel/sesion"

type Sol = { id: string; folio: string; modo: string; estado: string; etapa: string; etapa_nombre: string; creada: string; cierra_en?: string; trabajo: { servicio?: string; material?: string; cantidad?: string; ciudad?: string; descripcion?: string; archivos?: { nombre: string }[] }; contacto: { nombre?: string; empresa?: string; telefono?: string; correo?: string; ciudad?: string }; propuestas: number; pago_estado?: string; pago_monto?: number | null; liga_cliente?: string }

const ETAPAS = [["en_revision", "Por revisar"], ["publicada", "Publicadas"], ["con_propuestas", "Con propuestas"], ["adjudicada", "Adjudicadas"], ["en_fabricacion", "En fabricación"], ["entregada", "Entregadas"], ["todas", "Todas"]] as const

export default async function PanelLicitaciones({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "licitaciones")
  const { f } = await searchParams
  const etapa = f || "en_revision"
  let data: { totales: Record<string, number>; solicitudes: Sol[] } = { totales: {}, solicitudes: [] }, error = ""
  try { data = await adminFetch(`/admin/hetna-solicitudes${etapa === "todas" ? "" : `?etapa=${etapa}`}`) } catch (e) { error = (e as Error).message }
  const ADMIN = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "") + "/dashboard"
  return (
    <div>
      <Pestanas base={`/${locale}/panel/licitaciones`} actual={etapa} opciones={ETAPAS.map(([k, n]) => ({ clave: k, nombre: n, n: k === "todas" ? undefined : data.totales[k] }))} />
      <Tarjeta>
        <Titulo extra={<a className="text-[12px] font-semibold text-[#C2560A]" href={`${ADMIN}/solicitudes`} target="_blank" rel="noreferrer">Dashboard →</a>}>Solicitudes de fabricación</Titulo>
        {error && <Vacio>No pude leer las solicitudes: {error}</Vacio>}
        {!error && data.solicitudes.length === 0 && <Vacio>Nada en esta etapa.</Vacio>}
        <ul className="divide-y divide-[#EFEDE6]">
          {data.solicitudes.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-extrabold text-[#142033]">{s.folio} <span className="font-semibold text-[#6B675C]">· {s.trabajo?.servicio || s.modo}</span></p>
                <Etiqueta color={s.etapa === "en_revision" ? "ambar" : s.etapa === "entregada" ? "verde" : "azul"}>{s.etapa_nombre}</Etiqueta>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[#40403A]">{[s.contacto?.empresa || s.contacto?.nombre, s.trabajo?.ciudad || s.contacto?.ciudad, s.trabajo?.material, s.trabajo?.cantidad].filter(Boolean).join(" · ")}</p>
              {s.trabajo?.descripcion && <p className="mt-0.5 line-clamp-2 text-[12px] text-[#6B675C]">{s.trabajo.descripcion}</p>}
              <p className="mt-1 text-[11px] text-[#9A968B]">{hace(s.creada)} · {s.propuestas} propuesta(s){s.pago_monto ? ` · pago ${pesos(s.pago_monto)} ${s.pago_estado || ""}` : ""}{s.trabajo?.archivos?.length ? ` · ${s.trabajo.archivos.length} archivo(s)` : ""}</p>
              <div className="mt-1.5 flex gap-3 text-[12px] font-semibold">
                {s.contacto?.telefono && <a className="text-[#0F7A4A]" href={`https://wa.me/${String(s.contacto.telefono).replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                <a className="text-[#C2560A]" href={`${ADMIN}/solicitudes`} target="_blank" rel="noreferrer">Revisar</a>
                {s.liga_cliente && <a className="text-[#1D4F8C]" href={s.liga_cliente} target="_blank" rel="noreferrer">Ver como cliente</a>}
              </div>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}
