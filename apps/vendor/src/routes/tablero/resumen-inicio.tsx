// Parte de arriba del Inicio del vendedor (rediseño nov 2026): saludo,
// "tu siguiente paso" y tres números (solicitudes nuevas, pedidos por enviar,
// ventas del mes), más las solicitudes más urgentes. Todo con datos reales:
// /vendor/tablero (lo pasa la página) y /vendor/hetna-solicitudes.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

type Sol = {
  id: string
  folio?: string
  estado: string
  cierra_en?: string | null
  para_mi?: boolean
  mi_propuesta?: unknown
  mi_respuesta?: { motivo?: string } | null
  propuestas_recibidas?: number
  trabajo?: { servicio?: string; ciudad?: string; estado_mx?: string; descripcion?: string; material?: string }
}

export type DatosInicio = {
  moneda: string
  total_productos?: number
  ventas: { pedidos_mes: number; ingresos_mes: number; ingresos_previos: number; ventana_dias: number; ingresos_totales: number }
  por_enviar: { order_id: string; display_id: number | null; horas: number; tarde: boolean }[]
  stock: { titulo: string; nivel: "agotado" | "bajo" | "se_acaba" }[]
}

const pesos = (n: number, moneda = "mxn") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda.toUpperCase(), maximumFractionDigits: 0 }).format(n || 0)

const horasPara = (iso?: string | null) => (iso ? (new Date(iso).getTime() - Date.now()) / 3600_000 : null)
const plazo = (h: number | null) =>
  h === null ? "" : h <= 0 ? "ya cerró" : h < 1 ? "cierra en menos de 1 hora" : h < 48 ? `cierra en ${Math.round(h)} h` : `cierra en ${Math.round(h / 24)} días`

const C = {
  vidrio: {
    background: "rgba(255,255,255,0.78)",
    WebkitBackdropFilter: "blur(14px) saturate(1.2)",
    backdropFilter: "blur(14px) saturate(1.2)",
    borderRadius: 16,
    boxShadow: "0 0 0 1px rgba(20,32,51,0.06), 0 8px 24px -12px rgba(20,32,51,0.18)",
  } as React.CSSProperties,
}

function titulo(s: Sol) {
  const t = s.trabajo || {}
  const desc = (t.descripcion || "").split("\n")[0].slice(0, 70)
  return desc || [t.servicio, t.material].filter(Boolean).join(" · ") || s.folio || "Solicitud"
}

