// Pantalla "Blog" del dashboard (menú lateral).
// Aquí se escriben los artículos y guías que salen en el blog del foro
// (hetnacnc.com/mx/foro-cnc/blog). Cada artículo puede pertenecer a una
// sección del foro, y si se marca como "guía fija" sale arriba de esa sección.
//
// Se escribe en texto simple (## títulos, - listas, **negritas**, [ligas](url))
// y se guarda como HTML. Los artículos que ya existen se editan en HTML.
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"

type Articulo = {
  id: string
  slug: string
  title: string
  excerpt: string
  content_html: string
  cover_image_url: string | null
  video_url: string | null
  seo_title: string | null
  seo_description: string | null
  categoria: string | null
  guia: boolean
  autor: string | null
  published_at: string | null
  created_at: string
}

const SECCIONES: [string, string][] = [
  ["", "Sin sección (general)"],
  ["router-cnc", "Router CNC"],
  ["corte-laser", "Corte láser"],
  ["plasma", "Plasma CNC"],
  ["torno-fresadora", "Torno y fresadora CNC"],
  ["impresion-3d", "Impresión 3D"],
  ["diseno-cam", "Diseño y CAM"],
  ["controladores-electronica", "Controladores y electrónica"],
  ["materiales-herramientas", "Materiales y herramientas"],
  ["precios-negocio", "Precios y negocio"],
  ["muestra-tu-trabajo", "Muestra tu trabajo"],
]
const nombreSeccion = (s: string | null) => SECCIONES.find(([v]) => v === (s || ""))?.[1] || "—"

const SITIO = "https://hetnacnc.com"
const MSG_SESION =
  "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."
