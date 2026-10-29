// Pantalla "Solicitudes" del dashboard (menú lateral).
// El seguimiento de cada solicitud de fabricación: aquí apruebas las que
// llegan (antes de que las vean los talleres), le pides datos al cliente,
// mueves la etapa a mano si hace falta y ves el historial completo.
//
// Lo que se aprueba aquí sale a los talleres y al tablero público. Si nadie
// la revisa en LICITACION_REVISION_HORAS (24 h), se aprueba sola.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Solicitud = {
  id: string
  folio: string
  modo: string
  estado: string
  etapa: string
  etapa_nombre: string
  etapa_desde: string
  creada: string
  cierra_en: string | null
  trabajo: Record<string, any> & { archivos?: { nombre: string; tamano: number }[] }
  contacto: { nombre?: string; email?: string; telefono?: string; whatsapp?: string }
  propuestas: number
  pago_estado: string | null
  pago_monto: number | null
  paqueteria: string | null
  guia: string | null
  liga_cliente: string
}
type Detalle = {
  archivos: { nombre: string; tamano: number; url: string | null }[]
  eventos: { fecha: string; etapa: string | null; etapa_nombre: string | null; actor: string; nota: string | null; visible_cliente: boolean }[]
  propuestas: { id: string; precio: number; dias: number; incluye_envio: string; condiciones: string; estado: string; taller: string; taller_email: string }[]
}

const ETAPAS: { v: string; t: string }[] = [
  { v: "en_revision", t: "Por revisar" },
  { v: "enviada_talleres", t: "Con talleres" },
  { v: "cotizada", t: "Cotizadas" },
  { v: "aceptada", t: "Aceptadas" },
  { v: "en_produccion", t: "En producción" },
  { v: "entregada", t: "Entregadas" },
  { v: "cerrada", t: "Cerradas" },
  { v: "cancelada", t: "Canceladas" },
  { v: "", t: "Todas" },
]
const TODAS_ETAPAS = [
  ["nueva", "Nueva"], ["en_revision", "En revisión"], ["enviada_talleres", "Enviada a talleres"], ["cotizada", "Cotizada"],
  ["aceptada", "Aceptada"], ["en_produccion", "En producción"], ["entregada", "Entregada"], ["cerrada", "Cerrada"], ["cancelada", "Cancelada"],
]
const CAMPOS: [string, string][] = [
  ["necesidad", "Necesita"], ["servicio", "Proceso"], ["tiene_archivo", "Archivo"], ["material", "Material"],
  ["cantidad", "Cantidad"], ["medidas", "Medidas"], ["acabado", "Acabado"], ["fecha", "Para"], ["frecuencia", "Frecuencia"],
  ["presupuesto", "Presupuesto"], ["acepta_envio", "Acepta envío"],
]
const ACTOR: Record<string, string> = { hetna: "HETNA", taller: "Taller", cliente: "Cliente", sistema: "Sistema" }

const MSG_SESION =
  "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."