export function ResumenInicio({ datos }: { datos: DatosInicio }) {
  const [sols, setSols] = useState<Sol[] | null>(null)
  const [nombre, setNombre] = useState("")

  useEffect(() => {
    fetch("/vendor/hetna-solicitudes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSols(d?.solicitudes || []))
      .catch(() => setSols([]))
    fetch("/vendor/members/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNombre(d?.seller_member?.seller?.name || ""))
      .catch(() => {})
  }, [])

  const nuevas = (sols || [])
    .filter((s) => s.estado === "abierta" && !s.mi_propuesta && !(s.mi_respuesta && s.mi_respuesta.motivo !== "mas_info"))
    .sort((a, b) => (horasPara(a.cierra_en) ?? 1e9) - (horasPara(b.cierra_en) ?? 1e9))
  const urgente = nuevas[0]
  const v = datos.ventas
  const cambio = v.ingresos_previos > 0 ? Math.round(((v.ingresos_totales - v.ingresos_previos) / v.ingresos_previos) * 100) : null
  const tarde = datos.por_enviar.filter((p) => p.tarde)
  const agotados = datos.stock.filter((s) => s.nivel === "agotado")

  // Tu siguiente paso: lo más importante primero
  let paso: { titulo: string; detalle: string; a: string; boton: string } | null = null
  if (tarde.length) {
    const p = tarde[0]
    paso = { titulo: `Envía el pedido ${p.display_id ? "#" + p.display_id : ""}: ya va tarde`, detalle: `Lleva ${Math.round(p.horas)} horas esperando. Los envíos tarde bajan tu reputación.`, a: `/orders/${p.order_id}`, boton: "Ver pedido" }
  } else if (urgente) {
    paso = { titulo: `Responde "${titulo(urgente)}"`, detalle: `${urgente.para_mi ? "El cliente te eligió a ti · " : ""}${plazo(horasPara(urgente.cierra_en)) || "Solicitud abierta"}. Manda tu precio y tiempo antes de que cierre.`, a: "/solicitudes", boton: "Responder" }
  } else if (datos.por_enviar.length) {
    const p = datos.por_enviar[0]
    paso = { titulo: `Prepara el pedido ${p.display_id ? "#" + p.display_id : ""}`, detalle: `Tienes ${datos.por_enviar.length} pedido${datos.por_enviar.length === 1 ? "" : "s"} por enviar.`, a: "/orders", boton: "Ver pedidos" }
  } else if (datos.total_productos === 0) {
    paso = { titulo: "Publica tu primer producto", detalle: "Los clientes sólo pueden comprarte lo que tienes publicado.", a: "/publicar", boton: "Publicar" }
  } else if (agotados.length) {
    paso = { titulo: `Se agotó "${agotados[0].titulo}"`, detalle: "Repón existencias para no perder ventas.", a: "/inventory", boton: "Ver inventario" }
  }

  const kpi = (etiqueta: string, valor: string, pie: string, a: string, resalta = false, color = "#6B675C") => (
    <Link to={a} style={{ ...C.vidrio, padding: 18, textDecoration: "none", color: "inherit", display: "block", outline: resalta ? "2px solid rgba(217,96,11,0.45)" : "none" }}>
      <p style={{ margin: 0, fontSize: 13, color: "#55544D", fontWeight: 600 }}>{etiqueta}</p>
      <p style={{ margin: "8px 0 4px", fontSize: 30, fontWeight: 800, color: "#142033", letterSpacing: "-0.02em" }}>{valor}</p>
      <p style={{ margin: 0, fontSize: 12.5, color }}>{pie}</p>
    </Link>
  )

  return (
    <div style={{ marginBottom: 18 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#142033", letterSpacing: "-0.02em" }}>{nombre ? `Hola, ${nombre}` : "Inicio"}</h1>
      <p style={{ color: "#6B675C", fontSize: 14, margin: "4px 0 16px" }}>Lo que necesita tu atención hoy.</p>

      {paso ? (
        <div style={{ ...C.vidrio, padding: "14px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "linear-gradient(90deg, rgba(253,238,225,0.92), rgba(255,255,255,0.8))", boxShadow: "0 0 0 1px rgba(217,96,11,0.25), 0 8px 24px -12px rgba(217,96,11,0.35)" }}>
          <span style={{ fontSize: 22 }}>⏱️</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ margin: 0, fontWeight: 800, color: "#142033", fontSize: 15 }}>Tu siguiente paso: {paso.titulo}</p>
            <p style={{ margin: "2px 0 0", color: "#55544D", fontSize: 13 }}>{paso.detalle}</p>
          </div>
          <Link to={paso.a} style={{ background: "linear-gradient(180deg,#D9600B,#C2560A)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "9px 16px", borderRadius: 10, textDecoration: "none", boxShadow: "0 6px 16px -8px rgba(217,96,11,0.7)" }}>
            {paso.boton}
          </Link>
        </div>
      ) : (
        <div style={{ ...C.vidrio, padding: "14px 18px", marginBottom: 14, color: "#1E7B3A", fontWeight: 700, fontSize: 14 }}>✅ Todo al día: no tienes pedidos por enviar ni solicitudes por responder.</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 14 }}>
        {kpi("Solicitudes nuevas", sols === null ? "…" : String(nuevas.length), urgente ? `la más urgente ${plazo(horasPara(urgente.cierra_en)) || "está abierta"}` : "de la bolsa de proyectos", "/solicitudes", nuevas.length > 0)}
        {kpi("Pedidos por enviar", String(datos.por_enviar.length), tarde.length ? `${tarde.length} ya va${tarde.length === 1 ? "" : "n"} tarde` : datos.por_enviar.length ? "a tiempo" : "nada pendiente", "/orders", tarde.length > 0, tarde.length ? "#B3261E" : "#6B675C")}
        {kpi("Ventas del mes", pesos(v.ingresos_mes, datos.moneda), cambio === null ? `${v.pedidos_mes} pedido${v.pedidos_mes === 1 ? "" : "s"}` : `${cambio >= 0 ? "↑" : "↓"} ${Math.abs(cambio)} % en ${v.ventana_dias} días vs. los ${v.ventana_dias} anteriores`, "/orders", false, cambio === null ? "#6B675C" : cambio >= 0 ? "#1E7B3A" : "#B3261E")}
      </div>

      {nuevas.length > 0 && (
        <div style={{ ...C.vidrio, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid rgba(20,32,51,0.07)" }}>
            <p style={{ margin: 0, fontWeight: 800, color: "#142033" }}>Solicitudes de cotización por responder</p>
            <Link to="/solicitudes" style={{ fontSize: 13, fontWeight: 700, color: "#142033", textDecoration: "none" }}>Ver todas ›</Link>
          </div>
          {nuevas.slice(0, 3).map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid rgba(20,32,51,0.05)", flexWrap: "wrap" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#F3F1EA", display: "grid", placeItems: "center" }}>📄</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: 0, fontWeight: 700, color: "#142033", fontSize: 14 }}>{titulo(s)}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#6B675C" }}>
                  {[s.trabajo?.ciudad, s.trabajo?.estado_mx].filter(Boolean).join(", ") || "México"} · {plazo(horasPara(s.cierra_en)) || "abierta"} · {s.propuestas_recibidas || 0} propuesta{s.propuestas_recibidas === 1 ? "" : "s"}
                </p>
              </div>
              {s.para_mi && <span style={{ background: "#FFF1E6", color: "#C2560A", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>Te eligieron</span>}
              <Link to="/solicitudes" style={{ border: "1px solid rgba(217,96,11,0.5)", color: "#C2560A", fontWeight: 700, fontSize: 13, padding: "6px 14px", borderRadius: 10, textDecoration: "none" }}>Responder</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
