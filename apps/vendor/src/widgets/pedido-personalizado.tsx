// @ts-nocheck
// Página del pedido en el panel del taller: lo que el cliente eligió en cada
// pieza de Impresión 3D bajo pedido (color, colores de cada parte en las piezas
// "· 2 colores" y el texto de llaveros y letras), para imprimirla tal cual.
// Backend: packages/api/src/api/vendor/hetna-impresion/pedido/[id].
import { useEffect, useState } from "react"
import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

/** El id del pedido: el que da el panel o, si no, el de la dirección (/orders/order_…). */
const idPedido = (data) => data?.id || (window.location.pathname.match(/\/orders\/(order_[A-Za-z0-9]+)/) || [])[1] || ""

function PedidoPersonalizado({ data }) {
  const [piezas, setPiezas] = useState([])
  const id = idPedido(data)

  useEffect(() => {
    if (!id) return
    let vivo = true
    fetch(`/vendor/hetna-impresion/pedido/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { piezas: [] }))
      .then((j) => vivo && setPiezas(Array.isArray(j.piezas) ? j.piezas : []))
      .catch(() => vivo && setPiezas([]))
    return () => {
      vivo = false
    }
  }, [id])

  if (!piezas.length) return null
  return (
    <div style={{ background: "#FFF7EC", border: "1px solid #F2C98F", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Cómo lo quiere el cliente</div>
      <div style={{ fontSize: 13, color: "#6B675C", marginBottom: 10 }}>Imprímelo tal cual: colores y texto que eligió al comprar.</div>
      {piezas.map((p) => (
        <div key={p.id} style={{ borderTop: "1px solid #F2C98F", padding: "8px 0" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {p.titulo}
            {p.variante ? <span style={{ fontWeight: 400, color: "#6B675C" }}> · {p.variante}</span> : null}
            {p.cantidad > 1 ? <span style={{ fontWeight: 400, color: "#6B675C" }}> · {p.cantidad} piezas</span> : null}
          </div>
          {p.detalle.map(([k, v]) => (
            <div key={k} style={{ fontSize: 14, marginTop: 2 }}>
              <span style={{ color: "#6B675C" }}>{k}:</span> <b>{v}</b>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "orders.detail.main.before",
})

export default PedidoPersonalizado
