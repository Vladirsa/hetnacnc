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
async function api<T>(ruta: string): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin/hetna-envios${ruta}`, { credentials: "include", headers: cabeceras() })
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
        Cada envío con su protección y la evidencia del cliente. Si Skydropx reporta un sobrepeso o hay que reclamar la SOS Protección,
        descarga aquí las fotos de medidas y báscula.
      </p>
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
