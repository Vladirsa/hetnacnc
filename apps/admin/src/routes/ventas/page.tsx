// Página "Ventas" del dashboard: todas las ventas de HETNA en una sola lista
// (tienda, licitaciones y cobros por liga de la app del Cotizador), con en qué
// va el pago, la factura y la entrega. Sólo lectura: cada venta se atiende en
// su pantalla de siempre. Fase 1.2 de docs/analisis-sap-fase0.md.
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"

type Venta = {
  canal: "tienda" | "licitacion" | "cotizador"
  id: string
  folio: string
  fecha: string
  taller: string | null
  total: number
  moneda: string
  pago: "pagado" | "pendiente" | "reembolsado" | "parcial"
  factura: "emitida" | "solicitada" | "rechazada" | "no_pedida" | "sin_proceso" | "del_taller"
  entrega: "pendiente" | "enviado" | "entregado" | "cancelado"
  saldo_taller?: string | null
  nota?: string
}
type Respuesta = { dias: number; ventas: Venta[]; resumen: Record<string, { ventas: number; total: number; pagado: number; sin_factura: number; por_entregar: number }>; avisos: string[] }

const MSG_SESION = "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."
const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", suave: "var(--bg-subtle, #f7f7f5)", texto: "var(--fg-base, #1b1b18)", tenue: "var(--fg-subtle, #6b6a63)", verde: "#0F7A4A", naranja: "#C2560A", rojo: "#b42318", azul: "#0E2A5C" }
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 14 }
const campo: CSSProperties = { border: `1px solid ${C.borde}`, borderRadius: 8, padding: "7px 9px", fontSize: 13.5, background: C.fondo, color: C.texto }
const celda: CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${C.borde}`, fontSize: 13, textAlign: "left", whiteSpace: "nowrap" }

const CANAL = { tienda: "Tienda", licitacion: "Licitación", cotizador: "App Cotizador" }
const PAGO: Record<Venta["pago"], [string, string]> = { pagado: ["Pagado", C.verde], pendiente: ["Pendiente", C.tenue], parcial: ["Anticipo", C.naranja], reembolsado: ["Reembolsado", C.rojo] }
const FACTURA: Record<Venta["factura"], [string, string]> = {
  emitida: ["Emitida", C.verde],
  solicitada: ["Solicitada", C.naranja],
  rechazada: ["Rechazada", C.rojo],
  no_pedida: ["No pedida", C.tenue],
  sin_proceso: ["Sin proceso (cobra HETNA)", C.rojo],
  del_taller: ["La emite el taller", C.tenue],
}
const ENTREGA: Record<Venta["entrega"], [string, string]> = { pendiente: ["Por entregar", C.naranja], enviado: ["Enviado", C.azul], entregado: ["Entregado", C.verde], cancelado: ["Cancelado", C.tenue] }
const pesos = (n: number, m: string) => `${m === "USD" ? "US$" : "$"}${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const Marca = ({ par }: { par: [string, string] }) => <span style={{ color: par[1], fontWeight: 700 }}>{par[0]}</span>

const VentasPage = () => {
  const [dias, setDias] = useState(30)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState("")
  const [canal, setCanal] = useState("")
  const [filtro, setFiltro] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    setDatos(null)
    try {
      const r = await fetch(`/admin/hetna-ventas?dias=${dias}`, { credentials: "include", headers: cabeceras() })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) throw new Error(MSG_SESION)
      if (!r.ok) throw new Error(j?.message || `Error ${r.status}`)
      setDatos(j)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [dias])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const lista = useMemo(() => {
    const vs = datos?.ventas || []
    return vs.filter((v) => {
      if (canal && v.canal !== canal) return false
      if (filtro === "sin_factura") return v.pago === "pagado" && (v.factura === "no_pedida" || v.factura === "sin_proceso")
      if (filtro === "por_entregar") return v.pago === "pagado" && (v.entrega === "pendiente" || v.entrega === "enviado")
      if (filtro === "reembolsadas") return v.pago === "reembolsado"
      if (filtro === "sin_pago") return v.pago === "pendiente" || v.pago === "parcial"
      return true
    })
  }, [datos, canal, filtro])

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, color: C.texto }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>🧾 Ventas</h1>
        <div style={{ fontSize: 13.5, color: C.tenue, marginTop: 4 }}>
          Todo lo que se vende en HETNA en una lista: la tienda, las licitaciones y los cobros por liga de la app del Cotizador. Sólo lectura; cada venta se atiende en su pantalla de siempre.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select style={campo} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
        </select>
        <select style={campo} value={canal} onChange={(e) => setCanal(e.target.value)}>
          <option value="">Todos los canales</option>
          {Object.entries(CANAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select style={campo} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todas</option>
          <option value="sin_factura">Pagadas sin factura</option>
          <option value="por_entregar">Pagadas por entregar</option>
          <option value="sin_pago">Sin pago o sólo anticipo</option>
          <option value="reembolsadas">Reembolsadas</option>
        </select>
        <button type="button" style={{ ...campo, cursor: "pointer", fontWeight: 700 }} onClick={() => cargar()}>Recargar</button>
      </div>

      {error && <div style={{ ...caja, color: C.rojo }}>{error}</div>}
      {datos?.avisos?.length ? <div style={{ ...caja, color: C.naranja, fontSize: 13 }}>No se pudo leer: {datos.avisos.join(" · ")}</div> : null}

      {datos && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {Object.entries(datos.resumen).map(([k, r]) => {
            const [c, m] = k.split(":")
            return (
              <div key={k} style={caja}>
                <div style={{ fontSize: 12, color: C.tenue, fontWeight: 700 }}>{CANAL[c as keyof typeof CANAL] || c} · {m}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{pesos(r.pagado, m)}</div>
                <div style={{ fontSize: 12.5, color: C.tenue }}>pagado de {pesos(r.total, m)} · {r.ventas} ventas</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>
                  {r.sin_factura ? <span style={{ color: C.rojo }}>{r.sin_factura} pagadas sin factura · </span> : null}
                  {r.por_entregar ? <span style={{ color: C.naranja }}>{r.por_entregar} por entregar</span> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ ...caja, padding: 0, overflowX: "auto" }}>
        {!datos && !error && <div style={{ padding: 14, fontSize: 13, color: C.tenue }}>Cargando…</div>}
        {datos && !lista.length && <div style={{ padding: 14, fontSize: 13, color: C.tenue }}>No hay ventas con ese filtro.</div>}
        {datos && lista.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.suave }}>
                {["Fecha", "Canal", "Folio", "Taller", "Total", "Pago", "Factura", "Entrega", "Nota"].map((h) => <th key={h} style={{ ...celda, fontWeight: 700, color: C.tenue }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={`${v.canal}:${v.id}`}>
                  <td style={celda}>{new Date(v.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</td>
                  <td style={celda}>{CANAL[v.canal]}</td>
                  <td style={celda}>{v.folio}</td>
                  <td style={{ ...celda, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{v.taller || "—"}</td>
                  <td style={{ ...celda, fontWeight: 700 }}>{pesos(v.total, v.moneda)}</td>
                  <td style={celda}><Marca par={PAGO[v.pago]} /></td>
                  <td style={celda}><Marca par={FACTURA[v.factura]} /></td>
                  <td style={celda}><Marca par={ENTREGA[v.entrega]} /></td>
                  <td style={{ ...celda, color: C.tenue }}>{[v.nota, v.saldo_taller ? `Saldo taller: ${v.saldo_taller}` : ""].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export const config = {
  label: "Ventas",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3h16v18l-3-2-3 2-2-2-2 2-3-2-3 2z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
}

export default VentasPage
