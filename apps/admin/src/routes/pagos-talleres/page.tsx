// Pantalla "Pagos a talleres" del dashboard: cuánto se le debe a cada taller.
// Lo disponible ya se le puede transferir (SPEI a la cuenta que guardó en su
// perfil). Después de transferir, se marca como pagado con la clave de rastreo.
// Los sobrepesos "Descontado al taller" (Envíos > Sobrepesos) entran aquí como
// un renglón negativo: ya van restados del disponible. Si el disponible queda
// negativo, se arrastra al siguiente pago. Cada pedido se puede retener (no se
// paga) o liberar desde "Ver pedidos".
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Taller = {
  seller_id: string
  nombre: string
  email: string | null
  titular: string | null
  cuenta: string | null
  paypal?: string | null
  pais_envio?: string | null
  tarjeta_verificada?: boolean
  moneda: string
  pendiente: number
  disponible: number
  pagado: number
  retenido: number
  descuentos?: number
}
type Movimiento = {
  order_id: string
  display_id: number | null
  moneda: string
  neto: number
  estado: string
  estado_nombre: string
  digital: boolean
  motivo: string | null
  ajuste?: boolean
  disponible_en: string | null
  creado: string
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
  chico: { background: "#fff", color: "#142033", border: "1px solid #C9C5BA", borderRadius: 8, padding: "4px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer" },
}

