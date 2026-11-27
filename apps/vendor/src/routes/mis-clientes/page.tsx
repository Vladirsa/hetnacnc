// Mis clientes (reemplaza la pantalla "Clientes" de Mercur, que enseñaba el
// correo). Regla de HETNA: los tratos se quedan dentro de la plataforma, así
// que aquí sólo hay nombre, ubicación, giro y compras, y el botón para
// escribirle por el chat de HETNA. Datos: GET /vendor/hetna-clientes.
import { T, traducir } from "../../lib/idioma"
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

export const config: RouteConfig = { label: "Mis clientes",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation", icon: Icono }

type Cliente = {
  id: string; nombre: string; ciudad: string | null; estado: string | null; giro: string | null
  pedidos: number; total: number; moneda: string; ultimo: string; productos: string[]
  chat: { id: string; token: string; sin_leer: number } | null
}

const vidrio: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", backdropFilter: "blur(14px) saturate(1.2)",
  borderRadius: 16, boxShadow: "0 0 0 1px rgba(20,32,51,0.06), 0 8px 24px -12px rgba(20,32,51,0.18)",
}
const pesos = (n: number, m = "mxn") => new Intl.NumberFormat("es-MX", { style: "currency", currency: m.toUpperCase(), maximumFractionDigits: 0 }).format(n || 0)
const SITIO = "https://hetnacnc.com/mx"

function Escribir({ c, onListo }: { c: Cliente; onListo: (token: string) => void }) {
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  return (
    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
      <textarea
        value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={3}
        placeholder={`Escríbele a ${c.nombre}… (por aquí no se pueden mandar teléfonos, correos ni redes)`}
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D9D5C9", borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "inherit" }}
      />
      {error && <p style={{ margin: 0, color: "#B3261E", fontSize: 13 }}><T>{error}</T></p>}
      <div>
        <button
          type="button" disabled={enviando || !texto.trim()}
          onClick={async () => {
            setEnviando(true); setError("")
            const r = await fetch(`/vendor/hetna-clientes/${c.id}/chat`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensaje: texto }) })
            const d = await r.json().catch(() => ({}))
            setEnviando(false)
            if (!r.ok) return setError(d.message || "No se pudo enviar.")
            setTexto("")
            onListo(d.token)
          }}
          style={{ background: "linear-gradient(180deg,#D9600B,#C2560A)", color: "#fff", border: 0, borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: enviando || !texto.trim() ? 0.6 : 1 }}
        >
          <T>{enviando ? "Enviando…" : "Enviar por el chat de HETNA"}</T>
        </button>
      </div>
    </div>
  )
}

export default function MisClientesPage() {
  const [lista, setLista] = useState<Cliente[] | null>(null)
  const [error, setError] = useState("")
  const [buscar, setBuscar] = useState("")
  const [abierto, setAbierto] = useState<string | null>(null)

  const cargar = () =>
    fetch("/vendor/hetna-clientes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setLista(d.clientes || []))
      .catch((e) => setError(`No se pudieron cargar tus clientes (${e}).`))
  useEffect(() => { void cargar() }, [])

  const q = buscar.trim().toLowerCase()
  const filtrados = (lista || []).filter((c) => !q || [c.nombre, c.ciudad, c.estado, c.giro, ...c.productos].filter(Boolean).join(" ").toLowerCase().includes(q))

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#142033", letterSpacing: "-0.02em" }}><T>Mis clientes</T></h1>
      <p style={{ color: "#6B675C", fontSize: 14, margin: "4px 0 16px" }}>
        <T>Quién te ha comprado, de dónde es y qué le interesa. Para hablar con ellos usa el chat de HETNA: así tu venta queda protegida.</T>
      </p>

      <input
        value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={traducir("Buscar por nombre, ciudad, giro o producto")}
        style={{ ...vidrio, width: "100%", boxSizing: "border-box", border: 0, padding: "12px 14px", fontSize: 14, marginBottom: 14 }}
      />

      {error && <p style={{ color: "#B3261E" }}><T>{error}</T></p>}
      {!lista && !error && <p style={{ color: "#6B675C" }}><T>Cargando…</T></p>}
      {lista && lista.length === 0 && (
        <div style={{ ...vidrio, padding: 24, textAlign: "center", color: "#6B675C" }}><T>Todavía no tienes clientes. Aquí aparecerán quienes te compren.</T></div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {filtrados.map((c) => (
          <div key={c.id} style={{ ...vidrio, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: "#142033", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
                {c.nombre.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: 0, fontWeight: 800, color: "#142033", fontSize: 15 }}><T>{c.nombre}</T></p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#55544D" }}>
                  📍 <T>{[c.ciudad, c.estado].filter(Boolean).join(", ") || "Ubicación no indicada"}</T>
                  {c.giro ? <> · 🏷️ <T>{c.giro}</T></> : null}
                </p>
              </div>
              <div style={{ textAlign: "right", minWidth: 120 }}>
                <p style={{ margin: 0, fontWeight: 800, color: "#142033" }}>{pesos(c.total, c.moneda)}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#6B675C" }}>
                  <T>{c.pedidos}</T> <T>pedido</T><T>{c.pedidos === 1 ? "" : "s"}</T> <T>· último</T> {new Date(c.ultimo).toLocaleDateString("es-MX")}
                </p>
              </div>
            </div>
            {c.productos.length > 0 && (
              <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#6B675C" }}><T>Ha comprado:</T> <T>{c.productos.join(" · ")}</T></p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {c.chat && (
                <a href={`${SITIO}/chat-taller/${c.chat.token}`} target="_blank" rel="noreferrer"
                  style={{ background: "#142033", color: "#fff", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  <T>💬 Abrir conversación</T><T>{c.chat.sin_leer ? ` (${c.chat.sin_leer} sin leer)` : ""}</T>
                </a>
              )}
              <button type="button" onClick={() => setAbierto(abierto === c.id ? null : c.id)}
                style={{ background: "transparent", border: "1px solid rgba(217,96,11,0.5)", color: "#C2560A", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <T>{c.chat ? "Escribir otro mensaje" : "💬 Escribirle"}</T>
              </button>
            </div>
            {abierto === c.id && (
              <Escribir c={c} onListo={(token) => { setAbierto(null); void cargar(); window.open(`${SITIO}/chat-taller/${token}`, "_blank") }} />
            )}
          </div>
        ))}
      </div>
      <p style={{ marginTop: 18, fontSize: 12, color: "#9A968B" }}>
        <T>Por privacidad, HETNA no comparte el correo ni el teléfono de tus clientes. El chat bloquea datos de contacto para que todos los tratos queden protegidos.</T>
      </p>
    </div>
  )
}
