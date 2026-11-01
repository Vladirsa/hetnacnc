// @ts-nocheck
// Pantalla "Mi saldo" del panel del taller (/seller > Mi saldo).
// Lo que HETNA le debe al taller por sus ventas y lo que ya le pagó.
//   Diseño digital: disponible al momento.
//   Producto físico: disponible N días después de entregado.
// El pago lo hace HETNA por transferencia a la cuenta que el taller guardó.
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Cartera = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15V7" />
    <circle cx="16" cy="14" r="1.4" />
  </svg>
)

export const config: RouteConfig = {
  label: "Mi saldo",
  icon: Cartera,
}

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 12 },
  meta: { color: "#6B675C", fontSize: 13, margin: "2px 0 0" },
}
const COLOR = {
  pendiente: { c: "#8A5A00", bg: "#FFF6DB" },
  disponible: { c: "#1E7B3A", bg: "#E7F5EC" },
  pagado: { c: "#142033", bg: "#EEF1F6" },
  retenido: { c: "#6B675C", bg: "#F3F1EA" },
}
const dinero = (n, m = "mxn") =>
  `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(m).toUpperCase()}`
const fecha = (d) => (d ? new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—")

export default function SaldoPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/vendor/hetna-saldo", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setDatos)
      .catch(() => setError("No se pudo cargar tu saldo. Recarga la página."))
  }, [])

  if (error) return <div style={S.page}><p style={{ color: "#B3261E" }}>{error}</p></div>
  if (!datos) return <div style={S.page}><p style={S.meta}>Cargando…</p></div>

  const monedas = Object.keys(datos.resumen || {})
  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Mi saldo</h1>
      <p style={S.meta}>
        Diseños digitales: disponibles al momento. Productos físicos: disponibles {datos.dias_liberacion} días después de
        entregados. HETNA te transfiere lo disponible a la cuenta que guardaste en tu perfil.
      </p>

      {monedas.length === 0 ? (
        <div style={{ ...S.card, marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Aún no tienes ventas registradas.</p>
          <p style={S.meta}>Cuando vendas, aquí verás cuánto tienes pendiente, disponible y pagado.</p>
        </div>
      ) : (
        monedas.map((m) => (
          <div key={m} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, margin: "16px 0" }}>
            {["pendiente", "disponible", "pagado"].map((e) => (
              <div key={e} style={{ ...S.card, marginBottom: 0, background: COLOR[e].bg, borderColor: "transparent" }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: COLOR[e].c }}>
                  {e === "pendiente" ? "Pendiente de entrega" : e === "disponible" ? "Disponible" : "Ya pagado"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700, color: "#142033" }}>{dinero(datos.resumen[m][e], m)}</p>
              </div>
            ))}
          </div>
        ))
      )}

      {datos.movimientos.length > 0 && (
        <div style={S.card}>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Tus ventas</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6B675C" }}>
                  <th style={{ padding: "6px 8px" }}>Pedido</th>
                  <th style={{ padding: "6px 8px" }}>Venta</th>
                  <th style={{ padding: "6px 8px" }}>Comisión</th>
                  <th style={{ padding: "6px 8px" }}>Te toca</th>
                  <th style={{ padding: "6px 8px" }}>Estado</th>
                  <th style={{ padding: "6px 8px" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {datos.movimientos.map((f) => (
                  <tr key={f.order_id} style={{ borderTop: "1px solid #EFECE4" }}>
                    <td style={{ padding: "8px" }}>#{f.display_id ?? "—"}{f.digital ? " · digital" : ""}</td>
                    <td style={{ padding: "8px" }}>{dinero(f.productos, f.moneda)}</td>
                    <td style={{ padding: "8px" }}>−{dinero(f.comision, f.moneda)}</td>
                    <td style={{ padding: "8px", fontWeight: 700 }}>{dinero(f.neto, f.moneda)}</td>
                    <td style={{ padding: "8px" }}>
                      <span style={{ background: COLOR[f.estado]?.bg, color: COLOR[f.estado]?.c, borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>
                        {f.estado_nombre}
                      </span>
                      {f.estado === "pendiente" && f.disponible_en && (
                        <span style={{ display: "block", ...S.meta }}>Se libera el {fecha(f.disponible_en)}</span>
                      )}
                      {f.estado === "pagado" && f.pago_referencia && (
                        <span style={{ display: "block", ...S.meta }}>Ref. {f.pago_referencia}</span>
                      )}
                      {f.estado === "retenido" && f.motivo && <span style={{ display: "block", ...S.meta }}>{f.motivo}</span>}
                    </td>
                    <td style={{ padding: "8px" }}>{fecha(f.pagado_en || f.creado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
