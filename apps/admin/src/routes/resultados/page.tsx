// Pantalla "Resultados" del dashboard (menú lateral).
// El embudo de licitaciones: de las solicitudes que llegaron en el periodo,
// cuántas reciben propuesta, se eligen, se pagan y se entregan; en qué paso se
// pierden; cuánto tarda cada paso; si los recordatorios y las ampliaciones
// sirven, y la lista de las que están atoradas hoy para actuar.
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Datos = {
  dias: number
  pasos: { creadas: number; difundidas: number; con_propuesta: number; elegidas: number; pagadas: number; entregadas: number }
  perdidas: Record<string, number>
  tiempos_horas: { primera_propuesta: number | null; elegir: number | null; pagar: number | null }
  propuestas_por_solicitud: number | null
  talleres_avisados_promedio: number | null
  respuesta_talleres_pct: number | null
  ampliadas: { total: number; con_propuesta_despues: number }
  recordatorios: Record<string, { enviados: number; avanzaron: number }>
  motivos_no_cotizar: Record<string, number>
  semanas: { semana: string; creadas: number; pagadas: number }[]
  atoradas: { folio: string; motivo: string; dias: number; cliente: string; liga: string }[]
}

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  azul: "#142033",
  naranja: "#C2560A",
  rojo: "#b42318",
  verde: "#1E7B3A",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const h2: CSSProperties = { margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: C.texto }
const tenue: CSSProperties = { color: C.tenue, fontSize: 12 }

const PASOS: [keyof Datos["pasos"], string][] = [
  ["creadas", "Solicitudes"],
  ["difundidas", "Enviadas a talleres"],
  ["con_propuesta", "Con al menos una propuesta"],
  ["elegidas", "Eligieron taller"],
  ["pagadas", "Pagadas"],
  ["entregadas", "Entregadas"],
]
const PERDIDAS: Record<string, string> = {
  sin_revisar: "Esperan revisión de HETNA",
  sin_propuestas_abiertas: "Abiertas, todavía sin propuestas",
  sin_propuestas_cerradas: "Cerraron sin ninguna propuesta",
  sin_elegir: "Tienen propuestas y no eligen",
  sin_pagar: "Eligieron y no pagan",
  canceladas: "Canceladas",
}
const RECORDATORIO: Record<string, [string, string]> = {
  elegir: ["Cliente: propuestas sin elegir", "eligieron después"],
  pagar: ["Cliente: elegida sin pagar", "pagaron después"],
  contra: ["Taller: contraoferta sin responder", "respondieron"],
  hito: ["Taller: hito atrasado", "lo marcaron listo"],
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—")
const tiempo = (h: number | null) => (h == null ? "—" : h < 48 ? `${Math.round(h)} h` : `${Math.round((h / 24) * 10) / 10} días`)

async function cargar(dias: number): Promise<Datos> {
  let token: string | null = null
  try {
    token = localStorage.getItem("medusa_auth_token")
  } catch {
    /* sin almacenamiento */
  }
  const r = await fetch(`/admin/hetna-licitaciones/embudo?dias=${dias}`, {
    credentials: "include",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) throw new Error("No se pudo verificar tu sesión. Cierra sesión, vuelve a entrar y recarga.")
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d as Datos
}

function Tile({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div style={{ ...caja, marginBottom: 0, flex: "1 1 170px" }}>
      <p style={{ ...tenue, margin: 0 }}>{titulo}</p>
      <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.azul }}>{valor}</p>
      {nota && <p style={{ ...tenue, margin: "2px 0 0" }}>{nota}</p>}
    </div>
  )
}

