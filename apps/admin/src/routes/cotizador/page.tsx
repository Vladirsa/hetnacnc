// Pantalla "Cotizador" del dashboard (menú lateral): las ventas de la app para
// talleres. Cuántos se registran, cuántos están en prueba, en Gratis y
// pagando, cuánto entra al mes, a quién hablarle esta semana por WhatsApp y
// los correos automáticos que ya salieron (lib/cotizador-crm.ts del API).
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"

type Plan = "gratis" | "prueba" | "taller" | "pro" | "industrial" | "master"
type Fila = {
  id: string
  nombre: string
  correo: string
  telefono: string
  plan: Plan
  paga: boolean
  proveedor: string | null
  registrado: string | null
  prueba_dias: number | null
  renueva: string | null
  vence: string | null
  cotizaciones_mes: number
}
type Datos = {
  resumen: {
    talleres: number
    nuevos_7: number
    nuevos_30: number
    en_prueba: number
    gratis: number
    pagan: number
    pagan_por_plan: { taller: number; pro: number; industrial: number }
    cortesia: number
    ingreso_mensual_mxn: number
    ingreso_mensual_usd: number
    gratis_en_limite: number
  }
  por_vencer: Fila[]
  talleres: Fila[]
  correos: { enviados: Record<string, number>; hoy: Record<string, number> }
}

const MSG_SESION =
  "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."
