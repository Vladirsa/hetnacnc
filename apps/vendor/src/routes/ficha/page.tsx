// @ts-nocheck
// Panel del taller > Ficha del producto: lo que el cliente ve abajo de la
// descripción en la tienda (compatibilidad, videos, archivos para descargar y
// preguntas frecuentes). Antes sólo se podía poner a mano en Metadata.
//   GET  /vendor/hetna-ficha        -> productos del taller con su ficha
//   POST /vendor/hetna-ficha/:id    -> guarda (packages/api/src/lib/ficha-extendida.ts)
import { useEffect, useMemo, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
)

export const config: RouteConfig = {
  label: "Ficha del producto",
  icon: Icono,
}

const TIENDA = "https://hetnacnc.com/mx/products/"
const MAX_MB = 20
const EXT_ARCHIVO = /\.(pdf|zip|rar|7z|dxf|dwg|step|stp|stl|igs|iges|svg|ai|eps|nc|tap|gcode|txt|xlsx?|docx?|jpe?g|png|webp)$/i
const SUGERENCIAS = ["Mach3", "Mach4", "GRBL", "UCCNC", "LinuxCNC", "DDCS", "Richauto", "NcStudio", "Vectric", "Fusion 360", "LightBurn", "Router 1325", "Router 1530", "Router 6090", "Láser CO2", "Plasma"]

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 18, marginBottom: 14 },
  h2: { fontSize: 16, fontWeight: 700, margin: "0 0 4px" },
  ayuda: { color: "#6B675C", fontSize: 13, margin: "0 0 10px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", height: 38, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 10px", fontSize: 14, boxSizing: "border-box", background: "#fff" },
  area: { width: "100%", minHeight: 64, border: "1px solid #D9D5C9", borderRadius: 8, padding: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "7px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  quitar: { background: "transparent", color: "#B3261E", border: 0, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "4px 6px" },
  chip: { display: "inline-flex", alignItems: "center", gap: 4, background: "#F3F1EA", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 13, margin: "0 6px 6px 0" },
  fila: { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap" },
}

const vacia = () => ({ compatibilidad: [], videos: [], archivos: [], faq: [] })

function Chips({ valores, onChange, max }) {
  const [texto, setTexto] = useState("")
  const agregar = (t) => {
    const nuevos = String(t)
      .split(/[,;\n]+/)
      .map((x) => x.trim())
      .filter(Boolean)
    const todos = [...valores]
    for (const n of nuevos) if (!todos.some((v) => v.toLowerCase() === n.toLowerCase())) todos.push(n)
    onChange(todos.slice(0, max))
    setTexto("")
  }
  return (
    <div>
      <div>
        {valores.map((v) => (
          <span key={v} style={S.chip}>
            {v}
            <button type="button" aria-label={`Quitar ${v}`} style={{ ...S.quitar, padding: "0 4px" }} onClick={() => onChange(valores.filter((x) => x !== v))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={S.fila}>
        <input
          style={{ ...S.input, flex: "1 1 220px" }}
          value={texto}
          placeholder="Escribe y presiona Enter (ej. Mach3)"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              if (texto.trim()) agregar(texto)
            }
          }}
          onBlur={() => texto.trim() && agregar(texto)}
        />
      </div>
      <div style={{ fontSize: 12, color: "#6B675C" }}>
        Sugerencias:{" "}
        {SUGERENCIAS.filter((s) => !valores.includes(s)).slice(0, 10).map((s) => (
          <button key={s} type="button" onClick={() => agregar(s)} style={{ ...S.chip, border: 0, cursor: "pointer", padding: "3px 10px", fontSize: 12 }}>
            + {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function Editor({ producto, limites, alGuardar }) {
  const [f, setF] = useState(() => ({ ...vacia(), ...producto.ficha }))
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const cambiar = (k, i, campo, v) => set(k, f[k].map((it, j) => (j === i ? (campo ? { ...it, [campo]: v } : v) : it)))
  const quitar = (k, i) => set(k, f[k].filter((_, j) => j !== i))

  const subir = async (archivo) => {
    setMsg(null)
    if (!EXT_ARCHIVO.test(archivo.name)) return setMsg({ ok: false, t: `"${archivo.name}": usa PDF, ZIP, DXF, STEP, STL, imágenes u hojas de cálculo.` })
    if (archivo.size > MAX_MB * 1024 * 1024) return setMsg({ ok: false, t: `"${archivo.name}" pesa más de ${MAX_MB} MB. Súbelo a Google Drive y pega la liga.` })
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append("files", archivo)
      const r = await fetch("/vendor/uploads", { method: "POST", credentials: "include", body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || `No se pudo subir "${archivo.name}".`)
      set("archivos", [...f.archivos, { nombre: archivo.name.replace(/\.[^.]+$/, ""), url: d.files[0].url }])
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setSubiendo(false)
    }
  }

  const guardar = async () => {
    setGuardando(true)
    setMsg(null)
    try {
      const cuerpo = {
        compatibilidad: f.compatibilidad,
        videos: f.videos.map((v) => v.trim()).filter(Boolean),
        archivos: f.archivos.filter((a) => a.url.trim()),
        faq: f.faq.filter((q) => q.pregunta.trim() || q.respuesta.trim()),
      }
      const r = await fetch(`/vendor/hetna-ficha/${producto.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setF({ ...vacia(), ...d.ficha })
      setMsg({ ok: true, t: "Guardado. Ya se ve en la tienda (puede tardar un par de minutos)." })
      alGuardar(d.ficha)
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ borderTop: "1px solid #E7E4DC", marginTop: 14, paddingTop: 14 }}>
      <section style={{ marginBottom: 18 }}>
        <h3 style={S.h2}>Compatibilidad</h3>
        <p style={S.ayuda}>Controladores, programas o máquinas con los que funciona. Ayuda a que lo encuentren y evita devoluciones.</p>
        <Chips valores={f.compatibilidad} max={limites.compatibilidad} onChange={(v) => set("compatibilidad", v)} />
      </section>

      <section style={{ marginBottom: 18 }}>
        <h3 style={S.h2}>Videos</h3>
        <p style={S.ayuda}>Ligas de YouTube o Vimeo: el producto funcionando, la instalación o una prueba de corte.</p>
        {f.videos.map((v, i) => (
          <div key={i} style={S.fila}>
            <input style={{ ...S.input, flex: "1 1 280px" }} value={v} placeholder="https://www.youtube.com/watch?v=..." onChange={(e) => cambiar("videos", i, null, e.target.value)} />
            <button type="button" style={S.quitar} onClick={() => quitar("videos", i)}>Quitar</button>
          </div>
        ))}
        {f.videos.length < limites.videos && (
          <button type="button" style={S.btn2} onClick={() => set("videos", [...f.videos, ""])}>+ Agregar video</button>
        )}
      </section>

      <section style={{ marginBottom: 18 }}>
        <h3 style={S.h2}>Archivos para descargar</h3>
        <p style={S.ayuda}>Manual, ficha técnica, plano o diagrama de conexión. Súbelo aquí (hasta {MAX_MB} MB) o pega una liga de Google Drive, Dropbox u OneDrive.</p>
        {f.archivos.map((a, i) => (
          <div key={i} style={S.fila}>
            <input style={{ ...S.input, flex: "1 1 180px" }} value={a.nombre} placeholder="Nombre (ej. Manual de usuario)" onChange={(e) => cambiar("archivos", i, "nombre", e.target.value)} />
            <input style={{ ...S.input, flex: "2 1 260px" }} value={a.url} placeholder="https://..." onChange={(e) => cambiar("archivos", i, "url", e.target.value)} />
            <button type="button" style={S.quitar} onClick={() => quitar("archivos", i)}>Quitar</button>
          </div>
        ))}
        {f.archivos.length < limites.archivos && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ ...S.btn2, display: "inline-block", opacity: subiendo ? 0.6 : 1 }}>
              {subiendo ? "Subiendo..." : "Subir archivo"}
              <input
                type="file"
                hidden
                disabled={subiendo}
                onChange={(e) => {
                  const a = e.target.files?.[0]
                  e.target.value = ""
                  if (a) subir(a)
                }}
              />
            </label>
            <button type="button" style={S.btn2} onClick={() => set("archivos", [...f.archivos, { nombre: "", url: "" }])}>+ Pegar una liga</button>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 18 }}>
        <h3 style={S.h2}>Preguntas frecuentes</h3>
        <p style={S.ayuda}>Lo que más te preguntan antes de comprar. Google también las muestra en sus resultados.</p>
        {f.faq.map((q, i) => (
          <div key={i} style={{ ...S.card, padding: 12, background: "#FAF9F5" }}>
            <label style={S.label}>Pregunta</label>
            <input style={S.input} value={q.pregunta} placeholder="¿Incluye el spindle?" onChange={(e) => cambiar("faq", i, "pregunta", e.target.value)} />
            <label style={{ ...S.label, marginTop: 8 }}>Respuesta</label>
            <textarea style={S.area} value={q.respuesta} placeholder="Sí, incluye spindle de 2.2 kW enfriado por agua." onChange={(e) => cambiar("faq", i, "respuesta", e.target.value)} />
            <div style={{ textAlign: "right" }}>
              <button type="button" style={S.quitar} onClick={() => quitar("faq", i)}>Quitar pregunta</button>
            </div>
          </div>
        ))}
        {f.faq.length < limites.faq && (
          <button type="button" style={S.btn2} onClick={() => set("faq", [...f.faq, { pregunta: "", respuesta: "" }])}>+ Agregar pregunta</button>
        )}
      </section>

      <p style={{ color: "#6B675C", fontSize: 12, margin: "0 0 10px" }}>
        No escribas teléfonos, correos ni ligas en los textos: se ocultan automáticamente. Todo el trato va por HETNA.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={{ ...S.btn, opacity: guardando ? 0.6 : 1 }} disabled={guardando || subiendo} onClick={guardar}>
          {guardando ? "Guardando..." : "Guardar ficha"}
        </button>
        {producto.handle && producto.estado === "published" && (
          <a href={TIENDA + producto.handle} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: "#142033", fontWeight: 600 }}>
            Ver en la tienda
          </a>
        )}
        {msg && <span style={{ fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</span>}
      </div>
    </div>
  )
}

const cuantos = (f) => [f.compatibilidad.length, f.videos.length, f.archivos.length, f.faq.length].filter((n) => n > 0).length

export default function FichaPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [abierto, setAbierto] = useState(null)
  const [buscar, setBuscar] = useState("")

  useEffect(() => {
    fetch("/vendor/hetna-ficha", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d.message || r.status))))
      .then(setDatos)
      .catch((e) => setError("No se pudieron cargar tus productos (" + e + ")."))
  }, [])

  const lista = useMemo(() => {
    const t = buscar.trim().toLowerCase()
    return (datos?.productos || []).filter((p) => !t || String(p.titulo).toLowerCase().includes(t))
  }, [datos, buscar])

  if (error) return <div style={S.page}>{error}</div>
  if (!datos) return <div style={S.page}>Cargando...</div>

  const actualizar = (id, ficha) =>
    setDatos((d) => ({ ...d, productos: d.productos.map((p) => (p.id === id ? { ...p, ficha, completa: cuantos(ficha) } : p)) }))

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Ficha del producto</h1>
      <p style={S.sub}>
        Agrega compatibilidad, videos, manuales y preguntas frecuentes. Aparecen en la página del producto, abajo de la descripción, y le dan más confianza al cliente para comprar.
      </p>

      {datos.productos.length > 6 && (
        <input style={{ ...S.input, marginBottom: 14 }} value={buscar} placeholder="Buscar producto..." onChange={(e) => setBuscar(e.target.value)} />
      )}

      {!datos.productos.length && (
        <div style={{ ...S.card, textAlign: "center", color: "#6B675C" }}>
          Todavía no tienes productos. Publica el primero en <b>Publicar producto</b> y vuelve aquí para completar su ficha.
        </div>
      )}

      {lista.map((p) => (
        <div key={p.id} style={S.card}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {p.foto ? (
              <img src={p.foto} alt="" width={56} height={56} style={{ borderRadius: 8, objectFit: "cover", border: "1px solid #E7E4DC", flex: "0 0 auto" }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 8, background: "#F3F1EA", flex: "0 0 auto" }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</div>
              <div style={{ fontSize: 13, color: p.completa === 4 ? "#1E7B3A" : "#6B675C" }}>
                {p.completa === 4 ? "Ficha completa" : `${p.completa} de 4 secciones`}
                {p.estado !== "published" ? " · todavía no está publicado" : ""}
              </div>
            </div>
            <button type="button" style={S.btn2} onClick={() => setAbierto(abierto === p.id ? null : p.id)}>
              {abierto === p.id ? "Cerrar" : p.completa ? "Editar ficha" : "Completar ficha"}
            </button>
          </div>
          {abierto === p.id && <Editor producto={p} limites={datos.limites} alGuardar={(ficha) => actualizar(p.id, ficha)} />}
        </div>
      ))}
    </div>
  )
}
