// Mensajes: todas las conversaciones del taller con sus clientes por el chat
// de HETNA (las que empezó el cliente con "Preguntar al taller" y las que el
// taller empezó desde Mis clientes), organizadas con grupos y etiquetas, y sus
// preguntas a solicitudes con la respuesta del cliente.
import { T } from "../../lib/idioma"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export const config: RouteConfig = { label: "Mensajes",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation", icon: Icono }

type Conv = {
  id: string; cliente: string; producto: string | null; token: string; sin_leer: number; estado: string; fecha: string; ultimo: string; ultimo_de: string
  grupo: string | null; etiquetas: string[]; archivada: boolean
}
type Pregunta = { id: string; folio: string; trabajo: string; pregunta: string; respuesta: string | null; fecha: string; abierta: boolean }
type Datos = { disponible: boolean; conversaciones: Conv[]; preguntas: Pregunta[]; grupos: string[]; etiquetas: string[] }

// Grupos sugeridos (el taller puede escribir otros)
const GRUPOS_BASE = ["Nuevos", "Cotizando", "En producción", "Entregados", "Clientes frecuentes"]

const vidrio: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", backdropFilter: "blur(14px) saturate(1.2)",
  borderRadius: 16, boxShadow: "0 0 0 1px rgba(20,32,51,0.06), 0 8px 24px -12px rgba(20,32,51,0.18)",
}
const chip = (activo: boolean): React.CSSProperties => ({
  border: activo ? "1px solid #C2560A" : "1px solid rgba(20,32,51,0.12)", background: activo ? "#FFF3EB" : "#fff", color: activo ? "#C2560A" : "#40403A",
  borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer",
})
const etiqueta: React.CSSProperties = { background: "#EEF2F7", color: "#1D4E89", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700 }
const SITIO = "https://hetnacnc.com/mx"
const hace = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `hace ${Math.max(m, 1)} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return new Date(iso).toLocaleDateString("es-MX")
}

type Vista = "todas" | "sin_leer" | "archivadas" | "preguntas" | `grupo:${string}` | `etiqueta:${string}`

export default function MensajesPage() {
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [vista, setVista] = useState<Vista>("todas")
  const [buscar, setBuscar] = useState("")
  const [editando, setEditando] = useState<string | null>(null)

  const cargar = () =>
    fetch("/vendor/hetna-mensajes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setD)
      .catch((e) => setError(`No se pudieron cargar tus mensajes (${e}).`))
  useEffect(() => { void cargar() }, [])

  const guardar = async (c: Conv, cambio: Partial<Pick<Conv, "grupo" | "etiquetas" | "archivada">>) => {
    // Al momento en pantalla; luego se guarda
    setD((x) => (x ? { ...x, conversaciones: x.conversaciones.map((y) => (y.id === c.id ? { ...y, ...cambio } : y)) } : x))
    const r = await fetch("/vendor/hetna-mensajes", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conv_id: c.id, ...cambio }) })
    if (!r.ok) setError("No se pudo guardar el cambio. Intenta de nuevo.")
    else void cargar()
  }

  const convs = d?.conversaciones || []
  const preguntas = d?.preguntas || []
  const sinLeer = convs.reduce((a, c) => a + c.sin_leer, 0)
  const sinResponder = preguntas.filter((p) => !p.respuesta && p.abierta).length
  const respondidasNuevas = preguntas.filter((p) => p.respuesta && Date.now() - new Date(p.fecha).getTime() < 3 * 86400000).length
  const grupos = useMemo(() => [...new Set([...GRUPOS_BASE.filter((g) => convs.some((c) => c.grupo === g)), ...(d?.grupos || [])])], [d])

  const q = buscar.trim().toLowerCase()
  const coincide = (t: string) => !q || t.toLowerCase().includes(q)
  const visibles = convs.filter((c) => {
    if (!coincide(`${c.cliente} ${c.producto || ""} ${c.ultimo} ${c.etiquetas.join(" ")} ${c.grupo || ""}`)) return false
    if (vista === "archivadas") return c.archivada
    if (c.archivada) return false
    if (vista === "sin_leer") return c.sin_leer > 0
    if (vista.startsWith("grupo:")) return c.grupo === vista.slice(6)
    if (vista.startsWith("etiqueta:")) return c.etiquetas.includes(vista.slice(9))
    return true
  })
  const preguntasVisibles = preguntas.filter((p) => coincide(`${p.folio} ${p.trabajo} ${p.pregunta} ${p.respuesta || ""}`))

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#142033", letterSpacing: "-0.02em" }}><T>Mensajes</T></h1>
      <p style={{ color: "#6B675C", fontSize: 14, margin: "4px 0 14px" }}>
        <T>Tus conversaciones con clientes dentro de HETNA</T><T>{sinLeer ? ` · ${sinLeer} sin leer` : ""}</T><T>. Para escribirle a quien ya te compró, entra a</T> <Link to="/mis-clientes" style={{ color: "#C2560A", fontWeight: 700 }}><T>Mis clientes</T></Link>.
      </p>

      {/* Filtros */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar cliente, producto, folio o etiqueta…"
          style={{ flex: "1 1 240px", minWidth: 200, border: "1px solid rgba(20,32,51,0.15)", borderRadius: 10, padding: "8px 12px", fontSize: 14 }} />
        <button type="button" style={chip(vista === "todas")} onClick={() => setVista("todas")}><T>Todas</T></button>
        <button type="button" style={chip(vista === "sin_leer")} onClick={() => setVista("sin_leer")}><T>Sin leer</T>{sinLeer ? ` (${sinLeer})` : ""}</button>
        <button type="button" style={chip(vista === "preguntas")} onClick={() => setVista("preguntas")}>
          <T>Preguntas de solicitudes</T>{respondidasNuevas ? ` · ${respondidasNuevas} respondida${respondidasNuevas === 1 ? "" : "s"}` : sinResponder ? ` (${sinResponder})` : ""}
        </button>
        <button type="button" style={chip(vista === "archivadas")} onClick={() => setVista("archivadas")}><T>Archivadas</T></button>
      </div>
      {(grupos.length > 0 || (d?.etiquetas || []).length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {grupos.map((g) => (
            <button key={g} type="button" style={chip(vista === `grupo:${g}`)} onClick={() => setVista(`grupo:${g}`)}>📁 {g} ({convs.filter((c) => c.grupo === g && !c.archivada).length})</button>
          ))}
          {(d?.etiquetas || []).map((t) => (
            <button key={t} type="button" style={chip(vista === `etiqueta:${t}`)} onClick={() => setVista(`etiqueta:${t}`)}>🏷️ {t}</button>
          ))}
        </div>
      )}

      {error && <p style={{ color: "#B3261E" }}><T>{error}</T></p>}
      {!d && !error && <p style={{ color: "#6B675C" }}><T>Cargando…</T></p>}

      {/* Preguntas de solicitudes */}
      {d && vista === "preguntas" && (
        preguntasVisibles.length === 0 ? (
          <div style={{ ...vidrio, padding: 24, textAlign: "center", color: "#6B675C" }}>
            <T>Todavía no has hecho preguntas. En</T> <Link to="/solicitudes" style={{ color: "#C2560A", fontWeight: 700 }}><T>Solicitudes</T></Link> <T>usa «¿Te falta un dato? Pregúntale al cliente».</T>
          </div>
        ) : (
          <div style={{ ...vidrio, overflow: "hidden" }}>
            {preguntasVisibles.map((p) => (
              <Link key={p.id} to="/solicitudes" style={{ display: "block", padding: "14px 18px", borderBottom: "1px solid rgba(20,32,51,0.06)", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <p style={{ margin: 0, fontWeight: 800, color: "#142033", fontSize: 14 }}>{p.folio}<span style={{ fontWeight: 500, color: "#6B675C" }}> · <T>{p.trabajo}</T></span></p>
                  <span style={{ fontSize: 12, color: "#9A968B", whiteSpace: "nowrap" }}>{hace(p.fecha)}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#55544D" }}><b><T>Tú:</T></b> <T>{p.pregunta}</T></p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: p.respuesta ? "#1E7B3A" : "#9A968B" }}>
                  <b><T>Cliente:</T></b> <T>{p.respuesta || (p.abierta ? "todavía no contesta" : "la solicitud ya cerró")}</T>
                </p>
              </Link>
            ))}
          </div>
        )
      )}

      {/* Conversaciones */}
      {d && vista !== "preguntas" && !d.disponible && <div style={{ ...vidrio, padding: 20, color: "#6B675C" }}><T>El chat no está disponible por ahora.</T></div>}
      {d && vista !== "preguntas" && d.disponible && visibles.length === 0 && (
        <div style={{ ...vidrio, padding: 24, textAlign: "center", color: "#6B675C" }}>
          <T>{convs.length ? "No hay conversaciones con este filtro." : "Todavía no tienes mensajes. Cuando un cliente te pregunte algo desde tu producto o tu perfil, aparecerá aquí."}</T>
        </div>
      )}
      {d && vista !== "preguntas" && visibles.length > 0 && (
        <div style={{ ...vidrio, overflow: "hidden" }}>
          {visibles.map((c) => (
            <div key={c.id} style={{ borderBottom: "1px solid rgba(20,32,51,0.06)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 18px" }}>
                <a href={`${SITIO}/chat-taller/${c.token}`} target="_blank" rel="noreferrer" style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                  <span style={{ width: 38, height: 38, flex: "0 0 38px", borderRadius: 12, background: c.sin_leer ? "#C2560A" : "#142033", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
                    {c.cliente.charAt(0).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: c.sin_leer ? 800 : 700, color: "#142033", fontSize: 14 }}>
                      <T>{c.cliente}</T>{c.producto ? <span style={{ fontWeight: 500, color: "#6B675C" }}> · <T>{c.producto}</T></span> : null}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#55544D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <T>{c.ultimo_de === "taller" ? "Tú: " : ""}</T><T>{c.ultimo || "—"}</T>
                    </p>
                    {(c.grupo || c.etiquetas.length > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {c.grupo && <span style={{ ...etiqueta, background: "#FFF3EB", color: "#C2560A" }}>📁 {c.grupo}</span>}
                        {c.etiquetas.map((t) => <span key={t} style={etiqueta}>{t}</span>)}
                      </div>
                    )}
                  </div>
                </a>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#9A968B" }}>{hace(c.fecha)}</p>
                  {c.sin_leer > 0 && <span style={{ display: "inline-block", marginTop: 4, background: "#C2560A", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{c.sin_leer}</span>}
                  {c.estado === "cerrada" && <p style={{ margin: 0, fontSize: 11, color: "#9A968B" }}><T>cerrada</T></p>}
                  <div style={{ marginTop: 4 }}>
                    <button type="button" onClick={() => setEditando(editando === c.id ? null : c.id)} style={{ border: "none", background: "none", color: "#C2560A", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><T>Organizar</T></button>
                  </div>
                </div>
              </div>
              {editando === c.id && (
                <Organizar c={c} grupos={[...new Set([...GRUPOS_BASE, ...(d?.grupos || [])])]} guardar={(x) => { void guardar(c, x); setEditando(null) }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Organizar({ c, grupos, guardar }: { c: Conv; grupos: string[]; guardar: (x: Partial<Pick<Conv, "grupo" | "etiquetas" | "archivada">>) => void }) {
  const [grupo, setGrupo] = useState(c.grupo || "")
  const [etiquetas, setEtiquetas] = useState(c.etiquetas.join(", "))
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", padding: "0 18px 14px 68px", fontSize: 13 }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "#6B675C", fontWeight: 700 }}><T>Grupo</T></span>
        <input list={`grupos-${c.id}`} value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ej. Cotizando"
          style={{ border: "1px solid rgba(20,32,51,0.15)", borderRadius: 8, padding: "6px 10px", width: 170 }} />
        <datalist id={`grupos-${c.id}`}>{grupos.map((g) => <option key={g} value={g} />)}</datalist>
      </label>
      <label style={{ display: "grid", gap: 4, flex: "1 1 200px" }}>
        <span style={{ color: "#6B675C", fontWeight: 700 }}><T>Etiquetas (separadas por coma)</T></span>
        <input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Ej. urgente, MDF, mayoreo"
          style={{ border: "1px solid rgba(20,32,51,0.15)", borderRadius: 8, padding: "6px 10px" }} />
      </label>
      <button type="button" onClick={() => guardar({ grupo: grupo.trim() || null, etiquetas: etiquetas.split(",").map((x) => x.trim()).filter(Boolean) })}
        style={{ background: "#C2560A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer" }}><T>Guardar</T></button>
      <button type="button" onClick={() => guardar({ archivada: !c.archivada })}
        style={{ background: "#fff", color: "#40403A", border: "1px solid rgba(20,32,51,0.15)", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer" }}><T>{c.archivada ? "Sacar de archivadas" : "Archivar"}</T></button>
    </div>
  )
}