const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
async function leer(): Promise<Datos> {
  let r: Response
  try {
    r = await fetch("/admin/hetna-cotizador", { credentials: "include", headers: cabeceras() })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const d = (await r.json().catch(() => ({}))) as Datos & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  rojo: "#b42318",
  verde: "#1E7B3A",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`
const fecha = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—")

const NOMBRE_PLAN: Record<Plan, string> = {
  gratis: "Gratis",
  prueba: "En prueba",
  taller: "Taller",
  pro: "Pro",
  industrial: "Industrial",
  master: "HETNA",
}
const COLOR_PLAN: Record<Plan, [string, string]> = {
  gratis: ["#F3F1EA", "#44433D"],
  prueba: ["#E8F0FB", "#1D4F8C"],
  taller: ["#E6F4EC", "#14683F"],
  pro: ["#E6F4EC", "#14683F"],
  industrial: ["#E6F4EC", "#14683F"],
  master: ["#F3F1EA", "#44433D"],
}
const CORREOS: [string, string][] = [
  ["cot_bienvenida", "Bienvenida"],
  ["cot_prueba_4", "Quedan días de prueba"],
  ["cot_prueba_fin", "Terminó la prueba"],
  ["cot_limite", "Llegó a 5 cotizaciones"],
]

// WhatsApp de México: 10 dígitos -> 52 + número
const ligaWhatsApp = (tel: string, texto: string) => {
  let n = tel.replace(/\D/g, "")
  if (n.length === 10) n = `52${n}`
  return n.length >= 11 ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null
}

function motivo(f: Fila): string {
  if (f.plan === "prueba") return f.prueba_dias === 0 ? "Su prueba termina hoy" : `Le quedan ${f.prueba_dias} días de prueba`
  if (f.plan === "gratis" && f.cotizaciones_mes >= 5) return `En Gratis y ya hizo ${f.cotizaciones_mes} cotizaciones este mes`
  if (f.vence) return `Canceló; su plan termina el ${fecha(f.vence)}`
  return ""
}
function mensaje(f: Fila): string {
  if (f.plan === "prueba")
    return `Hola, soy de HETNA CNC. Vi que ${f.nombre} está probando el Cotizador y su prueba termina pronto. ¿Te ayudo a dejarlo listo o tienes alguna duda del plan Taller?`
  if (f.plan === "gratis")
    return `Hola, soy de HETNA CNC. Vi que ${f.nombre} ya usó sus cotizaciones gratis de este mes. ¿Te ayudo a pasarte al plan Taller para que cotices sin límite?`
  return `Hola, soy de HETNA CNC. Vi que cancelaste tu plan del Cotizador. ¿Hubo algo que no te funcionó? Me interesa mucho saberlo.`
}

function PlanChip({ f }: { f: Fila }) {
  const [bg, fg] = COLOR_PLAN[f.plan]
  return (
    <span style={{ background: bg, color: fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {NOMBRE_PLAN[f.plan]}
      {f.plan === "prueba" && f.prueba_dias !== null ? ` · ${f.prueba_dias} d` : ""}
      {["taller", "pro", "industrial"].includes(f.plan) && !f.paga ? " · cortesía" : ""}
    </span>
  )
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string | number; nota?: string }) {
  return (
    <div style={{ ...caja, marginBottom: 0, flex: "1 1 150px" }}>
      <div style={{ fontSize: 12, color: C.tenue, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.texto, marginTop: 4 }}>{valor}</div>
      {nota && <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>{nota}</div>}
    </div>
  )
}

const FILTROS: [string, string][] = [
  ["", "Todos"],
  ["prueba", "En prueba"],
  ["gratis", "Gratis"],
  ["pagan", "Pagan"],
]

export default function CotizadorPagina() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [filtro, setFiltro] = useState("")
  const [buscar, setBuscar] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    try {
      setDatos(await leer())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const lista = useMemo(() => {
    if (!datos) return []
    const q = buscar.trim().toLowerCase()
    return datos.talleres.filter((f) => {
      if (filtro === "pagan" && !f.paga) return false
      if (filtro && filtro !== "pagan" && f.plan !== filtro) return false
      return !q || `${f.nombre} ${f.correo} ${f.telefono}`.toLowerCase().includes(q)
    })
  }, [datos, filtro, buscar])

  const r = datos?.resumen
  const conversion = r && r.talleres ? Math.round((r.pagan / r.talleres) * 100) : 0

  return (
    <div style={{ padding: 20, color: C.texto, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Ventas del Cotizador</h1>
          <p style={{ margin: "4px 0 16px", color: C.tenue, fontSize: 14 }}>
            Talleres de la app hetnacnc.com/cotizador: quién se registra, quién paga y a quién hablarle esta semana.
          </p>
        </div>
        <button
          onClick={() => void cargar()}
          style={{ cursor: "pointer", borderRadius: 10, padding: "8px 14px", border: `1px solid ${C.borde}`, background: C.fondo, color: C.texto, fontWeight: 700 }}
        >
          Actualizar
        </button>
      </div>

      {error ? (
        <p style={{ color: C.rojo }}>{error}</p>
      ) : !datos || !r ? (
        <p style={{ color: C.tenue }}>Cargando…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Cifra
              titulo="Ingreso mensual"
              valor={pesos(r.ingreso_mensual_mxn)}
              nota={r.ingreso_mensual_usd ? `+ US$${r.ingreso_mensual_usd} por PayPal` : "Suscripciones activas"}
            />
            <Cifra
              titulo="Pagan"
              valor={r.pagan}
              nota={`Taller ${r.pagan_por_plan.taller} · Pro ${r.pagan_por_plan.pro} · Industrial ${r.pagan_por_plan.industrial}`}
            />
            <Cifra titulo="En prueba" valor={r.en_prueba} nota={`${r.gratis} en Gratis · ${r.cortesia} de cortesía`} />
            <Cifra titulo="Talleres" valor={r.talleres} nota={`${r.nuevos_7} nuevos esta semana · ${r.nuevos_30} en 30 días`} />
            <Cifra titulo="Conversión" valor={`${conversion}%`} nota="de los talleres registrados pagan" />
          </div>

          <div style={caja}>
            <strong>A quién hablarle esta semana ({datos.por_vencer.length})</strong>
            <p style={{ margin: "4px 0 10px", fontSize: 13, color: C.tenue }}>
              Pruebas que terminan en 7 días, talleres en Gratis que ya llegaron a 5 cotizaciones y planes cancelados que se acaban. Un
              mensaje personal en este momento convierte mucho más que cualquier correo.
            </p>
            {datos.por_vencer.length === 0 ? (
              <p style={{ color: C.tenue, fontSize: 14, margin: 0 }}>Nadie por ahora.</p>
            ) : (
              datos.por_vencer.map((f) => {
                const wa = ligaWhatsApp(f.telefono, mensaje(f))
                return (
                  <div
                    key={f.id}
                    style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 0", borderTop: `1px solid ${C.borde}` }}
                  >
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{f.nombre}</div>
                      <div style={{ fontSize: 13, color: C.tenue }}>
                        {motivo(f)} · {f.correo || "sin correo"}
                      </div>
                    </div>
                    <PlanChip f={f} />
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ background: "#1E7B3A", color: "#fff", borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                      >
                        WhatsApp
                      </a>
                    ) : f.correo ? (
                      <a href={`mailto:${f.correo}`} style={{ color: C.naranja, fontSize: 13, fontWeight: 700 }}>
                        Escribir correo
                      </a>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>

          <div style={caja}>
            <strong>Correos automáticos</strong>
            <p style={{ margin: "4px 0 10px", fontSize: 13, color: C.tenue }}>
              Salen solos todos los días a las 10:47. "Hoy" son los que saldrían en la próxima corrida.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {CORREOS.map(([k, t]) => (
                <div key={k} style={{ background: C.suave, borderRadius: 10, padding: "8px 12px", fontSize: 13, flex: "1 1 180px" }}>
                  <div style={{ fontWeight: 700 }}>{t}</div>
                  <div style={{ color: C.tenue }}>
                    Enviados: {datos.correos.enviados[k] || 0} · Hoy: {datos.correos.hoy[k] || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={caja}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <strong style={{ marginRight: 8 }}>Talleres</strong>
              {FILTROS.map(([k, t]) => (
                <button
                  key={k}
                  onClick={() => setFiltro(k)}
                  style={{
                    cursor: "pointer",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    border: `1px solid ${filtro === k ? C.naranja : C.borde}`,
                    background: filtro === k ? "#FDEEE1" : C.fondo,
                    color: filtro === k ? C.naranja : C.texto,
                  }}
                >
                  {t}
                </button>
              ))}
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar nombre, correo o teléfono"
                style={{ marginLeft: "auto", border: `1px solid ${C.borde}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, minWidth: 220, background: C.fondo, color: C.texto }}
              />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: C.tenue }}>
                    <th style={{ padding: "6px 8px" }}>Taller</th>
                    <th style={{ padding: "6px 8px" }}>Plan</th>
                    <th style={{ padding: "6px 8px" }}>Cotizaciones del mes</th>
                    <th style={{ padding: "6px 8px" }}>Registro</th>
                    <th style={{ padding: "6px 8px" }}>Renueva / vence</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.id} style={{ borderTop: `1px solid ${C.borde}` }}>
                      <td style={{ padding: "8px" }}>
                        <div style={{ fontWeight: 700 }}>{f.nombre}</div>
                        <div style={{ color: C.tenue }}>
                          {f.correo}
                          {f.telefono ? ` · ${f.telefono}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "8px" }}>
                        <PlanChip f={f} />
                      </td>
                      <td style={{ padding: "8px", fontWeight: 700, color: f.plan === "gratis" && f.cotizaciones_mes >= 5 ? C.rojo : C.texto }}>
                        {f.cotizaciones_mes}
                      </td>
                      <td style={{ padding: "8px" }}>{fecha(f.registrado)}</td>
                      <td style={{ padding: "8px" }}>{f.vence ? `Vence ${fecha(f.vence)}` : f.renueva ? `Renueva ${fecha(f.renueva)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.length === 0 && <p style={{ color: C.tenue }}>No hay talleres en esta lista.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Cotizador",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <path d="M9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" />
    </svg>
  ),
}
