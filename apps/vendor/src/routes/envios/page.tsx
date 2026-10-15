// @ts-nocheck
// Pantalla simple de Envíos para el taller: 3 datos y un botón. Nada técnico.
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Camion = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)

export const config: RouteConfig = {
  label: "Envíos",
  icon: Camion,
}

const S = {
  page: { maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 20, marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 700, margin: "0 0 6px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", maxWidth: 240, height: 42, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 10px", fontSize: 16, boxSizing: "border-box", background: "#fff" },
  hint: { color: "#6B675C", fontSize: 12, marginTop: 6 },
  fila: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "12px 22px", fontWeight: 600, fontSize: 15, cursor: "pointer" },
}

const aTexto = (n) => (n === null || n === undefined ? "" : String(n))

export default function EnviosPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(true)
  const [aviso, setAviso] = useState("")
  const [msg, setMsg] = useState(null)
  const [precio, setPrecio] = useState("")
  const [gratis, setGratis] = useState(false)
  const [gratisDesde, setGratisDesde] = useState("")
  const [recoger, setRecoger] = useState(false)
  const [digital, setDigital] = useState(false)

  useEffect(() => {
    fetch("/vendor/hetna-envios", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setListo(!!d.listo)
        setAviso(d.mensaje || "")
        setPrecio(aTexto(d.precio))
        setGratis(d.gratis_desde !== null && d.gratis_desde !== undefined)
        setGratisDesde(aTexto(d.gratis_desde))
        setRecoger(!!d.recoger)
        setDigital(!!d.digital)
      })
      .catch(() => setMsg({ ok: false, t: "No se pudo cargar. Recarga la página." }))
      .finally(() => setCargando(false))
  }, [])

  const guardar = async () => {
    setMsg(null)
    if (precio === "" || Number(precio) < 0) {
      return setMsg({ ok: false, t: "Escribe el precio de tu envío (puede ser 0)." })
    }
    if (gratis && !(Number(gratisDesde) > 0)) {
      return setMsg({ ok: false, t: "Escribe desde qué monto el envío es gratis." })
    }
    setGuardando(true)
    try {
      const r = await fetch("/vendor/hetna-envios", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          precio: Number(precio),
          gratis_desde: gratis ? Number(gratisDesde) : null,
          recoger,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "Error " + r.status)
      setListo(true)
      setMsg({ ok: true, t: "Listo, tus envíos se actualizaron." })
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div style={S.page}>Cargando...</div>

  if (!listo && aviso) {
    return (
      <div style={S.page}>
        <h1 style={S.h1}>Envíos</h1>
        <div style={S.card}>
          <p style={{ margin: 0, fontSize: 14 }}>{aviso}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Envíos</h1>
      <p style={S.sub}>Define cuánto cobras de envío en pesos mexicanos. Solo son tres datos.</p>

      <section style={S.card}>
        <h2 style={S.h2}>Precio de tu envío</h2>
        <label style={S.label}>Cuánto cobras por envío ($ MXN)</label>
        <input style={S.input} type="number" min="0" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="150" />
        <p style={S.hint}>Es un precio fijo por pedido. Pon 0 si el envío siempre es gratis.</p>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Envío gratis</h2>
        <label style={S.fila}>
          <input type="checkbox" checked={gratis} onChange={(e) => setGratis(e.target.checked)} style={{ width: 20, height: 20 }} />
          Ofrecer envío gratis en pedidos grandes
        </label>
        {gratis && (
          <div style={{ marginTop: 12 }}>
            <label style={S.label}>Gratis cuando el pedido pase de ($ MXN)</label>
            <input style={S.input} type="number" min="1" inputMode="decimal" value={gratisDesde} onChange={(e) => setGratisDesde(e.target.value)} placeholder="1500" />
            <p style={S.hint}>Se cuenta el total de los productos del carrito del cliente.</p>
          </div>
        )}
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Recoger en tu taller</h2>
        <label style={S.fila}>
          <input type="checkbox" checked={recoger} onChange={(e) => setRecoger(e.target.checked)} style={{ width: 20, height: 20 }} />
          Permitir que el cliente pase por su pedido (sin costo de envío)
        </label>
      </section>

      <section style={{ ...S.card, background: "#F7F5EE" }}>
        <h2 style={S.h2}>Productos digitales</h2>
        <p style={{ margin: 0, fontSize: 14 }}>
          {digital ? "Ya está activa la entrega digital sin costo. " : "En unos minutos se activa la entrega digital sin costo. "}
          Para que un producto sea digital, en su formulario pon el <b>Tipo</b> como <b>Digital</b>.
        </p>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button type="button" style={{ ...S.btn, opacity: guardando ? 0.6 : 1 }} disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando..." : "Guardar envíos"}
        </button>
        {msg && <span style={{ fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</span>}
      </div>
    </div>
  )
}
