// Pantalla "Envíos" del dashboard (menú lateral): los envíos de Envíos HETNA
// con su protección y la evidencia que subió el cliente (alto, largo, ancho y
// báscula con la guía visible). Cuando Skydropx reporta un sobrepeso o hay que
// reclamar la SOS Protección, aquí está la evidencia para mandarla.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Envio = {
  folio: string
  estado: string
  precio: number
  paqueteria: string
  paquete: { tipo?: string; largo?: number; ancho?: number; alto?: number; peso?: number } | null
  contenido: string
  contenido_estado: string | null
  proteccion_valor: number | null
  proteccion_costo: number | null
  evidencia: number
  evidencia_completa: boolean
  created_at: string
}
type Foto = { tipo: string; etiqueta: string; nombre: string; subido: string; url: string | null }
type Detalle = {
  origen: Record<string, string>
  destino: Record<string, string>
  pago_id: string | null
  acepta_evidencia: boolean
  evidencia: Foto[]
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
async function api<T>(ruta: string, cuerpo?: unknown, base = "/admin/hetna-envios"): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${base}${ruta}`, {
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
  rojo: "#b42318",
  verde: "#1E7B3A",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const ESTADOS = [
  ["", "Todos"],
  ["pendiente_pago", "Pendiente de pago"],
  ["pagado", "Pagados (generar guía)"],
  ["guia_generada", "Con guía"],
  ["cancelado", "Cancelados"],
]

// ── Sobrepesos ──────────────────────────────────────────────────────────────────────
type Sobrepeso = {
  id: string
  folio: string
  tipo: "envio" | "guia"
  referencia: string
  responsable_tipo: "cliente" | "taller"
  responsable_nombre: string | null
  responsable_email: string | null
  kg_cotizado: number | null
  kg_reportado: number | null
  monto: number
  nota: string | null
  estado: string
  estado_nombre: string
  evidencia_completa: boolean
  pago_url: string | null
  pago_id: string | null
  created_at: string
}
const sob = <T,>(ruta: string, cuerpo?: unknown) => api<T>(ruta, cuerpo, "/admin/hetna-sobrepesos")
const input: CSSProperties = { border: `1px solid ${C.borde}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, background: C.fondo, color: C.texto }

