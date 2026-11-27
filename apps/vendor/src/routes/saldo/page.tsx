// @ts-nocheck
// Pantalla "Mi saldo" del panel del taller (/seller > Mi saldo).
// Lo que HETNA le debe al taller por sus ventas y lo que ya le pagó.
//   Diseño digital: disponible al momento.
//   Producto físico: disponible N días después de entregado.
// El pago lo hace HETNA por transferencia a la cuenta que el taller guardó.
import { T } from "../../lib/idioma"
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
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: Cartera,
}

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  card: { background: "rgba(255,255,255,0.78)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", backdropFilter: "blur(14px) saturate(1.2)", border: "1px solid rgba(20,32,51,0.06)", boxShadow: "0 8px 24px -12px rgba(20,32,51,0.18)", borderRadius: 16, padding: 18, marginBottom: 14 },
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

  if (error) return <div style={S.page}><p style={{ color: "#B3261E" }}><T>{error}</T></p></div>
  if (!datos) return <div style={S.page}><p style={S.meta}><T>Cargando…</T></p></div>

  const monedas = Object.keys(datos.resumen || {})
  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px", color: "#142033", letterSpacing: "-0.02em" }}><T>Mi saldo</T></h1>
      <p style={S.meta}>
        <T>Diseños digitales: disponibles al momento. Productos físicos: disponibles en cuanto el cliente libera el pago, o
        solos</T> <T>{datos.dias_liberacion}</T> <T>días después de entregados. Si el cliente reporta un problema, el pago se congela
        (ve Reclamos). HETNA te transfiere lo disponible a la cuenta que guardaste en tu perfil.</T>
      </p>

      {monedas.length === 0 ? (
        <div style={{ ...S.card, marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}><T>Aún no tienes ventas registradas.</T></p>
          <p style={S.meta}><T>Cuando vendas, aquí verás cuánto tienes pendiente, disponible y pagado.</T></p>
        </div>
      ) : (
        monedas.map((m) => (
          <div key={m} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, margin: "16px 0" }}>
            {["pendiente", "disponible", "pagado"].map((e) => (
              <div key={e} style={{ ...S.card, marginBottom: 0, ...(e === "disponible" ? { background: "linear-gradient(135deg,#142033,#22334F)", color: "#fff" } : {}) }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: e === "disponible" ? "#F2A65E" : COLOR[e].c }}>
                  <T>{e === "pendiente" ? "Pendiente de entrega" : e === "disponible" ? "Disponible" : "Ya pagado"}</T>
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, color: e === "disponible" ? "#fff" : "#142033", letterSpacing: "-0.02em" }}>{dinero(datos.resumen[m][e], m)}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: e === "disponible" ? "rgba(255,255,255,0.7)" : "#6B675C" }}>
                  <T>{e === "pendiente" ? `se libera ${datos.dias_liberacion} días después de entregar` : e === "disponible" ? "listo para transferirte" : "ya está en tu cuenta"}</T>
                </p>
              </div>
            ))}
          </div>
        ))
      )}

      {datos.movimientos.length > 0 && (
        <div style={S.card}>
          <p style={{ margin: "0 0 8px", fontWeight: 800, color: "#142033" }}><T>Tus ventas</T></p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6B675C" }}>
                  <th style={{ padding: "6px 8px" }}><T>Pedido</T></th>
                  <th style={{ padding: "6px 8px" }}><T>Venta</T></th>
                  <th style={{ padding: "6px 8px" }}><T>Comisión</T></th>
                  <th style={{ padding: "6px 8px" }}><T>Te toca</T></th>
                  <th style={{ padding: "6px 8px" }}><T>Estado</T></th>
                  <th style={{ padding: "6px 8px" }}><T>Fecha</T></th>
                </tr>
              </thead>
              <tbody>
                {datos.movimientos.map((f) => (
                  <tr key={f.order_id} style={{ borderTop: "1px solid #EFECE4" }}>
                    <td style={{ padding: "8px" }}>
                      {/* Descuento por sobrepeso de una guía de HETNA o por un reclamo: resta de tu siguiente pago */}
                      {f.ajuste ? <span style={{ color: "#B3261E", fontWeight: 600 }}><T>{f.motivo || "Descuento"}</T></span> : <>#<T>{f.display_id ?? "—"}</T><T>{f.digital ? " · digital" : ""}</T></>}
                    </td>
                    <td style={{ padding: "8px" }}>{dinero(f.productos, f.moneda)}</td>
                    <td style={{ padding: "8px" }}>−{dinero(f.comision, f.moneda)}</td>
                    <td style={{ padding: "8px", fontWeight: 700 }}>{dinero(f.neto, f.moneda)}</td>
                    <td style={{ padding: "8px" }}>
                      <span style={{ background: COLOR[f.estado]?.bg, color: COLOR[f.estado]?.c, borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>
                        <T>{f.estado_nombre}</T>
                      </span>
                      {f.aceptado_en && <span style={{ display: "block", ...S.meta }}><T>El cliente liberó el pago</T></span>}
                      {f.estado === "pendiente" && f.disponible_en && (
                        <span style={{ display: "block", ...S.meta }}><T>Se libera el</T> {fecha(f.disponible_en)}</span>
                      )}
                      {f.estado === "pagado" && f.pago_referencia && (
                        <span style={{ display: "block", ...S.meta }}><T>Ref.</T> <T>{f.pago_referencia}</T></span>
                      )}
                      {f.estado === "retenido" && f.motivo && <span style={{ display: "block", ...S.meta }}><T>{f.motivo}</T></span>}
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
