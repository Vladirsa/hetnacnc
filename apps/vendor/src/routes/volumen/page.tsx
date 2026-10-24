// @ts-nocheck
// Pantalla "Precios por cantidad" del taller: por producto, dos datos y guardar.
//
// Existe porque el panel de Mercur lee los precios por cantidad pero no tiene
// campo para escribirlos. El mecanismo sí es nativo: el precio baja solo en el
// carrito al subir la cantidad, sin códigos ni promociones.
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Etiqueta = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
    <circle cx="7" cy="7" r="1.5" />
  </svg>
)

export const config: RouteConfig = {
  label: "Precios por cantidad",
  icon: Etiqueta,
}

const S = {
  page: { maxWidth: 820, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 12 },
  titulo: { fontSize: 15, fontWeight: 700, margin: 0 },
  base: { color: "#6B675C", fontSize: 13, margin: "2px 0 12px" },
  fila: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" },
  campo: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12.5, fontWeight: 600 },
  input: { width: 150, height: 40, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 10px", fontSize: 16, boxSizing: "border-box", background: "#fff" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnQuitar: { background: "transparent", color: "#9B3225", border: 0, padding: "10px 6px", fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "underline" },
  hint: { color: "#6B675C", fontSize: 12, margin: "8px 0 0" },
  ok: { color: "#1F5B29", fontSize: 13, fontWeight: 600, margin: "8px 0 0" },
  err: { color: "#9B3225", fontSize: 13, fontWeight: 600, margin: "8px 0 0" },
  activo: { display: "inline-block", background: "#EDF7EE", color: "#1F5B29", borderRadius: 6, padding: "2px 7px", fontSize: 11.5, fontWeight: 700, marginLeft: 8 },
}

const aTexto = (n) => (n === null || n === undefined ? "" : String(n))
const pesos = (n) =>
  typeof n === "number"
    ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 })
    : "—"

export default function VolumenPage() {
  const [cargando, setCargando] = useState(true)
  const [ofertas, setOfertas] = useState([])
  const [borrador, setBorrador] = useState({})
  const [guardando, setGuardando] = useState(null)
  const [msg, setMsg] = useState({})
  const [error, setError] = useState("")

  const cargar = () =>
    fetch("/vendor/hetna-volumen", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const lista = d.ofertas || []
        setOfertas(lista)
        const inicial = {}
        for (const o of lista) {
          inicial[o.offer_id] = {
            desde: aTexto(o.desde),
            precio: aTexto(o.precio_escalon),
          }
        }
        setBorrador(inicial)
      })
      .catch(() => setError("No se pudo cargar. Recarga la página."))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const cambiar = (id, campo, valor) =>
    setBorrador((b) => ({ ...b, [id]: { ...b[id], [campo]: valor } }))

  const guardar = async (oferta, quitar) => {
    const id = oferta.offer_id
    setMsg((m) => ({ ...m, [id]: null }))
    const datos = borrador[id] || {}

    if (!quitar) {
      if (!(Number(datos.desde) >= 2)) {
        return setMsg((m) => ({
          ...m,
          [id]: { ok: false, t: "Escribe desde cuántas piezas aplica (2 o más)." },
        }))
      }
      if (!(Number(datos.precio) > 0)) {
        return setMsg((m) => ({
          ...m,
          [id]: { ok: false, t: "Escribe el precio por pieza." },
        }))
      }
    }

    setGuardando(id)
    try {
      const r = await fetch("/vendor/hetna-volumen", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          quitar
            ? { offer_id: id, desde: null }
            : { offer_id: id, desde: Number(datos.desde), precio: Number(datos.precio) }
        ),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "Error " + r.status)

      setMsg((m) => ({
        ...m,
        [id]: { ok: true, t: quitar ? "Se quitó el precio por cantidad." : "Guardado." },
      }))
      // Se recarga para que lo que se ve sea lo que de verdad quedó guardado,
      // no lo que se escribió en la caja.
      await cargar()
    } catch (e) {
      setMsg((m) => ({ ...m, [id]: { ok: false, t: e.message } }))
    } finally {
      setGuardando(null)
    }
  }

  if (cargando) return <div style={S.page}>Cargando...</div>

  if (error) {
    return (
      <div style={S.page}>
        <h1 style={S.h1}>Precios por cantidad</h1>
        <div style={S.card}>
          <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Precios por cantidad</h1>
      <p style={S.sub}>
        Ofrece la pieza más barata cuando el cliente lleva varias. El precio baja
        solo en su carrito: no tiene que escribir ningún código. Y se le avisa en
        la página del producto, para que le dé por pedir más.
      </p>

      {!ofertas.length && (
        <div style={S.card}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Todavía no tienes productos en venta. Cuando publiques el primero,
            aquí vas a poder ponerle precio por cantidad.
          </p>
        </div>
      )}

      {ofertas.map((o) => {
        const d = borrador[o.offer_id] || {}
        const m = msg[o.offer_id]
        const ocupado = guardando === o.offer_id
        const sinPrecio = o.precio === null

        return (
          <section key={o.offer_id} style={S.card}>
            <p style={S.titulo}>
              {o.titulo}
              {o.desde ? (
                <span style={S.activo}>
                  {o.desde}+ a {pesos(o.precio_escalon)}
                </span>
              ) : null}
            </p>
            <p style={S.base}>
              {sinPrecio
                ? "Esta oferta todavía no tiene precio de una pieza. Ponlo primero en Ofertas."
                : `Una pieza cuesta ${pesos(o.precio)}`}
            </p>

            {!sinPrecio && (
              <>
                <div style={S.fila}>
                  <div style={S.campo}>
                    <label style={S.label}>Desde cuántas piezas</label>
                    <input
                      style={S.input}
                      type="number"
                      min="2"
                      step="1"
                      inputMode="numeric"
                      value={d.desde || ""}
                      onChange={(e) => cambiar(o.offer_id, "desde", e.target.value)}
                      placeholder="3"
                    />
                  </div>
                  <div style={S.campo}>
                    <label style={S.label}>Precio por pieza ($ MXN)</label>
                    <input
                      style={S.input}
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={d.precio || ""}
                      onChange={(e) => cambiar(o.offer_id, "precio", e.target.value)}
                      placeholder={String(Math.max(1, Math.round((o.precio || 0) * 0.9)))}
                    />
                  </div>
                  <button
                    style={{ ...S.btn, opacity: ocupado ? 0.6 : 1 }}
                    disabled={ocupado}
                    onClick={() => guardar(o, false)}
                  >
                    {ocupado ? "Guardando…" : "Guardar"}
                  </button>
                  {o.desde ? (
                    <button
                      style={S.btnQuitar}
                      disabled={ocupado}
                      onClick={() => guardar(o, true)}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
                <p style={S.hint}>
                  Tiene que ser menos de {pesos(o.precio)}, que es lo que cuesta
                  una pieza suelta.
                </p>
              </>
            )}

            {m ? <p style={m.ok ? S.ok : S.err}>{m.t}</p> : null}
          </section>
        )
      })}
    </div>
  )
}
