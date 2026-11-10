// HETNA Panel → App (Cotizador): talleres registrados, en prueba, gratis y
// pagando; a quién hablarle esta semana.
import { Etiqueta, Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, fechaCorta, pesos } from "@/lib/panel/sesion"

type Fila = { id: string; nombre: string; correo: string; telefono: string; plan: string; paga: boolean; proveedor: string | null; registrado: string | null; prueba_dias: number | null; renueva: string | null; vence: string | null; cotizaciones_mes: number }
type Panel = { resumen: { talleres: number; nuevos_7: number; nuevos_30: number; en_prueba: number; gratis: number; pagan: number; pagan_por_plan: Record<string, number>; cortesia: number; ingreso_mensual_mxn: number; ingreso_mensual_usd: number; gratis_en_limite: number }; por_vencer: Fila[]; filas: Fila[] }

export default async function PanelCotizador({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "cotizador")
  let p: Panel | null = null, error = ""
  try { p = await adminFetch<Panel>("/admin/hetna-cotizador") } catch (e) { error = (e as Error).message }
  const wa = (t: string) => `https://wa.me/${String(t || "").replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`
  return (
    <div className="grid gap-4">
      {error && <Vacio>No pude leer la app: {error}</Vacio>}
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
