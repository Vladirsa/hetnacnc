// Pantalla "Biblioteca" del dashboard (menú lateral).
// Aquí se agregan las ligas que salen en la Biblioteca de recursos de la
// Academia (hetnacnc.com/mx/servicios/aprendizaje-cnc#biblioteca): planos,
// guías, videos y programas de otros sitios. No se copia el contenido: se
// guarda una ficha con descripción propia, el crédito y la liga al original.
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"

type Recurso = {
  id: string
  titulo: string
  descripcion: string
  url: string
  fuente: string
  categoria: string
  tipo: string
  imagen_url: string | null
  destacado: boolean
  orden: number
  publicado: boolean
  created_at: string
}

// Misma lista que packages/api/src/lib/recursos-academia.ts
const CATEGORIAS: [string, string][] = [
  ["muebles-melamina", "Muebles y melamina"],
  ["carpinteria", "Carpintería y madera"],
  ["router-cnc", "Router CNC"],
  ["corte-laser", "Corte láser"],
  ["plasma", "Plasma CNC"],
  ["impresion-3d", "Impresión 3D"],
  ["electronica", "Electrónica y controladores"],
  ["diseno-cam", "Diseño y CAM"],
  ["programas", "Programas gratis"],
  ["otros", "Otros"],
]
const TIPOS: [string, string][] = [
  ["planos", "Planos"],
  ["guia", "Guía o tutorial"],
  ["video", "Video"],
  ["programa", "Programa"],
  ["pdf", "Libro o PDF"],
  ["sitio", "Sitio de consulta"],
]
const nombre = (l: [string, string][], v: string) => l.find(([k]) => k === v)?.[1] || v

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
    r = await fetch(`/admin/hetna-recursos${ruta}`, {
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

async function subirImagen(archivo: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error("Usa una imagen JPG, PNG o WEBP.")
  if (archivo.size > 8 * 1024 * 1024) throw new Error("La imagen pesa más de 8 MB.")
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/admin/uploads", { method: "POST", credentials: "include", headers: cabeceras(), body: fd })
  const d = (await r.json().catch(() => ({}))) as { files?: { url: string }[]; message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || "No se pudo subir la imagen.")
  // La Biblioteca sólo acepta fotos https: si el servidor guarda archivos sin
  // https (FILE_BACKEND_URL), avisar ya y no al guardar.
  if (!d.files[0].url.startsWith("https://")) {
    throw new Error("La imagen se subió, pero el servidor la guarda sin https (revisa FILE_BACKEND_URL). Pega una liga https.")
  }
  return d.files[0].url
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

type Borrador = {
  id?: string
  titulo: string
  url: string
  fuente: string
  categoria: string
  tipo: string
  descripcion: string
  imagen_url: string
  destacado: boolean
  orden: number
  publicado: boolean
}
const vacio = (): Borrador => ({
  titulo: "", url: "", fuente: "", categoria: "muebles-melamina", tipo: "planos", descripcion: "", imagen_url: "",
  destacado: false, orden: 0, publicado: true,
})
const deRecurso = (r: Recurso): Borrador => ({
  id: r.id, titulo: r.titulo, url: r.url, fuente: r.fuente, categoria: r.categoria, tipo: r.tipo,
  descripcion: r.descripcion, imagen_url: r.imagen_url || "", destacado: r.destacado, orden: r.orden, publicado: r.publicado,
})
const dominio = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function Editor({ inicial, alSalir }: { inicial: Borrador; alSalir: (guardado: boolean) => void }) {
  const [b, setB] = useState<Borrador>(inicial)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState("")
  const [subiendo, setSubiendo] = useState(false)
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }))

  const guardar = async () => {
    setOcupado(true)
    setMsg("")
    try {
      const { id, ...cuerpo } = b
      await api(id ? `/${id}` : "", "POST", cuerpo)
      alSalir(true)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div style={caja}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 16 }}>{b.id ? "Editar recurso" : "Recurso nuevo"}</strong>
        <button type="button" style={boton("normal")} onClick={() => alSalir(false)}>← Volver a la lista</button>
      </div>

      <label style={etiqueta}>Liga del recurso *</label>
      <input
        style={campo}
        value={b.url}
        onChange={(e) => set("url", e.target.value)}
        onBlur={() => !b.fuente && dominio(b.url) && set("fuente", dominio(b.url))}
        placeholder="https://sitio.com/pagina-de-los-planos"
      />
      <label style={etiqueta}>Título *</label>
      <input style={campo} value={b.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Planos para armar muebles de melamina" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
        <div>
          <label style={etiqueta}>Categoría *</label>
          <select style={campo} value={b.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={etiqueta}>Tipo</label>
          <select style={campo} value={b.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={etiqueta}>Fuente o autor (crédito) *</label>
          <input style={campo} value={b.fuente} onChange={(e) => set("fuente", e.target.value)} placeholder="Manuales Fáciles" />
        </div>
      </div>
      <label style={etiqueta}>Descripción (con tus palabras, máx. 500)</label>
      <textarea
        style={{ ...campo, minHeight: 70 }}
        maxLength={500}
        value={b.descripcion}
        onChange={(e) => set("descripcion", e.target.value)}
        placeholder="Qué encuentra el visitante y para quién sirve. No copies el texto del sitio original."
      />
      <label style={etiqueta}>Imagen de portada (opcional)</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ ...boton("normal"), display: "inline-block" }}>
          {subiendo ? "Subiendo…" : "Subir imagen"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            disabled={subiendo}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (!f) return
              setSubiendo(true)
              setMsg("")
              try {
                set("imagen_url", await subirImagen(f))
              } catch (err) {
                setMsg((err as Error).message)
              } finally {
                setSubiendo(false)
              }
            }}
          />
        </label>
        {b.imagen_url && (
          <>
            <img src={b.imagen_url} alt="" style={{ height: 54, width: 96, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.borde}` }} />
            <button type="button" style={boton("normal")} onClick={() => set("imagen_url", "")}>Quitar</button>
          </>
        )}
      </div>
      <input style={{ ...campo, marginTop: 6 }} value={b.imagen_url} onChange={(e) => set("imagen_url", e.target.value)} placeholder="…o pega una liga https de una foto tuya" />
      <p style={{ fontSize: 12, color: C.tenue, margin: "4px 0 0" }}>
        Sin imagen, la Academia le pone una portada de HETNA con el color y el ícono de su categoría. Usa fotos tuyas, no las del otro sitio.
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 12, fontSize: 14 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={b.publicado} onChange={(e) => set("publicado", e.target.checked)} />
          Visible en la Academia
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={b.destacado} onChange={(e) => set("destacado", e.target.checked)} />
          Recomendado (sale primero)
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Orden
          <input type="number" style={{ ...campo, width: 80 }} value={b.orden} onChange={(e) => set("orden", Number(e.target.value) || 0)} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        <button type="button" style={boton("primario")} disabled={ocupado} onClick={guardar}>
          {ocupado ? "Guardando…" : "Guardar"}
        </button>
        {msg && <span style={{ color: C.rojo, fontSize: 14 }}>{msg}</span>}
      </div>
      <p style={{ fontSize: 12.5, color: C.tenue, marginTop: 12 }}>
        En la Academia sale el título, tu descripción, la fuente y un botón que abre el sitio original. No subas copias de los
        planos o PDF de otros sitios sin permiso del autor.
      </p>
    </div>
  )
}

export default function RecursosPage() {
  const [lista, setLista] = useState<Recurso[] | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [editando, setEditando] = useState<Borrador | null>(null)
  const [filtro, setFiltro] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    try {
      const d = await api<{ recursos: Recurso[] }>("")
      setLista(d.recursos)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => (lista || []).filter((r) => !filtro || r.categoria === filtro), [lista, filtro])

  const borrar = async (r: Recurso) => {
    if (!window.confirm(`¿Borrar "${r.titulo}" de la biblioteca?`)) return
    try {
      await api(`/${r.id}`, "DELETE")
      setAviso("Recurso borrado.")
      void cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (editando) {
    return (
      <div style={{ padding: 16, maxWidth: 900, color: C.texto }}>
        <Editor
          inicial={editando}
          alSalir={(guardado) => {
            setEditando(null)
            if (guardado) {
              setAviso("Guardado. En la Academia se ve en unos minutos.")
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
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Biblioteca de la Academia</h1>
          <p style={{ color: C.tenue, margin: 0, fontSize: 14 }}>
            Ligas a planos, guías y programas de otros sitios. Salen en{" "}
            <a href={`${SITIO}/mx/servicios/aprendizaje-cnc#biblioteca`} target="_blank" rel="noreferrer" style={{ color: C.naranja }}>
              la Academia
            </a>.
          </p>
        </div>
        <button type="button" style={boton("primario")} onClick={() => { setAviso(""); setEditando(vacio()) }}>+ Agregar recurso</button>
      </div>
      {aviso && <p style={{ color: C.verde, fontSize: 14 }}>{aviso}</p>}
      {error ? (
        <p style={{ color: C.rojo }}>{error}</p>
      ) : !lista ? (
        <p style={{ color: C.tenue }}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>Todavía no hay recursos. Agrega el primero: la sección aparece en la Academia en cuanto haya uno visible.</p>
      ) : (
        <>
          <div style={{ margin: "14px 0", display: "flex", gap: 8, alignItems: "center" }}>
            <select style={{ ...campo, width: 260 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todas las categorías ({lista.length})</option>
              {CATEGORIAS.map(([v, t]) => (
                <option key={v} value={v}>{t} ({lista.filter((r) => r.categoria === v).length})</option>
              ))}
            </select>
          </div>
          {visibles.map((r) => (
            <div key={r.id} style={{ ...caja, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{r.titulo}</strong>
                <div style={{ fontSize: 13, color: C.tenue, marginTop: 2 }}>
                  {nombre(CATEGORIAS, r.categoria)} · {nombre(TIPOS, r.tipo)} · {r.fuente}
                  {r.destacado ? " · Recomendado" : ""}
                  {r.publicado ? "" : " · Oculto"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ ...boton("normal"), textDecoration: "none" }}>Abrir</a>
                <button type="button" style={boton("normal")} onClick={() => { setAviso(""); setEditando(deRecurso(r)) }}>Editar</button>
                <button type="button" style={boton("peligro")} onClick={() => void borrar(r)}>Borrar</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Biblioteca",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h4v16H4zM10 4h4v16h-4z" />
      <path d="M16.5 4.5l3.5 1-3.8 14.5-3.5-1" />
    </svg>
  ),
}
