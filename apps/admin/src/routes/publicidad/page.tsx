// Página "Publicidad" del dashboard (aparece en el menú lateral).
// Aquí se administran los banners y anuncios del sitio: imagen, textos, enlace, fechas, orden,
// pausar/activar, borrar y ver vistas y clics. Usa la misma sesión con la que entraste al dashboard.
// Los datos se leen y guardan a través del sitio (/api/pub/admin/...), mismo dominio.
import { useCallback, useEffect, useState } from "react"
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from "react"

// ---------- Tipos ----------
type Config = {
  nombre: string
  medidas: string
  anchoMax: number
  max: number
  ratio: string
  publicidad: boolean
  ayuda: string
}

type Pieza = {
  id: string
  espacio: string
  titulo: string
  subtitulo: string | null
  boton: string | null
  enlace: string
  imagen_url: string | null
  imagen_movil_url: string | null
  video_url: string | null
  anunciante: string | null
  es_publicidad: boolean
  orden: number
  desde: string
  hasta: string | null
  activo: boolean
  vistas: number
  clics: number
}

type Borrador = {
  id?: string
  espacio: string
  titulo: string
  subtitulo: string
  boton: string
  enlace: string
  imagen_url: string
  imagen_movil_url: string
  video_url: string
  anunciante: string
  es_publicidad: boolean
  orden: number
  desde: string // aaaa-mm-dd
  hasta: string // aaaa-mm-dd
  activo: boolean
}

type Datos = { piezas: Pieza[]; espacios: Record<string, Config>; orden: string[] }
type Lista = { ok: true } & Datos
type Falla = { ok: false; error: string }
type Guardado = { ok: true; id: string } | Falla
type Simple = { ok: true } | Falla

const MSG_SESION =
  "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."

// ---------- Comunicación con el sitio ----------
const tokenLocal = (): string | null => {
  try {
    return localStorage.getItem("medusa_auth_token")
  } catch {
    return null
  }
}

const cabeceras = (): Record<string, string> => {
  const h: Record<string, string> = { "x-hetna-pub": "1" }
  const t = tokenLocal()
  if (t) h.authorization = `Bearer ${t}`
  return h
}

async function api<T>(ruta: string, cuerpo?: unknown): Promise<T | Falla> {
  try {
    const init: RequestInit =
      cuerpo === undefined
        ? { headers: cabeceras(), credentials: "include" }
        : {
            method: "POST",
            headers: { ...cabeceras(), "content-type": "application/json" },
            body: JSON.stringify(cuerpo),
            credentials: "include",
          }
    const r = await fetch(`/api/pub/admin/${ruta}`, init)
    return (await r.json()) as T | Falla
  } catch {
    return { ok: false, error: "No se pudo conectar con el sitio. Revisa tu internet e intenta de nuevo." }
  }
}

// ---------- Utilidades ----------
const vacio = (espacio: string, cfg?: Config): Borrador => ({
  espacio,
  titulo: "",
  subtitulo: "",
  boton: "",
  enlace: "/",
  imagen_url: "",
  imagen_movil_url: "",
  video_url: "",
  anunciante: "",
  es_publicidad: cfg ? cfg.publicidad : false,
  orden: 1,
  desde: "",
  hasta: "",
  activo: true,
})

const aBorrador = (p: Pieza): Borrador => ({
  id: p.id,
  espacio: p.espacio,
  titulo: p.titulo || "",
  subtitulo: p.subtitulo || "",
  boton: p.boton || "",
  enlace: p.enlace || "/",
  imagen_url: p.imagen_url || "",
  imagen_movil_url: p.imagen_movil_url || "",
  video_url: p.video_url || "",
  anunciante: p.anunciante || "",
  es_publicidad: p.es_publicidad,
  orden: p.orden,
  desde: p.desde.slice(0, 10),
  hasta: p.hasta ? p.hasta.slice(0, 10) : "",
  activo: p.activo,
})

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  rojo: "#b42318",
}