const enviar = (cuerpo: Record<string, unknown>) =>
  fetch("/admin/hetna-saldos/pagar", {
    method: "POST",
    credentials: "include",
    headers: { ...cabeceras(), "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => null)

// Pedidos de un taller, con Retener / Liberar
function Pedidos({ sellerId, moneda, alCambiar }: { sellerId: string; moneda: string; alCambiar: () => void }) {
  const [lista, setLista] = useState<Movimiento[] | null>(null)
  const [msg, setMsg] = useState("")
  const [ocupado, setOcupado] = useState("")
  const cargar = useCallback(() => {
    fetch(`/admin/hetna-saldos?seller_id=${encodeURIComponent(sellerId)}`, { credentials: "include", headers: cabeceras() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setLista(((d.movimientos || []) as Movimiento[]).filter((m) => m.moneda === moneda)))
      .catch(() => setMsg("No se pudieron cargar los pedidos."))
  }, [sellerId, moneda])
  useEffect(cargar, [cargar])
  const cambiar = async (m: Movimiento, liberar: boolean) => {
    let cuerpo: Record<string, unknown>
    if (liberar) {
      if (!confirm(`¿Liberar el pedido #${m.display_id ?? "—"}? Vuelve a contar para pagarle al taller.`)) return
      cuerpo = { order_id: m.order_id, liberar: true }
    } else {
      const motivo = prompt(`¿Por qué se retiene el pedido #${m.display_id ?? "—"}? (no se le paga al taller mientras tanto)`)
      if (motivo === null) return
      cuerpo = { order_id: m.order_id, retener: motivo.trim() || "Retenido por HETNA" }
    }
    setOcupado(m.order_id)
    setMsg("")
    const r = await enviar(cuerpo)
    setOcupado("")
    if (!r?.ok) setMsg((await r?.json().catch(() => null))?.message || "No se pudo guardar. Intenta de nuevo.")
    cargar()
    alCambiar()
  }
  if (!lista) return <p style={S.meta}>{msg || "Cargando pedidos…"}</p>
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #EFECE4", paddingTop: 8 }}>
      {msg && <p style={{ color: "#B3261E", fontSize: 13, margin: "0 0 6px" }}>{msg}</p>}
      {lista.length === 0 ? (
        <p style={S.meta}>Sin pedidos.</p>
      ) : (
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {lista.map((m) => (
              <tr key={m.order_id} style={{ borderTop: "1px solid #F3F1EA" }}>
                <td style={{ padding: "6px 4px" }}>
                  {m.ajuste ? <span style={{ color: "#B3261E", fontWeight: 600 }}>{m.motivo || "Descuento por sobrepeso"}</span> : <>#{m.display_id ?? "—"}{m.digital ? " · digital" : ""}</>}
                </td>
                <td style={{ padding: "6px 4px", fontWeight: 600, color: m.neto < 0 ? "#B3261E" : undefined }}>{dinero(m.neto, m.moneda)}</td>
                <td style={{ padding: "6px 4px" }}>
                  {m.estado_nombre}
                  {m.estado === "retenido" && m.motivo && <span style={{ display: "block", ...S.meta }}>{m.motivo}</span>}
                </td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>
                  {!m.ajuste && (m.estado === "pendiente" || m.estado === "disponible") && (
                    <button style={S.chico} disabled={ocupado === m.order_id} onClick={() => cambiar(m, false)}>Retener</button>
                  )}
                  {!m.ajuste && m.estado === "retenido" && (
                    <button style={S.chico} disabled={ocupado === m.order_id} onClick={() => cambiar(m, true)}>Liberar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Fila({ t, alPagar }: { t: Taller; alPagar: () => void }) {
  const [ref, setRef] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const [msg, setMsg] = useState("")
  const [verPedidos, setVerPedidos] = useState(false)
  const pagar = async () => {
    // Proveedor extranjero con PayPal: se le paga por PayPal (referencia = ID de la transacción)
    const porPaypal = !!t.paypal && (!t.cuenta || !!t.pais_envio)
    if (ref.trim().length < 4) return setMsg(porPaypal ? "Pon el ID de la transacción de PayPal." : "Pon la clave de rastreo del SPEI.")
    if (t.tarjeta_verificada === false && !confirm(`${t.nombre} no ha verificado su tarjeta. Lo recomendado es pedírsela antes de transferirle. ¿Marcar el pago de todos modos?`)) return
    if (!confirm(`¿Ya le transferiste ${dinero(t.disponible, t.moneda)} a ${t.nombre}?`)) return
    setTrabajando(true)
    setMsg("")
    const r = await fetch("/admin/hetna-saldos/pagar", {
      method: "POST",
      credentials: "include",
      headers: { ...cabeceras(), "content-type": "application/json" },
      // Lo que se vio y se transfirió: si el disponible cambió, el servidor no marca nada
      body: JSON.stringify({ seller_id: t.seller_id, referencia: ref.trim(), metodo: porPaypal ? "paypal" : "spei", total: t.disponible, moneda: t.moneda }),
    }).catch(() => null)
    setTrabajando(false)
    if (r?.ok) {
      const j = await r.json().catch(() => ({}))
      if (j?.aviso) alert(j.aviso)
      alPagar()
    }
    else setMsg((await r?.json().catch(() => null))?.message || "No se pudo marcar. Intenta de nuevo.")
  }
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{t.nombre}</p>
          <p style={S.meta}>{t.email || "sin correo"}</p>
          <p style={S.meta}>
            Cuenta: {t.cuenta ? `${t.cuenta} · ${t.titular || "sin titular"}` : t.paypal ? "—" : "⚠ el taller no ha guardado su cuenta"}
          </p>
          {t.paypal && (
            <p style={{ ...S.meta, fontWeight: 600 }}>
              PayPal: {t.paypal}
              {t.pais_envio ? ` · proveedor en ${t.pais_envio} (págale por PayPal)` : ""}
            </p>
          )}
          {t.tarjeta_verificada === false && (
            <p style={{ ...S.meta, color: "#9A6A06", fontWeight: 600 }}>⚠ No ha verificado su tarjeta: pídesela antes de transferirle.</p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 12, color: t.disponible < 0 ? "#B3261E" : "#1E7B3A", fontWeight: 700 }}>
            {t.disponible < 0 ? "SALDO EN CONTRA (SE DESCUENTA DEL SIGUIENTE PAGO)" : "DISPONIBLE PARA PAGAR"}
          </p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: t.disponible < 0 ? "#B3261E" : undefined }}>{dinero(t.disponible, t.moneda)}</p>
          {!!t.descuentos && (
            <p style={{ ...S.meta, color: "#B3261E" }}>Incluye descuentos por sobrepeso: {dinero(t.descuentos, t.moneda)}</p>
          )}
          <p style={S.meta}>Pendiente de entrega: {dinero(t.pendiente, t.moneda)} · Pagado: {dinero(t.pagado, t.moneda)}</p>
          {t.retenido !== 0 && <p style={{ ...S.meta, color: "#9A6A06" }}>Retenido (no se paga): {dinero(t.retenido, t.moneda)}</p>}
          <button style={{ ...S.chico, marginTop: 6 }} onClick={() => setVerPedidos(!verPedidos)}>
            {verPedidos ? "Ocultar pedidos" : "Ver pedidos"}
          </button>
        </div>
      </div>
      {verPedidos && <Pedidos sellerId={t.seller_id} moneda={t.moneda} alCambiar={alPagar} />}
      {t.disponible > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input style={S.input} placeholder={t.paypal && (!t.cuenta || t.pais_envio) ? "ID de la transacción de PayPal" : "Clave de rastreo del SPEI"} value={ref} onChange={(e) => setRef(e.target.value)} />
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
  // Un saldo en contra no resta de lo que se les paga a los demás talleres
  const total = datos.talleres.reduce((s, t) => s + (t.moneda === "mxn" ? Math.max(0, t.disponible) : 0), 0)
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
