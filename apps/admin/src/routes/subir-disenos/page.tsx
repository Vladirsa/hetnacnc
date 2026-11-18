// Dashboard > Subir diseños: la forma fácil de dar de alta los diseños digitales
// de HETNA, uno o muchos a la vez.
//   1. Arrastra los archivos (DXF, SVG, STL, ZIP…) y sus fotos. La foto se junta
//      con el archivo del mismo nombre (bandeja.dxf + bandeja.jpg).
//   2. "Preparar": sube el archivo al almacenamiento privado, mejora la foto con
//      IA (fondo blanco o escena realista) y la IA escribe la ficha completa:
//      título SEO, descripción, características, etiquetas, FAQ, precio, licencia.
//   3. Revisa, corrige y "Publicar": queda a la venta con descarga automática.
// Backend: /admin/hetna-subir-disenos (packages/api/src/lib/subir-disenos.ts).
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, DragEvent } from "react"

type Modo = "original" | "fondo_blanco" | "escena"
type Licencia = "personal" | "comercial_limitada" | "comercial_ampliada"
type Ficha = {
  titulo: string
  titulo_seo: string
  handle: string
  descripcion_corta: string
  descripcion_larga: string
  caracteristicas: string
  formatos: string
  subcategoria: string
  tags: string
  keyword_principal: string
  meta_description: string
  faq: { p: string; r: string }[]
  precio_mxn: number
  licencia: Licencia
  nota: string
}
type Estado = "pendiente" | "trabajando" | "listo" | "publicando" | "publicado" | "error"
type Item = {
  id: string
  archivo: File | null
  imagen: File | null
  preview: string
  modo: Modo
  estado: Estado
  paso: string
  sku: string
  storage_key: string
  formato: string
  imagen_url: string
  ficha: Ficha | null
  gratis: boolean
  derechos: boolean
  error: string
  url: string
  abierto: boolean
}
type Config = { ia_texto: boolean; ia_imagen: boolean; subcategorias: string[]; extensiones: string[]; max_mb_archivo: number; max_mb_imagen: number }

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  verde: "#1E7B3A",
  rojo: "#B42318",
  ambar: "#B54708",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const campo: CSSProperties = { width: "100%", padding: "7px 9px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 13.5, background: C.fondo, color: "inherit", boxSizing: "border-box", fontFamily: "inherit" }
const boton: CSSProperties = { background: C.naranja, color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13.5 }
const botonClaro: CSSProperties = { ...boton, background: C.suave, color: "inherit", border: `1px solid ${C.borde}` }
const etiqueta: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: C.tenue, marginBottom: 3 }

const IMAGEN = /\.(png|jpe?g|webp)$/i
const MODOS: { v: Modo; t: string }[] = [
  { v: "fondo_blanco", t: "Fondo blanco (IA)" },
  { v: "escena", t: "Pieza real en escena (IA)" },
  { v: "original", t: "Tal cual" },
]

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

async function api<T>(ruta: string, cuerpo?: unknown, form?: FormData): Promise<T> {
  const r = await fetch(`/admin/hetna-subir-disenos${ruta}`, {
    method: cuerpo || form ? "POST" : "GET",
    credentials: "include",
    headers: form ? cabeceras() : { "Content-Type": "application/json", ...cabeceras() },
    body: form || (cuerpo ? JSON.stringify(cuerpo) : undefined),
  })
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d as T
}

const base = (n: string) => n.replace(/\.[^.]+$/, "").toLowerCase().trim()
const nuevoId = () => Math.random().toString(36).slice(2, 10)
const faqATexto = (f: { p: string; r: string }[]) => f.map((x) => `${x.p} | ${x.r}`).join("\n")
const textoAFaq = (t: string) =>
  t
    .split("\n")
    .map((l) => l.split("|"))
    .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
    .map(([p, ...r]) => ({ p: p.trim(), r: r.join("|").trim() }))

function Contador({ n, min, max }: { n: number; min: number; max: number }) {
  const bien = n >= min && n <= max
  return <span style={{ fontSize: 11, fontWeight: 700, color: bien ? C.verde : C.ambar }}>{n} / {min}–{max} {bien ? "✓" : ""}</span>
}