const estadoDe = (p: Pieza): { texto: string; fondo: string; color: string } => {
  const ahora = Date.now()
  if (!p.activo) return { texto: "Pausado", fondo: "#e7e4dc", color: "#44433d" }
  if (Date.parse(p.desde) > ahora) return { texto: "Programado", fondo: "#dcebfa", color: "#1d4e89" }
  if (p.hasta && Date.parse(p.hasta) < ahora) return { texto: "Vencido", fondo: "#f8dada", color: "#9b1c1c" }
  return { texto: "Activo", fondo: "#d9f2e3", color: "#16794f" }
}

const diasRestantes = (p: Pieza): number | null =>
  p.hasta ? Math.ceil((Date.parse(p.hasta) - Date.now()) / 86_400_000) : null

const fechaCorta = (t: string | null) => (t ? t.slice(0, 10) : "sin fin")

// Reduce la imagen en el navegador (WebP, máx. ~800 KB) para que el sitio siga rápido.
async function comprimir(archivo: File, anchoMax: number): Promise<Blob> {
  const bmp = await createImageBitmap(archivo)
  const escala = Math.min(1, anchoMax / bmp.width)
  const lienzo = document.createElement("canvas")
  lienzo.width = Math.round(bmp.width * escala)
  lienzo.height = Math.round(bmp.height * escala)
  const ctx = lienzo.getContext("2d")
  if (!ctx) throw new Error("Tu navegador no puede procesar la imagen.")
  ctx.drawImage(bmp, 0, 0, lienzo.width, lienzo.height)
  const aBlob = (q: number) =>
    new Promise<Blob>((ok, mal) =>
      lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo comprimir la imagen."))), "image/webp", q)
    )
  let calidad = 0.85
  let blob = await aBlob(calidad)
  while (blob.size > 800 * 1024 && calidad > 0.4) {
    calidad -= 0.1
    blob = await aBlob(calidad)
  }
  return blob
}