export default function Resultados() {
  const [dias, setDias] = useState(30)
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setD(null)
    setError(null)
    cargar(dias).then(setD).catch((e) => setError(e.message))
  }, [dias])

  return (
    <div style={{ padding: 24, maxWidth: 1000, color: C.texto }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>Resultados de licitaciones</h1>
      <p style={{ ...tenue, margin: "0 0 14px", fontSize: 13 }}>
        Solicitudes creadas en los últimos {dias} días: hasta dónde llegan, dónde se pierden y qué hacer hoy.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[7, 30, 90].map((n) => (
          <button key={n} type="button" onClick={() => setDias(n)}
            style={{ cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, border: "none",
              background: dias === n ? C.azul : C.suave, color: dias === n ? "#fff" : C.texto }}>
            {n} días
          </button>
        ))}
      </div>
      {error ? <p style={{ color: C.rojo }}>{error}</p> : !d ? <p style={tenue}>Cargando…</p> : <Panel d={d} />}
    </div>
  )
}

/** Lo que se dibuja con los datos ya cargados. */
export function Panel({ d }: { d: Datos }) {
  const maxSemana = Math.max(1, ...d.semanas.map((s) => s.creadas))
  // El paso con la peor conversión es donde más se pierde
  let peor: { de: string; a: string; tasa: number } | null = null
  {
    for (let i = 1; i < PASOS.length; i++) {
      const a = d.pasos[PASOS[i - 1][0]], b = d.pasos[PASOS[i][0]]
      if (a >= 3 && (!peor || b / a < peor.tasa)) peor = { de: PASOS[i - 1][1], a: PASOS[i][1], tasa: b / a }
    }
  }

  return (
    <>
          <div style={caja}>
            <p style={h2}>Embudo</p>
            {PASOS.map(([k, nombre], i) => {
              const n = d.pasos[k]
              const ancho = d.pasos.creadas ? Math.max(2, (n / d.pasos.creadas) * 100) : 0
              const previo = i ? d.pasos[PASOS[i - 1][0]] : 0
              return (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "190px 1fr 150px", gap: 10, alignItems: "center", margin: "6px 0" }}>
                  <span style={{ fontSize: 13 }}>{nombre}</span>
                  <div style={{ background: C.suave, borderRadius: 6, height: 22, overflow: "hidden" }}>
                    <div style={{ width: `${ancho}%`, height: "100%", background: i === PASOS.length - 1 ? C.verde : C.azul, borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {n} <span style={{ ...tenue, fontWeight: 400 }}>{i ? `(${pct(n, previo)} del anterior)` : ""}</span>
                  </span>
                </div>
              )
            })}
            {peor && peor.tasa < 1 && (
              <p style={{ margin: "10px 0 0", fontSize: 13, background: "#FFF8EE", padding: "8px 10px", borderRadius: 8 }}>
                Donde más se pierde: de <strong>{peor.de.toLowerCase()}</strong> a <strong>{peor.a.toLowerCase()}</strong> (sólo pasa el {Math.round(peor.tasa * 100)}%).
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Tile titulo="Hasta la primera propuesta" valor={tiempo(d.tiempos_horas.primera_propuesta)} nota="mediana, desde que se envía a talleres" />
            <Tile titulo="De la primera propuesta a elegir" valor={tiempo(d.tiempos_horas.elegir)} nota="mediana" />
            <Tile titulo="De elegir a pagar" valor={tiempo(d.tiempos_horas.pagar)} nota="mediana" />
            <Tile titulo="Propuestas por solicitud" valor={d.propuestas_por_solicitud == null ? "—" : String(d.propuestas_por_solicitud)} nota="de las que recibieron alguna" />
            <Tile titulo="Talleres avisados" valor={d.talleres_avisados_promedio == null ? "—" : String(d.talleres_avisados_promedio)}
              nota={d.respuesta_talleres_pct == null ? "promedio por solicitud" : `promedio; cotiza el ${d.respuesta_talleres_pct}%`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
            <div style={caja}>
              <p style={h2}>Dónde se quedaron</p>
              {Object.entries(PERDIDAS).map(([k, t]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: `1px dashed ${C.borde}` }}>
                  <span>{t}</span><strong style={{ color: d.perdidas[k] ? C.naranja : C.tenue }}>{d.perdidas[k] || 0}</strong>
                </div>
              ))}
            </div>

            <div style={caja}>
              <p style={h2}>¿Sirven los recordatorios?</p>
              {Object.keys(d.recordatorios).length === 0 ? <p style={tenue}>Todavía no sale ningún recordatorio en este periodo.</p> :
                Object.entries(d.recordatorios).map(([k, r]) => (
                  <div key={k} style={{ fontSize: 13, padding: "4px 0", borderBottom: `1px dashed ${C.borde}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{RECORDATORIO[k]?.[0] || k}</span><strong>{r.enviados}</strong>
                    </div>
                    <span style={tenue}>{r.avanzaron} {RECORDATORIO[k]?.[1] || "avanzaron"} ({pct(r.avanzaron, r.enviados)})</span>
                  </div>
                ))}
              <p style={{ ...h2, margin: "14px 0 6px", fontSize: 14 }}>Ampliadas por falta de propuestas</p>
              <p style={{ margin: 0, fontSize: 13 }}>
                {d.ampliadas.total} ampliadas · <strong>{d.ampliadas.con_propuesta_despues}</strong> recibieron propuesta después ({pct(d.ampliadas.con_propuesta_despues, d.ampliadas.total)})
              </p>
            </div>

            <div style={caja}>
              <p style={h2}>Por qué los talleres no cotizan</p>
              {Object.keys(d.motivos_no_cotizar).length === 0 ? <p style={tenue}>Ningún taller ha rechazado en este periodo.</p> :
                Object.entries(d.motivos_no_cotizar).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: `1px dashed ${C.borde}` }}>
                    <span>{k}</span><strong>{n}</strong>
                  </div>
                ))}
            </div>

            <div style={caja}>
              <p style={h2}>Por semana</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                {d.semanas.map((s) => (
                  <div key={s.semana} title={`Semana del ${s.semana}: ${s.creadas} solicitudes, ${s.pagadas} pagadas`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{s.creadas || ""}</span>
                    <div style={{ width: "100%", height: `${(s.creadas / maxSemana) * 90}%`, minHeight: s.creadas ? 3 : 0, background: C.suave, borderRadius: 4, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: s.creadas ? `${(s.pagadas / s.creadas) * 100}%` : 0, background: C.verde }} />
                    </div>
                    <span style={{ fontSize: 10, color: C.tenue }}>{s.semana.slice(5)}</span>
                  </div>
                ))}
              </div>
              <p style={{ ...tenue, margin: "6px 0 0" }}>Gris: solicitudes de la semana. Verde: las que se pagaron.</p>
            </div>
          </div>

          <div style={caja}>
            <p style={h2}>Atoradas hoy ({d.atoradas.length})</p>
            {d.atoradas.length === 0 ? <p style={tenue}>Nada atorado. 🎉</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: C.tenue }}>
                    <th style={{ padding: "4px 6px" }}>Folio</th><th style={{ padding: "4px 6px" }}>Qué pasa</th>
                    <th style={{ padding: "4px 6px" }}>Días</th><th style={{ padding: "4px 6px" }}>Cliente</th><th />
                  </tr>
                </thead>
                <tbody>
                  {d.atoradas.map((a) => (
                    <tr key={a.folio + a.motivo} style={{ borderTop: `1px solid ${C.borde}` }}>
                      <td style={{ padding: "6px", fontWeight: 700 }}>{a.folio}</td>
                      <td style={{ padding: "6px" }}>{a.motivo}</td>
                      <td style={{ padding: "6px", color: a.dias >= 5 ? C.rojo : C.texto, fontWeight: 700 }}>{a.dias}</td>
                      <td style={{ padding: "6px" }}>{a.cliente}</td>
                      <td style={{ padding: "6px" }}><a href={a.liga} target="_blank" rel="noreferrer" style={{ color: C.naranja }}>Ver lo que ve el cliente</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ ...tenue, margin: "8px 0 0" }}>Para escribirle al cliente o mover la etapa, búscala por folio en Solicitudes.</p>
          </div>
    </>
  )
}

export const config = {
  label: "Resultados",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
}
