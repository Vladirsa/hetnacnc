// HETNA Panel → App → Creadores (programa de creadores, estrategia 1.5).
//   · Solicitudes del formulario de /creadores: crear su código o descartarla.
//   · Creadores: visitas a su página, talleres registrados con su código, los
//     que ya pagan y los meses que ganó (se aplican a mano, como los meses a
//     favor de referidos).
import { TS } from "@/i18n/TS"
import { AccionesCreador, DescartarSolicitud, NuevoCreador } from "@/components/hetna/panel/Creadores"
import { SubApp } from "@/components/hetna/panel/SubApp"
import { Etiqueta, Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { puedeActuar } from "@/lib/panel/roles"
import { adminFetch, exigirPagina, hace } from "@/lib/panel/sesion"

type Creador = {
  codigo: string
  nombre: string
  red: string | null
  canal_url: string | null
  correo: string | null
  dias_regalo: number
  meses_por_taller: number
  comision_pct: number
  activo: boolean
  visitas_30: number
  visitas: number
  registrados: number
  pagando: number
  meses_ganados: number
}
type Solicitud = { id: number; nombre: string; correo: string; red: string | null; canal_url: string; seguidores: string | null; mensaje: string | null; estado: string; codigo: string | null; created_at: string }
type Datos = { creadores: Creador[]; solicitudes: Solicitud[] }

export default async function PanelCreadores({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const yo = await exigirPagina(locale, "cotizador")
  const actuar = puedeActuar(yo.rol, "distribuidores")
  let d: Datos | null = null, error = ""
  try { d = await adminFetch<Datos>("/admin/hetna-creadores") } catch (e) { error = (e as Error).message }
  const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
  const tot = (d?.creadores || []).reduce((a, c) => ({ visitas: a.visitas + c.visitas_30, registrados: a.registrados + c.registrados, pagando: a.pagando + c.pagando }), { visitas: 0, registrados: 0, pagando: 0 })
  const nuevas = (d?.solicitudes || []).filter((s) => s.estado === "nueva")

  return (
    <div className="grid gap-4">
      <SubApp locale={locale} actual="creadores" />
      {error && <Vacio><TS>No pude leer los creadores:</TS> {error}</Vacio>}
      {d && (
        <>
          <Tarjeta>
            <Titulo extra={<a href={`/${locale}/creadores`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[#C2560A]"><TS>Página del programa →</TS></a>}><TS>Creadores</TS></Titulo>
            <div className="grid grid-cols-3 gap-2">
              <Kpi etiqueta="Visitas (30 días)" valor={String(tot.visitas)} />
              <Kpi etiqueta="Talleres registrados" valor={String(tot.registrados)} />
              <Kpi etiqueta="Ya pagan" valor={String(tot.pagando)} antes={tot.registrados ? `${Math.round((tot.pagando / tot.registrados) * 100)} %` : undefined} />
            </div>
            <div className="mt-3">{actuar && <NuevoCreador />}</div>
            {d.creadores.length === 0 && <div className="mt-2"><Vacio><TS>Todavía no hay creadores. Crea el primero o espera solicitudes del formulario.</TS></Vacio></div>}
            <ul className="mt-2 divide-y divide-[#EFEDE6]">
              {d.creadores.map((c) => (
                <li key={c.codigo} className="py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-black tracking-wider text-[#142033]">{c.codigo}</p>
                    <Etiqueta color={c.activo ? "verde" : "gris"}>{c.activo ? "activo" : "pausado"}</Etiqueta>
                  </div>
                  <p className="text-[13px] font-semibold">
                    {c.nombre}
                    {c.canal_url && <a href={c.canal_url} target="_blank" rel="noreferrer" className="ml-2 text-[12px] font-normal text-[#1D4F8C]">{c.red || "canal"} ↗</a>}
                  </p>
                  <p className="text-[12px] text-[#40403A]">
                    {c.visitas_30} <TS>visitas en 30 días (</TS>{c.visitas} <TS>en total) ·</TS> {c.registrados} <TS>registrados ·</TS> <b>{c.pagando} <TS>pagando</TS></b>
                  </p>
                  <p className="text-[12px] text-[#6B675C]">
                    <TS>Su audiencia:</TS> {c.dias_regalo} <TS>días · Él:</TS> {c.meses_por_taller} {c.meses_por_taller === 1 ? "mes" : "meses"} <TS>por taller que paga</TS>
                    {c.comision_pct > 0 ? ` + ${c.comision_pct}% del primer pago` : ""}
                    {c.meses_ganados > 0 && <> · <b className="text-[#0F7A4A]"><TS>ha ganado</TS> {c.meses_ganados} {c.meses_ganados === 1 ? "mes" : "meses"}</b></>}
                  </p>
                  {actuar && <AccionesCreador codigo={c.codigo} activo={c.activo} liga={`${SITIO}/${locale}/creadores/${c.codigo}`} meses={c.meses_por_taller} comision={c.comision_pct} />}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-[#6B675C]">
              <TS>Los meses ganados se aplican a mano en su cuenta (como los meses a favor de referidos). La comisión en dinero sólo se paga si la pusiste mayor a 0.</TS>
            </p>
          </Tarjeta>

          <Tarjeta>
            <Titulo extra={<span className="text-[11px] text-[#6B675C]"><TS>del formulario de /creadores</TS></span>}><TS>Solicitudes</TS> {nuevas.length > 0 && `(${nuevas.length} nuevas)`}</Titulo>
            {d.solicitudes.length === 0 && <Vacio><TS>Sin solicitudes todavía.</TS></Vacio>}
            <ul className="divide-y divide-[#EFEDE6]">
              {d.solicitudes.map((s) => (
                <li key={s.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[14px] font-extrabold">{s.nombre}</p>
                    <Etiqueta color={s.estado === "nueva" ? "ambar" : s.estado === "atendida" ? "verde" : "gris"}>{s.estado === "atendida" && s.codigo ? s.codigo : s.estado}</Etiqueta>
                  </div>
                  <p className="text-[12px] text-[#40403A]">
                    {s.correo} · {s.red}{s.seguidores ? ` · ${s.seguidores}` : ""} ·{" "}
                    <a href={s.canal_url} target="_blank" rel="noreferrer" className="text-[#1D4F8C]"><TS>ver canal ↗</TS></a>
                  </p>
                  {s.mensaje && <p className="mt-1 text-[12px] italic text-[#6B675C]">“<TS>{s.mensaje}</TS>”</p>}
                  <p className="text-[11px] text-[#9A968B]">{hace(s.created_at)}</p>
                  {actuar && s.estado === "nueva" && (
                    <div className="mt-1.5 flex flex-wrap items-start gap-1.5">
                      <NuevoCreador etiqueta="Crear su código" inicial={{ solicitud_id: s.id, nombre: s.nombre, correo: s.correo, canal_url: s.canal_url, red: s.red || undefined }} />
                      <DescartarSolicitud id={s.id} nombre={s.nombre} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>
        </>
      )}
    </div>
  )
}
