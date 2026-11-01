// Pantalla "Pagos a talleres" del dashboard: cuánto se le debe a cada taller.
// Lo disponible ya se le puede transferir (SPEI a la cuenta que guardó en su
// perfil). Después de transferir, se marca como pagado con la clave de rastreo.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Taller = {
  seller_id: string
  nombre: string
  email: string | null
  titular: string | null
  cuenta: string | null
  moneda: string
  pendiente: number
  disponible: number
  pagado: number
  retenido: number
}

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
const dinero = (n: number, m: string) =>
  `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m.toUpperCase()}`

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "24px 16px 80px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 12 },
  meta: { color: "#6B675C", fontSize: 13, margin: "2px 0 0" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  input: { border: "1px solid #C9C5BA", borderRadius: 8, padding: "7px 10px", fontSize: 13, minWidth: 220 },
}

function Fila({ t, alPagar }: { t: Taller; alPagar: () => void }) {
  const [ref, setRef] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const [msg, setMsg] = useState("")
  const pagar = async () => {
    if (ref.trim().length < 4) return setMsg("Pon la clave de rastreo del SPEI.")
    if (!confirm(`¿Ya le transferiste ${dinero(t.disponible, t.moneda)} a ${t.nombre}?`)) return
    setTrabajando(true)
    setMsg("")
    const r = await fetch("/admin/hetna-saldos/pagar", {
      method: "POST",
      credentials: "include",
      headers: { ...cabeceras(), "content-type": "application/json" },
      body: JSON.stringify({ seller_id: t.seller_id, referencia: ref.trim(), metodo: "spei" }),
    }).catch(() => null)
    setTrabajando(false)
    if (r?.ok) alPagar()
    else setMsg("No se pudo marcar. Intenta de nuevo.")
  }
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{t.nombre}</p>
          <p style={S.meta}>{t.email || "sin correo"}</p>
          <p style={S.meta}>
            Cuenta: {t.cuenta ? `${t.cuenta} · ${t.titular || "sin titular"}` : "⚠ el taller no ha guardado su cuenta"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#1E7B3A", fontWeight: 700 }}>DISPONIBLE PARA PAGAR</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{dinero(t.disponible, t.moneda)}</p>
          <p style={S.meta}>Pendiente de entrega: {dinero(t.pendiente, t.moneda)} · Pagado: {dinero(t.pagado, t.moneda)}</p>
        </div>
      </div>
      {t.disponible > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input style={S.input} placeholder="Clave de rastreo del SPEI" value={ref} onChange={(e) => setRef(e.target.value)} />
          <button style={S.btn} disabled={trabajando} onClick={pagar}>
            {trabajando ? "Guardando…" : "Marcar como pagado"}
          </button>
          {msg && <span style={{ color: "#B3261E", fontSize: 13 }}>{msg}</span>}
        </div>
      )}
    </div>
  )
}

export default function PagosTalleresPage() {
  const [datos, setDatos] = useState<{ dias_liberacion: number; talleres: Taller[] } | null>(null)
  const [error, setError] = useState("")
  const cargar = useCallback(() => {
    fetch("/admin/hetna-saldos", { credentials: "include", headers: cabeceras() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setDatos)
      .catch(() => setError("No se pudo cargar. Cierra sesión, vuelve a entrar y recarga."))
  }, [])
  useEffect(cargar, [cargar])

  if (error) return <div style={S.page}><p style={{ color: "#B3261E" }}>{error}</p></div>
  if (!datos) return <div style={S.page}><p style={S.meta}>Cargando…</p></div>
  const total = datos.talleres.reduce((s, t) => s + (t.moneda === "mxn" ? t.disponible : 0), 0)
  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Pagos a talleres</h1>
      <p style={S.meta}>
        Digital: disponible al momento. Físico: {datos.dias_liberacion} días después de entregado (guía de Skydropx o
        "Ya lo recibí" del comprador). Ya trae descontada la comisión de HETNA.
      </p>
      <div style={{ ...S.card, marginTop: 16, background: "#E7F5EC", borderColor: "transparent" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1E7B3A" }}>TOTAL POR PAGAR HOY (MXN)</p>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{dinero(total, "mxn")}</p>
      </div>
      {datos.talleres.length === 0 ? (
        <p style={S.meta}>Todavía no hay ventas registradas.</p>
      ) : (
        datos.talleres.map((t) => <Fila key={`${t.seller_id}-${t.moneda}`} t={t} alPagar={cargar} />)
      )}
    </div>
  )
}

export const config = {
  label: "Pagos a talleres",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15V7" />
      <circle cx="16" cy="14" r="1.4" />
    </svg>
  ),
}
