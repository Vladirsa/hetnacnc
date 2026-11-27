// HETNA Panel → Talleres: verificaciones (expedientes) por estado.
import { TS } from "@/i18n/TS"
import { Etiqueta, Pestanas, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, hace } from "@/lib/panel/sesion"
import { puedeActuar } from "@/lib/panel/roles"
import { AccionesVerificacion } from "@/components/hetna/panel/Acciones"

type Exp = { seller_id: string; nombre: string; handle: string; email: string; telefono: string; estado: string; motivo?: string; enviado_en?: string; revisado_en?: string; archivos: { id: string; tipo: string; mime?: string }[]; faltan: string[] }
const ESTADOS = [["en_revision", "Por revisar"], ["verificado", "Verificados"], ["rechazado", "Rechazados"], ["borrador", "Sin enviar"], ["todos", "Todos"]] as const
const COLOR: Record<string, "ambar" | "verde" | "rojo" | "gris"> = { en_revision: "ambar", verificado: "verde", rechazado: "rojo", borrador: "gris" }

export default async function PanelTalleres({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params
  const yo = await exigirPagina(locale, "talleres")
  const { f } = await searchParams
  const estado = f || "en_revision"
  let lista: Exp[] = [], error = ""
  try { lista = (await adminFetch<{ expedientes: Exp[] }>(`/admin/hetna-verificacion${estado === "todos" ? "" : `?estado=${estado}`}`)).expedientes || [] } catch (e) { error = (e as Error).message }
  const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
  return (
    <div>
      <Pestanas base={`/${locale}/panel/talleres`} actual={estado} opciones={ESTADOS.map(([k, n]) => ({ clave: k, nombre: n }))} />
      <Tarjeta>
        <Titulo extra={<a className="text-[12px] font-semibold text-[#C2560A]" href={`${SITIO}/dashboard/verificacion`} target="_blank" rel="noreferrer"><TS>Dashboard →</TS></a>}><TS>Verificación de talleres</TS></Titulo>
        {error && <Vacio><TS>No pude leer las verificaciones:</TS> <TS>{error}</TS></Vacio>}
        {!error && lista.length === 0 && <Vacio><TS>Nada en este estado.</TS></Vacio>}
        <ul className="divide-y divide-[#EFEDE6]">
          {lista.map((t) => (
            <li key={t.seller_id} className="py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-extrabold text-[#142033]"><TS>{t.nombre}</TS></p>
                <Etiqueta color={COLOR[t.estado] || "gris"}>{t.estado.replace("_", " ")}</Etiqueta>
              </div>
              <p className="mt-0.5 text-[12px] text-[#6B675C]"><TS>{t.email}</TS><TS>{t.telefono ? ` · ${t.telefono}` : ""}</TS> · <TS>{t.archivos.length}</TS> <TS>documento(s)</TS><TS>{t.faltan?.length ? ` · faltan: ${t.faltan.join(", ")}` : ""}</TS></p>
              <p className="text-[11px] text-[#9A968B]"><TS>{t.enviado_en ? `enviado ${hace(t.enviado_en)}` : ""}</TS><TS>{t.motivo ? ` · ${t.motivo}` : ""}</TS></p>
              {t.archivos.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {t.archivos.map((a) => (
                    <a key={a.id} href={`/api/app/panel/archivo?seller=${t.seller_id}&id=${a.id}`} target="_blank" rel="noreferrer" className="rounded-md bg-[#E8F0FB] px-2 py-1 text-[11px] font-semibold text-[#1D4F8C]">📄 <TS>{a.tipo}</TS></a>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex gap-3 text-[12px] font-semibold">
                {t.handle && <a className="text-[#1D4F8C]" href={`${SITIO}/${locale}/talleres/${t.handle}`} target="_blank" rel="noreferrer"><TS>Ver perfil</TS></a>}
                {t.telefono && <a className="text-[#0F7A4A]" href={`https://wa.me/${String(t.telefono).replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`} target="_blank" rel="noreferrer"><TS>WhatsApp</TS></a>}
                <a className="text-[#C2560A]" href={`${SITIO}/dashboard/verificacion`} target="_blank" rel="noreferrer"><TS>Dashboard</TS></a>
              </div>
              {puedeActuar(yo.rol, "talleres") && <AccionesVerificacion sellerId={t.seller_id} estado={t.estado} />}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}