export default function SubirDisenosPage() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [modoGeneral, setModoGeneral] = useState<Modo>("fondo_blanco")
  const [arrastrando, setArrastrando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const ref = useRef<Item[]>([])
  ref.current = items

  useEffect(() => {
    api<Config>("").then(setCfg).catch(() => setCfg(null))
  }, [])

  const cambiar = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const cambiarFicha = (id: string, p: Partial<Ficha>) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.ficha ? { ...x, ficha: { ...x.ficha, ...p } } : x)))

  const agregar = (lista: FileList | File[]) => {
    const archivos = Array.from(lista)
    const imagenes = archivos.filter((f) => IMAGEN.test(f.name))
    const disenos = archivos.filter((f) => !IMAGEN.test(f.name))
    const usadas = new Set<File>()
    const nuevos: Item[] = disenos.map((a) => {
      const img = imagenes.find((i) => !usadas.has(i) && base(i.name) === base(a.name)) || null
      if (img) usadas.add(img)
      return {
        id: nuevoId(), archivo: a, imagen: img, preview: img ? URL.createObjectURL(img) : "", modo: modoGeneral,
        estado: "pendiente", paso: "", sku: "", storage_key: "", formato: "", imagen_url: "", ficha: null,
        gratis: false, derechos: false, error: "", url: "", abierto: true,
      }
    })
    // Fotos sin archivo del mismo nombre: a los diseños que no tienen foto, en orden
    const sueltas = imagenes.filter((i) => !usadas.has(i))
    setItems((xs) => {
      const todos = [...xs, ...nuevos]
      for (const img of sueltas) {
        const sin = todos.find((x) => !x.imagen && x.estado === "pendiente")
        if (sin) Object.assign(sin, { imagen: img, preview: URL.createObjectURL(img) })
        else todos.push({ id: nuevoId(), archivo: null, imagen: img, preview: URL.createObjectURL(img), modo: modoGeneral, estado: "pendiente", paso: "", sku: "", storage_key: "", formato: "", imagen_url: "", ficha: null, gratis: false, derechos: false, error: "", url: "", abierto: true })
      }
      return [...todos]
    })
  }

  const subirImagen = async (it: Item, modo: Modo) => {
    if (!it.imagen) throw new Error("Falta la foto del diseño.")
    const fd = new FormData()
    fd.append("imagen", it.imagen)
    fd.append("modo", modo)
    fd.append("contexto", it.ficha?.titulo || it.archivo?.name || "")
    return api<{ url: string }>("/imagen", undefined, fd)
  }

  const preparar = async (id: string) => {
    let it = ref.current.find((x) => x.id === id)
    if (!it) return
    if (!it.archivo) return cambiar(id, { estado: "error", error: "Falta el archivo del diseño (DXF, STL, ZIP…). Arrástralo con el mismo nombre que la foto." })
    if (!it.imagen) return cambiar(id, { estado: "error", error: "Falta la foto o captura del diseño." })
    cambiar(id, { estado: "trabajando", error: "" })
    try {
      let { sku, storage_key, formato } = it
      if (!storage_key) {
        cambiar(id, { paso: "Subiendo archivo…" })
        const fd = new FormData()
        fd.append("archivo", it.archivo)
        const r = await api<{ sku: string; storage_key: string; formato: string }>("/archivo", undefined, fd)
        ;({ sku, storage_key, formato } = r)
        cambiar(id, { sku, storage_key, formato })
      }
      let imagen_url = it.imagen_url
      if (!imagen_url) {
        cambiar(id, { paso: it.modo === "original" ? "Preparando imagen…" : "Mejorando imagen con IA (hasta 1 min)…" })
        imagen_url = (await subirImagen(it, it.modo)).url
        cambiar(id, { imagen_url })
      }
      it = ref.current.find((x) => x.id === id)!
      if (!it.ficha) {
        cambiar(id, { paso: "La IA está escribiendo la ficha…" })
        const ficha = await api<Ficha>("/ficha", { imagen_url, nombre_archivo: it.archivo?.name, formatos: formato, sku })
        cambiar(id, { ficha })
      }
      cambiar(id, { estado: "listo", paso: "" })
    } catch (e) {
      cambiar(id, { estado: "error", paso: "", error: (e as Error).message })
    }
  }

  const prepararTodo = async () => {
    setOcupado(true)
    for (const it of ref.current.filter((x) => x.estado === "pendiente" || x.estado === "error")) await preparar(it.id)
    setOcupado(false)
  }

  const rehacerImagen = async (id: string, modo: Modo) => {
    const it = ref.current.find((x) => x.id === id)
    if (!it) return
    cambiar(id, { estado: "trabajando", paso: modo === "original" ? "Preparando imagen…" : "Mejorando imagen con IA…", modo, error: "" })
    try {
      const { url } = await subirImagen(it, modo)
      cambiar(id, { imagen_url: url, estado: it.ficha ? "listo" : "pendiente", paso: "" })
    } catch (e) {
      cambiar(id, { estado: it.ficha ? "listo" : "error", paso: "", error: (e as Error).message })
    }
  }

  const rehacerFicha = async (id: string) => {
    const it = ref.current.find((x) => x.id === id)
    if (!it) return
    cambiar(id, { estado: "trabajando", paso: "La IA está escribiendo la ficha…", error: "" })
    try {
      const ficha = await api<Ficha>("/ficha", { imagen_url: it.imagen_url, nombre_archivo: it.archivo?.name, formatos: it.formato, sku: it.sku, nota: it.ficha?.nota })
      cambiar(id, { ficha, estado: "listo", paso: "" })
    } catch (e) {
      cambiar(id, { estado: "listo", paso: "", error: (e as Error).message })
    }
  }

  const publicar = async (id: string) => {
    const it = ref.current.find((x) => x.id === id)
    if (!it?.ficha) return
    if (!it.derechos) return cambiar(id, { error: "Marca la casilla de derechos antes de publicar." })
    cambiar(id, { estado: "publicando", error: "" })
    try {
      const r = await api<{ url: string; creado: boolean }>("/publicar", {
        ...it.ficha,
        sku: it.sku,
        archivo_storage_key: it.storage_key,
        imagen_url: it.imagen_url,
        gratis: it.gratis,
        derechos_confirmados: true,
      })
      cambiar(id, { estado: "publicado", url: r.url, abierto: false })
    } catch (e) {
      cambiar(id, { estado: "listo", error: (e as Error).message })
    }
  }

  const publicarListos = async () => {
    setOcupado(true)
    for (const it of ref.current.filter((x) => x.estado === "listo" && x.derechos)) await publicar(it.id)
    setOcupado(false)
  }

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    if (e.dataTransfer.files?.length) agregar(e.dataTransfer.files)
  }

  const cuenta = (e: Estado) => items.filter((x) => x.estado === e).length
  const listosConDerechos = items.filter((x) => x.estado === "listo" && x.derechos).length

  return (
    <div style={{ padding: 20, maxWidth: 1080, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Subir diseños</h1>
      <p style={{ color: C.tenue, margin: "0 0 14px", fontSize: 14 }}>
        Arrastra tus archivos y sus fotos. La IA mejora la imagen y escribe la ficha con título SEO; tú revisas y publicas. Junta cada foto con su archivo
        usando el mismo nombre (por ejemplo <b>bandeja.dxf</b> y <b>bandeja.jpg</b>).
      </p>
      {cfg && (!cfg.ia_texto || !cfg.ia_imagen) && (
        <div style={{ ...caja, background: "#FFFAEB", borderColor: "#F0D58A", fontSize: 13 }}>
          {!cfg.ia_texto && <div>⚠ Sin IA de texto en el servidor (ANTHROPIC_API_KEY): la ficha se llena a mano.</div>}
          {!cfg.ia_imagen && <div>⚠ Sin IA de imágenes (FAL_KEY): sólo se puede subir la foto tal cual.</div>}
        </div>
      )}

      <div
        style={{ ...caja, border: `2px dashed ${arrastrando ? C.naranja : C.borde}`, background: arrastrando ? "#FDEEE1" : C.suave, textAlign: "center", padding: 28, cursor: "pointer" }}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        onClick={() => entrada.current?.click()}
      >
        <div style={{ fontSize: 28 }}>📂</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>Arrastra aquí tus archivos y fotos, o haz clic para elegirlos</div>
        <div style={{ fontSize: 12.5, color: C.tenue, marginTop: 4 }}>
          Archivos: {(cfg?.extensiones || ["dxf", "svg", "stl", "zip"]).slice(0, 10).join(", ")}… hasta {cfg?.max_mb_archivo ?? 14} MB · Fotos: JPG, PNG o WebP
          hasta {cfg?.max_mb_imagen ?? 8} MB
        </div>
        <input ref={entrada} type="file" multiple style={{ display: "none" }} onChange={(e) => e.target.files && agregar(e.target.files)} />
      </div>

      {items.length > 0 && (
        <div style={{ ...caja, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>
            Imagen:{" "}
            <select style={{ ...campo, width: "auto", display: "inline-block" }} value={modoGeneral} onChange={(e) => {
              const m = e.target.value as Modo
              setModoGeneral(m)
              setItems((xs) => xs.map((x) => (x.estado === "pendiente" ? { ...x, modo: m } : x)))
            }}>
              {MODOS.map((m) => (
                <option key={m.v} value={m.v} disabled={m.v !== "original" && cfg?.ia_imagen === false}>{m.t}</option>
              ))}
            </select>
          </label>
          <span style={{ fontSize: 13, color: C.tenue }}>
            {items.length} en la lista · {cuenta("listo")} listos · {cuenta("publicado")} publicados{cuenta("error") ? ` · ${cuenta("error")} con error` : ""}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" style={botonClaro} disabled={ocupado || !items.some((x) => x.estado === "pendiente" || x.estado === "error")} onClick={() => void prepararTodo()}>
              {ocupado ? "Trabajando…" : "1. Preparar todo con IA"}
            </button>
            <button type="button" style={boton} disabled={ocupado || !listosConDerechos} onClick={() => void publicarListos()}>
              2. Publicar {listosConDerechos || ""} listos
            </button>
          </span>
        </div>
      )}

      {items.map((it) => (
        <div key={it.id} style={{ ...caja, borderColor: it.estado === "publicado" ? "#A6D8B5" : it.estado === "error" ? "#F3B7B0" : C.borde }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 132, flexShrink: 0 }}>
              {it.imagen_url || it.preview ? (
                <img src={it.imagen_url || it.preview} alt="" style={{ width: 132, height: 132, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.borde}`, background: "#fff" }} />
              ) : (
                <div style={{ width: 132, height: 132, borderRadius: 10, background: C.suave, display: "grid", placeItems: "center", fontSize: 12, color: C.tenue }}>Sin foto</div>
              )}
              {it.imagen && it.estado !== "publicado" && (
                <select style={{ ...campo, marginTop: 6, fontSize: 12 }} value={it.modo} disabled={it.estado === "trabajando" || it.estado === "publicando"}
                  onChange={(e) => (it.imagen_url ? void rehacerImagen(it.id, e.target.value as Modo) : cambiar(it.id, { modo: e.target.value as Modo }))}>
                  {MODOS.map((m) => (
                    <option key={m.v} value={m.v} disabled={m.v !== "original" && cfg?.ia_imagen === false}>{m.t}</option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 15 }}>{it.ficha?.titulo || it.archivo?.name || it.imagen?.name}</b>
                {it.formato && <span style={{ fontSize: 11, background: C.suave, border: `1px solid ${C.borde}`, borderRadius: 999, padding: "1px 8px" }}>{it.formato}</span>}
                {it.sku && <span style={{ fontSize: 11, color: C.tenue }}>{it.sku}</span>}
                <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: it.estado === "publicado" ? C.verde : it.estado === "error" ? C.rojo : C.tenue }}>
                  {it.estado === "pendiente" && "Pendiente"}
                  {it.estado === "trabajando" && `⏳ ${it.paso}`}
                  {it.estado === "listo" && "Listo para revisar"}
                  {it.estado === "publicando" && "⏳ Publicando…"}
                  {it.estado === "publicado" && "✓ Publicado"}
                  {it.estado === "error" && "Error"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>
                {it.archivo ? `Archivo: ${it.archivo.name}` : "⚠ Falta el archivo del diseño"} · {it.imagen ? `Foto: ${it.imagen.name}` : "⚠ Falta la foto"}
              </div>
              {it.error && <p style={{ color: C.rojo, fontSize: 13, margin: "6px 0 0" }}>{it.error}</p>}
              {it.estado === "publicado" && (
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                  Ya está a la venta: <a href={it.url} target="_blank" rel="noreferrer" style={{ color: C.naranja, fontWeight: 700 }}>{it.url}</a>
                </p>
              )}
              {it.estado === "pendiente" && (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button type="button" style={botonClaro} onClick={() => void preparar(it.id)}>Preparar con IA</button>
                  <button type="button" style={{ ...botonClaro, color: C.rojo }} onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>Quitar</button>
                </div>
              )}
              {it.estado === "error" && !it.ficha && (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button type="button" style={botonClaro} onClick={() => void preparar(it.id)}>Reintentar</button>
                  <button type="button" style={{ ...botonClaro, color: C.rojo }} onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>Quitar</button>
                </div>
              )}
            </div>
          </div>

          {it.ficha && it.estado !== "publicado" && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.borde}`, paddingTop: 12 }}>
              {it.ficha.nota && <p style={{ fontSize: 13, color: C.ambar, margin: "0 0 10px" }}>📝 {it.ficha.nota}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={etiqueta}>Título en la tienda</span>
                  <input style={campo} value={it.ficha.titulo} onChange={(e) => cambiarFicha(it.id, { titulo: e.target.value })} />
                </label>
                <label>
                  <span style={etiqueta}>Título SEO (Google) <Contador n={it.ficha.titulo_seo.length} min={45} max={60} /></span>
                  <input style={campo} value={it.ficha.titulo_seo} onChange={(e) => cambiarFicha(it.id, { titulo_seo: e.target.value })} />
                </label>
                <label>
                  <span style={etiqueta}>Palabra clave principal</span>
                  <input style={campo} value={it.ficha.keyword_principal} onChange={(e) => cambiarFicha(it.id, { keyword_principal: e.target.value })} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={etiqueta}>Meta descripción (Google) <Contador n={it.ficha.meta_description.length} min={120} max={160} /></span>
                  <input style={campo} value={it.ficha.meta_description} onChange={(e) => cambiarFicha(it.id, { meta_description: e.target.value })} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={etiqueta}>Descripción corta</span>
                  <input style={campo} value={it.ficha.descripcion_corta} onChange={(e) => cambiarFicha(it.id, { descripcion_corta: e.target.value })} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={etiqueta}>Descripción</span>
                  <textarea style={{ ...campo, minHeight: 110 }} value={it.ficha.descripcion_larga} onChange={(e) => cambiarFicha(it.id, { descripcion_larga: e.target.value })} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={etiqueta}>Qué incluye / características (separadas por ;)</span>
                  <input style={campo} value={it.ficha.caracteristicas} onChange={(e) => cambiarFicha(it.id, { caracteristicas: e.target.value })} />
                </label>
                <label>
                  <span style={etiqueta}>Etiquetas (separadas por coma)</span>
                  <input style={campo} value={it.ficha.tags} onChange={(e) => cambiarFicha(it.id, { tags: e.target.value })} />
                </label>
                <label>
                  <span style={etiqueta}>Categoría</span>
                  <select style={campo} value={it.ficha.subcategoria} onChange={(e) => cambiarFicha(it.id, { subcategoria: e.target.value })}>
                    <option value="">Diseños digitales (general)</option>
                    {(cfg?.subcategorias || []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={etiqueta}>Precio (MXN)</span>
                  <input style={campo} type="number" min={0} disabled={it.gratis} value={it.gratis ? 0 : it.ficha.precio_mxn}
                    onChange={(e) => cambiarFicha(it.id, { precio_mxn: Number(e.target.value) })} />
                  <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <input type="checkbox" checked={it.gratis} onChange={(e) => cambiar(it.id, { gratis: e.target.checked })} /> Gratis (descarga con cuenta)
                  </label>
                </label>
                <label>
                  <span style={etiqueta}>Licencia</span>
                  <select style={campo} value={it.ficha.licencia} onChange={(e) => cambiarFicha(it.id, { licencia: e.target.value as Licencia })}>
                    <option value="personal">Personal (uso propio)</option>
                    <option value="comercial_limitada">Comercial limitada (puede vender piezas)</option>
                    <option value="comercial_ampliada">Comercial ampliada</option>
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={etiqueta}>Preguntas frecuentes (una por línea: pregunta | respuesta)</span>
                  <textarea key={`faq-${it.id}-${it.ficha.faq.map((f) => f.p).join("|")}`} style={{ ...campo, minHeight: 70 }} defaultValue={faqATexto(it.ficha.faq)} onBlur={(e) => cambiarFicha(it.id, { faq: textoAFaq(e.target.value) })} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={etiqueta}>Dirección en la tienda</span>
                  <input style={campo} value={it.ficha.handle} onChange={(e) => cambiarFicha(it.id, { handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
                  <input type="checkbox" checked={it.derechos} onChange={(e) => cambiar(it.id, { derechos: e.target.checked, error: "" })} />
                  Este diseño es mío (o tengo derecho a venderlo)
                </label>
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button type="button" style={botonClaro} disabled={it.estado !== "listo"} onClick={() => void rehacerFicha(it.id)}>Rehacer texto con IA</button>
                  <button type="button" style={boton} disabled={it.estado !== "listo" || !it.derechos} onClick={() => void publicar(it.id)}>Publicar</button>
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export const config = {
  label: "Subir diseños",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  ),
}