const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
async function api<T>(ruta: string, metodo = "GET", cuerpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin/hetna-blog${ruta}`, {
      method: metodo,
      credentials: "include",
      headers: cuerpo === undefined ? cabeceras() : { ...cabeceras(), "content-type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

// Texto simple → HTML. Pocas reglas y predecibles: lo justo para escribir una
// guía sin saber HTML. Todo se escapa antes de dar formato.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const enLinea = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>')
function textoAHtml(texto: string): string {
  const bloques = texto.replace(/\r/g, "").split(/\n{2,}/)
  return bloques
    .map((b) => {
      const lineas = b.split("\n").filter((l) => l.trim())
      if (!lineas.length) return ""
      if (lineas.length === 1 && /^###\s/.test(lineas[0])) return `<h3>${enLinea(lineas[0].replace(/^###\s+/, ""))}</h3>`
      if (lineas.length === 1 && /^##\s/.test(lineas[0])) return `<h2>${enLinea(lineas[0].replace(/^##\s+/, ""))}</h2>`
      if (lineas.every((l) => /^\s*[-*]\s/.test(l))) return `<ul>${lineas.map((l) => `<li>${enLinea(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`
      if (lineas.every((l) => /^\s*\d+[.)]\s/.test(l))) return `<ol>${lineas.map((l) => `<li>${enLinea(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`
      if (lineas.length === 1 && /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/.test(lineas[0])) {
        const [, alt, src] = lineas[0].match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/)!
        return `<p><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" /></p>`
      }
      return `<p>${lineas.map(enLinea).join("<br/>")}</p>`
    })
    .filter(Boolean)
    .join("\n")
}

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  rojo: "#b42318",
  verde: "#1E7B3A",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const campo: CSSProperties = {
  width: "100%", borderRadius: 8, border: `1px solid ${C.borde}`, padding: "8px 10px", fontSize: 14,
  background: C.fondo, color: C.texto, boxSizing: "border-box", fontFamily: "inherit",
}
const etiqueta: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, margin: "10px 0 4px" }
const boton = (tipo: "primario" | "normal" | "peligro"): CSSProperties => ({
  cursor: "pointer", borderRadius: 10, padding: "9px 14px", fontSize: 14, fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none",
  background: tipo === "primario" ? C.naranja : tipo === "peligro" ? C.rojo : C.fondo,
  color: tipo === "normal" ? C.texto : "#fff",
})

const AYUDA = `## Así se pone un subtítulo

Un párrafo es texto seguido. Deja una línea vacía entre párrafos.
**Negritas** con dos asteriscos y *cursivas* con uno.

- Una lista se hace con guiones
- Un elemento por línea

1. Una lista numerada
2. Con número y punto

[Texto de la liga](/mx/cotizar)
![Descripción de la imagen](https://...)`

type Borrador = {
  id?: string
  title: string
  slug: string
  excerpt: string
  texto: string
  html: string
  modo: "texto" | "html"
  categoria: string
  guia: boolean
  autor: string
  cover_image_url: string
  video_url: string
  seo_title: string
  seo_description: string
  publicado: boolean
}

const vacio = (): Borrador => ({
  title: "", slug: "", excerpt: "", texto: "", html: "", modo: "texto", categoria: "", guia: false, autor: "Equipo HETNA",
  cover_image_url: "", video_url: "", seo_title: "", seo_description: "", publicado: true,
})
const deArticulo = (a: Articulo): Borrador => ({
  id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt, texto: "", html: a.content_html, modo: "html",
  categoria: a.categoria || "", guia: a.guia, autor: a.autor || "", cover_image_url: a.cover_image_url || "",
  video_url: a.video_url || "", seo_title: a.seo_title || "", seo_description: a.seo_description || "", publicado: Boolean(a.published_at),
})

function Editor({ inicial, alSalir }: { inicial: Borrador; alSalir: (guardado: boolean) => void }) {
  const [b, setB] = useState<Borrador>(inicial)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [verAyuda, setVerAyuda] = useState(false)
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }))
  const html = useMemo(() => (b.modo === "texto" ? textoAHtml(b.texto) : b.html), [b.modo, b.texto, b.html])

  const guardar = async () => {
    setOcupado(true)
    setMsg(null)
    try {
      const cuerpo = {
        title: b.title, slug: b.slug, excerpt: b.excerpt, content_html: html, categoria: b.categoria, guia: b.guia,
        autor: b.autor, cover_image_url: b.cover_image_url, video_url: b.video_url, seo_title: b.seo_title,
        seo_description: b.seo_description, publicado: b.publicado,
      }
      if (b.id) await api(`/${b.id}`, "POST", cuerpo)
      else await api("", "POST", cuerpo)
      alSalir(true)
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div style={caja}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 16 }}>{b.id ? "Editar artículo" : "Artículo nuevo"}</strong>
        <button type="button" style={boton("normal")} onClick={() => alSalir(false)}>← Volver a la lista</button>
      </div>

      <label style={etiqueta}>Título *</label>
      <input style={campo} value={b.title} onChange={(e) => set("title", e.target.value)} placeholder="Cómo pasar un PDF a DXF para cortar en CNC" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
        <div>
          <label style={etiqueta}>Sección del foro</label>
          <select style={campo} value={b.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {SECCIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={etiqueta}>Autor</label>
          <input style={campo} value={b.autor} onChange={(e) => set("autor", e.target.value)} />
        </div>
        <div>
          <label style={etiqueta}>Dirección (slug)</label>
          <input style={campo} value={b.slug} onChange={(e) => set("slug", e.target.value)} placeholder="se arma sola con el título" />
        </div>
      </div>
      <label style={{ ...etiqueta, display: "flex", gap: 6, alignItems: "center", fontWeight: 400 }}>
        <input type="checkbox" checked={b.guia} onChange={(e) => set("guia", e.target.checked)} />
        <span><strong>Guía fija</strong>: sale arriba de su sección del foro, para las dudas que se repiten.</span>
      </label>

      <label style={etiqueta}>Resumen (sale en la lista y en Google)</label>
      <textarea style={{ ...campo, minHeight: 60 }} value={b.excerpt} onChange={(e) => set("excerpt", e.target.value)} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
        <label style={etiqueta}>Contenido *</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          {b.modo === "texto" ? (
            <>
              <button type="button" style={{ ...boton("normal"), padding: "4px 10px", fontSize: 12 }} onClick={() => setVerAyuda(!verAyuda)}>
                {verAyuda ? "Ocultar ayuda" : "¿Cómo doy formato?"}
              </button>
              <button type="button" style={{ ...boton("normal"), padding: "4px 10px", fontSize: 12 }} onClick={() => setB((x) => ({ ...x, modo: "html", html }))}>
                Pasar a HTML
              </button>
            </>
          ) : (
            <span style={{ color: C.tenue }}>Editando en HTML</span>
          )}
        </div>
      </div>
      {verAyuda && <pre style={{ ...campo, background: C.suave, whiteSpace: "pre-wrap", fontSize: 12.5 }}>{AYUDA}</pre>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 10 }}>
        <textarea
          style={{ ...campo, minHeight: 420, fontFamily: b.modo === "html" ? "ui-monospace,monospace" : "inherit", fontSize: b.modo === "html" ? 12.5 : 14 }}
          value={b.modo === "texto" ? b.texto : b.html}
          onChange={(e) => (b.modo === "texto" ? set("texto", e.target.value) : set("html", e.target.value))}
          placeholder={b.modo === "texto" ? "Escribe aquí. Deja una línea vacía entre párrafos." : ""}
        />
        <div style={{ ...campo, minHeight: 420, overflow: "auto", background: C.suave, lineHeight: 1.6 }}>
          <div style={{ fontSize: 12, color: C.tenue, marginBottom: 6 }}>Vista previa</div>
          <div dangerouslySetInnerHTML={{ __html: html || "<p style='color:#999'>Aquí se ve cómo queda.</p>" }} />
        </div>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Imagen, video y Google (opcional)</summary>
        <label style={etiqueta}>Imagen de portada (liga https)</label>
        <input style={campo} value={b.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} />
        <label style={etiqueta}>Video de YouTube (liga)</label>
        <input style={campo} value={b.video_url} onChange={(e) => set("video_url", e.target.value)} />
        <label style={etiqueta}>Título para Google (máx. 70)</label>
        <input style={campo} maxLength={70} value={b.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
        <label style={etiqueta}>Descripción para Google (máx. 170)</label>
        <textarea style={{ ...campo, minHeight: 50 }} maxLength={170} value={b.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
      </details>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        <label style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={b.publicado} onChange={(e) => set("publicado", e.target.checked)} />
          Publicado (si no, queda como borrador)
        </label>
        <button type="button" style={boton("primario")} disabled={ocupado} onClick={guardar}>
          {ocupado ? "Guardando…" : "Guardar"}
        </button>
        {msg && <span style={{ color: msg.ok ? C.verde : C.rojo, fontSize: 14 }}>{msg.t}</span>}
      </div>
    </div>
  )
}

export default function BlogPage() {
  const [lista, setLista] = useState<Articulo[] | null>(null)
  const [error, setError] = useState("")
  const [editando, setEditando] = useState<Borrador | null>(null)
  const [aviso, setAviso] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    try {
      const d = await api<{ articulos: Articulo[] }>("")
      setLista(d.articulos)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const borrar = async (a: Articulo) => {
    if (!window.confirm(`¿Borrar "${a.title}"? Deja de verse en el sitio.`)) return
    try {
      await api(`/${a.id}`, "DELETE")
      setAviso("Artículo borrado.")
      void cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (editando) {
    return (
      <div style={{ padding: 16, maxWidth: 1200, color: C.texto }}>
        <Editor
          inicial={editando}
          alSalir={(guardado) => {
            setEditando(null)
            if (guardado) {
              setAviso("Guardado.")
              void cargar()
            }
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 1000, color: C.texto }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Blog del foro</h1>
          <p style={{ color: C.tenue, margin: 0, fontSize: 14 }}>
            Artículos y guías que salen en <a href={`${SITIO}/mx/foro-cnc/blog`} target="_blank" rel="noreferrer" style={{ color: C.naranja }}>hetnacnc.com/mx/foro-cnc/blog</a>.
          </p>
        </div>
        <button type="button" style={boton("primario")} onClick={() => { setAviso(""); setEditando(vacio()) }}>+ Artículo nuevo</button>
      </div>
      {aviso && <p style={{ color: C.verde, fontSize: 14 }}>{aviso}</p>}
      {error ? (
        <p style={{ color: C.rojo }}>{error}</p>
      ) : !lista ? (
        <p style={{ color: C.tenue }}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>Todavía no hay artículos. Escribe el primero.</p>
      ) : (
        <div style={{ marginTop: 14 }}>
          {lista.map((a) => (
            <div key={a.id} style={{ ...caja, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{a.title}</strong>
                <div style={{ fontSize: 13, color: C.tenue, marginTop: 2 }}>
                  {nombreSeccion(a.categoria)}
                  {a.guia ? " · Guía fija" : ""} · {a.published_at ? `Publicado ${new Date(a.published_at).toLocaleDateString("es-MX")}` : "Borrador"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {a.published_at && (
                  <a href={`${SITIO}/mx/foro-cnc/blog/${a.slug}`} target="_blank" rel="noreferrer" style={{ ...boton("normal"), textDecoration: "none" }}>Ver</a>
                )}
                <button type="button" style={boton("normal")} onClick={() => { setAviso(""); setEditando(deArticulo(a)) }}>Editar</button>
                <button type="button" style={boton("peligro")} onClick={() => void borrar(a)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const config = {
  label: "Blog",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7M9 11h5" />
    </svg>
  ),
}
