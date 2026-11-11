// HETNA Panel → App (Cotizador): talleres registrados, en prueba, gratis y
// pagando; a quién hablarle esta semana.
import { SubApp } from "@/components/hetna/panel/SubApp"
import { Etiqueta, Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, fechaCorta, pesos } from "@/lib/panel/sesion"

type Fila = { id: string; nombre: string; correo: string; telefono: string; plan: string; paga: boolean; proveedor: string | null; registrado: string | null; prueba_dias: number | null; renueva: string | null; vence: string | null; cotizaciones_mes: number }
type Crec = { resumen: { talleres: number; activos_7: number; activos_30: number; cotizaciones_7: number; cotizaciones_30: number; simulador_7: number; simulador_30: number; nuevos_30: number; mismo_dia_pct: number | null; licitaciones_30: number; referidos_30: number }; semanas: { semana: string; activos: number; cotizaciones: number; simulador: number; nuevos: number; licitaciones: number }[] }
type Panel = { resumen: { talleres: number; nuevos_7: number; nuevos_30: number; en_prueba: number; gratis: number; pagan: number; pagan_por_plan: Record<string, number>; cortesia: number; ingreso_mensual_mxn: number; ingreso_mensual_usd: number; gratis_en_limite: number }; por_vencer: Fila[]; filas: Fila[] }

export default async function PanelCotizador({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "cotizador")
  let p: Panel | null = null, error = ""
  let c: Crec | null = null
  try { p = await adminFetch<Panel>("/admin/hetna-cotizador") } catch (e) { error = (e as Error).message }
  try { c = await adminFetch<Crec>("/admin/hetna-crecimiento") } catch { c = null }
  const wa = (t: string) => `https://wa.me/${String(t || "").replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`
  return (
    <div className="grid gap-4">
      <SubApp locale={locale} actual="talleres" />
      {error && <Vacio>No pude leer la app: {error}</Vacio>}
      {c && (
        <Tarjeta>
          <Titulo extra={<span className="text-[11px] text-[#6B675C]">los 3 números de la semana</span>}>Crecimiento</Titulo>
          <div className="grid grid-cols-3 gap-2">
            <Kpi etiqueta="Talleres activos" valor={String(c.resumen.activos_7)} antes={`7 días · ${c.resumen.activos_30} en 30`} />
            <Kpi etiqueta="Con simulador" valor={String(c.resumen.simulador_7)} antes={`de ${c.resumen.cotizaciones_7} cotiz. · ${c.resumen.simulador_30}/${c.resumen.cotizaciones_30} en 30 días`} />
            <Kpi etiqueta="Licitaciones cerradas" valor={String(c.resumen.licitaciones_30)} antes="30 días" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Kpi etiqueta="Cotizó el primer día" valor={c.resumen.mismo_dia_pct == null ? "—" : `${c.resumen.mismo_dia_pct}%`} antes={`de ${c.resumen.nuevos_30} nuevos en 30 días`} />
            <Kpi etiqueta="Llegaron por referido" valor={String(c.resumen.referidos_30)} antes="30 días" />
          </div>
          <Tendencia semanas={c.semanas} />
        </Tarjeta>
      )}
      {p && (
        <>
          <Tarjeta>
            <Titulo>Talleres en la app</Titulo>
            <div className="grid grid-cols-2 gap-2">
              <Kpi etiqueta="Registrados" valor={String(p.resumen.talleres)} antes={`+${p.resumen.nuevos_7} esta semana · +${p.resumen.nuevos_30} en 30 días`} />
              <Kpi etiqueta="Pagando" valor={String(p.resumen.pagan)} antes={`Taller ${p.resumen.pagan_por_plan.taller || 0} · Pro ${p.resumen.pagan_por_plan.pro || 0} · Ind. ${p.resumen.pagan_por_plan.industrial || 0}`} />
              <Kpi etiqueta="En prueba" valor={String(p.resumen.en_prueba)} />
              <Kpi etiqueta="Gratis" valor={String(p.resumen.gratis)} antes={`${p.resumen.gratis_en_limite} en el límite`} />
              <Kpi etiqueta="Ingreso mensual" valor={pesos(p.resumen.ingreso_mensual_mxn)} antes={p.resumen.ingreso_mensual_usd ? `+ ${p.resumen.ingreso_mensual_usd.toFixed(0)} USD` : undefined} />
              <Kpi etiqueta="Cortesías" valor={String(p.resumen.cortesia)} />
            </div>
          </Tarjeta>
          <Tarjeta>
            <Titulo>A quién hablarle esta semana</Titulo>
            {p.por_vencer.length === 0 ? <Vacio>Nadie por vencer.</Vacio> : (
              <ul className="divide-y divide-[#EFEDE6]">
                {p.por_vencer.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold">{f.nombre}</p>
                      <p className="text-[11.5px] text-[#6B675C]">{f.plan}{f.prueba_dias != null ? ` · ${f.prueba_dias} días de prueba` : ""}{f.vence ? ` · vence ${fechaCorta(f.vence)}` : ""} · {f.cotizaciones_mes} cotiz. este mes</p>
                    </div>
                    {f.telefono && <a href={wa(f.telefono)} target="_blank" rel="noreferrer" className="rounded-lg bg-[#E6F4EC] px-3 py-1.5 text-[12px] font-bold text-[#0F7A4A]">WhatsApp</a>}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta>
            <Titulo>Últimos registrados</Titulo>
            <ul className="divide-y divide-[#EFEDE6]">
              {[...p.filas].sort((a, b) => String(b.registrado || "").localeCompare(String(a.registrado || ""))).slice(0, 15).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{f.nombre}</p>
                    <p className="text-[11px] text-[#6B675C]">{fechaCorta(f.registrado)} · {f.cotizaciones_mes} cotiz.</p>
                  </div>
                  <Etiqueta color={f.paga ? "verde" : f.plan === "prueba" ? "azul" : "gris"}>{f.plan}</Etiqueta>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </>
      )}
    </div>
  )
}

// Barras de 8 semanas: activos (verde) y cotizaciones con simulador (azul).
function Tendencia({ semanas }: { semanas: Crec["semanas"] }) {
  const max = Math.max(1, ...semanas.map((s) => Math.max(s.activos, s.cotizaciones)))
  return (
    <div className="mt-3">
      <p className="mb-1 text-[11px] font-semibold text-[#6B675C]">Últimas 8 semanas · <span className="text-[#0F7A4A]">■</span> activos · <span className="text-[#1F5FBF]">■</span> cotizaciones (<span className="text-[#7FA6E0]">■</span> con simulador)</p>
      <div className="flex h-16 items-end gap-1.5">
        {semanas.map((s) => (
          <div key={s.semana} className="flex flex-1 items-end justify-center gap-[2px]" title={`Semana del ${s.semana}: ${s.activos} activos · ${s.cotizaciones} cotizaciones (${s.simulador} con simulador) · ${s.nuevos} nuevos · ${s.licitaciones} licitaciones`}>
            <div className="w-1/3 rounded-t bg-[#0F7A4A]" style={{ height: `${Math.max(2, (s.activos / max) * 100)}%` }} />
            <div className="relative w-1/3 rounded-t bg-[#1F5FBF]" style={{ height: `${Math.max(2, (s.cotizaciones / max) * 100)}%` }}>
              <div className="absolute bottom-0 left-0 right-0 rounded-t bg-[#7FA6E0]" style={{ height: `${s.cotizaciones ? (s.simulador / s.cotizaciones) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[#9A968B]"><span>{semanas[0]?.semana.slice(5)}</span><span>hoy</span></div>
    </div>
  )
}
