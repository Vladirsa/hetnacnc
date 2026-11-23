// HETNA Panel → Estrategia (sólo el dueño): los indicadores de la estrategia de
// liderazgo (docs/estrategia-liderazgo-mundial.md) contra los 30 días anteriores.
import { Etiqueta, Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { MarcarCompensacion } from "@/components/hetna/panel/Fase4"
import { adminFetch, exigirPagina } from "@/lib/panel/sesion"

type Origen = { fuente: string; campana: string; solicitudes: number; con_propuesta_elegida: number }
type Periodo = { origenes?: Origen[]; solicitudes: number; con_propuesta: number; horas_primera_propuesta: number | null; talleres_activos: number; archivos_revisados: number; archivos_con_problema: number }
type Datos = {
  actual: Periodo
  anterior: Periodo
  red: { talleres: number; puntualidad_pct: number | null; entregas_con_fecha: number; con_capacidad_libre: number; con_precios: number | null; campana_precios: { enviados: number; recordados: number; llenaron: number } | null }
  latam: { pais: string; talleres: number; clientes: number }[]
  metas: { puntualidad_pct: number; horas_primera_propuesta: number; archivos_detectados_pct: number }
}

type Fase4 = {
  config: { activa: boolean; compensacionPctDia: number | null; compensacionTopePct: number; expresPct: number | null; creditoDias: number | null }
  lista: { clave: string; listo: boolean; para: string }[]
  compensaciones: { solicitud_id: string; folio: string; total: number; dias_tarde: number; monto: number; estado: string; created_at: string }[]
}

const PAIS: Record<string, string> = { co: "🇨🇴 Colombia", cl: "🇨🇱 Chile", pe: "🇵🇪 Perú", ar: "🇦🇷 Argentina", gt: "🇬🇹 Guatemala", ec: "🇪🇨 Ecuador", cr: "🇨🇷 Costa Rica", bo: "🇧🇴 Bolivia", do: "🇩🇴 Rep. Dominicana", es: "🇪🇸 España" }

const cambio = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)} % vs. mes anterior` : a ? "nuevo este mes" : undefined)
const horas = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h} h` : `${Math.round(h / 24)} días`)

export default async function PanelEstrategia({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "estrategia")
  let d: Datos | null = null, error = ""
  try { d = await adminFetch<Datos>("/admin/hetna-estrategia") } catch (e) { error = (e as Error).message }
  let f4: Fase4 | null = null
  try { f4 = await adminFetch<Fase4>("/admin/hetna-fase4") } catch {}
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

      {f4 && (
        <Tarjeta>
          <Titulo extra={<Etiqueta color={f4.config.activa ? "verde" : "gris"}>{f4.config.activa ? "encendida" : "apagada"}</Etiqueta>}>Fase 4: HETNA responde</Titulo>
          <p className="mb-2 text-[12px] text-[#6B675C]">
            HETNA cobra y retiene el pago, garantiza la fecha (compensa si el taller se atrasa), servicio exprés y crédito a empresas. Se enciende sólo con estas claves en el .env del backend; antes, revísalo con tu contador y tu abogado.
          </p>
          <ul className="divide-y divide-[#EFEDE6]">
            {f4.lista.map((x) => (
              <li key={x.clave} className="flex items-start justify-between gap-2 py-2 text-[13px]">
                <span>
                  <code className="text-[12px] font-bold text-[#142033]">{x.clave}</code>
                  <span className="block text-[12px] text-[#6B675C]">{x.para}</span>
                </span>
                <Etiqueta color={x.listo ? "verde" : "ambar"}>{x.listo ? "lista" : "falta"}</Etiqueta>
              </li>
            ))}
          </ul>
          {f4.compensaciones.filter((c) => c.estado === "pendiente").length > 0 && (
            <>
              <p className="mt-3 text-[13px] font-bold text-[#8A3D06]">Compensaciones por entrega tarde, por aplicar</p>
              <ul className="divide-y divide-[#EFEDE6]">
                {f4.compensaciones.filter((c) => c.estado === "pendiente").map((c) => (
                  <li key={c.solicitud_id} className="py-2 text-[13px]">
                    <b>{c.folio}</b> · {c.dias_tarde} {c.dias_tarde === 1 ? "día" : "días"} tarde · compensar <b>${Number(c.monto).toLocaleString("es-MX")}</b> de ${Number(c.total).toLocaleString("es-MX")}
                    <MarcarCompensacion id={c.solicitud_id} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tarjeta>
      )}

      <Tarjeta>
        <Titulo>De dónde vienen las solicitudes (30 días)</Titulo>
        {!a.origenes?.length ? (
          <Vacio>Todavía no hay solicitudes con origen. Las ligas de los anuncios llevan utm_source y utm_campaign; aquí se ve cuántas solicitudes trae cada campaña.</Vacio>
        ) : (
          <ul className="divide-y divide-[#EFEDE6]">
            {a.origenes.map((o) => (
              <li key={`${o.fuente}|${o.campana}`} className="flex justify-between gap-3 py-2 text-[13px]">
                <span className="font-semibold">
                  {o.fuente === "directo" ? "Directo / sin campaña" : o.fuente}
                  {o.campana && <span className="font-normal text-[#6B675C]"> · {o.campana}</span>}
                </span>
                <span className="whitespace-nowrap text-[#40403A]">
                  {o.solicitudes} solicitudes · {o.con_propuesta_elegida} eligieron taller
                </span>
              </li>
            ))}
          </ul>
        )}
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
