import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react"

// Panel de portadas (carrusel principal de hetnacnc.com).
// Lo que se guarda aquí aparece en la tienda en máximo un minuto, sin compilar ni tocar GitHub.

const IconoPortadas = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <rect x="1.5" y="2.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3.5 8.5l2.2-2.2 1.8 1.8 1.5-1.5 2.5 2.4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <circle cx="5.5" cy="12.8" r="0.8" fill="currentColor" />
    <circle cx="7.5" cy="12.8" r="0.8" fill="currentColor" />
    <circle cx="9.5" cy="12.8" r="0.8" fill="currentColor" />
  </svg>
)

export const config = {
  label: "Portadas",
  icon: IconoPortadas,
  rank: 90,
}

export const handle = {
  breadcrumb: () => "Portadas",
}

type Estado = "pendiente_pago" | "en_revision" | "aprobada" | "rechazada"

type Portada = {
  id: string
  etiqueta: string
  titulo: string
  texto: string
  imagen_url: string | null
  boton1_texto: string | null
  boton1_url: string | null
  boton2_texto: string | null
  boton2_url: string | null
  orden: number
  activa: boolean
  inicia_en: string | null
  termina_en: string | null
  origen: "hetna" | "vendedor"
  seller_id: string | null
  estado: Estado
  impresiones: number
  clics: number
}

type Formulario = {
  etiqueta: string
  titulo: string
  texto: string
  imagen_url: string
  boton1_texto: string
  boton1_url: string
  boton2_texto: string
  boton2_url: string
  orden: string
  activa: boolean
  inicia_en: string
  termina_en: string
}

const VACIO: Formulario = {
  etiqueta: "",
  titulo: "",
  texto: "",
  imagen_url: "",
  boton1_texto: "",
  boton1_url: "",
  boton2_texto: "",
  boton2_url: "",
  orden: "0",
  activa: true,
  inicia_en: "",
  termina_en: "",
}

// El panel vive en el mismo dominio que la API (nginx manda /admin al backend)
const API = typeof window !== "undefined" ? window.location.origin : ""

