// HETNA Panel → Estrategia (sólo el dueño): los indicadores de la estrategia de
// liderazgo (docs/estrategia-liderazgo-mundial.md) contra los 30 días anteriores.
import { Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina } from "@/lib/panel/sesion"

type Periodo = { solicitudes: number; con_propuesta: number; horas_primera_propuesta: number | null; talleres_activos: number; archivos_revisados: number; archivos_con_problema: number }
type Datos = {
  actual: Periodo
  anterior: Periodo
  red: { talleres: number; puntualidad_pct: number | null; entregas_con_fecha: number; con_capacidad_libre: number; con_precios: number | null; campana_precios: { enviados: number; recordados: number; llenaron: number } | null }
  latam: { pais: string; talleres: number; clientes: number }[]
  metas: { puntualidad_pct: number; horas_primera_propuesta: number; archivos_detectados_pct: number }
}

const PAIS: Record<string, string> = { co: "🇨🇴 Colombia", cl: "🇨🇱 Chile", pe: "🇵🇪 Perú", ar: "🇦🇷 Argentina", gt: "🇬🇹 Guatemala", ec: "🇪🇨 Ecuador", cr: "🇨🇷 Costa Rica", bo: "🇧🇴 Bolivia", do: "🇩🇴 Rep. Dominicana", es: "🇪🇸 España" }

const cambio = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)} % vs. mes anterior` : a ? "nuevo este mes" : undefined)
const horas = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h} h` : `${Math.round(h / 24)} días`)

export default async function PanelEstrategia({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "estrategia")
  let d: Datos | null = null, error = ""
  try { d = await adminFetch<Datos>("/admin/hetna-estrategia") } catch (e) { error = (e as Error).message }
  if (!d) return <Vacio>No pude leer los indicadores: {error}</Vacio>
  const a = d.actual, b = d.anterior
  const pctDetectados = a.archivos_revisados ? Math.round((a.archivos_con_problema / a.archivos_revisados) * 100) : null
  return (
    <div className="grid gap-4">
      <Tarjeta>
        <Titulo extra={<span className="text-[11px] text-[#6B675C]">últimos 30 días</span>}>🏆 Estrategia: ¿vamos ganando?</Titulo>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi etiqueta="Solicitudes de fabricación" valor={String(a.solicitudes)} antes={cambio(a.solicitudes, b.solicitudes)} />
          <Kpi etiqueta="Talleres activos (mandaron propuesta)" valor={String(a.talleres_activos)} antes={cambio(a.talleres_activos, b.talleres_activos)} />
          <Kpi etiqueta={`1ª propuesta (meta < ${horas(d.metas.horas_primera_propuesta)})`} valor={horas(a.horas_primera_propuesta)} antes={b.horas_primera_propuesta != null ? `antes ${horas(b.horas_primera_propuesta)}` : undefined} />
          <Kpi etiqueta="Solicitudes con propuesta" valor={a.solicitudes ? `${Math.round((a.con_propuesta / a.solicitudes) * 100)} %` : "—"} antes={`${a.con_propuesta} de ${a.solicitudes}`} />
        </div>
      </Tarjeta>

      <Tarjeta>
        <Titulo>La red de talleres</Titulo>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi etiqueta={`Entregas a tiempo (meta ${d.metas.puntualidad_pct} %)`} valor={d.red.puntualidad_pct != null ? `${d.red.puntualidad_pct} %` : "—"} antes={`${d.red.entregas_con_fecha} entregas con fecha`} />
          <Kpi etiqueta="Talleres en la red" valor={String(d.red.talleres)} />
          <Kpi etiqueta="Con precios de acabados" valor={d.red.con_precios != null ? String(d.red.con_precios) : "—"} antes={d.red.campana_precios ? `campaña: ${d.red.campana_precios.enviados} avisados, ${d.red.campana_precios.llenaron} llenaron` : undefined} />
          <Kpi etiqueta="Con máquina libre hoy" valor={String(d.red.con_capacidad_libre)} />
        </div>
      </Tarjeta>

      <Tarjeta>
        <Titulo>Archivos revisados antes de cotizar</Titulo>
        <div className="grid grid-cols-2 gap-2">
          <Kpi etiqueta="Solicitudes con archivo revisado" valor={String(a.archivos_revisados)} antes={cambio(a.archivos_revisados, b.archivos_revisados)} />
          <Kpi etiqueta="Con algo que corregir (detectado a tiempo)" valor={String(a.archivos_con_problema)} antes={pctDetectados != null ? `${pctDetectados} % de los archivos` : undefined} />
        </div>
        <p className="mt-2 text-[11px] text-[#6B675C]">Cada archivo con problema detectado es un reclamo que no llega al taller.</p>
      </Tarjeta>

      <Tarjeta>
        <Titulo extra={<a href={`/${locale}/panel/cotizador/latam`} className="text-[12px] font-semibold text-[#C2560A]">Ver registros →</a>}>Latinoamérica: pre-registros</Titulo>
        {d.latam.length === 0 ? (
          <Vacio>Todavía no hay registros. Prende los países en Mercados de la configuración de redes para que salga la campaña semanal.</Vacio>
        ) : (
          <ul className="divide-y divide-[#EFEDE6]">
            {d.latam.map((p) => (
              <li key={p.pais} className="flex justify-between py-2 text-[13px]">
                <span className="font-semibold">{PAIS[p.pais] || p.pais}</span>
                <span className="text-[#40403A]">{p.talleres} talleres · {p.clientes} clientes</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  )
}
