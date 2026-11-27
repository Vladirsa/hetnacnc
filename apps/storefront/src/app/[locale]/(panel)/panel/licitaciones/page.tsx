// HETNA Panel → Licitaciones: solicitudes de fabricación por etapa.
import { TS } from "@/i18n/TS"
import { Etiqueta, Pestanas, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, hace, pesos } from "@/lib/panel/sesion"
import { puedeActuar } from "@/lib/panel/roles"
import { AccionesLicitacion } from "@/components/hetna/panel/Acciones"

type Sol = { id: string; folio: string; modo: string; estado: string; etapa: string; etapa_nombre: string; creada: string; cierra_en?: string; trabajo: { servicio?: string; material?: string; cantidad?: string; ciudad?: string; descripcion?: string; archivos?: { nombre: string }[] }; contacto: { nombre?: string; empresa?: string; telefono?: string; correo?: string; ciudad?: string }; propuestas: number; pago_estado?: string; pago_monto?: number | null; liga_cliente?: string }

const ETAPAS = [["en_revision", "Por revisar"], ["nueva", "Nuevas"], ["enviada_talleres", "Con talleres"], ["cotizada", "Cotizadas"], ["aceptada", "Aceptadas"], ["en_produccion", "En producción"], ["entregada", "Entregadas"], ["cerrada", "Cerradas"], ["cancelada", "Canceladas"], ["todas", "Todas"]] as const
const ETAPAS_MOVER = ETAPAS.filter(([k]) => k !== "todas").map(([clave, nombre]) => ({ clave, nombre }))

export default async function PanelLicitaciones({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params
  const yo = await exigirPagina(locale, "licitaciones")
  const { f } = await searchParams
  const etapa = f || "en_revision"
  let data: { totales: Record<string, number>; solicitudes: Sol[] } = { totales: {}, solicitudes: [] }, error = ""
  try { data = await adminFetch(`/admin/hetna-solicitudes${etapa === "todas" ? "" : `?etapa=${etapa}`}`) } catch (e) { error = (e as Error).message }
  const ADMIN = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "") + "/dashboard"
  return (
    <div>
      <Pestanas base={`/${locale}/panel/licitaciones`} actual={etapa} opciones={ETAPAS.map(([k, n]) => ({ clave: k, nombre: n, n: k === "todas" ? undefined : data.totales[k] }))} />
      <Tarjeta>
        <Titulo extra={<a className="text-[12px] font-semibold text-[#C2560A]" href={`${ADMIN}/solicitudes`} target="_blank" rel="noreferrer"><TS>Dashboard →</TS></a>}><TS>Solicitudes de fabricación</TS></Titulo>
        {error && <Vacio><TS>No pude leer las solicitudes:</TS> <TS>{error}</TS></Vacio>}
        {!error && data.solicitudes.length === 0 && <Vacio><TS>Nada en esta etapa.</TS></Vacio>}
        <ul className="divide-y divide-[#EFEDE6]">
          {data.solicitudes.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-extrabold text-[#142033]"><TS>{s.folio}</TS> <span className="font-semibold text-[#6B675C]">· {s.trabajo?.servicio || s.modo}</span></p>
                <Etiqueta color={s.etapa === "en_revision" ? "ambar" : s.etapa === "entregada" ? "verde" : "azul"}><TS>{s.etapa_nombre}</TS></Etiqueta>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[#40403A]"><TS>{[s.contacto?.empresa || s.contacto?.nombre, s.trabajo?.ciudad || s.contacto?.ciudad, s.trabajo?.material, s.trabajo?.cantidad].filter(Boolean).join(" · ")}</TS></p>
              {s.trabajo?.descripcion && <p className="mt-0.5 line-clamp-2 text-[12px] text-[#6B675C]"><TS>{s.trabajo.descripcion}</TS></p>}
              <p className="mt-1 text-[11px] text-[#9A968B]">{hace(s.creada)} · <TS>{s.propuestas}</TS> <TS>propuesta(s)</TS><TS>{s.pago_monto ? ` · pago ${pesos(s.pago_monto)} ${s.pago_estado || ""}` : ""}</TS><TS>{s.trabajo?.archivos?.length ? ` · ${s.trabajo.archivos.length} archivo(s)` : ""}</TS></p>
              <div className="mt-1.5 flex gap-3 text-[12px] font-semibold">
                {s.contacto?.telefono && <a className="text-[#0F7A4A]" href={`https://wa.me/${String(s.contacto.telefono).replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`} target="_blank" rel="noreferrer"><TS>WhatsApp</TS></a>}
                {s.contacto?.correo && <a className="text-[#40403A]" href={`mailto:${s.contacto.correo}`}><TS>Correo</TS></a>}
                {s.liga_cliente && <a className="text-[#1D4F8C]" href={s.liga_cliente} target="_blank" rel="noreferrer"><TS>Ver como cliente</TS></a>}
                <a className="text-[#C2560A]" href={`${ADMIN}/solicitudes`} target="_blank" rel="noreferrer"><TS>Dashboard</TS></a>
              </div>
              {puedeActuar(yo.rol, "licitaciones") && <AccionesLicitacion id={s.id} etapa={s.etapa} etapas={ETAPAS_MOVER} />}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}