const llamar = async <T,>(ruta: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(`${API}${ruta}`, {
    credentials: "include",
    ...init,
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  if (!r.ok) {
    let msg = `Error ${r.status}`
    try {
      const j = await r.json()
      msg = j?.message || msg
    } catch {
      // respuesta sin JSON
    }
    throw new Error(msg)
  }
  return r.json() as Promise<T>
}

// Las imagenes subidas al backend quedan como http://localhost:9000/static/...;
// para verlas en el navegador se piden a traves del optimizador de la tienda.
const vistaImagen = (url: string | null, ancho = 640) => {
  if (!url) return ""
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    return `/_next/image?url=${encodeURIComponent(url)}&w=${ancho}&q=70`
  }
  return url
}

const aFechaInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

// Fecha del input (AAAA-MM-DD) a ISO: inicio a las 00:00 y fin a las 23:59 hora local
const deFechaInput = (v: string, fin: boolean) => {
  if (!v) return null
  const [a, m, d] = v.split("-").map(Number)
  const f = fin ? new Date(a, m - 1, d, 23, 59, 59) : new Date(a, m - 1, d, 0, 0, 0)
  return f.toISOString()
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    : null

const situacion = (p: Portada): { texto: string; color: string; fondo: string } => {
  const ahora = new Date()
  if (p.estado === "en_revision") return { texto: "En revisión", color: "#8A5A00", fondo: "#FFF3D6" }
  if (p.estado === "pendiente_pago") return { texto: "Pago pendiente", color: "#8A5A00", fondo: "#FFF3D6" }
  if (p.estado === "rechazada") return { texto: "Rechazada", color: "#A11B1B", fondo: "#FDE3E3" }
  if (!p.activa) return { texto: "Apagada", color: "#5B5B57", fondo: "#EEECE7" }
  if (p.inicia_en && new Date(p.inicia_en) > ahora)
    return { texto: `Programada · ${fmt(p.inicia_en)}`, color: "#1D4E89", fondo: "#E2ECF8" }
  if (p.termina_en && new Date(p.termina_en) < ahora)
    return { texto: "Vencida", color: "#5B5B57", fondo: "#EEECE7" }
  return { texto: "Visible ahora", color: "#14653A", fondo: "#DDF3E6" }
}

const ESTILOS = `
.hp{display:flex;flex-direction:column;gap:12px}
.hp-card{background:var(--bg-base,#fff);border:1px solid var(--border-base,#E7E4DC);border-radius:12px;overflow:hidden}
.hp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-bottom:1px solid var(--border-base,#E7E4DC)}
.hp-h1{margin:0;font-size:18px;font-weight:600;color:var(--fg-base,#1B1B18)}
.hp-sub{margin:2px 0 0;font-size:13px;color:var(--fg-subtle,#6B6A63)}
.hp-btn{border:0;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;background:#C2560A;color:#fff}
.hp-btn:hover{background:#A84A08}
.hp-btn[disabled]{opacity:.6;cursor:default}
.hp-btn2{border:1px solid var(--border-base,#D9D5CB);border-radius:8px;padding:6px 12px;font-size:12.5px;font-weight:600;cursor:pointer;background:var(--bg-base,#fff);color:var(--fg-base,#1B1B18)}
.hp-btn2:hover{background:var(--bg-subtle,#F4F1EA)}
.hp-del{color:#A11B1B}
.hp-row{display:grid;grid-template-columns:168px 1fr auto;gap:16px;align-items:center;padding:14px 24px;border-bottom:1px solid var(--border-base,#E7E4DC)}
.hp-row:last-child{border-bottom:0}
.hp-thumb{width:168px;height:94px;border-radius:8px;object-fit:cover;background:#142033;display:block}
.hp-thumb-vacio{width:168px;height:94px;border-radius:8px;background:linear-gradient(135deg,#0B1424,#1E2C47);display:flex;align-items:center;justify-content:center;color:#9FB0C8;font-size:11px}
.hp-tag{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#C2560A}
.hp-titulo{font-size:14.5px;font-weight:600;color:var(--fg-base,#1B1B18);margin:2px 0}
.hp-meta{font-size:12px;color:var(--fg-subtle,#6B6A63);display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.hp-badge{font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 9px}
.hp-acciones{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.hp-vacio{padding:40px 24px;text-align:center;color:var(--fg-subtle,#6B6A63);font-size:13.5px}
.hp-form{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;padding:20px 24px}
.hp-campo{display:flex;flex-direction:column;gap:5px}
.hp-full{grid-column:1/-1}
.hp-label{font-size:12.5px;font-weight:600;color:var(--fg-base,#1B1B18)}
.hp-ayuda{font-size:11.5px;color:var(--fg-muted,#8A887F)}
.hp-input{border:1px solid var(--border-base,#D9D5CB);border-radius:8px;padding:8px 10px;font-size:13.5px;background:var(--bg-field,#fff);color:var(--fg-base,#1B1B18);font-family:inherit}
.hp-input:focus{outline:2px solid #E8833A;outline-offset:0}
.hp-prev{width:100%;max-width:520px;aspect-ratio:16/7;border-radius:10px;object-fit:cover;background:#142033}
.hp-pie{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid var(--border-base,#E7E4DC)}
.hp-error{margin:0 24px;padding:9px 12px;border-radius:8px;background:#FDE3E3;color:#A11B1B;font-size:13px}
.hp-ok{margin:0 24px;padding:9px 12px;border-radius:8px;background:#DDF3E6;color:#14653A;font-size:13px}
@media (max-width:760px){.hp-row{grid-template-columns:1fr}.hp-form{grid-template-columns:1fr}.hp-acciones{justify-content:flex-start}}
`

const PortadasPage = () => {
  const [lista, setLista] = useState<Portada[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [editando, setEditando] = useState<string | "nueva" | null>(null)
  const [form, setForm] = useState<Formulario>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [borrar, setBorrar] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { portadas } = await llamar<{ portadas: Portada[] }>("/admin/hetna/portadas")
      setLista(portadas)
      setError("")
    } catch (e) {
      setError(`No se pudieron cargar las portadas: ${(e as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const abrirNueva = () => {
    setForm({ ...VACIO, orden: String(lista.length + 1) })
    setEditando("nueva")
    setAviso("")
    setError("")
  }

  const abrirEditar = (p: Portada) => {
    setForm({
      etiqueta: p.etiqueta || "",
      titulo: p.titulo || "",
      texto: p.texto || "",
      imagen_url: p.imagen_url || "",
      boton1_texto: p.boton1_texto || "",
      boton1_url: p.boton1_url || "",
      boton2_texto: p.boton2_texto || "",
      boton2_url: p.boton2_url || "",
      orden: String(p.orden ?? 0),
      activa: p.activa,
      inicia_en: aFechaInput(p.inicia_en),
      termina_en: aFechaInput(p.termina_en),
    })
    setEditando(p.id)
    setAviso("")
    setError("")
  }

  const cambiar =
    (campo: keyof Formulario) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const valor = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value
      setForm((f) => ({ ...f, [campo]: valor }))
    }

  const subirImagen = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    if (archivo.size > 3 * 1024 * 1024) {
      setError("La imagen pesa más de 3 MB. Usa un JPG de 1920×1080 o menos.")
      return
    }
    setSubiendo(true)
    setError("")
    try {
      const datos = new FormData()
      datos.append("files", archivo)
      const { files } = await llamar<{ files: { url: string }[] }>("/admin/uploads", {
        method: "POST",
        body: datos,
      })
      setForm((f) => ({ ...f, imagen_url: files[0]?.url || "" }))
    } catch (err) {
      setError(`No se pudo subir la imagen: ${(err as Error).message}`)
    } finally {
      setSubiendo(false)
      e.target.value = ""
    }
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError("")
    const cuerpo = {
      etiqueta: form.etiqueta,
      titulo: form.titulo,
      texto: form.texto,
      imagen_url: form.imagen_url || null,
      boton1_texto: form.boton1_texto || null,
      boton1_url: form.boton1_url || null,
      boton2_texto: form.boton2_texto || null,
      boton2_url: form.boton2_url || null,
      orden: Number(form.orden) || 0,
      activa: form.activa,
      inicia_en: deFechaInput(form.inicia_en, false),
      termina_en: deFechaInput(form.termina_en, true),
    }
    try {
      if (editando === "nueva") {
        await llamar("/admin/hetna/portadas", { method: "POST", body: JSON.stringify(cuerpo) })
      } else if (editando) {
        await llamar(`/admin/hetna/portadas/${editando}`, { method: "POST", body: JSON.stringify(cuerpo) })
      }
      setEditando(null)
      setAviso("Guardado. La tienda lo mostrará en menos de un minuto.")
      await cargar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const alternar = async (p: Portada) => {
    try {
      await llamar(`/admin/hetna/portadas/${p.id}`, {
        method: "POST",
        body: JSON.stringify({ activa: !p.activa }),
      })
      await cargar()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const eliminar = async (id: string) => {
    try {
      await llamar(`/admin/hetna/portadas/${id}`, { method: "DELETE" })
      setBorrar(null)
      await cargar()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="hp">
      <style>{ESTILOS}</style>

      <div className="hp-card">
        <div className="hp-head">
          <div>
            <h1 className="hp-h1">Portadas de la tienda</h1>
            <p className="hp-sub">
              Carrusel principal de hetnacnc.com. Cambia solo cada 5 segundos; se publican y se quitan
              solas según sus fechas.
            </p>
          </div>
          {editando === null && (
            <button type="button" className="hp-btn" onClick={abrirNueva}>
              + Nueva portada
            </button>
          )}
        </div>

        {error && <p className="hp-error" style={{ marginTop: 14 }}>{error}</p>}
        {aviso && !error && <p className="hp-ok" style={{ marginTop: 14 }}>{aviso}</p>}

        {editando !== null && (
          <form onSubmit={guardar}>
            <div className="hp-form">
              <div className="hp-campo hp-full">
                <span className="hp-label">Imagen</span>
                {form.imagen_url ? (
                  <img className="hp-prev" src={vistaImagen(form.imagen_url, 1080)} alt="" />
                ) : (
                  <div className="hp-thumb-vacio" style={{ width: "100%", maxWidth: 520, height: 160 }}>
                    Sin imagen: se usará el fondo azul de HETNA
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label className="hp-btn2" style={{ display: "inline-block" }}>
                    {subiendo ? "Subiendo…" : form.imagen_url ? "Cambiar imagen" : "Subir imagen"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={subirImagen}
                      disabled={subiendo}
                      style={{ display: "none" }}
                    />
                  </label>
                  {form.imagen_url && (
                    <button
                      type="button"
                      className="hp-btn2"
                      onClick={() => setForm((f) => ({ ...f, imagen_url: "" }))}
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <span className="hp-ayuda">
                  Horizontal, de preferencia 1920×1080 o 1376×768, JPG de menos de 400 KB. La máquina
                  debe quedar del lado derecho: el texto va a la izquierda.
                </span>
              </div>

              <label className="hp-campo">
                <span className="hp-label">Etiqueta</span>
                <input className="hp-input" value={form.etiqueta} onChange={cambiar("etiqueta")} maxLength={40} placeholder="Corte por plasma" />
                <span className="hp-ayuda">Texto corto en la píldora naranja.</span>
              </label>
              <label className="hp-campo">
                <span className="hp-label">Orden</span>
                <input className="hp-input" type="number" value={form.orden} onChange={cambiar("orden")} />
                <span className="hp-ayuda">1 sale primero, 2 después, etc.</span>
              </label>

              <label className="hp-campo hp-full">
                <span className="hp-label">Título *</span>
                <input className="hp-input" value={form.titulo} onChange={cambiar("titulo")} maxLength={120} required placeholder="Plasma CNC para lámina y placa de acero" />
              </label>
              <label className="hp-campo hp-full">
                <span className="hp-label">Texto</span>
                <textarea className="hp-input" rows={2} value={form.texto} onChange={cambiar("texto")} maxLength={260} placeholder="Rejas, letreros, piezas y estructuras metálicas cortadas a la medida." />
              </label>

              <label className="hp-campo">
                <span className="hp-label">Botón naranja: texto</span>
                <input className="hp-input" value={form.boton1_texto} onChange={cambiar("boton1_texto")} maxLength={40} placeholder="Cotizar corte plasma" />
              </label>
              <label className="hp-campo">
                <span className="hp-label">Botón naranja: liga</span>
                <input className="hp-input" value={form.boton1_url} onChange={cambiar("boton1_url")} placeholder="/servicios/cotizador-cnc" />
              </label>
              <label className="hp-campo">
                <span className="hp-label">Botón blanco: texto</span>
                <input className="hp-input" value={form.boton2_texto} onChange={cambiar("boton2_texto")} maxLength={40} placeholder="Ver plasma" />
              </label>
              <label className="hp-campo">
                <span className="hp-label">Botón blanco: liga</span>
                <input className="hp-input" value={form.boton2_url} onChange={cambiar("boton2_url")} placeholder="/categories/plasma" />
              </label>
              <span className="hp-ayuda hp-full" style={{ marginTop: -6 }}>
                Ligas de la tienda empiezan con / (ej. /categories/plasma, /sellers/hetna-cnc,
                /servicios/cotizador-cnc). Ligas externas con https:// (ej. https://wa.me/52…).
              </span>

              <label className="hp-campo">
                <span className="hp-label">Se publica desde</span>
                <input className="hp-input" type="date" value={form.inicia_en} onChange={cambiar("inicia_en")} />
                <span className="hp-ayuda">Vacío = desde hoy.</span>
              </label>
              <label className="hp-campo">
                <span className="hp-label">Se quita después de</span>
                <input className="hp-input" type="date" value={form.termina_en} onChange={cambiar("termina_en")} />
                <span className="hp-ayuda">Vacío = no vence.</span>
              </label>

              <label className="hp-campo hp-full" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.activa} onChange={cambiar("activa")} />
                <span className="hp-label">Encendida</span>
              </label>
            </div>
            <div className="hp-pie">
              <button type="button" className="hp-btn2" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button type="submit" className="hp-btn" disabled={guardando || subiendo}>
                {guardando ? "Guardando…" : "Guardar portada"}
              </button>
            </div>
          </form>
        )}

        {editando === null && (
          <div>
            {cargando ? (
              <div className="hp-vacio">Cargando…</div>
            ) : lista.length === 0 ? (
              <div className="hp-vacio">
                Aún no hay portadas. Mientras tanto la tienda muestra las 5 portadas de HETNA que vienen
                en el código. Crea la primera con “+ Nueva portada”.
              </div>
            ) : (
              lista.map((p) => {
                const s = situacion(p)
                return (
                  <div className="hp-row" key={p.id}>
                    {p.imagen_url ? (
                      <img className="hp-thumb" src={vistaImagen(p.imagen_url, 384)} alt="" loading="lazy" />
                    ) : (
                      <div className="hp-thumb-vacio">Sin imagen</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      {p.etiqueta && <span className="hp-tag">{p.etiqueta}</span>}
                      <div className="hp-titulo">{p.titulo}</div>
                      <div className="hp-meta">
                        <span className="hp-badge" style={{ color: s.color, background: s.fondo }}>
                          {s.texto}
                        </span>
                        <span>Orden {p.orden}</span>
                        {(p.inicia_en || p.termina_en) && (
                          <span>
                            {fmt(p.inicia_en) || "Hoy"} → {fmt(p.termina_en) || "sin fin"}
                          </span>
                        )}
                        {p.origen === "vendedor" && <span>Pagada por vendedor</span>}
                      </div>
                    </div>
                    <div className="hp-acciones">
                      {borrar === p.id ? (
                        <>
                          <span className="hp-meta">¿Eliminar?</span>
                          <button type="button" className="hp-btn2 hp-del" onClick={() => eliminar(p.id)}>
                            Sí, eliminar
                          </button>
                          <button type="button" className="hp-btn2" onClick={() => setBorrar(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="hp-btn2" onClick={() => abrirEditar(p)}>
                            Editar
                          </button>
                          <button type="button" className="hp-btn2" onClick={() => alternar(p)}>
                            {p.activa ? "Apagar" : "Encender"}
                          </button>
                          <button type="button" className="hp-btn2 hp-del" onClick={() => setBorrar(p.id)}>
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PortadasPage