// ---------- Estilos ----------
const caja: CSSProperties = {
  background: C.fondo,
  border: `1px solid ${C.borde}`,
  borderRadius: 12,
  padding: 16,
}
const campo: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${C.borde}`,
  background: C.fondo,
  color: C.texto,
  fontSize: 14,
}
const etiqueta: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: C.texto }
const nota: CSSProperties = { margin: "0 0 6px", fontSize: 12.5, color: C.tenue }
const boton = (primario: boolean, peligro = false): CSSProperties => ({
  cursor: "pointer",
  borderRadius: 10,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  border: primario ? "none" : `1px solid ${C.borde}`,
  background: primario ? C.naranja : C.fondo,
  color: primario ? "#fff" : peligro ? C.rojo : C.texto,
})

const Campo = ({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) => (
  <div>
    <label style={etiqueta}>{titulo}</label>
    {ayuda && <p style={nota}>{ayuda}</p>}
    {children}
  </div>
)

// ---------- Campo de imagen (comprime y sube) ----------
function CampoImagen({
  titulo,
  ayuda,
  valor,
  anchoMax,
  onCambio,
}: {
  titulo: string
  ayuda: string
  valor: string
  anchoMax: number
  onCambio: (url: string) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState("")

  const elegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setSubiendo(true)
    setMsg("")
    try {
      const blob = await comprimir(f, anchoMax)
      const fd = new FormData()
      fd.append("archivo", new File([blob], "banner.webp", { type: "image/webp" }))
      const r = await fetch("/api/pub/subir", { method: "POST", headers: cabeceras(), body: fd, credentials: "include" })
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!r.ok || !j.url)
        throw new Error(j.error || (r.status === 413 ? "La imagen es muy pesada para el servidor." : "No se pudo subir."))
      onCambio(j.url)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo subir la imagen.")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div>
      <span style={etiqueta}>{titulo}</span>
      <p style={nota}>{ayuda}</p>
      {valor && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <img
            src={valor}
            alt="Vista previa"
            style={{ height: 96, maxWidth: "60%", objectFit: "cover", borderRadius: 8, border: `1px solid ${C.borde}` }}
          />
          <button type="button" style={boton(false)} onClick={() => onCambio("")}>
            Quitar
          </button>
        </div>
      )}
      <label style={{ ...boton(false), display: "inline-block" }}>
        {subiendo ? "Subiendo…" : valor ? "Cambiar imagen" : "Elegir imagen"}
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={elegir} disabled={subiendo} />
      </label>
      {msg && <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600, color: C.rojo }}>{msg}</p>}
    </div>
  )
}

// ---------- Página ----------
export const config = {
  label: "Publicidad",
  icon: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10v4h4l5 4V6L7 10z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
    </svg>
  ),
}

export default function PaginaPublicidad() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const r = await api<Lista>("lista")
    setCargando(false)
    if (r.ok) {
      setDatos({ piezas: r.piezas, espacios: r.espacios, orden: r.orden })
      setError("")
    } else {
      setError(r.error === "sin_sesion" ? MSG_SESION : r.error)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const cambia = <K extends keyof Borrador>(k: K, v: Borrador[K]) =>
    setEditando((b) => (b ? { ...b, [k]: v } : b))

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!editando) return
    setGuardando(true)
    setError("")
    const b = editando
    const r = await api<Guardado>("guardar", {
      ...b,
      desde: b.desde ? `${b.desde}T00:00:00-06:00` : "",
      hasta: b.hasta ? `${b.hasta}T23:59:59-06:00` : "",
    })
    setGuardando(false)
    if (r.ok) {
      setEditando(null)
      await cargar()
    } else {
      setError(r.error === "sin_sesion" ? MSG_SESION : r.error)
    }
  }

  const alternar = async (p: Pieza) => {
    const r = await api<Simple>("alternar", { id: p.id, activo: !p.activo })
    if (!r.ok) setError(r.error === "sin_sesion" ? MSG_SESION : r.error)
    await cargar()
  }

  const borrar = async (p: Pieza) => {
    if (!window.confirm(`¿Borrar "${p.titulo || p.anunciante || "este anuncio"}" para siempre? Esto no se puede deshacer.`)) return
    const r = await api<Simple>("borrar", { id: p.id })
    if (!r.ok) setError(r.error === "sin_sesion" ? MSG_SESION : r.error)
    await cargar()
  }

  // ---------- Formulario ----------
  if (editando && datos) {
    const cfg = datos.espacios[editando.espacio]
    return (
      <form onSubmit={guardar} style={{ ...caja, display: "flex", flexDirection: "column", gap: 18, maxWidth: 820, margin: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: C.texto }}>{editando.id ? "Editar anuncio" : "Nuevo anuncio"}</h1>

        <Campo titulo="¿Dónde se va a mostrar?">
          <select
            style={campo}
            value={editando.espacio}
            onChange={(e) => {
              const esp = e.target.value
              setEditando((b) => (b ? { ...b, espacio: esp, es_publicidad: datos.espacios[esp]?.publicidad ?? b.es_publicidad } : b))
            }}
          >
            {datos.orden.map((id) => (
              <option key={id} value={id}>
                {datos.espacios[id]?.nombre ?? id}
              </option>
            ))}
          </select>
          {cfg && (
            <>
              <p style={{ ...nota, marginTop: 6 }}>{cfg.ayuda}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.naranja }}>
                Medida recomendada: {cfg.medidas} · caben {cfg.max} a la vez
              </p>
            </>
          )}
        </Campo>

        <CampoImagen
          titulo="Imagen"
          ayuda="Se reduce sola a WebP para que cargue rápido. Si la imagen ya trae el texto, deja vacíos título y botón."
          valor={editando.imagen_url}
          anchoMax={cfg?.anchoMax ?? 1200}
          onCambio={(u) => cambia("imagen_url", u)}
        />

        {editando.espacio === "carrusel_principal" && (
          <>
            <CampoImagen
              titulo="Imagen para celular (opcional)"
              ayuda="Versión más vertical, 800 × 900 px aprox. Si no la subes, se usa la misma imagen."
              valor={editando.imagen_movil_url}
              anchoMax={900}
              onCambio={(u) => cambia("imagen_movil_url", u)}
            />
            <Campo titulo="Video MP4 (opcional)">
              <input
                style={campo}
                placeholder="https://…/video.mp4 (corto, menos de 5 MB)"
                value={editando.video_url}
                onChange={(e) => cambia("video_url", e.target.value)}
              />
            </Campo>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Campo titulo="Título (opcional)">
            <input style={campo} maxLength={140} value={editando.titulo} onChange={(e) => cambia("titulo", e.target.value)} />
          </Campo>
          <Campo titulo="Texto del botón (opcional)">
            <input
              style={campo}
              maxLength={40}
              placeholder="Ej. Ver ofertas"
              value={editando.boton}
              onChange={(e) => cambia("boton", e.target.value)}
            />
          </Campo>
        </div>
        <Campo titulo="Subtítulo (opcional)">
          <input style={campo} maxLength={300} value={editando.subtitulo} onChange={(e) => cambia("subtitulo", e.target.value)} />
        </Campo>
        <Campo
          titulo="¿A dónde lleva al hacer clic?"
          ayuda="Dentro del sitio empieza con /  ·  Fuera del sitio empieza con https://"
        >
          <input
            style={campo}
            required
            placeholder="/talleres/mi-taller  ó  https://sitio-del-anunciante.com"
            value={editando.enlace}
            onChange={(e) => cambia("enlace", e.target.value)}
          />
        </Campo>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Campo titulo="Anunciante (taller o empresa)">
            <input style={campo} maxLength={120} value={editando.anunciante} onChange={(e) => cambia("anunciante", e.target.value)} />
          </Campo>
          <Campo titulo="Orden (1 aparece primero)">
            <input
              style={campo}
              type="number"
              min={0}
              max={99}
              value={editando.orden}
              onChange={(e) => cambia("orden", Number(e.target.value) || 0)}
            />
          </Campo>
          <Campo titulo="Empieza el (vacío = hoy)">
            <input style={campo} type="date" value={editando.desde} onChange={(e) => cambia("desde", e.target.value)} />
          </Campo>
          <Campo titulo="Termina el (vacío = sin fecha de fin)">
            <input style={campo} type="date" value={editando.hasta} onChange={(e) => cambia("hasta", e.target.value)} />
          </Campo>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: C.texto }}>
          <input
            type="checkbox"
            style={{ width: 20, height: 20, marginTop: 2 }}
            checked={editando.es_publicidad}
            onChange={(e) => cambia("es_publicidad", e.target.checked)}
          />
          <span>
            <strong>Es publicidad de un tercero</strong>
            <br />
            <span style={{ fontSize: 13, color: C.tenue }}>
              Muestra la etiqueta "Publicidad" sobre la imagen (recomendado cuando el anunciante paga).
            </span>
          </span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: C.texto }}>
          <input
            type="checkbox"
            style={{ width: 20, height: 20 }}
            checked={editando.activo}
            onChange={(e) => cambia("activo", e.target.checked)}
          />
          <strong>Activo (visible en el sitio)</strong>
        </label>

        {error && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.rojo }}>{error}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button type="submit" disabled={guardando} style={boton(true)}>
            {guardando ? "Guardando…" : "Guardar anuncio"}
          </button>
          <button
            type="button"
            style={boton(false)}
            onClick={() => {
              setEditando(null)
              setError("")
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  // ---------- Lista ----------
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: C.texto }}>Publicidad y banners</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: C.tenue }}>
            Cambia las imágenes del sitio y administra a tus anunciantes. Los cambios se ven en menos de un minuto.
          </p>
        </div>
        {datos && (
          <button type="button" style={boton(true)} onClick={() => setEditando(vacio("franja_inicio", datos.espacios.franja_inicio))}>
            + Nuevo anuncio
          </button>
        )}
      </div>

      {error && (
        <p style={{ margin: 0, padding: 12, borderRadius: 8, background: "#f8dada", color: "#9b1c1c", fontSize: 14, fontWeight: 700 }}>
          {error}
        </p>
      )}
      {cargando && <p style={{ margin: 0, fontSize: 14, color: C.tenue }}>Cargando…</p>}

      {datos &&
        datos.orden.map((id) => {
          const cfg = datos.espacios[id]
          if (!cfg) return null
          const lista = datos.piezas.filter((p) => p.espacio === id)
          const vigentes = lista.filter((p) => estadoDe(p).texto === "Activo").length
          return (
            <section key={id} style={caja}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, color: C.texto }}>{cfg.nombre}</h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: C.tenue }}>
                    {cfg.medidas} · {vigentes} de {cfg.max} activos
                  </p>
                </div>
                <button type="button" style={boton(false)} onClick={() => setEditando(vacio(id, cfg))}>
                  + Agregar aquí
                </button>
              </div>

              {lista.length === 0 ? (
                <p style={{ margin: "12px 0 0", fontSize: 14, color: C.tenue }}>Sin anuncios. Se muestra el contenido de siempre.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  {lista.map((p) => {
                    const est = estadoDe(p)
                    const dias = diasRestantes(p)
                    const porVencer = est.texto === "Activo" && dias !== null && dias <= 7
                    const ctr = p.vistas > 0 ? ((p.clics / p.vistas) * 100).toFixed(1) : "0.0"
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 12,
                          padding: 10,
                          border: `1px solid ${C.borde}`,
                          borderRadius: 10,
                          background: C.suave,
                        }}
                      >
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt="" style={{ width: 150, height: 76, objectFit: "cover", borderRadius: 8 }} />
                        ) : (
                          <span
                            style={{
                              width: 150,
                              height: 76,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 8,
                              background: C.borde,
                              fontSize: 12,
                              color: C.tenue,
                            }}
                          >
                            Sin imagen
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: 15, color: C.texto }}>{p.titulo || p.anunciante || "(sin título)"}</strong>
                            <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: est.fondo, color: est.color }}>
                              {est.texto}
                            </span>
                            {p.es_publicidad && (
                              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: "#fdeee1", color: "#b34d07" }}>
                                Publicidad
                              </span>
                            )}
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.tenue }}>
                            {p.anunciante ? `${p.anunciante} · ` : ""}
                            {fechaCorta(p.desde)} → {fechaCorta(p.hasta)} · orden {p.orden}
                          </p>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.texto }}>
                            {p.vistas} vistas · {p.clics} clics · {ctr}% de clics
                          </p>
                          {porVencer && dias !== null && (
                            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "#b34d07" }}>
                              {dias <= 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`} — buen momento de ofrecerle renovar.
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button type="button" style={boton(false)} onClick={() => setEditando(aBorrador(p))}>
                            Editar
                          </button>
                          <button type="button" style={boton(false)} onClick={() => void alternar(p)}>
                            {p.activo ? "Pausar" : "Activar"}
                          </button>
                          <button type="button" style={boton(false, true)} onClick={() => void borrar(p)}>
                            Borrar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}

      <section style={{ ...caja, borderStyle: "dashed", fontSize: 14, color: C.texto }}>
        <strong>Próxima etapa:</strong> cobro a anunciantes con Mercado Pago, mensajes a talleres ofreciendo el servicio de
        publicidad y avisos automáticos para renovar antes de que termine.
      </section>
    </div>
  )
}