function NuevoSobrepeso({ inicial, alGuardar }: { inicial?: { tipo: "envio" | "guia"; folio: string }; alGuardar: () => void }) {
  const [d, setD] = useState({ tipo: inicial?.tipo || "envio", folio: inicial?.folio || "", kg_cotizado: "", kg_reportado: "", monto: "", nota: "", disputar: false })
  const [estado, setEstado] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const cambia = (k: string, v: unknown) => setD((x) => ({ ...x, [k]: v }))
  const guardar = async () => {
    setEstado("")
    setTrabajando(true)
    try {
      const r = await sob<{ folio: string; correo: boolean; pago_url: string | null; evidencia_completa: boolean }>("", {
        ...d,
        kg_cotizado: d.kg_cotizado ? Number(d.kg_cotizado) : undefined,
        kg_reportado: d.kg_reportado ? Number(d.kg_reportado) : undefined,
        monto: Number(d.monto),
      })
      setEstado(
        `${r.folio} registrado. ${d.disputar ? "Queda en disputa (no se cobró todavía)." : r.correo ? "Se le mandó la liga de pago por correo." : "OJO: no salió el correo; revisa Resend/Mercado Pago."}` +
          (r.evidencia_completa ? " Tiene la evidencia completa: considera disputarlo." : " No tiene la evidencia completa.")
      )
      setD((x) => ({ ...x, folio: "", kg_cotizado: "", kg_reportado: "", monto: "", nota: "" }))
      alGuardar()
    } catch (e) {
      setEstado((e as Error).message)
    } finally {
      setTrabajando(false)
    }
  }
  return (
    <div style={{ ...caja, background: C.suave }}>
      <strong>Registrar un sobrepeso</strong>
      <p style={{ margin: "4px 0 10px", fontSize: 13, color: C.tenue }}>
        Copia lo que reportó Skydropx. “Cobrar” le manda al responsable una liga de pago y le bloquea nuevas guías hasta que pague.
        “Disputar primero” lo deja en espera mientras lo peleas con la evidencia.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={d.tipo} onChange={(e) => cambia("tipo", e.target.value)} style={input}>
          <option value="envio">Envío HETNA (cliente)</option>
          <option value="guia">Guía de pedido (taller)</option>
        </select>
        <input value={d.folio} onChange={(e) => cambia("folio", e.target.value)} placeholder={d.tipo === "envio" ? "ENV-00012" : "Pedido # (ej. 123)"} style={{ ...input, width: 140 }} />
        <input value={d.kg_cotizado} onChange={(e) => cambia("kg_cotizado", e.target.value)} placeholder="kg cotizados" inputMode="decimal" style={{ ...input, width: 110 }} />
        <input value={d.kg_reportado} onChange={(e) => cambia("kg_reportado", e.target.value)} placeholder="kg reportados" inputMode="decimal" style={{ ...input, width: 115 }} />
        <input value={d.monto} onChange={(e) => cambia("monto", e.target.value)} placeholder="Monto $" inputMode="decimal" style={{ ...input, width: 100 }} />
      </div>
      <input value={d.nota} onChange={(e) => cambia("nota", e.target.value)} placeholder="Nota (ej. guía 6461244088861, Paquetexpress)" style={{ ...input, width: "100%", marginTop: 8, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={d.disputar} onChange={(e) => cambia("disputar", e.target.checked)} /> Disputar primero (no cobrar todavía)
        </label>
        <button type="button" disabled={trabajando || !d.folio || !d.monto} onClick={guardar}
          style={{ cursor: "pointer", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, background: d.disputar ? "#142033" : "#C2560A", color: "#fff", opacity: trabajando || !d.folio || !d.monto ? 0.5 : 1 }}>
          {trabajando ? "Guardando…" : d.disputar ? "Registrar en disputa" : "Registrar y cobrar"}
        </button>
      </div>
      {estado && <p style={{ margin: "8px 0 0", fontSize: 13 }}>{estado}</p>}
    </div>
  )
}

const ACCIONES: Record<string, [string, string][]> = {
  por_cobrar: [["disputar", "Pasar a disputa"], ["pagado", "Pagó por fuera"], ["descontado", "Descontado al taller"], ["anular", "Anular"]],
  en_disputa: [["cobrar", "Perdimos: cobrar"], ["anular", "Ganamos: anular"]],
  pagado: [],
  descontado: [],
  anulado: [["cobrar", "Volver a cobrar"]],
}

function Sobrepesos() {
  const [lista, setLista] = useState<Sobrepeso[] | null>(null)
  const [totales, setTotales] = useState<Record<string, { n: number; monto: number }>>({})
  const [error, setError] = useState("")
  const cargar = useCallback(async () => {
    try {
      const d = await sob<{ sobrepesos: Sobrepeso[]; totales: Record<string, { n: number; monto: number }> }>("")
      setLista(d.sobrepesos)
      setTotales(d.totales || {})
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])
  const accion = async (s: Sobrepeso, a: string) => {
    if (a === "cobrar" && !confirm(`Se le mandará a ${s.responsable_email || "el responsable"} una liga para pagar ${pesos(s.monto)}. ¿Seguir?`)) return
    try {
      await sob(`/${s.id}`, { accion: a })
      await cargar()
    } catch (e) {
      alert((e as Error).message)
    }
  }
  return (
    <>
      <NuevoSobrepeso alGuardar={() => void cargar()} />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, marginBottom: 12, color: C.tenue }}>
        {Object.entries(totales).map(([k, v]) => (
          <span key={k}>
            {k.replace("_", " ")}: <strong style={{ color: C.texto }}>{v.n}</strong> ({pesos(v.monto)})
          </span>
        ))}
      </div>
      {error ? (
        <p style={{ color: C.rojo }}>{error}</p>
      ) : !lista ? (
        <p style={{ color: C.tenue }}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>No hay sobrepesos registrados.</p>
      ) : (
        lista.map((s) => (
          <div key={s.id} style={caja}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13 }}>
                <strong style={{ fontSize: 15 }}>{s.folio}</strong> · {s.referencia} · {s.responsable_tipo === "taller" ? "Taller" : "Cliente"}{" "}
                {s.responsable_nombre} ({s.responsable_email || "sin correo"})
                <div style={{ marginTop: 4 }}>
                  {s.kg_cotizado != null && s.kg_reportado != null ? `${s.kg_cotizado} kg → ${s.kg_reportado} kg · ` : ""}
                  <strong>{pesos(s.monto)}</strong> · {fecha(s.created_at)}
                  {s.nota ? ` · ${s.nota}` : ""}
                </div>
                <div style={{ marginTop: 4, color: s.evidencia_completa ? C.verde : C.rojo }}>
                  {s.evidencia_completa ? "✓ Tiene evidencia completa" : "Sin evidencia completa"}
                  {s.pago_id ? ` · Pago MP ${s.pago_id}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "inline-block", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, background: C.suave }}>{s.estado_nombre}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 8 }}>
                  {(ACCIONES[s.estado] || [])
                    .filter(([a]) => a !== "descontado" || s.responsable_tipo === "taller")
                    .map(([a, t]) => (
                      <button key={a} type="button" onClick={() => accion(s, a)}
                        style={{ cursor: "pointer", border: `1px solid ${C.borde}`, background: C.fondo, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700 }}>
                        {t}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  )
}

function Tarjeta({ e }: { e: Envio }) {
  const [abierto, setAbierto] = useState(false)
  const [d, setD] = useState<Detalle | null>(null)
  const [error, setError] = useState("")
  const abrir = async () => {
    setAbierto(!abierto)
    if (d || abierto) return
    try {
      setD(await api<Detalle>(`/${e.folio}`))
    } catch (x) {
      setError((x as Error).message)
    }
  }
  const p = e.paquete || {}
  return (
    <div style={caja}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 16 }}>{e.folio}</strong>{" "}
          <span style={{ color: C.tenue, fontSize: 13 }}>
            · {e.paqueteria} · {fecha(e.created_at)}
          </span>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {p.tipo} · {p.largo}×{p.ancho}×{p.alto} cm · {p.peso} kg cotizados · {e.contenido} ({e.contenido_estado || "—"})
          </div>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            {pesos(e.precio)} · {e.estado}
            {e.proteccion_valor ? (
              <strong style={{ color: C.verde }}> · SOS Protección por {pesos(e.proteccion_valor)} (cobró {pesos(e.proteccion_costo || 0)})</strong>
            ) : null}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              display: "inline-block", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700,
              background: e.evidencia_completa ? "#E6F4EC" : "#FDECEA", color: e.evidencia_completa ? C.verde : C.rojo,
            }}
          >
            {e.evidencia_completa ? "Evidencia completa" : `Evidencia: ${e.evidencia} de 4`}
          </span>
          <div>
            <button type="button" onClick={abrir} style={{ marginTop: 8, cursor: "pointer", border: `1px solid ${C.borde}`, background: C.fondo, borderRadius: 10, padding: "6px 12px", fontWeight: 700, fontSize: 13 }}>
              {abierto ? "Ocultar" : "Ver detalle y fotos"}
            </button>
          </div>
        </div>
      </div>
      {abierto && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${C.borde}`, paddingTop: 12, fontSize: 13 }}>
          {error && <p style={{ color: C.rojo }}>{error}</p>}
          {!d && !error && <p style={{ color: C.tenue }}>Cargando…</p>}
          {d && (
            <>
              <p style={{ margin: "0 0 6px" }}>
                <strong>Remitente:</strong> {d.origen.nombre} · {d.origen.telefono} · {d.origen.email} · C.P. {d.origen.cp}
              </p>
              <p style={{ margin: "0 0 6px" }}>
                <strong>Destinatario:</strong> {d.destino.nombre} · {d.destino.telefono} · C.P. {d.destino.cp}
              </p>
              <p style={{ margin: "0 0 10px", color: C.tenue }}>
                Pago MP: {d.pago_id || "—"} · Aceptó cobros por sobrepeso y evidencia: {d.acepta_evidencia ? "sí" : "no (envío anterior al cambio)"}
              </p>
              {d.evidencia.length === 0 ? (
                <p style={{ color: C.rojo }}>El cliente no ha subido evidencia.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                  {d.evidencia.map((f) => (
                    <a key={`${f.tipo}-${f.subido}`} href={f.url || undefined} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", border: `1px solid ${C.borde}`, borderRadius: 10, overflow: "hidden", color: C.texto, textDecoration: "none" }}>
                      {f.url ? (
                        <img src={f.url} alt={f.etiqueta} style={{ width: "100%", height: 110, objectFit: "cover", display: "block", background: C.suave }} />
                      ) : (
                        <div style={{ height: 110, background: C.suave }} />
                      )}
                      <div style={{ padding: 8 }}>
                        <strong style={{ fontSize: 12 }}>{f.etiqueta}</strong>
                        <div style={{ fontSize: 11, color: C.tenue }}>{fecha(f.subido)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
              <p style={{ margin: "10px 0 0", fontSize: 12, color: C.tenue }}>
                Las ligas de las fotos duran 1 hora. Descárgalas para mandarlas a Skydropx si hay sobrepeso o reclamo.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function EnviosPage() {
  const [vista, setVista] = useState<"envios" | "sobrepesos">("envios")
  const [estado, setEstado] = useState("")
  const [lista, setLista] = useState<Envio[] | null>(null)
  const [error, setError] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    try {
      setLista((await api<{ envios: Envio[] }>(estado ? `?estado=${estado}` : "")).envios)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [estado])

  useEffect(() => {
    setLista(null)
    void cargar()
  }, [cargar])

  return (
    <div style={{ padding: 16, maxWidth: 1000, color: C.texto }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Envíos HETNA</h1>
      <p style={{ color: C.tenue, margin: "0 0 14px", fontSize: 14 }}>
        Cada envío con su protección y la evidencia del cliente. Si Skydropx reporta un sobrepeso, regístralo en Sobrepesos (también los
        de guías de talleres) y descarga aquí las fotos de medidas y báscula para disputarlo o reclamar la SOS Protección.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {([["envios", "Envíos"], ["sobrepesos", "Sobrepesos"]] as const).map(([v, t]) => (
          <button key={v} type="button" onClick={() => setVista(v)}
            style={{
              cursor: "pointer", borderRadius: 10, padding: "8px 14px", fontSize: 14, fontWeight: 700,
              border: `1px solid ${vista === v ? "#C2560A" : C.borde}`, background: vista === v ? "#FFF1E6" : C.fondo, color: C.texto,
            }}>
            {t}
          </button>
        ))}
      </div>
      {vista === "sobrepesos" ? (
        <Sobrepesos />
      ) : (
      <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {ESTADOS.map(([v, t]) => (
          <button key={v} type="button" onClick={() => setEstado(v)}
            style={{
              cursor: "pointer", borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 600, border: "none",
              background: estado === v ? "#142033" : C.suave, color: estado === v ? "#fff" : C.texto,
            }}>
            {t}
          </button>
        ))}
      </div>
      {error ? (
        <p style={{ color: C.rojo }}>{error}</p>
      ) : !lista ? (
        <p style={{ color: C.tenue }}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>No hay envíos en esta lista.</p>
      ) : (
        lista.map((e) => <Tarjeta key={e.folio} e={e} />)
      )}
      </>
      )}
    </div>
  )
}

export const config = {
  label: "Envíos",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  ),
}
