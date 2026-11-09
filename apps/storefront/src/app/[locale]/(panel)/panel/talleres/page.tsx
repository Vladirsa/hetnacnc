// HETNA Panel → Talleres: verificaciones (expedientes) por estado.
import { Etiqueta, Pestanas, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, hace } from "@/lib/panel/sesion"

type Exp = { seller_id: string; nombre: string; handle: string; email: string; telefono: string; estado: string; motivo?: string; enviado_en?: string; revisado_en?: string; archivos: { tipo: string }[]; faltan: string[] }
const ESTADOS = [["en_revision", "Por revisar"], ["verificado", "Verificados"], ["rechazado", "Rechazados"], ["borrador", "Sin enviar"], ["todos", "Todos"]] as const
const COLOR: Record<string, "ambar" | "verde" | "rojo" | "gris"> = { en_revision: "ambar", verificado: "verde", rechazado: "rojo", borrador: "gris" }

export default async function PanelTalleres({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "talleres")
  const { f } = await searchParams
  const estado = f || "en_revision"
  let lista: Exp[] = [], error = ""
  try { lista = (await adminFetch<{ expedientes: Exp[] }>(`/admin/hetna-verificacion${estado === "todos" ? "" : `?estado=${estado}`}`)).expedientes || [] } catch (e) { error = (e as Error).message }
  const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
  return (
    <div>
      <Pestanas base={`/${locale}/panel/talleres`} actual={estado} opciones={ESTADOS.map(([k, n]) => ({ clave: k, nombre: n }))} />
      <Tarjeta>
        <Titulo extra={<a className="text-[12px] font-semibold text-[#C2560A]" href={`${SITIO}/dashboard/verificacion`} target="_blank" rel="noreferrer">Dashboard →</a>}>Verificación de talleres</Titulo>
        {error && <Vacio>No pude leer las verificaciones: {error}</Vacio>}
        {!error && lista.length === 0 && <Vacio>Nada en este estado.</Vacio>}
        <ul className="divide-y divide-[#EFEDE6]">
          {lista.map((t) => (
            <li key={t.seller_id} className="py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-extrabold text-[#142033]">{t.nombre}</p>
                <Etiqueta color={COLOR[t.estado] || "gris"}>{t.estado.replace("_", " ")}</Etiqueta>
              </div>
              <p className="mt-0.5 text-[12px] text-[#6B675C]">{t.email}{t.telefono ? ` · ${t.telefono}` : ""} · {t.archivos.length} documento(s){t.faltan?.length ? ` · faltan: ${t.faltan.join(", ")}` : ""}</p>
              <p className="text-[11px] text-[#9A968B]">{t.enviado_en ? `enviado ${hace(t.enviado_en)}` : ""}{t.motivo ? ` · ${t.motivo}` : ""}</p>
              <div className="mt-1.5 flex gap-3 text-[12px] font-semibold">
                {t.handle && <a className="text-[#1D4F8C]" href={`${SITIO}/${locale}/talleres/${t.handle}`} target="_blank" rel="noreferrer">Ver perfil</a>}
                <a className="text-[#C2560A]" href={`${SITIO}/dashboard/verificacion`} target="_blank" rel="noreferrer">Revisar expediente</a>
              </div>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}
