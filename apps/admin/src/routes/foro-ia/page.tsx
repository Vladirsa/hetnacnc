// Dashboard > Foro e IA: borradores del agente del foro (packages/api/src/lib/foro-agente.ts).
//   - Respuestas a preguntas del foro que llevan horas sin contestar.
//   - Temas para abrir conversación que propone el investigador de los lunes
//     (el artículo queda como borrador en Dashboard → Blog).
// Nada se publica solo: aquí se edita y se publica con la cuenta «equipo-hetna».
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Propuesta = {
  id: number
  tipo: "respuesta" | "tema"
  titulo: string
  pregunta: string | null
  texto: string
  url: string | null
  seccion: string | null
  estado: string
  created_at: string
}
type Datos = { pendientes: Propuesta[]; recientes: Propuesta[]; secciones: { slug: string; nombre: string }[]; foro_configurado: boolean }

const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", tenue: "var(--fg-subtle, #6b6a63)", naranja: "#C2560A" }
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 12 }
const boton: CSSProperties = { background: C.naranja, color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 14 }
const botonClaro: CSSProperties = { ...boton, background: "transparent", color: "inherit", border: `1px solid ${C.borde}` }
const campo: CSSProperties = { width: "100%", padding: "8px 10px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 14, background: C.fondo, color: "inherit", boxSizing: "border-box", fontFamily: "inherit" }

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
const pedir = async (cuerpo?: unknown) => {
  const r = await fetch("/admin/hetna-foro-ia", {
    method: cuerpo ? "POST" : "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...cabeceras() },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(d?.message || "No se pudo completar.")
  return d
}

function Tarjeta({ p, secciones, alTerminar }: { p: Propuesta; secciones: Datos["secciones"]; alTerminar: (m: string) => void }) {
  const [texto, setTexto] = useState(p.texto)
  const [titulo, setTitulo] = useState(p.titulo)
  const [seccion, setSeccion] = useState(p.seccion || "")
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const accion = async (a: "publicar" | "descartar") => {
    setOcupado(true)
    setError("")
    try {
      const r = await pedir({ id: p.id, accion: a, texto, titulo, seccion })
      alTerminar(a === "publicar" ? `Publicado${r?.url ? `: ${r.url}` : ""}` : "Descartado")
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }
  return (
    <div style={caja}>
      <p style={{ margin: 0, fontSize: 12, color: C.tenue }}>
        {p.tipo === "respuesta" ? "Respuesta a una pregunta sin contestar" : "Tema nuevo para el foro"} · {new Date(p.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
      </p>
      {p.tipo === "respuesta" ? (
        <>
          <p style={{ margin: "4px 0", fontWeight: 700 }}>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                {p.titulo} ↗
              </a>
            ) : (
              p.titulo
            )}
          </p>
          {p.pregunta && <p style={{ margin: "0 0 8px", fontSize: 13, color: C.tenue, whiteSpace: "pre-wrap" }}>{p.pregunta.slice(0, 600)}</p>}
        </>
      ) : (
        <div style={{ display: "grid", gap: 8, margin: "6px 0 8px" }}>
          <input style={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <select style={campo} value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            {secciones.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      <textarea style={{ ...campo, minHeight: 140 }} value={texto} onChange={(e) => setTexto(e.target.value)} />
      {error && <p style={{ color: "#B42318", fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" style={boton} disabled={ocupado} onClick={() => void accion("publicar")}>
          Publicar como equipo HETNA
        </button>
        <button type="button" style={botonClaro} disabled={ocupado} onClick={() => void accion("descartar")}>
          Descartar
        </button>
      </div>
    </div>
  )
}

export default function ForoIaPage() {
  const [d, setD] = useState<Datos | null>(null)
  const [aviso, setAviso] = useState("")
  const [corriendo, setCorriendo] = useState("")
  const cargar = () =>
    pedir()
      .then(setD)
      .catch((e) => setAviso((e as Error).message))
  useEffect(() => {
    void cargar()
  }, [])
  const correr = async (que: "respondedor" | "investigador") => {
    setCorriendo(que)
    setAviso(que === "investigador" ? "Investigando (tarda 1 o 2 minutos)…" : "Buscando preguntas…")
    try {
      const r = await pedir({ correr: que })
      setAviso(que === "investigador" ? (r?.ok ? `Listo: «${r.titulo}». El artículo quedó como borrador en Blog.` : `No se pudo: ${r?.motivo || ""}`) : `${r?.nuevas || 0} borrador(es) nuevo(s).`)
      await cargar()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setCorriendo("")
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Foro e IA</h1>
      <p style={{ color: C.tenue, margin: "0 0 12px", fontSize: 14 }}>
        Borradores del agente: respuestas para preguntas que llevan horas sin contestar y temas nuevos que propone el investigador de los lunes. Edítalos y
        publícalos con la cuenta del equipo; nada sale solo.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" style={botonClaro} disabled={!!corriendo} onClick={() => void correr("respondedor")}>
          Buscar preguntas sin respuesta ahora
        </button>
        <button type="button" style={botonClaro} disabled={!!corriendo} onClick={() => void correr("investigador")}>
          Investigar un tema ahora
        </button>
      </div>
      {aviso && <p style={{ ...caja, background: "#F7F5F0" }}>{aviso}</p>}
      {d && !d.foro_configurado && <p style={{ ...caja, background: "#FFFAEB" }}>Falta HETNA_FORO_DB en el .env del API: sin eso no se puede leer ni publicar en el foro.</p>}
      {!d && !aviso && <p style={{ color: C.tenue }}>Cargando…</p>}
      {d && !d.pendientes.length && <p style={{ ...caja, color: C.tenue }}>No hay borradores pendientes.</p>}
      {d?.pendientes.map((p) => (
        <Tarjeta
          key={p.id}
          p={p}
          secciones={d.secciones}
          alTerminar={(m) => {
            setAviso(m)
            void cargar()
          }}
        />
      ))}
      {d && d.recientes.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "20px 0 8px" }}>Recientes</h2>
          {d.recientes.map((p) => (
            <p key={p.id} style={{ margin: "0 0 6px", fontSize: 13 }}>
              {p.estado === "publicado" ? "✅" : "🗑"} {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.titulo}</a> : p.titulo}
            </p>
          ))}
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Foro e IA",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  ),
}