const tokenLocal = (): string | null => {
  try {
    return localStorage.getItem("medusa_auth_token")
  } catch {
    return null
  }
}
const cabeceras = (): Record<string, string> => {
  const t = tokenLocal()
  return t ? { authorization: `Bearer ${t}` } : {}
}
async function api<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin/hetna-solicitudes${ruta}`, {
      credentials: "include",
      ...(cuerpo === undefined
        ? { headers: cabeceras() }
        : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
    })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-MX") : "—")
const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
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
const boton = (tipo: "primario" | "normal" | "peligro"): CSSProperties => ({
  cursor: "pointer",
  borderRadius: 10,
  padding: "8px 13px",
  fontSize: 13,
  fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none",
  background: tipo === "primario" ? C.verde : tipo === "peligro" ? C.rojo : C.fondo,
  color: tipo === "normal" ? C.texto : "#fff",
})
const area: CSSProperties = {
  width: "100%", minHeight: 60, borderRadius: 8, border: `1px solid ${C.borde}`, padding: 8, fontSize: 13,
  background: C.fondo, color: C.texto, boxSizing: "border-box", fontFamily: "inherit",
}
const soloDigitos = (t?: string) => (t || "").replace(/\D/g, "")

function Tarjeta({ s, alCambiar }: { s: Solicitud; alCambiar: () => void }) {
  const [abierta, setAbierta] = useState(false)
  const [det, setDet] = useState<Detalle | null>(null)
  const [nota, setNota] = useState("")
  const [etapa, setEtapa] = useState(s.etapa)
  const [interna, setInterna] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const t = s.trabajo || {}
  const wa = soloDigitos(s.contacto?.whatsapp || s.contacto?.telefono)

  const cargarDetalle = useCallback(() => {
    api<Detalle>(`/${s.id}`).then(setDet).catch((e) => setMsg({ ok: false, t: e.message }))
  }, [s.id])

  useEffect(() => {
    if (abierta && !det) cargarDetalle()
  }, [abierta, det, cargarDetalle])

  const accion = async (cuerpo: Record<string, unknown>, listo: string) => {
    setOcupado(true)
    setMsg(null)
    try {
      await api(`/${s.id}/accion`, cuerpo)
      setMsg({ ok: true, t: listo })
      setNota("")
      setDet(null)
      alCambiar()
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div style={caja}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 15 }}>{s.folio}</strong>
          <span style={{ background: "#FFF1E6", color: C.naranja, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
            {s.etapa_nombre}
          </span>
          <span style={{ color: C.tenue, fontSize: 12 }}>
            {s.modo === "directa" ? "Para un taller" : "Abierta"} · {s.propuestas} {s.propuestas === 1 ? "propuesta" : "propuestas"} · creada {fecha(s.creada)}
          </span>
        </div>
        <a href={s.liga_cliente} target="_blank" rel="noreferrer" style={{ color: C.naranja, fontSize: 13, fontWeight: 600 }}>
          Ver como el cliente ↗
        </a>
      </div>

      <p style={{ whiteSpace: "pre-line", margin: "10px 0", color: C.texto, fontSize: 14 }}>{t.descripcion}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 13 }}>
        {CAMPOS.filter(([k]) => t[k]).map(([k, l]) => (
          <span key={k}><span style={{ color: C.tenue }}>{l}:</span> <strong>{String(t[k])}</strong></span>
        ))}
        {(t.ciudad || t.estado_mx) && (
          <span><span style={{ color: C.tenue }}>Entrega:</span> <strong>{[t.ciudad, t.estado_mx].filter(Boolean).join(", ")}</strong></span>
        )}
        {(t.archivos || []).length > 0 && <span>📎 {(t.archivos || []).length} archivo(s)</span>}
        {t.archivo && <a href={t.archivo} target="_blank" rel="noreferrer" style={{ color: C.naranja }}>Liga del cliente ↗</a>}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: C.tenue }}>
        Cliente: <strong style={{ color: C.texto }}>{s.contacto?.nombre || "—"}</strong> · {s.contacto?.email}
        {wa && (
          <>
            {" "}·{" "}
            <a href={`https://wa.me/${wa.length === 10 ? `52${wa}` : wa}`} target="_blank" rel="noreferrer" style={{ color: C.verde, fontWeight: 600 }}>
              WhatsApp {s.contacto?.whatsapp || s.contacto?.telefono}
            </a>
          </>
        )}
        {s.pago_monto ? ` · Pago ${s.pago_estado || "—"} ${pesos(s.pago_monto)}` : ""}
        {s.guia ? ` · Guía ${s.paqueteria || ""} ${s.guia}` : ""}
      </div>

      {s.estado === "revision" && (
        <div style={{ marginTop: 12, background: C.suave, borderRadius: 10, padding: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Revisión: ¿tiene lo necesario para cotizar?</p>
          <textarea style={area} value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Para pedir información o cancelar, escribe aquí lo que le dices al cliente. Para aprobar es opcional." />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={boton("primario")} disabled={ocupado}
              onClick={() => accion({ accion: "aprobar", nota }, "Aprobada: se está enviando a los talleres.")}>
              Aprobar y enviar a talleres
            </button>
            <button type="button" style={boton("normal")} disabled={ocupado}
              onClick={() => accion({ accion: "pedir_info", nota }, "Le mandamos tu pregunta al cliente.")}>
              Pedir información al cliente
            </button>
            <button type="button" style={boton("peligro")} disabled={ocupado}
              onClick={() => window.confirm("¿Cancelar esta solicitud? El cliente recibe tu motivo por correo.") && accion({ accion: "cancelar", nota }, "Cancelada.")}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" style={boton("normal")} onClick={() => setAbierta(!abierta)}>
          {abierta ? "Ocultar detalle" : "Historial, propuestas y archivos"}
        </button>
      </div>

      {abierta && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${C.borde}`, paddingTop: 12 }}>
          {!det ? (
            <p style={{ color: C.tenue, fontSize: 13 }}>Cargando…</p>
          ) : (
            <>
              {det.archivos.length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 13 }}>
                  <strong>Archivos</strong> <span style={{ color: C.tenue }}>(ligas de 1 hora)</span>
                  {det.archivos.map((a, i) => (
                    <div key={i}>{a.url ? <a href={a.url} target="_blank" rel="noreferrer" style={{ color: C.naranja }}>⬇ {a.nombre}</a> : `${a.nombre} (no disponible)`}</div>
                  ))}
                </div>
              )}
              {det.propuestas.length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 13 }}>
                  <strong>Propuestas</strong>
                  {det.propuestas.map((p) => (
                    <div key={p.id} style={{ color: p.estado === "elegida" ? C.verde : C.texto }}>
                      {p.estado === "elegida" ? "★ " : ""}{p.taller}: {pesos(p.precio)} · {p.dias} días{p.incluye_envio === "si" ? " · con envío" : ""} · {p.taller_email}
                    </div>
                  ))}
                </div>
              )}
              <strong style={{ fontSize: 13 }}>Historial</strong>
              <ul style={{ margin: "6px 0 12px", paddingLeft: 18, fontSize: 13 }}>
                {det.eventos.map((e, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <span style={{ color: C.tenue }}>{fecha(e.fecha)} · {ACTOR[e.actor] || e.actor}</span>{" "}
                    {e.etapa_nombre && <strong>→ {e.etapa_nombre}</strong>}{" "}
                    {e.nota}
                    {!e.visible_cliente && <em style={{ color: C.tenue }}> (interna)</em>}
                  </li>
                ))}
              </ul>

              <div style={{ background: C.suave, borderRadius: 10, padding: 12 }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Mover etapa o anotar</p>
                <textarea style={area} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (el cliente la ve, salvo que la marques como interna)" />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                  <select value={etapa} onChange={(e) => setEtapa(e.target.value)}
                    style={{ borderRadius: 8, border: `1px solid ${C.borde}`, padding: "7px 8px", fontSize: 13, background: C.fondo, color: C.texto }}>
                    {TODAS_ETAPAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                  <button type="button" style={boton("normal")} disabled={ocupado || etapa === s.etapa}
                    onClick={() => accion({ accion: "etapa", etapa, nota }, "Etapa actualizada; el cliente fue avisado si aplica.")}>
                    Mover a esta etapa
                  </button>
                  <label style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} /> Nota interna
                  </label>
                  <button type="button" style={boton("normal")} disabled={ocupado || !nota.trim()}
                    onClick={() => accion({ accion: "nota", nota, interna }, "Nota guardada.")}>
                    Sólo anotar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p style={{ margin: "10px 0 0", fontSize: 13, color: msg.ok ? C.verde : C.rojo }}>{msg.t}</p>}
    </div>
  )
}

export default function SolicitudesPage() {
  const [etapa, setEtapa] = useState("en_revision")
  const [lista, setLista] = useState<Solicitud[] | null>(null)
  const [totales, setTotales] = useState<Record<string, number>>({})
  const [error, setError] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    try {
      const d = await api<{ solicitudes: Solicitud[]; totales: Record<string, number> }>(etapa ? `?etapa=${etapa}` : "")
      setLista(d.solicitudes)
      setTotales(d.totales || {})
    } catch (e) {
      setError((e as Error).message)
    }
  }, [etapa])

  useEffect(() => {
    setLista(null)
    void cargar()
  }, [cargar])

  return (
    <div style={{ padding: 16, maxWidth: 1000, color: C.texto }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Solicitudes de fabricación</h1>
      <p style={{ color: C.tenue, margin: "0 0 14px", fontSize: 14 }}>
        Aprueba las nuevas antes de que lleguen a los talleres y sigue cada pedido hasta que se entrega.
        Las que nadie revise en 24 horas se aprueban solas.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {ETAPAS.map((e) => (
          <button key={e.v} type="button" onClick={() => setEtapa(e.v)}
            style={{
              cursor: "pointer", borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 600, border: "none",
              background: etapa === e.v ? "#142033" : C.suave, color: etapa === e.v ? "#fff" : C.texto,
            }}>
            {e.t}{e.v && totales[e.v] ? ` (${totales[e.v]})` : ""}
          </button>
        ))}
      </div>
      {error ? (
        <p style={{ color: C.rojo }}>{error}</p>
      ) : !lista ? (
        <p style={{ color: C.tenue }}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>No hay solicitudes en esta lista.</p>
      ) : (
        lista.map((s) => <Tarjeta key={s.id} s={s} alCambiar={() => void cargar()} />)
      )}
    </div>
  )
}

export const config = {
  label: "Solicitudes",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 15l2 2 4-4" />
    </svg>
  ),
}
