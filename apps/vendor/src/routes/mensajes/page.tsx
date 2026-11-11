// Mensajes: todas las conversaciones del taller con sus clientes por el chat
// de HETNA (las que empezó el cliente con "Preguntar al taller" y las que el
// taller empezó desde Mis clientes). Cada una se abre en la página del chat.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export const config: RouteConfig = { label: "Mensajes", icon: Icono }

type Conv = { id: string; cliente: string; producto: string | null; token: string; sin_leer: number; estado: string; fecha: string; ultimo: string; ultimo_de: string }

const vidrio: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", backdropFilter: "blur(14px) saturate(1.2)",
  borderRadius: 16, boxShadow: "0 0 0 1px rgba(20,32,51,0.06), 0 8px 24px -12px rgba(20,32,51,0.18)",
}
const SITIO = "https://hetnacnc.com/mx"
const hace = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `hace ${Math.max(m, 1)} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return new Date(iso).toLocaleDateString("es-MX")
}

export default function MensajesPage() {
  const [d, setD] = useState<{ disponible: boolean; conversaciones: Conv[] } | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    fetch("/vendor/hetna-mensajes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setD)
      .catch((e) => setError(`No se pudieron cargar tus mensajes (${e}).`))
  }, [])
  const sinLeer = (d?.conversaciones || []).reduce((a, c) => a + c.sin_leer, 0)

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#142033", letterSpacing: "-0.02em" }}>Mensajes</h1>
      <p style={{ color: "#6B675C", fontSize: 14, margin: "4px 0 16px" }}>
        Tus conversaciones con clientes dentro de HETNA{sinLeer ? ` · ${sinLeer} sin leer` : ""}. Para escribirle a quien ya te compró, entra a <Link to="/mis-clientes" style={{ color: "#C2560A", fontWeight: 700 }}>Mis clientes</Link>.
      </p>
      {error && <p style={{ color: "#B3261E" }}>{error}</p>}
      {!d && !error && <p style={{ color: "#6B675C" }}>Cargando…</p>}
      {d && !d.disponible && <div style={{ ...vidrio, padding: 20, color: "#6B675C" }}>El chat no está disponible por ahora.</div>}
      {d && d.disponible && d.conversaciones.length === 0 && (
        <div style={{ ...vidrio, padding: 24, textAlign: "center", color: "#6B675C" }}>Todavía no tienes mensajes. Cuando un cliente te pregunte algo desde tu producto o tu perfil, aparecerá aquí.</div>
      )}
      {d && d.conversaciones.length > 0 && (
        <div style={{ ...vidrio, overflow: "hidden" }}>
          {d.conversaciones.map((c) => (
            <a key={c.id} href={`${SITIO}/chat-taller/${c.token}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid rgba(20,32,51,0.06)", textDecoration: "none", color: "inherit" }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: c.sin_leer ? "#C2560A" : "#142033", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
                {c.cliente.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: c.sin_leer ? 800 : 700, color: "#142033", fontSize: 14 }}>
                  {c.cliente}{c.producto ? <span style={{ fontWeight: 500, color: "#6B675C" }}> · {c.producto}</span> : null}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#55544D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.ultimo_de === "taller" ? "Tú: " : ""}{c.ultimo || "—"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#9A968B" }}>{hace(c.fecha)}</p>
                {c.sin_leer > 0 && <span style={{ display: "inline-block", marginTop: 4, background: "#C2560A", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{c.sin_leer}</span>}
                {c.estado === "cerrada" && <p style={{ margin: 0, fontSize: 11, color: "#9A968B" }}>cerrada</p>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
