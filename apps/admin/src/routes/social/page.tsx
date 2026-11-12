// Página "Social Hub" del dashboard (Licitaciones 3.0, Fase 5A).
// Crear, adaptar por red, programar, publicar y medir publicaciones en redes.
// La lógica vive en packages/api/src/lib/social-hub.ts; publica el flujo de
// n8n "Social Hub - Publicar". Usa la misma sesión del dashboard.
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"

type RedInfo = { clave: string; nombre: string; auto: boolean; max: number; imagen?: string }
type Liga = { codigo: string; red: string; grupo: string | null; clics: number; url: string; eventos: Record<string, number> }
type Pub = {
  id: string
  origen: string
  titulo: string
  texto_base: string
  textos: Record<string, string>
  redes: string[]
  medios: { url: string }[] | null
  url_destino: string
  estado: string
  programada_para: string | null
  publicada_en: string | null
  resultado: Record<string, { ok: boolean; manual?: boolean; pendiente?: boolean; error?: string; url?: string }> | null
  adaptada_ia: boolean
  created_at: string
  ligas: Liga[]
  mercado?: string | null
  notas?: string | null
  puntajes?: Record<string, { puntaje: number; revisiones: { ok: boolean; texto: string; consejo?: string }[] }>
}
type Config = { redes: string[]; automatico: Record<string, boolean>; horario: { desde: number; hasta: number }; retraso_min: number; piloto?: { activo: boolean; minimo: number; redes: string[] }; aviso_hora?: number; primer_comentario?: boolean; youtube_auto?: boolean; auto_respuestas?: boolean; video_animado?: boolean; imagen_nueva?: boolean }
type Datos = { publicaciones: Pub[]; redes: RedInfo[]; config: Config; n8n: boolean; mercados?: { clave: string; nombre: string }[] }

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
const boton = (tipo: "primario" | "normal" | "peligro"): CSSProperties => ({
  cursor: "pointer",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none",
  background: tipo === "primario" ? C.naranja : tipo === "peligro" ? C.rojo : C.fondo,
  color: tipo === "normal" ? C.texto : "#fff",
})
const campo: CSSProperties = { width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1px solid ${C.borde}`, padding: 8, fontSize: 14, background: C.fondo, color: C.texto }
const ORIGEN: Record<string, string> = { manual: "Manual", licitacion: "Licitación", taller: "Taller nuevo", producto: "Producto", foro: "Foro", taller_video: "Video de taller", promociones: "Promociones diarias (producto, blog y herramientas con imagen y video)" }
const ESTADO: Record<string, [string, string]> = {
  borrador: ["Borrador", "#8A5A00"],
  programada: ["Programada", "#1a3a5c"],
  publicando: ["Publicando…", "#1a3a5c"],
  publicada: ["Publicada", C.verde],
  parcial: ["Parcial", "#8A5A00"],
  error: ["Error", C.rojo],
  descartada: ["Descartada", C.tenue],
}
const MSG_SESION = "No se pudo verificar tu sesión. Cierra sesión en el dashboard, vuelve a entrar y recarga."

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
async function api<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`/admin/hetna-social${ruta}`, {
    credentials: "include",
    ...(cuerpo === undefined
      ? { headers: cabeceras() }
      : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
  }).catch(() => null)
  if (!r) throw new Error("No se pudo conectar con el servidor.")
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}
async function subirImagen(archivo: File): Promise<string> {
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/admin/uploads", { method: "POST", credentials: "include", headers: cabeceras(), body: fd })
  const d = (await r.json().catch(() => ({}))) as { files?: { url: string }[]; message?: string }
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || "No se pudo subir la imagen.")
  return d.files[0].url
}
const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
const aLocal = (s: string | null) => {
  if (!s) return ""
  const d = new Date(s)
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 16)
}
const copiar = (t: string) => navigator.clipboard?.writeText(t).catch(() => {})

function Chips({ redes, todas, alCambiar }: { redes: string[]; todas: RedInfo[]; alCambiar: (r: string[]) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {todas.map((r) => {
        const on = redes.includes(r.clave)
        return (
          <button
            key={r.clave}
            type="button"
            onClick={() => alCambiar(on ? redes.filter((x) => x !== r.clave) : [...redes, r.clave])}
            title={r.auto ? "Se publica sola" : "Copiar y pegar (la red no permite automatizar)"}
            style={{ ...boton("normal"), padding: "4px 10px", fontWeight: 600, background: on ? "#142033" : C.fondo, color: on ? "#fff" : C.texto }}
          >
            {r.nombre}
            {!r.auto && " ✋"}
          </button>
        )
      })}
    </div>
  )
}

function Nueva({ redes, config, alCrear, mercados }: { redes: RedInfo[]; config: Config; alCrear: () => void; mercados?: { clave: string; nombre: string }[] }) {
  const [f, setF] = useState({ titulo: "", texto_base: "", url: "https://hetnacnc.com/mx", programada_para: "", mercado: "mx" })
  const [sel, setSel] = useState<string[]>(config.redes)
  const [img, setImg] = useState("")
  const [nota, setNota] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const crear = async () => {
    setOcupado(true)
    setNota("")
    try {
      await api("", { ...f, redes: sel, medios: img ? [{ url: img }] : [], programada_para: f.programada_para ? new Date(f.programada_para).toISOString() : null })
      setF({ titulo: "", texto_base: "", url: "https://hetnacnc.com/mx", programada_para: "", mercado: "mx" })
      setImg("")
      setNota("Lista. Revisa abajo el texto de cada red.")
      alCrear()
    } catch (e) {
      setNota((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <section style={caja}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Nueva publicación</h2>
      <div style={{ display: "grid", gap: 8 }}>
        <input style={campo} placeholder="Título interno (ej. Promoción de corte láser)" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        <textarea style={{ ...campo, minHeight: 90 }} placeholder="¿Qué quieres decir? La IA lo adapta a cada red. La liga medida se agrega sola." value={f.texto_base} onChange={(e) => setF({ ...f, texto_base: e.target.value })} />
        <input style={campo} placeholder="Liga de destino en hetnacnc.com" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <Chips redes={sel} todas={redes} alCambiar={setSel} />
        {mercados && mercados.length > 1 && (
          <label style={{ fontSize: 13 }}>
            Mercado{" "}
            <select style={{ ...campo, width: "auto", padding: 5 }} value={f.mercado} onChange={(e) => setF({ ...f, mercado: e.target.value })}>
              {mercados.map((m) => (
                <option key={m.clave} value={m.clave}>{m.nombre}</option>
              ))}
            </select>{" "}
            <span style={{ color: C.tenue, fontSize: 12 }}>La IA lo escribe en el idioma y modismos de ese país.</span>
          </label>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...boton("normal"), fontWeight: 600 }}>
            {img ? "✓ Imagen lista" : "+ Imagen"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={async (e) => {
                const a = e.target.files?.[0]
                if (!a) return
                try {
                  setImg(await subirImagen(a))
                } catch (er) {
                  setNota((er as Error).message)
                }
              }}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            Programar (opcional){" "}
            <input type="datetime-local" style={{ ...campo, width: "auto", padding: 5 }} value={f.programada_para} onChange={(e) => setF({ ...f, programada_para: e.target.value })} />
          </label>
          <button type="button" style={boton("primario")} disabled={ocupado || !f.titulo.trim() || !f.texto_base.trim()} onClick={crear}>
            {ocupado ? "Preparando textos…" : "Crear"}
          </button>
        </div>
        {nota && <p style={{ fontSize: 13, margin: 0 }}>{nota}</p>}
      </div>
    </section>
  )
}

function Tarjeta({ p, redes, alCambiar }: { p: Pub; redes: RedInfo[]; alCambiar: () => void }) {
  const [abierta, setAbierta] = useState(p.estado === "borrador" || p.estado === "error")
  const [textos, setTextos] = useState<Record<string, string>>(p.textos || {})
  const [sel, setSel] = useState<string[]>(p.redes)
  const [cuando, setCuando] = useState(aLocal(p.programada_para))
  const [grupo, setGrupo] = useState("")
  const [nota, setNota] = useState("")
  const [notaOk, setNotaOk] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [haciendo, setHaciendo] = useState("") // qué acción está corriendo (para mostrarlo en su botón)
  const [cambiadas, setCambiadas] = useState<string[]>([]) // redes que acaba de mejorar la IA (se resaltan)
  useEffect(() => {
    setTextos(p.textos || {})
    setSel(p.redes)
  }, [p.id, p.textos, p.redes])
  const nombre = (c: string) => redes.find((r) => r.clave === c)?.nombre || c
  const auto = (c: string) => !!redes.find((r) => r.clave === c)?.auto
  const ligaDe = (red: string) => p.ligas.find((l) => l.red === red && !l.grupo)?.url
  const hacer = async (cuerpo: Record<string, unknown>, ok: string) => {
    setOcupado(true)
    setHaciendo(String(cuerpo.accion || ""))
    setNota("")
    setCambiadas([])
    try {
      const r = await api<{ cambiadas?: string[]; publicacion?: Pub }>(`/${p.id}`, cuerpo)
      // Muestra los textos nuevos de inmediato, sin esperar a recargar la lista
      if (r.publicacion?.textos) setTextos(r.publicacion.textos)
      const cs = r.cambiadas || []
      setCambiadas(cs)
      setNotaOk(true)
      setNota(cs.length ? `${ok} Se mejoró: ${cs.map((c) => nombre(c)).join(", ")}.` : ok)
      alCambiar()
    } catch (e) {
      setNotaOk(false)
      setNota((e as Error).message)
    } finally {
      setOcupado(false)
      setHaciendo("")
    }
  }
  const [et, col] = ESTADO[p.estado] || [p.estado, C.tenue]
  const clics = p.ligas.reduce((a, l) => a + l.clics, 0)
  const conv = p.ligas.reduce((a, l) => a + Object.values(l.eventos || {}).reduce((x, y) => x + y, 0), 0)
  return (
    <article style={caja}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setAbierta(!abierta)}>
        <b style={{ color: col, fontSize: 12, textTransform: "uppercase" }}>{et}</b>
        <span style={{ fontSize: 12, color: C.tenue }}>{ORIGEN[p.origen] || p.origen}</span>
        {(p as any).emocion && <span style={{ fontSize: 12, background: "#FFF1E6", color: "#9A3D00", borderRadius: 99, padding: "1px 8px" }} title="Emoción que vende esta pieza (mapa emocional)">❤ {String((p as any).emocion).replace("suenos", "sueños")}</span>}
        {(p as any).ab && (
          <span style={{ fontSize: 12, background: "#EEF2FF", color: "#3730A3", borderRadius: 99, padding: "1px 8px" }} title="Mismo video con dos ganchos distintos: si el A rinde bien, el B no se publica">
            {(p as any).ab.variante === "A" ? "🅰 Prueba A/B" : "🅱 Prueba A/B (otro gancho)"}{(p as any).ab.decision ? ` · ${(p as any).ab.decision}` : ""}
          </span>
        )}
        <b style={{ flex: 1, minWidth: 200 }}>{p.titulo}</b>
        <span style={{ fontSize: 12, color: C.tenue }}>
          {p.estado === "programada" ? `⏰ ${fecha(p.programada_para)}` : p.publicada_en ? `✓ ${fecha(p.publicada_en)}` : fecha(p.created_at)}
          {clics ? ` · ${clics} clics` : ""}
          {conv ? ` · ${conv} conversiones` : ""}
        </span>
        <span style={{ color: C.tenue }}>{abierta ? "▲" : "▼"}</span>
      </div>
      {abierta && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {p.medios?.[0]?.url &&
            (/\.(mp4|mov|webm)(\?|$)/i.test(p.medios[0].url) ? (
              <video src={p.medios[0].url} controls preload="metadata" style={{ maxWidth: 220, borderRadius: 8 }} />
            ) : (
              <img src={p.medios[0].url} alt="" style={{ maxWidth: 220, borderRadius: 8 }} />
            ))}
          {p.mercado && p.mercado !== "mx" && <span style={{ fontSize: 12, color: C.tenue }}>🌎 Mercado: {p.mercado.toUpperCase()} (sale en las mismas cuentas, en su idioma y a su hora)</span>}
          {p.notas && <div style={{ fontSize: 12, background: "#FFF8EE", borderRadius: 8, padding: 8, whiteSpace: "pre-wrap" }}>🎬 {p.notas}</div>}
          <label style={{ ...boton("normal"), fontWeight: 600, justifySelf: "start" }}>
            {p.medios?.length ? "Cambiar imagen o video" : "+ Agregar imagen o video"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              style={{ display: "none" }}
              onChange={async (e) => {
                const a = e.target.files?.[0]
                if (!a) return
                setNota("Subiendo…")
                try {
                  const url = await subirImagen(a)
                  await hacer({ accion: "guardar", textos, redes: sel, medios: [{ url, tipo: a.type.startsWith("video") ? "video" : "imagen" }] }, "Listo, quedó agregado.")
                } catch (er) {
                  setNota((er as Error).message)
                }
              }}
            />
          </label>
          <Chips redes={sel} todas={redes} alCambiar={setSel} />
          {sel.map((red) => {
            const r = p.resultado?.[red]
            const final = (textos[red] || "").replace("{{liga}}", ligaDe(red) || "{{liga}}")
            return (
              <div key={red} style={{ background: cambiadas.includes(red) ? "#e8f7ee" : C.suave, border: cambiadas.includes(red) ? `2px solid ${C.verde}` : "2px solid transparent", borderRadius: 10, padding: 10, transition: "background .4s" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <b style={{ fontSize: 13 }}>{nombre(red)}</b>
                  {cambiadas.includes(red) && <span style={{ fontSize: 12, color: C.verde, fontWeight: 700 }}>🧠 mejorado por la IA</span>}
                  {p.puntajes?.[red] && <Puntaje p={p.puntajes[red]} />}
                  {!auto(red) && <span style={{ fontSize: 12, color: C.tenue }}>✋ copiar y pegar</span>}
                  {r && (r.ok ? <span style={{ fontSize: 12, color: C.verde }}>✓ {r.manual ? "lista para pegar" : "publicada"}</span> : r.pendiente ? <span style={{ fontSize: 12, color: C.tenue }}>⏳ Instagram la está procesando; se publica sola en unos minutos</span> : <span style={{ fontSize: 12, color: C.rojo }}>✗ {r.error}</span>)}
                  {r?.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.naranja }}>
                      ver ↗
                    </a>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: (textos[red] || "").length > (redes.find((x) => x.clave === red)?.max || 9999) ? C.rojo : C.tenue }}>
                    {(textos[red] || "").length} caracteres
                  </span>
                  <button type="button" style={{ ...boton("normal"), padding: "2px 8px", fontSize: 12 }} onClick={() => copiar(final)}>
                    Copiar
                  </button>
                </div>
                <textarea style={{ ...campo, minHeight: 80, fontSize: 13 }} value={textos[red] || ""} onChange={(e) => setTextos({ ...textos, [red]: e.target.value })} />
              </div>
            )
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => hacer({ accion: "guardar", textos, redes: sel }, "Guardado.")}>
              Guardar cambios
            </button>
            <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => hacer({ accion: "adaptar", redes: sel }, "Textos reescritos.")}>
              ✨ Reescribir textos
            </button>
            <button type="button" style={{ ...boton("normal"), ...(haciendo === "revisar" ? { background: "#142033", color: "#fff", cursor: "wait" } : {}), opacity: ocupado && haciendo !== "revisar" ? 0.5 : 1 }} disabled={ocupado} title="El revisor corrige gancho, llamada a la acción, largo y hashtags de cada red sin inventar datos" onClick={() => hacer({ accion: "revisar" }, "✓ Listo: mejorada con IA (si no te gusta, dale Deshacer).")}>
              {haciendo === "revisar" ? "⏳ Mejorando con IA… (10 a 30 s)" : "🧠 Mejorar con IA"}
            </button>
            {((p as any).version_anterior || cambiadas.length > 0) && (
              <button type="button" style={{ ...boton("normal"), opacity: ocupado && haciendo !== "deshacer" ? 0.5 : 1 }} disabled={ocupado} onClick={() => hacer({ accion: "deshacer" }, "✓ Volvió a la versión anterior.")}>
                {haciendo === "deshacer" ? "⏳ Regresando…" : "↩ Deshacer mejora"}
              </button>
            )}
            <input type="datetime-local" style={{ ...campo, width: "auto", padding: 5 }} value={cuando} onChange={(e) => setCuando(e.target.value)} />
            <button
              type="button"
              style={boton("normal")}
              disabled={ocupado}
              onClick={async () => {
                await hacer({ accion: "guardar", textos, redes: sel }, "")
                await hacer({ accion: "programar", programada_para: cuando ? new Date(cuando).toISOString() : null }, "Programada.")
              }}
            >
              ⏰ {cuando ? "Programar" : "Lo antes posible"}
            </button>
            <button
              type="button"
              style={boton("primario")}
              disabled={ocupado}
              onClick={async () => {
                await hacer({ accion: "guardar", textos, redes: sel }, "")
                await hacer({ accion: "publicar" }, "Publicación enviada.")
              }}
            >
              🚀 Publicar ahora
            </button>
            {p.estado !== "descartada" && (
              <button type="button" style={boton("peligro")} disabled={ocupado} onClick={() => hacer({ accion: "descartar" }, "Descartada.")}>
                Descartar
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
            <span>Liga medida para pegar en un grupo o comunidad:</span>
            <input style={{ ...campo, width: 220, padding: 5 }} placeholder="Nombre del grupo (ej. CNC México FB)" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
            <button
              type="button"
              style={{ ...boton("normal"), padding: "4px 10px" }}
              disabled={!grupo.trim()}
              onClick={async () => {
                try {
                  const d = await api<{ url: string }>(`/${p.id}`, { accion: "liga", red: "grupos_facebook", grupo })
                  copiar(d.url)
                  setNota(`Liga copiada: ${d.url}`)
                  setGrupo("")
                  alCambiar()
                } catch (e) {
                  setNota((e as Error).message)
                }
              }}
            >
              Crear y copiar
            </button>
          </div>
          {p.ligas.length > 0 && (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <tbody>
                {p.ligas.map((l) => (
                  <tr key={l.codigo} style={{ borderTop: `1px solid ${C.borde}` }}>
                    <td style={{ padding: 4 }}>{l.grupo ? `👥 ${l.grupo}` : nombre(l.red)}</td>
                    <td style={{ padding: 4, color: C.tenue }}>{l.url}</td>
                    <td style={{ padding: 4 }}>{l.clics} clics</td>
                    <td style={{ padding: 4, color: C.tenue }}>
                      {Object.entries(l.eventos || {})
                        .filter(([k]) => k !== "clic")
                        .map(([k, n]) => `${n} ${k.replace("_", " ")}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {nota && (
            <p style={{ fontSize: 14, margin: 0, padding: "8px 12px", borderRadius: 8, fontWeight: 600, background: notaOk ? "#e8f7ee" : "#fdecec", color: notaOk ? C.verde : C.rojo }}>{nota}</p>
          )}
        </div>
      )}
    </article>
  )
}

function TelegramAprobacion() {
  const [vinculado, setVinculado] = useState<boolean | null>(null)
  const [codigo, setCodigo] = useState("")
  const [nota, setNota] = useState("")
  const ver = useCallback(() => api<any>("/config").then((d) => setVinculado(!!d.telegram?.vinculado)).catch(() => setVinculado(false)), [])
  useEffect(() => {
    void ver()
  }, [ver])
  if (vinculado === null) return <p style={{ fontSize: 13, color: C.tenue }}>Revisando…</p>
  return (
    <div style={{ fontSize: 13, display: "grid", gap: 6 }}>
      {vinculado ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: C.verde }}>✓ Tu Telegram está vinculado.</span>
          <button type="button" style={boton("normal")} onClick={async () => { const r = await api<any>("/config", { telegram: "probar" }).catch((e) => ({ error: (e as Error).message })); setNota(r.error || `Te mandé ${r.enviados ?? 0} borradores a Telegram.`) }}>Mandarme los borradores ahora</button>
          <button type="button" style={boton("normal")} onClick={async () => { await api("/config", { telegram: "desvincular" }).catch(() => {}); void ver() }}>Desvincular</button>
        </div>
      ) : (
        <>
          <span style={{ color: C.tenue }}>Cada mañana el bot te manda los borradores con botones ✅ Aprobar, 🚀 Publicar ya, ✏️ Cambiar y 🗑 Descartar. Vincúlalo una sola vez:</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" style={boton("normal")} onClick={async () => { const r = await api<any>("/config", { telegram: "codigo" }).catch(() => null); setCodigo(r?.codigo || ""); setNota(r?.codigo ? "" : "No se pudo generar el código.") }}>Generar código</button>
            {codigo && (
              <span>
                Abre en Telegram el bot de HETNA (el que publica en tu canal) y mándale: <b style={{ fontFamily: "monospace", fontSize: 15 }}>/vincular {codigo}</b> (dura 15 minutos).{" "}
                <button type="button" style={{ ...boton("normal"), padding: "2px 8px" }} onClick={() => void ver()}>Ya lo mandé</button>
              </span>
            )}
          </div>
        </>
      )}
      {nota && <span style={{ color: C.tenue }}>{nota}</span>}
    </div>
  )
}

/** WhatsApp de HETNA (Evolution API): reconectar con QR, recibir mensajes y probar. Sólo números verificados reciben avisos. */
function WhatsappConexion() {
  const [e, setE] = useState<any>(null)
  const [falla, setFalla] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [num, setNum] = useState("")
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const cargar = () => api<any>("/whatsapp").then((x) => { setE(x); setFalla(null) }).catch((er) => setFalla((er as Error).message))
  useEffect(() => { void cargar() }, [])
  const hacer = async (cuerpo: any) => {
    setOcupado(true)
    try {
      const d = await api<any>("/whatsapp", cuerpo)
      if (cuerpo.accion === "qr") {
        if (d.conectado) { setQr(null); setNota({ ok: true, t: "✓ El WhatsApp ya está conectado" }) }
        else { setQr(d.qr || null); setNota({ ok: true, t: d.qr ? "Escanéalo desde el celular de HETNA: WhatsApp → ⋮ → Dispositivos vinculados → Vincular un dispositivo. Después aprieta 'Ver estado'." : `Código para vincular: ${d.codigo || "—"}` }) }
      } else if (cuerpo.accion === "webhook") setNota({ ok: true, t: "✓ Listo: los mensajes que lleguen al WhatsApp de HETNA ya pasan al sistema (verificación, BAJA y fotos)." })
      else if (cuerpo.accion === "prueba") setNota({ ok: true, t: "✓ Mensaje de prueba enviado" })
      void cargar()
    } catch (er) {
      setNota({ ok: false, t: `✗ ${(er as Error).message}` })
    } finally {
      setOcupado(false)
    }
  }
  const conectado = e?.conexion === "open"
  return (
    <div style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 10, marginTop: 8, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b>💬 WhatsApp</b>
        {falla ? <span style={{ color: C.rojo }}>No se pudo leer el estado: {falla}</span> : !e ? <span style={{ color: C.tenue }}>Cargando…</span> : (
          <span style={{ color: !e.configurado ? C.rojo : conectado ? C.verde : C.rojo, fontWeight: 600 }}>
            {!e.configurado ? "Faltan las llaves en el servidor" : conectado ? "Conectado" : `Desconectado (${e.conexion || "sin datos"})`}
          </span>
        )}
        {e && <span style={{ color: C.tenue }}>· {e.verificados} números verificados ({e.talleres} talleres, {e.clientes} clientes) · {e.bajas} bajas</span>}
        <span style={{ flex: 1 }} />
        {e?.configurado && <button type="button" style={boton(conectado ? "normal" : "primario")} disabled={ocupado} onClick={() => void hacer({ accion: "qr" })}>{conectado ? "Ver estado" : "Reconectar (QR)"}</button>}
        {e?.configurado && <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void hacer({ accion: "webhook" })}>Recibir mensajes</button>}
      </div>
      {qr && <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR de WhatsApp" style={{ width: 240, height: 240, marginTop: 8, border: `1px solid ${C.borde}`, borderRadius: 8 }} />}
      {e?.configurado && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
          <input value={num} onChange={(x) => setNum(x.target.value)} placeholder="Tu celular a 10 dígitos" style={{ padding: "4px 8px", border: `1px solid ${C.borde}`, borderRadius: 6, fontSize: 12 }} />
          <button type="button" style={boton("normal")} disabled={ocupado || !num} onClick={() => void hacer({ accion: "prueba", numero: num })}>Mandar prueba</button>
          {e.numero_hetna ? <span style={{ color: C.tenue, fontSize: 12 }}>Número de HETNA para verificar: +{e.numero_hetna}</span> : <span style={{ color: C.rojo, fontSize: 12 }}>Falta WHATSAPP_HETNA (número de HETNA) en el .env del backend</span>}
        </div>
      )}
      <div style={{ color: C.tenue, fontSize: 12, marginTop: 4 }}>
        Sólo reciben avisos por WhatsApp los talleres y clientes que verificaron su número (ellos escriben primero). Se mandan uno a la vez, con pausa y tope de {e?.tope_dia || 250} al día para cuidar el número. BAJA = dejar de recibir.
      </div>
      {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 4 }}>{nota.t}</div>}
    </div>
  )
}

/** TikTok: conectar la cuenta de HETNA; los videos llegan como borrador a la app de TikTok. */
function TikTokConexion() {
  const [e, setE] = useState<any>(null)
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const cargar = () => api<any>("/tiktok").then((x) => { setE(x); setFalla(null) }).catch((er) => setFalla((er as Error).message))
  useEffect(() => { void cargar() }, [])
  // Siempre se muestra: si el servidor no contesta, se dice por qué (antes se escondía y no se sabía qué pasaba)
  if (!e)
    return (
      <div style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 10, marginTop: 8, fontSize: 13 }}>
        <b>🎵 TikTok</b> <span style={{ color: falla ? C.rojo : C.tenue }}>{falla ? `No se pudo leer el estado: ${falla}. ¿Ya se desplegó la versión con TikTok?` : "Cargando…"}</span>
      </div>
    )
  const hacer = async (accion: string) => {
    setOcupado(true)
    try {
      const d = await api<any>("/tiktok", { accion })
      if (accion === "conectar" && d.url) {
        window.open(d.url, "_blank", "noopener")
        setNota({ ok: true, t: "Se abrió TikTok en otra pestaña: entra con la cuenta de HETNA y acepta. Cuando diga \"TikTok conectado\", regresa aquí y aprieta \"Probar\"." })
      } else if (accion === "probar") setNota(d.ok ? { ok: true, t: `✓ Conectado como ${d.usuario || "tu cuenta"}` } : { ok: false, t: `✗ ${d.error}` })
      else setNota({ ok: true, t: "TikTok desconectado" })
      void cargar()
    } catch (er) {
      setNota({ ok: false, t: `✗ ${(er as Error).message}` })
    } finally {
      setOcupado(false)
    }
  }
  return (
    <div style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 10, marginTop: 8, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b>🎵 TikTok</b>
        <span style={{ color: e.conectado ? C.verde : C.tenue, fontWeight: 600 }}>{!e.configurado ? "Faltan las llaves en el servidor" : e.conectado ? `Conectado${e.usuario ? ` (${e.usuario})` : ""}` : "Sin conectar"}</span>
        <span style={{ flex: 1 }} />
        {e.configurado && <button type="button" style={boton(e.conectado ? "normal" : "primario")} disabled={ocupado} onClick={() => void hacer("conectar")}>{e.conectado ? "Volver a conectar" : "Conectar TikTok"}</button>}
        {e.conectado && <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void hacer("probar")}>Probar</button>}
        {e.conectado && <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void hacer("desconectar")}>Desconectar</button>}
      </div>
      <div style={{ color: C.tenue, fontSize: 12, marginTop: 4 }}>
        Con TikTok conectado, los videos aprobados para TikTok llegan como <b>borrador</b> a la app de TikTok: ábrela, pon un sonido de moda y publícalo. El texto para pegar te llega por Telegram.
        {!e.configurado && " Guarda TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en el .env del backend."}
      </div>
      {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 4 }}>{nota.t}</div>}
    </div>
  )
}

function PruebaRed({ red, nombre }: { red: string; nombre: string }) {
  const [r, setR] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 10px" }}>
      <button type="button" style={boton("normal")} disabled={cargando} onClick={async () => { setCargando(true); setR(await api<any>("/config", { probar: red }).catch((e) => ({ ok: false, error: (e as Error).message }))); setCargando(false) }}>
        {cargando ? "Probando…" : `Probar ${nombre}`}
      </button>
      {r && (r.ok ? <span style={{ fontSize: 13, color: C.verde }}>✓ {nombre} conectado{r.usuario ? ` (@${r.usuario})` : r.canal ? ` (${r.canal}${r.suscriptores != null ? `, ${r.suscriptores} suscriptores` : ""})` : ""}</span> : <span style={{ fontSize: 13, color: C.rojo }}>✗ {r.error}</span>)}
    </div>
  )
}

function PruebaInstagram() {
  const [r, setR] = useState<{ ok: boolean; usuario?: string; error?: string } | null>(null)
  const [cargando, setCargando] = useState(false)
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 10px" }}>
      <button
        type="button"
        style={boton("normal")}
        disabled={cargando}
        onClick={async () => {
          setCargando(true)
          setR(await api<any>("/config", { probar: "instagram" }).catch((e) => ({ ok: false, error: (e as Error).message })))
          setCargando(false)
        }}
      >
        {cargando ? "Probando…" : "Probar Instagram"}
      </button>
      {r && (r.ok ? <span style={{ fontSize: 13, color: C.verde }}>✓ Instagram conectado{r.usuario ? ` (@${r.usuario})` : ""}. Ya puedes activarlo abajo.</span> : <span style={{ fontSize: 13, color: C.rojo }}>✗ {r.error}</span>)}
    </div>
  )
}

type Comentario = { id: string; red: string; autor: string | null; texto: string; estado: string; categoria: string | null; respuesta: string | null; error: string | null; post_titulo: string | null; created_at: string }
function Conversaciones() {
  const [lista, setLista] = useState<Comentario[] | null>(null)
  const [filtro, setFiltro] = useState("propuesta")
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState("")
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const cargar = useCallback(async () => {
    const r = await fetch(`/admin/hetna-social/comentarios${filtro ? `?estado=${filtro}` : ""}`, { credentials: "include", headers: cabeceras() }).then((x) => x.json()).catch(() => ({ comentarios: [] }))
    setLista(r.comentarios || [])
  }, [filtro])
  useEffect(() => {
    void cargar()
  }, [cargar])
  const accion = async (id: string, cuerpo: Record<string, unknown>, ok: string) => {
    setOcupado(id + String(cuerpo.accion))
    setNota(null)
    try {
      await api("/comentarios", { id, ...cuerpo })
      setNota({ ok: true, t: ok })
      void cargar()
    } catch (e) {
      setNota({ ok: false, t: (e as Error).message })
    }
    setOcupado("")
  }
  const CAT: Record<string, string> = { pregunta_frecuente: "❓ pregunta frecuente", pregunta: "❓ pregunta", elogio: "👏 elogio", queja: "⚠️ queja", spam: "🚫 spam", otro: "💬 otro" }
  return (
    <section style={caja}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        {[["propuesta", "Por responder"], ["respondido", "Respondidos"], ["ignorado", "Ignorados"], ["error", "Con error"], ["", "Todos"]].map(([v, t]) => (
          <button key={v || "todos"} type="button" onClick={() => setFiltro(v)} style={{ ...boton("normal"), padding: "3px 10px", fontSize: 12, background: filtro === v ? "#142033" : C.fondo, color: filtro === v ? "#fff" : C.texto }}>{t}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" style={boton("normal")} disabled={ocupado === "leer"} onClick={async () => { setOcupado("leer"); const r = await api<any>("/comentarios", { accion: "revisar" }).catch((e) => ({ error: (e as Error).message })); setNota(r.error ? { ok: false, t: r.error } : { ok: true, t: `Comentarios nuevos: ${r.nuevos ?? 0}.` }); setOcupado(""); void cargar() }}>
          {ocupado === "leer" ? "⏳ Leyendo…" : "Leer comentarios ahora"}
        </button>
      </div>
      <p style={{ color: C.tenue, fontSize: 12, margin: "0 0 8px" }}>Cada 15 minutos se leen los comentarios de Instagram y Facebook. La IA propone la respuesta con datos reales de HETNA; también te llegan a Telegram con botones.</p>
      {nota && <p style={{ fontSize: 14, padding: "8px 12px", borderRadius: 8, fontWeight: 600, background: nota.ok ? "#e8f7ee" : "#fdecec", color: nota.ok ? C.verde : C.rojo }}>{nota.t}</p>}
      {!lista ? <p>Cargando…</p> : lista.length === 0 ? <p style={{ color: C.tenue, fontSize: 13 }}>No hay comentarios aquí.</p> : lista.map((c) => (
        <div key={c.id} style={{ borderTop: `1px solid ${C.borde}`, padding: "10px 0", display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: C.tenue }}>{c.red === "instagram" ? "📸 Instagram" : "📘 Facebook"} · <b>{c.autor || "alguien"}</b> · {c.categoria ? CAT[c.categoria] || c.categoria : ""} · en "{c.post_titulo || "publicación"}"</div>
          <div style={{ fontSize: 14 }}>"{c.texto}"</div>
          {c.estado === "respondido" ? (
            <div style={{ fontSize: 13, color: C.verde }}>✓ Respondido: {c.respuesta}</div>
          ) : (
            <>
              <textarea style={{ ...campo, minHeight: 60, fontSize: 13 }} value={edit[c.id] ?? c.respuesta ?? ""} onChange={(e) => setEdit({ ...edit, [c.id]: e.target.value })} placeholder="Escribe la respuesta" />
              {c.error && <span style={{ fontSize: 12, color: C.rojo }}>✗ {c.error}</span>}
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={boton("primario")} disabled={!!ocupado} onClick={() => accion(c.id, { accion: "enviar", texto: edit[c.id] ?? c.respuesta ?? "" }, "✓ Respuesta enviada.")}>{ocupado === c.id + "enviar" ? "⏳ Enviando…" : "✅ Enviar respuesta"}</button>
                <button type="button" style={boton("normal")} disabled={!!ocupado} onClick={() => accion(c.id, { accion: "ignorar" }, "Ignorado.")}>🗑 Ignorar</button>
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  )
}

type Referencia = { id: string; tipo: string; url: string; nota: string | null; analisis: Record<string, string> | null; estado: string; error: string | null }
function Referencias() {
  const [d, setD] = useState<{ referencias: Referencia[]; guia: { texto: string; actualizada?: string } } | null>(null)
  const [nota, setNota] = useState("")
  const [liga, setLiga] = useState("")
  const [guia, setGuia] = useState("")
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState("")
  const llamar = async (cuerpo: unknown) => {
    const r = await fetch("/admin/hetna-referencias", { method: "POST", credentials: "include", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.message || "No se pudo.")
    return j
  }
  const cargar = useCallback(async () => {
    const r = await fetch("/admin/hetna-referencias", { credentials: "include", headers: cabeceras() }).then((x) => x.json()).catch(() => null)
    if (r) {
      setD(r)
      setGuia((g) => g || r.guia?.texto || "")
    }
  }, [])
  useEffect(() => {
    void cargar()
    const t = setInterval(() => void cargar(), 15000) // los análisis tardan unos segundos
    return () => clearInterval(t)
  }, [cargar])
  const agregar = async (tipo: string, url: string) => {
    setOcupado("agregar")
    setAviso(null)
    try {
      await llamar({ accion: "agregar", tipo, url, nota })
      setNota("")
      setLiga("")
      setAviso({ ok: true, t: "✓ Agregada. El agente la analiza en unos segundos." })
      void cargar()
    } catch (e) {
      setAviso({ ok: false, t: (e as Error).message })
    }
    setOcupado("")
  }
  const ET: Record<string, string> = { formato: "Formato", gancho: "Gancho", estructura: "Estructura", estilo_visual: "Estilo visual", texto_en_pantalla: "Texto en pantalla", colores: "Colores", por_que_funciona: "Por qué funciona", como_usarlo_en_hetna: "Cómo usarlo en HETNA" }
  return (
    <div>
      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>🎯 Enséñale al equipo de agentes lo que te gusta</h3>
        <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 8px" }}>
          Sube imágenes o videos cortos que te gusten (de cualquier marca) y escribe qué te gusta. El agente analiza el formato, el gancho, la estructura y el estilo, y con todo arma la Guía de estilo HETNA que siguen el guionista, el diseñador y el revisor. Se copia el formato, nunca el contenido ajeno.
        </p>
        <textarea style={{ ...campo, minHeight: 50, fontSize: 13 }} placeholder="¿Qué te gusta de esta pieza? (ej. el humor del personaje, la infografía clara, el ritmo del video)" value={nota} onChange={(e) => setNota(e.target.value)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
          <label style={{ ...boton("primario"), opacity: ocupado ? 0.6 : 1 }}>
            {ocupado === "agregar" ? "⏳ Subiendo…" : "+ Subir imagen o video"}
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" style={{ display: "none" }} onChange={async (e) => { const a = e.target.files?.[0]; if (!a) return; setOcupado("agregar"); try { const url = await subirImagen(a); await agregar(a.type.startsWith("video") ? "video" : "imagen", url) } catch (er) { setAviso({ ok: false, t: (er as Error).message + (a.type.startsWith("video") ? " (prueba con un video más corto, menos de 25 MB)" : "") }); setOcupado("") } }} />
          </label>
          <input style={{ ...campo, width: 280, padding: 6 }} placeholder="…o pega una liga (TikTok, YouTube, Instagram)" value={liga} onChange={(e) => setLiga(e.target.value)} />
          <button type="button" style={boton("normal")} disabled={!liga.trim() || !!ocupado} onClick={() => agregar("liga", liga.trim())}>Agregar liga</button>
        </div>
        <p style={{ color: C.tenue, fontSize: 12, margin: "6px 0 0" }}>De las ligas el agente no puede ver el video: descríbelo bien en la nota. Para videos, mejor súbelos (descárgalos desde la app).</p>
        {aviso && <p style={{ fontSize: 14, padding: "8px 12px", borderRadius: 8, fontWeight: 600, background: aviso.ok ? "#e8f7ee" : "#fdecec", color: aviso.ok ? C.verde : C.rojo }}>{aviso.t}</p>}
      </section>

      <section style={caja}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>📘 Guía de estilo HETNA</h3>
          <button type="button" style={boton("primario")} disabled={!!ocupado} onClick={async () => { setOcupado("guia"); setAviso(null); try { const r = await llamar({ accion: "generar_guia" }); setGuia(r.guia.texto); setAviso({ ok: true, t: "✓ Guía actualizada con tus referencias." }) } catch (e) { setAviso({ ok: false, t: (e as Error).message }) } setOcupado("") }}>
            {ocupado === "guia" ? "⏳ Escribiendo la guía…" : "🧠 Armar guía con mis referencias"}
          </button>
          <button type="button" style={boton("normal")} disabled={!!ocupado} onClick={async () => { setOcupado("guardar"); try { await llamar({ accion: "guardar_guia", texto: guia }); setAviso({ ok: true, t: "✓ Guía guardada." }) } catch (e) { setAviso({ ok: false, t: (e as Error).message }) } setOcupado("") }}>Guardar cambios</button>
        </div>
        <p style={{ color: C.tenue, fontSize: 12 }}>{d?.guia?.actualizada ? `Actualizada: ${fecha(d.guia.actualizada)}. ` : ""}Puedes editarla a mano. Todos los agentes la leen antes de escribir o diseñar.</p>
        <textarea style={{ ...campo, minHeight: 220, fontSize: 13 }} value={guia} onChange={(e) => setGuia(e.target.value)} placeholder="Aquí aparecerá la guía cuando tengas referencias analizadas." />
      </section>

      <section style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Tus referencias ({d?.referencias.length ?? 0})</h3>
        {!d ? <p>Cargando…</p> : d.referencias.length === 0 ? <p style={{ color: C.tenue, fontSize: 13 }}>Todavía no hay referencias. Sube 5 a 10 piezas que te gusten para empezar.</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {d.referencias.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 10, borderTop: `1px solid ${C.borde}`, paddingTop: 10 }}>
                <div style={{ width: 120, flexShrink: 0 }}>
                  {r.tipo === "imagen" ? <img src={r.url} alt="" style={{ width: 120, borderRadius: 8 }} /> : r.tipo === "video" ? <video src={r.url} controls preload="metadata" style={{ width: 120, borderRadius: 8 }} /> : <a href={r.url} target="_blank" rel="noreferrer" style={{ color: C.naranja, fontSize: 12, wordBreak: "break-all" }}>{r.url}</a>}
                </div>
                <div style={{ flex: 1, fontSize: 12 }}>
                  {r.nota && <div style={{ fontSize: 13, marginBottom: 4 }}>💬 {r.nota}</div>}
                  {r.estado === "pendiente" && <div style={{ color: C.tenue }}>⏳ Analizando…</div>}
                  {r.estado === "error" && <div style={{ color: C.rojo }}>✗ {r.error}</div>}
                  {r.analisis && Object.entries(r.analisis).map(([k, v]) => <div key={k}><b>{ET[k] || k}:</b> {v}</div>)}
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button type="button" style={{ ...boton("normal"), padding: "2px 8px", fontSize: 12 }} onClick={async () => { await llamar({ accion: "reanalizar", id: r.id }).catch(() => {}); void cargar() }}>Volver a analizar</button>
                    <button type="button" style={{ ...boton("normal"), padding: "2px 8px", fontSize: 12 }} onClick={async () => { await llamar({ accion: "borrar", id: r.id }).catch(() => {}); void cargar() }}>Quitar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const nombreRed = (r: string) => ({ facebook: "Facebook", instagram: "Instagram" } as Record<string, string>)[r] || r

function Resultados() {
  const [dias, setDias] = useState(30)
  const [m, setM] = useState<any>(null)
  const [error, setError] = useState("")
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState("")
  useEffect(() => {
    api<any>(`/metricas?dias=${dias}`).then(setM).catch((e) => setError((e as Error).message))
  }, [dias])
  if (error) return <p style={{ color: C.rojo }}>{error}</p>
  if (!m) return <p>Cargando…</p>
  const th: CSSProperties = { textAlign: "left", padding: 6, fontSize: 12, color: C.tenue }
  const td: CSSProperties = { padding: 6, borderTop: `1px solid ${C.borde}` }
  const ap = m.aprendizaje
  const leerAhora = async () => {
    setLeyendo(true)
    try {
      const r = await api<{ leidas: number }>("/metricas", {})
      setAviso(`Se leyeron ${r.leidas} estadísticas.`)
      setM(await api<any>(`/metricas?dias=${dias}`))
    } catch (e) {
      setAviso((e as Error).message)
    }
    setLeyendo(false)
  }
  const ve = m.ventas
  const pesos = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-MX")
  return (
    <div>
      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>💰 Qué publicación vende (últimos {ve?.dias || 90} días)</h3>
        <p style={{ margin: "0 0 10px", color: C.tenue, fontSize: 13 }}>
          De cada publicación: cuántos dieron clic en su liga y qué hicieron después (registros, pruebas del Cotizador y pagos del Cotizador, créditos 3D o compras de la tienda).
          Los pagos que llegan después se cuentan a la publicación por la que esa persona se registró. El plan semanal usa esto para repetir lo que vende.
        </p>
        {ve && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {[["Clics", ve.totales.clics], ["Registros", ve.totales.registros], ["Pruebas Cotizador", ve.totales.pruebas], ["Pagos", ve.totales.pagos], ["Ingresos", pesos(ve.totales.ingresos)]].map(([t, v]) => (
              <div key={String(t)} style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: "8px 14px", minWidth: 110 }}>
                <div style={{ fontSize: 11, color: C.tenue }}>{t}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {!ve?.publicaciones?.length ? (
          <p style={{ fontSize: 13, color: C.tenue }}>Todavía no hay clics medidos. Las ligas hetnacnc.com/r/… de cada publicación empiezan a contar en cuanto se publican.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Publicación", "Clics", "Registros", "Pruebas", "Pagos", "Ingresos"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {ve.publicaciones.slice(0, 20).map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ ...td, maxWidth: 380 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.titulo}>{f.titulo}</div><div style={{ fontSize: 11, color: C.tenue }}>{[f.fuente, f.mercado?.toUpperCase()].filter(Boolean).join(" · ")}</div></td>
                    <td style={td}>{f.clics}</td>
                    <td style={td}>{f.registros}</td>
                    <td style={td}>{f.pruebas}</td>
                    <td style={{ ...td, fontWeight: f.pagos ? 800 : 400, color: f.pagos ? C.verde : undefined }}>{f.pagos}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{f.ingresos ? pesos(f.ingresos) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Anuncios />

      <section style={caja}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>🧠 Lo que estamos aprendiendo (Facebook e Instagram)</h3>
          <span style={{ flex: 1 }} />
          <button type="button" style={boton("normal")} disabled={leyendo} onClick={leerAhora}>{leyendo ? "Leyendo…" : "Leer estadísticas ahora"}</button>
        </div>
        {aviso && <p style={{ fontSize: 12, color: C.tenue }}>{aviso}</p>}
        <p style={{ color: C.tenue, fontSize: 12, margin: "6px 0" }}>
          Cada 6 horas se leen alcance, me gusta, comentarios, compartidos, guardados y vistas. Puntos de interacción = me gusta + comentarios×2 + compartidos×3 + guardados×3 (compartir y guardar es lo que más premian los algoritmos). El agente usa esto al llenar el plan de cada semana.
        </p>
        {!ap || !ap.publicaciones ? (
          <p style={{ color: C.tenue, fontSize: 13 }}>Todavía no hay estadísticas. Aparecen unas horas después de publicar en Facebook o Instagram.</p>
        ) : (
          <>
            {ap.resumen.length > 0 ? (
              <ul style={{ fontSize: 13, margin: "6px 0 10px", paddingLeft: 18 }}>{ap.resumen.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
            ) : (
              <p style={{ color: C.tenue, fontSize: 13 }}>Con {ap.publicaciones} publicaciones medidas aún no hay conclusiones (se necesitan al menos 3 por grupo).</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {[["Por formato", ap.por_formato, (g: any) => g.formato], ["Por mercado", ap.por_mercado, (g: any) => String(g.mercado).toUpperCase()], ["Por hora (local)", ap.por_hora.slice(0, 8), (g: any) => `${g.hora}:00`], ["Por emoción", ap.por_emocion || [], (g: any) => g.emocion]].map(([t, lista, et]: any) => (
                <div key={t}>
                  <b style={{ fontSize: 13 }}>{t}</b>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr><th style={th}>Red</th><th style={th}></th><th style={th}>Pub.</th><th style={th}>Interacción media</th><th style={th}>Alcance medio</th></tr></thead>
                    <tbody>
                      {lista.map((g: any, i: number) => (
                        <tr key={i}><td style={td}>{nombreRed(g.red)}</td><td style={td}>{et(g)}</td><td style={td}>{g.n}</td><td style={td}>{g.interaccion_media}</td><td style={td}>{g.alcance_medio || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            {ap.mejores.length > 0 && (
              <>
                <b style={{ fontSize: 13, display: "block", marginTop: 10 }}>Publicaciones con más interacción</b>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <tbody>
                    {ap.mejores.map((x: any, i: number) => (
                      <tr key={i}>
                        <td style={td}>{x.titulo}</td><td style={td}>{nombreRed(x.red)} · {x.formato} · {String(x.mercado).toUpperCase()}</td>
                        <td style={td}>❤ {x.me_gusta} · 💬 {x.comentarios} · ↗ {x.compartidos} · 🔖 {x.guardados}{x.alcance ? ` · 👁 ${x.alcance}` : ""}</td>
                        <td style={td}>{x.url && <a href={x.url} target="_blank" rel="noreferrer" style={{ color: C.naranja }}>ver ↗</a>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </section>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[7, 30, 90].map((d) => (
          <button key={d} type="button" style={{ ...boton("normal"), background: dias === d ? "#142033" : C.fondo, color: dias === d ? "#fff" : C.texto }} onClick={() => setDias(d)}>
            {d} días
          </button>
        ))}
      </div>
      <section style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Por red</h3>
        {m.por_red.length === 0 ? (
          <p style={{ color: C.tenue, fontSize: 13 }}>Todavía no hay clics en ligas medidas. Aparecerán en cuanto se publique algo.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Red</th>
                <th style={th}>Clics</th>
                <th style={th}>Clientes nuevos</th>
                <th style={th}>Talleres nuevos</th>
                <th style={th}>Solicitudes</th>
                <th style={th}>Ventas</th>
              </tr>
            </thead>
            <tbody>
              {m.por_red.map((r: any) => (
                <tr key={r.red}>
                  <td style={td}>{r.nombre}</td>
                  <td style={td}>{r.clics}</td>
                  <td style={td}>{r.registro_cliente}</td>
                  <td style={td}>{r.registro_taller}</td>
                  <td style={td}>{r.solicitud}</td>
                  <td style={td}>
                    {r.venta}
                    {r.ventas_mxn ? ` · $${Number(r.ventas_mxn).toLocaleString("es-MX")}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Comunidades que más traen</h3>
        {m.grupos.length === 0 ? (
          <p style={{ color: C.tenue, fontSize: 13 }}>Crea ligas por grupo desde cada publicación ("Liga medida para pegar en un grupo") para saber cuál funciona mejor.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {m.grupos.map((g: any) => (
                <tr key={g.codigo}>
                  <td style={td}>👥 {g.grupo}</td>
                  <td style={td}>{g.clics} clics</td>
                  <td style={td}>{g.conversiones} conversiones</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Publicaciones que más traen</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {m.publicaciones.map((p: any) => (
              <tr key={p.id}>
                <td style={td}>{p.titulo}</td>
                <td style={td}>{ORIGEN[p.origen] || p.origen}</td>
                <td style={td}>{p.clics} clics</td>
                <td style={td}>{p.conversiones} conversiones</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Configuracion({ datos, alGuardar }: { datos: Datos; alGuardar: () => void }) {
  const [c, setC] = useState<Config>(datos.config)
  const [nota, setNota] = useState("")
  const guardar = async () => {
    try {
      await api("/config", c)
      setNota("Guardado.")
      alGuardar()
    } catch (e) {
      setNota((e as Error).message)
    }
  }
  return (
    <section style={caja}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Redes para las publicaciones automáticas</h3>
      <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 8px" }}>Activa sólo las que ya estén conectadas en n8n (Facebook y Telegram ya lo están; Instagram en cuanto la prueba salga bien). ✋ = copiar y pegar.</p>
      <PruebaInstagram />
      <PruebaRed red="threads" nombre="Threads" />
      <PruebaRed red="youtube" nombre="YouTube" />
      <TikTokConexion />
      <WhatsappConexion />
      <Chips redes={c.redes} todas={datos.redes} alCambiar={(r) => setC({ ...c, redes: r })} />
      <h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>¿Qué sale solo y qué espera tu visto bueno?</h3>
      {Object.keys(c.automatico).map((k) => (
        <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, margin: "4px 0" }}>
          <input type="checkbox" checked={c.automatico[k]} onChange={(e) => setC({ ...c, automatico: { ...c.automatico, [k]: e.target.checked } })} />
          {ORIGEN[k]}: {c.automatico[k] ? "se publica sola" : "queda en borrador para que la revises"}
        </label>
      ))}
      <p style={{ color: C.tenue, fontSize: 12, margin: "4px 0 0" }}>Las licitaciones sólo se publican si el cliente lo autorizó, y siempre con el resumen sin datos privados.</p>
      <h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>Horario de publicación (centro de México)</h3>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, flexWrap: "wrap" }}>
        de <input type="number" min={0} max={23} style={{ ...campo, width: 70 }} value={c.horario.desde} onChange={(e) => setC({ ...c, horario: { ...c.horario, desde: Number(e.target.value) } })} />
        a <input type="number" min={1} max={24} style={{ ...campo, width: 70 }} value={c.horario.hasta} onChange={(e) => setC({ ...c, horario: { ...c.horario, hasta: Number(e.target.value) } })} /> h · esperar
        <input type="number" min={0} max={1440} style={{ ...campo, width: 80 }} value={c.retraso_min} onChange={(e) => setC({ ...c, retraso_min: Number(e.target.value) })} /> min antes de publicar lo automático
      </div>
      <h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>🤖 Piloto automático</h3>
      <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 8px" }}>
        Los borradores que genera el sistema (plan semanal, promociones y Fábrica) se programan solos cuando ya tienen imagen o video y su puntaje llega al mínimo. Lo demás te llega por Telegram para aprobar.
      </p>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center" }}>
        <input type="checkbox" checked={!!c.piloto?.activo} onChange={(e) => setC({ ...c, piloto: { minimo: 75, redes: [], ...(c.piloto || {}), activo: e.target.checked } })} />
        Activar piloto automático · puntaje mínimo
        <input type="number" min={40} max={100} style={{ ...campo, width: 70 }} value={c.piloto?.minimo ?? 75} onChange={(e) => setC({ ...c, piloto: { activo: false, redes: [], ...(c.piloto || {}), minimo: Number(e.target.value) } })} />
      </label>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 10 }}>
        <input type="checkbox" checked={c.primer_comentario !== false} onChange={(e) => setC({ ...c, primer_comentario: e.target.checked })} />
        Primer comentario automático con la liga en Facebook (necesita el permiso pages_manage_engagement)
      </label>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={c.imagen_nueva !== false} onChange={(e) => setC({ ...c, imagen_nueva: e.target.checked })} />
        Imágenes con el estilo nuevo (los mismos fondos que los videos animados). Si se apaga o falla, salen con el estilo anterior
      </label>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={!!c.video_animado} onChange={(e) => setC({ ...c, video_animado: e.target.checked })} />
        Videos animados (estilo «¿Máquina parada?») para los reels y shorts del plan. Se hacen de 2 a 6 am los que salen en más de 24 h; si uno falla, sale el video de siempre
      </label>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={!!c.youtube_auto} onChange={(e) => setC({ ...c, youtube_auto: e.target.checked })} />
        YouTube conectado en n8n: los videos verticales salen solos como Shorts (sin esto, YouTube queda para copiar y pegar)
      </label>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={!!c.auto_respuestas} onChange={(e) => setC({ ...c, auto_respuestas: e.target.checked })} />
        Respuestas automáticas: la IA contesta sola las preguntas frecuentes y los elogios (lo demás te llega a Telegram para aprobar)
      </label>
      <p style={{ color: C.tenue, fontSize: 12, margin: "4px 0 0" }}>
        🧠 El revisor con IA mejora solo los borradores del plan, promociones y Fábrica antes de que salgan, y el piloto le da una segunda oportunidad a lo que no llega al puntaje. En cada publicación tienes "Mejorar con IA" y "Deshacer".
      </p>
      <h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>📲 Aprobar desde Telegram</h3>
      <TelegramAprobacion />
      <div style={{ fontSize: 14, marginTop: 6 }}>
        Mándame los borradores del día a las{" "}
        <input type="number" min={0} max={23} style={{ ...campo, width: 60 }} value={c.aviso_hora ?? 8} onChange={(e) => setC({ ...c, aviso_hora: Number(e.target.value) })} /> h (centro de México)
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" style={boton("primario")} onClick={guardar}>
          Guardar
        </button>
        {nota && <span style={{ fontSize: 13 }}>{nota}</span>}
      </div>
      <p style={{ fontSize: 12, color: datos.n8n ? C.verde : C.rojo, marginTop: 12 }}>
        {datos.n8n ? "✓ Conectado a n8n (flujo Social Hub - Publicar)." : "✗ Falta configurar N8N_REDES_URL en el servidor."}
      </p>
    </section>
  )
}

type VideoTaller = { id: string; url: string; taller: string; handle: string; descripcion: string | null; estado: string; tamano: number; autorizo_en: string; autorizo_version: string; fecha: string }

function VideosTalleres({ redes, config, alCambiar }: { redes: RedInfo[]; config: Config; alCambiar: () => void }) {
  const [lista, setLista] = useState<VideoTaller[] | null>(null)
  const [error, setError] = useState("")
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [motivo, setMotivo] = useState<Record<string, string>>({})
  const cargar = useCallback(async () => {
    try {
      const d = await api<{ videos: VideoTaller[] }>("/videos?estado=pendiente")
      setLista(d.videos)
    } catch (e) {
      setError((e as Error).message)
      setLista([])
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])
  const decidir = async (id: string, accion: "aprobar" | "rechazar") => {
    setError("")
    try {
      await api(`/videos/${id}`, accion === "aprobar" ? { accion, redes: sel[id] || config.redes } : { accion, motivo: motivo[id] || "" })
      void cargar()
      alCambiar()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <div>
      <p style={{ color: C.tenue, fontSize: 13 }}>
        Videos que suben los talleres desde "Promociona tu taller", con su autorización registrada. Al aprobar se programa la publicación con crédito y liga al perfil del taller.
        Revisa que no salga información confidencial del cliente ni música con derechos.
      </p>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {lista === null ? (
        <p>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>No hay videos por revisar.</p>
      ) : (
        lista.map((v) => (
          <article key={v.id} style={{ ...caja, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <video src={v.url} controls preload="metadata" style={{ width: 220, maxHeight: 390, borderRadius: 8, background: "#000" }} />
            <div style={{ flex: 1, minWidth: 260, display: "grid", gap: 8, alignContent: "start" }}>
              <b>{v.taller}</b>
              <span style={{ fontSize: 13 }}>{v.descripcion || "Sin descripción"}</span>
              <span style={{ fontSize: 12, color: C.tenue }}>
                {(v.tamano / 1048576).toFixed(1)} MB · autorizó el {fecha(v.autorizo_en)} (texto {v.autorizo_version})
              </span>
              <Chips redes={sel[v.id] || config.redes} todas={redes} alCambiar={(r) => setSel({ ...sel, [v.id]: r })} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={boton("primario")} onClick={() => void decidir(v.id, "aprobar")}>
                  ✓ Aprobar y programar
                </button>
                <input style={{ ...campo, width: 220, padding: 6 }} placeholder="Motivo (si lo rechazas)" value={motivo[v.id] || ""} onChange={(e) => setMotivo({ ...motivo, [v.id]: e.target.value })} />
                <button type="button" style={boton("peligro")} onClick={() => void decidir(v.id, "rechazar")}>
                  Rechazar
                </button>
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  )
}

function Puntaje({ p }: { p: { puntaje: number; revisiones: { ok: boolean; texto: string; consejo?: string }[] } }) {
  const [abierto, setAbierto] = useState(false)
  const col = p.puntaje >= 80 ? C.verde : p.puntaje >= 55 ? "#8A5A00" : C.rojo
  const fallas = p.revisiones.filter((x) => !x.ok)
  return (
    <span style={{ position: "relative" }}>
      <button type="button" onClick={() => setAbierto(!abierto)} title="Puntaje de algoritmo" style={{ border: `1px solid ${col}`, color: col, background: "transparent", borderRadius: 999, padding: "0 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
        Algoritmo {p.puntaje}
      </button>
      {abierto && (
        <span style={{ position: "absolute", zIndex: 5, top: 22, left: 0, width: 300, background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 10, padding: 10, fontSize: 12, boxShadow: "0 6px 20px rgba(0,0,0,.12)" }}>
          {p.revisiones.map((x, i) => (
            <span key={i} style={{ display: "block", margin: "2px 0", color: x.ok ? C.verde : C.texto }}>
              {x.ok ? "✓" : "✗"} {x.texto}
              {!x.ok && x.consejo && <span style={{ display: "block", color: C.tenue, marginLeft: 14 }}>{x.consejo}</span>}
            </span>
          ))}
          {!fallas.length && <span style={{ color: C.verde }}>Cumple la guía de esta red.</span>}
        </span>
      )}
    </span>
  )
}

type Hueco = { id: string; fecha: string; red: string; mercado: string; publico: string; pilar: string; formato: string; estado: string; post_id: string | null; titulo?: string }
type GuiaVista = { red: string; nombre: string; auto: boolean; formatos: string[]; frecuencia: number; horas: number[]; dias: number[]; publicos: string[]; liga: string; hashtags: [number, number]; media: string; claves: string }
type Estrat = {
  config: { mercados: Record<string, number> }
  guias: GuiaVista[]
  publicos: { clave: string; nombre: string; objetivo: string; destino: string; pilares: string[] }[]
  mercados: { clave: string; nombre: string; zona: string; nota: string; pct: number; redes: string[] }[]
}
const NOMBRE_PUBLICO: Record<string, string> = { clientes_empresa: "Empresas", clientes_particulares: "Particulares", talleres: "Talleres", proveedores: "Proveedores" }
const ESTADO_HUECO: Record<string, [string, string]> = {
  vacio: ["Sin contenido", C.tenue],
  borrador: ["Borrador por revisar", "#8A5A00"],
  falta_material: ["Falta video", C.rojo],
  programada: ["Programada", "#1a3a5c"],
  publicada: ["Publicada", C.verde],
  parcial: ["Parcial", "#8A5A00"],
  descartada: ["Descartada", C.tenue],
}
const DIAS = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
const lunes = (d = new Date()) => {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}

function Plan({ alCambiar, irA }: { alCambiar: () => void; irA: (v: string) => void }) {
  const [semana, setSemana] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return lunes(d)
  })
  const [huecos, setHuecos] = useState<Hueco[] | null>(null)
  const [nota, setNota] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const cargar = useCallback(async () => {
    try {
      const d = await api<{ semana: string; huecos: Hueco[] }>(`/plan?semana=${semana}`)
      setHuecos(d.huecos)
    } catch (e) {
      setNota((e as Error).message)
      setHuecos([])
    }
  }, [semana])
  useEffect(() => {
    void cargar()
  }, [cargar])
  const hacer = async (accion: "generar" | "llenar") => {
    setOcupado(true)
    setNota(accion === "llenar" ? "El agente está escribiendo los borradores… puede tardar un par de minutos." : "")
    try {
      const d = await api<any>("/plan", { accion, semana })
      setNota(accion === "generar" ? (d.ya ? "Esa semana ya tenía plan." : `Plan armado: ${d.creados} publicaciones.`) : `Listo: ${d.llenados} borradores para revisar en Pendientes.`)
      void cargar()
      alCambiar()
    } catch (e) {
      setNota((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  const mover = (dias: number) => {
    const d = new Date(`${semana}T12:00:00`)
    d.setDate(d.getDate() + dias)
    setSemana(lunes(d))
  }
  const porDia = useMemo(() => {
    const m: Record<string, Hueco[]> = {}
    for (const h of huecos || []) {
      const k = new Date(h.fecha).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })
      ;(m[k] ||= []).push(h)
    }
    return Object.entries(m)
  }, [huecos])
  const conteo = (est: string) => (huecos || []).filter((h) => h.estado === est).length
  return (
    <section style={caja}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Plan de la semana del {new Date(`${semana}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}</h3>
        <button type="button" style={{ ...boton("normal"), padding: "4px 10px" }} onClick={() => mover(-7)}>◀</button>
        <button type="button" style={{ ...boton("normal"), padding: "4px 10px" }} onClick={() => mover(7)}>▶</button>
        <span style={{ flex: 1 }} />
        <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void hacer("generar")}>1. Armar plan</button>
        <button type="button" style={boton("primario")} disabled={ocupado || !conteo("vacio")} onClick={() => void hacer("llenar")}>2. Escribir borradores ({conteo("vacio")})</button>
      </div>
      <Temario alCambiar={alCambiar} />
      <p style={{ color: C.tenue, fontSize: 12, margin: "6px 0" }}>
        Cada domingo se arma solo el plan de la semana siguiente y el agente escribe los borradores. Los que piden video quedan en "Falta video": usa un video de taller o súbelo.
      </p>
      {nota && <p style={{ fontSize: 13 }}>{nota}</p>}
      {huecos && huecos.length > 0 && (
        <p style={{ fontSize: 12, color: C.tenue }}>
          {huecos.length} publicaciones · {conteo("publicada")} publicadas · {conteo("programada")} programadas · {conteo("borrador")} por revisar · {conteo("falta_material")} sin video
        </p>
      )}
      {huecos === null ? (
        <p>Cargando…</p>
      ) : huecos.length === 0 ? (
        <p style={{ color: C.tenue }}>Esta semana todavía no tiene plan. Dale "Armar plan".</p>
      ) : (
        porDia.map(([dia, hs]) => (
          <div key={dia} style={{ marginTop: 10 }}>
            <b style={{ fontSize: 13, textTransform: "capitalize" }}>{dia}</b>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 4 }}>
              <tbody>
                {hs.map((h) => {
                  const [txt, col] = ESTADO_HUECO[h.estado] || [h.estado, C.tenue]
                  return (
                    <tr key={h.id} style={{ borderTop: `1px solid ${C.borde}` }}>
                      <td style={{ padding: 4, width: 50 }}>{new Date(h.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: 4, width: 110 }}><b>{h.red}</b>{h.mercado !== "mx" ? ` · ${h.mercado.toUpperCase()}` : ""}</td>
                      <td style={{ padding: 4, width: 70 }}>{h.formato}</td>
                      <td style={{ padding: 4, width: 90, color: C.tenue }}>{NOMBRE_PUBLICO[h.publico] || h.publico}</td>
                      <td style={{ padding: 4 }}>{h.pilar}</td>
                      <td style={{ padding: 4, width: 140, color: col, fontWeight: 700 }}>
                        {h.post_id ? (
                          <button type="button" onClick={() => irA(h.estado === "programada" ? "calendario" : "pendientes")} style={{ background: "none", border: 0, color: col, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12 }}>{txt} →</button>
                        ) : txt}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  )
}

function Estrategia({ alCambiar, irA }: { alCambiar: () => void; irA: (v: string) => void }) {
  const [e, setE] = useState<Estrat | null>(null)
  const [mercados, setMercados] = useState<Record<string, number>>({})
  const [guias, setGuias] = useState<Record<string, { frecuencia: number; horas: string }>>({})
  const [pilares, setPilares] = useState<Record<string, string>>({})
  const [nota, setNota] = useState("")
  const aplicar = (d: Estrat) => {
    setE(d)
    setMercados(Object.fromEntries(d.mercados.map((m) => [m.clave, m.pct])))
    setGuias(Object.fromEntries(d.guias.map((g) => [g.red, { frecuencia: g.frecuencia, horas: g.horas.join(", ") }])))
    setPilares(Object.fromEntries(d.publicos.map((p) => [p.clave, p.pilares.join("\n")])))
  }
  useEffect(() => {
    api<Estrat>("/estrategia").then(aplicar).catch((er) => setNota((er as Error).message))
  }, [])
  const guardar = async () => {
    try {
      const d = await api<Estrat>("/estrategia", {
        mercados,
        guias: Object.fromEntries(Object.entries(guias).map(([red, g]) => [red, { frecuencia: g.frecuencia, horas: g.horas.split(/[,\s]+/).filter(Boolean).map(Number) }])),
        pilares: Object.fromEntries(Object.entries(pilares).map(([k, v]) => [k, v.split("\n")])),
      })
      aplicar(d)
      setNota("Guardado. Se aplica al próximo plan.")
    } catch (er) {
      setNota((er as Error).message)
    }
  }
  if (!e) return <p>{nota || "Cargando…"}</p>
  const th: CSSProperties = { textAlign: "left", padding: 6, fontSize: 12, color: C.tenue }
  const td: CSSProperties = { padding: 6, borderTop: `1px solid ${C.borde}`, fontSize: 12, verticalAlign: "top" }
  return (
    <div>
      <Plan alCambiar={alCambiar} irA={irA} />

      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Mercados</h3>
        <p style={{ color: C.tenue, fontSize: 12, margin: "0 0 8px" }}>
          Reparto del esfuerzo (0 = apagado). Todos los mercados salen en las mismas cuentas de HETNA, cada publicación en su idioma y a la hora local del país. Empezamos con Colombia en Sudamérica.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {e.mercados.map((m) => (
              <tr key={m.clave}>
                <td style={td}><b>{m.nombre}</b><div style={{ color: C.tenue }}>{m.nota}</div></td>
                <td style={{ ...td, width: 90 }}>
                  <input type="number" min={0} max={100} style={{ ...campo, width: 70, padding: 4 }} value={mercados[m.clave] ?? 0} onChange={(ev) => setMercados({ ...mercados, [m.clave]: Number(ev.target.value) })} /> %
                </td>
                <td style={{ ...td, color: C.tenue }}>{m.redes.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Guía por red (lo que premia cada algoritmo)</h3>
        <p style={{ color: C.tenue, fontSize: 12, margin: "0 0 8px" }}>Punto de partida basado en estudios; ajusta la frecuencia y las horas con tus resultados. Las redes cambian sus algoritmos: esta guía se revisa cada mes.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={th}>Red</th>
                <th style={th}>Qué premia</th>
                <th style={th}>Formatos</th>
                <th style={th}>Liga / hashtags</th>
                <th style={th}>Por semana</th>
                <th style={th}>Horas (local)</th>
              </tr>
            </thead>
            <tbody>
              {e.guias.map((g) => (
                <tr key={g.red}>
                  <td style={td}><b>{g.nombre}</b>{!g.auto && <div style={{ color: C.tenue }}>✋ a mano</div>}</td>
                  <td style={{ ...td, maxWidth: 280 }}>{g.claves}</td>
                  <td style={td}>{[...new Set(g.formatos)].join(", ")}<div style={{ color: C.tenue }}>{g.dias.map((d) => DIAS[d]).join(" ")}</div></td>
                  <td style={td}>{g.liga === "perfil" ? "Liga en el perfil" : g.liga === "primer_comentario" ? "Liga en 1er comentario" : "Liga en el texto"}<div style={{ color: C.tenue }}>#{g.hashtags[0]}–{g.hashtags[1]}</div></td>
                  <td style={td}>
                    <input type="number" min={0} max={21} style={{ ...campo, width: 60, padding: 4 }} value={guias[g.red]?.frecuencia ?? 0} onChange={(ev) => setGuias({ ...guias, [g.red]: { ...guias[g.red], frecuencia: Number(ev.target.value) } })} />
                  </td>
                  <td style={td}>
                    <input style={{ ...campo, width: 90, padding: 4 }} value={guias[g.red]?.horas ?? ""} onChange={(ev) => setGuias({ ...guias, [g.red]: { ...guias[g.red], horas: ev.target.value } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Públicos y temas</h3>
        <p style={{ color: C.tenue, fontSize: 12, margin: "0 0 8px" }}>Un tema por línea. El plan los rota en cada red según a quién le habla.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {e.publicos.map((p) => (
            <label key={p.clave} style={{ fontSize: 13 }}>
              <b>{p.nombre}</b>
              <span style={{ display: "block", color: C.tenue, fontSize: 12 }}>Meta: {p.objetivo} · {p.destino}</span>
              <textarea style={{ ...campo, minHeight: 120, fontSize: 12, marginTop: 4 }} value={pilares[p.clave] || ""} onChange={(ev) => setPilares({ ...pilares, [p.clave]: ev.target.value })} />
            </label>
          ))}
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" style={boton("primario")} onClick={() => void guardar()}>Guardar estrategia</button>
        {nota && <span style={{ fontSize: 13 }}>{nota}</span>}
      </div>
    </div>
  )
}

type Hallazgo = { id: string; tipo: string; mercado: string; titulo: string; resumen: string | null; url: string; lugar: string | null; relevancia: number; accion: string | null; datos: Record<string, string> | null; estado: string; mensaje: string; created_at: string }
type BusquedaR = { id: string; tipo: string; mercado: string; consulta: string; activa: boolean }
const TIPO_RADAR: Record<string, string> = { cliente: "🎯 Clientes", taller: "🏭 Talleres", contenido: "💡 Contenido", competencia: "👀 Competencia", evento: "📅 Eventos", mencion: "🔔 Menciones" }

function Radar({ alCambiar }: { alCambiar: () => void }) {
  const [d, setD] = useState<{ hallazgos: Hallazgo[]; conteo: Record<string, number>; busquedas: BusquedaR[]; tipos: string[]; mercados: { clave: string; nombre: string }[]; tope_dia: number } | null>(null)
  const [estado, setEstado] = useState("nuevo")
  const [tipo, setTipo] = useState("")
  const [nota, setNota] = useState("")
  const [verBusq, setVerBusq] = useState(false)
  const [busq, setBusq] = useState<BusquedaR[]>([])
  const [ocupado, setOcupado] = useState("")
  const cargar = useCallback(async () => {
    try {
      const x = await fetch(`/admin/hetna-radar?estado=${estado}${tipo ? `&tipo=${tipo}` : ""}`, { credentials: "include", headers: cabeceras() }).then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.message || `Error ${r.status}`)
        return j
      })
      setD(x)
      setBusq(x.busquedas)
    } catch (e) {
      setNota((e as Error).message)
    }
  }, [estado, tipo])
  useEffect(() => {
    void cargar()
  }, [cargar])
  const post = async (cuerpo: Record<string, unknown>) => {
    const r = await fetch("/admin/hetna-radar", { method: "POST", credentials: "include", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.message || `Error ${r.status}`)
    return j
  }
  const marcar = async (id: string, est: string) => {
    try {
      await post({ accion: "estado", id, estado: est })
      void cargar()
    } catch (e) {
      setNota((e as Error).message)
    }
  }
  const publicar = async (id: string) => {
    try {
      await post({ accion: "publicar", id })
      setNota("Borrador creado: revísalo en Pendientes.")
      alCambiar()
      void cargar()
    } catch (e) {
      setNota((e as Error).message)
    }
  }
  const buscarYa = async (id: string) => {
    setOcupado(id)
    setNota("Buscando en la web… tarda alrededor de un minuto.")
    try {
      const x = await post({ accion: "buscar", id })
      setNota(`Listo: ${x.encontrados} encontrados, ${x.nuevos} nuevos.`)
      void cargar()
    } catch (e) {
      setNota((e as Error).message)
    } finally {
      setOcupado("")
    }
  }
  const guardarBusq = async () => {
    try {
      const x = await post({ accion: "busquedas", lista: busq })
      setBusq(x.busquedas)
      setNota("Búsquedas guardadas.")
    } catch (e) {
      setNota((e as Error).message)
    }
  }
  if (!d) return <p>{nota || "Cargando…"}</p>
  return (
    <div>
      <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 10px" }}>
        Cada mañana el Radar busca en la web (hasta {d.tope_dia} búsquedas al día, rotando) clientes que necesitan fabricar, talleres para invitar, temas para contenido, competencia, ferias y menciones de HETNA.
        Sólo información pública. Las invitaciones las mandas tú, una por una.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {[["", "Todos"], ...d.tipos.map((t) => [t, TIPO_RADAR[t] || t])].map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTipo(k)} style={{ ...boton("normal"), padding: "4px 10px", background: tipo === k ? "#142033" : C.fondo, color: tipo === k ? "#fff" : C.texto }}>
            {t}
            {k && d.conteo[k] ? ` (${d.conteo[k]})` : ""}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <select style={{ ...campo, width: "auto", padding: 5 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="nuevo">Nuevos</option>
          <option value="util">Guardados</option>
          <option value="convertido">Convertidos en publicación</option>
          <option value="descartado">Descartados</option>
        </select>
        <button type="button" style={boton("normal")} onClick={() => setVerBusq(!verBusq)}>{verBusq ? "Cerrar búsquedas" : "⚙ Búsquedas"}</button>
      </div>
      {nota && <p style={{ fontSize: 13 }}>{nota}</p>}

      {verBusq && (
        <section style={caja}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Qué busca el Radar</h3>
          {busq.map((b, i) => (
            <div key={b.id} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <input type="checkbox" checked={b.activa} onChange={(e) => setBusq(busq.map((x, j) => (j === i ? { ...x, activa: e.target.checked } : x)))} title="Activa" />
              <select style={{ ...campo, width: "auto", padding: 4, fontSize: 12 }} value={b.tipo} onChange={(e) => setBusq(busq.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))}>
                {d.tipos.map((t) => <option key={t} value={t}>{TIPO_RADAR[t] || t}</option>)}
              </select>
              <select style={{ ...campo, width: "auto", padding: 4, fontSize: 12 }} value={b.mercado} onChange={(e) => setBusq(busq.map((x, j) => (j === i ? { ...x, mercado: e.target.value } : x)))}>
                {d.mercados.map((m) => <option key={m.clave} value={m.clave}>{m.nombre}</option>)}
              </select>
              <input style={{ ...campo, flex: 1, minWidth: 260, padding: 5, fontSize: 12 }} value={b.consulta} onChange={(e) => setBusq(busq.map((x, j) => (j === i ? { ...x, consulta: e.target.value } : x)))} />
              <button type="button" style={{ ...boton("normal"), padding: "3px 8px", fontSize: 12 }} disabled={!!ocupado} onClick={() => void buscarYa(b.id)}>{ocupado === b.id ? "Buscando…" : "Buscar ahora"}</button>
              <button type="button" style={{ ...boton("normal"), padding: "3px 8px", fontSize: 12 }} onClick={() => setBusq(busq.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={boton("normal")} onClick={() => setBusq([...busq, { id: `rb_${Date.now()}`, tipo: "contenido", mercado: "mx", consulta: "", activa: true }])}>+ Agregar búsqueda</button>
            <button type="button" style={boton("primario")} onClick={() => void guardarBusq()}>Guardar búsquedas</button>
          </div>
          <p style={{ color: C.tenue, fontSize: 12, marginBottom: 0 }}>"Buscar ahora" usa la búsqueda web de Claude: cada búsqueda tiene un costo pequeño en tu cuenta de Claude.</p>
        </section>
      )}

      {d.hallazgos.length === 0 ? (
        <p style={{ color: C.tenue }}>Nada por aquí todavía. El Radar busca cada mañana; también puedes abrir "⚙ Búsquedas" y darle "Buscar ahora".</p>
      ) : (
        d.hallazgos.map((h) => (
          <article key={h.id} style={caja}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12 }}>{TIPO_RADAR[h.tipo] || h.tipo}</span>
              <span style={{ fontSize: 12, color: C.naranja }}>{"★".repeat(h.relevancia)}</span>
              {h.mercado !== "mx" && <span style={{ fontSize: 12, color: C.tenue }}>{h.mercado.toUpperCase()}</span>}
              <b style={{ flex: 1, minWidth: 200 }}>{h.titulo}</b>
              <a href={h.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.naranja }}>Fuente ↗</a>
            </div>
            {h.resumen && <p style={{ fontSize: 13, margin: "6px 0" }}>{h.resumen}</p>}
            <p style={{ fontSize: 12, color: C.tenue, margin: "2px 0" }}>
              {[h.lugar, h.datos?.empresa, h.datos?.sitio, h.datos?.fecha].filter(Boolean).join(" · ")}
            </p>
            {h.accion && <p style={{ fontSize: 13, margin: "6px 0" }}>👉 {h.accion}</p>}
            {h.mensaje && (
              <details style={{ fontSize: 12, margin: "4px 0" }}>
                <summary style={{ cursor: "pointer" }}>Mensaje sugerido para escribirles</summary>
                <p style={{ whiteSpace: "pre-wrap", background: C.suave, borderRadius: 8, padding: 8 }}>{h.mensaje}</p>
                <button type="button" style={{ ...boton("normal"), padding: "3px 8px", fontSize: 12 }} onClick={() => copiar(h.mensaje)}>Copiar mensaje</button>
              </details>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {["contenido", "evento", "competencia", "mencion"].includes(h.tipo) && h.estado !== "convertido" && (
                <button type="button" style={boton("primario")} onClick={() => void publicar(h.id)}>Crear publicación</button>
              )}
              {h.estado !== "util" && <button type="button" style={boton("normal")} onClick={() => void marcar(h.id, "util")}>Guardar</button>}
              {h.estado !== "descartado" && <button type="button" style={boton("normal")} onClick={() => void marcar(h.id, "descartado")}>Descartar</button>}
            </div>
          </article>
        ))
      )}
    </div>
  )
}

type Trabajo = { id: string; entrada: any; estado: string; error: string | null; piezas: any; created_at: string; titulo: string | null }
type FondoB = { id: string; tema: string; url: string; fuente: string | null; licencia: string | null }
type MusicaB = { id: string; titulo: string; url: string; estilo: string | null; licencia: string | null }
const NOMBRE_TEMA: Record<string, string> = { laser: "Corte láser", plasma: "Plasma", router: "Router", torno: "Torno y fresado", taller: "Taller", lamina: "Láminas y materiales", impresion3d: "Impresión 3D", general: "General" }
const ESTADO_TRABAJO: Record<string, [string, string]> = { pendiente: ["En cola", "#8A5A00"], produciendo: ["Produciendo…", "#1a3a5c"], listo: ["Listo", C.verde], error: ["Error", C.rojo] }

async function apiFab<T>(cuerpo?: unknown): Promise<T> {
  const r = await fetch("/admin/hetna-fabrica", {
    credentials: "include",
    ...(cuerpo === undefined ? { headers: cabeceras() } : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
  })
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (!r.ok) throw new Error((d as any)?.message || `Error ${r.status}`)
  return d
}

type FechaE = { clave: string; nombre: string; fecha: string; faltan: number; anticipacion: number; en_temporada: boolean; tema: string; activa: boolean; etiquetas: string[]; sugeridas: string[]; productos: { id: string; titulo: string; foto: string | null }[]; ultima: string | null }

/** Agente de anuncios de Meta: impulsa con dinero lo que ya funcionó solo. Nada sale sin aprobar. */
function Anuncios() {
  const [d, setD] = useState<any>(null)
  const [c, setC] = useState<any>(null)
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const cargar = async () => {
    const x = await api<any>("/anuncios").catch(() => null)
    setD(x)
    if (x) setC(x.config)
  }
  useEffect(() => { void cargar() }, [])
  const hacer = async (cuerpo: any, msj: string) => {
    setOcupado(cuerpo.accion + (cuerpo.id || ""))
    try {
      const x = await api<any>("/anuncios", cuerpo)
      setD(x)
      setC(x.config)
      setNota({ ok: true, t: msj })
    } catch (e) {
      setNota({ ok: false, t: `✗ ${(e as Error).message}` })
    } finally {
      setOcupado(null)
    }
  }
  if (!d || !c) return null
  const pesos = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString("es-MX")
  const ESTADO: Record<string, [string, string]> = { propuesta: ["Propuesta: falta tu aprobación", "#8A5A00"], lanzando: ["Lanzando…", "#1a3a5c"], activo: ["Activo", C.verde], terminado: ["Terminado", C.tenue], rechazado: ["Rechazado", C.tenue], error: ["Error (quedó en pausa, no gasta)", C.rojo] }
  return (
    <section style={caja}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>📣 Anuncios en Meta (impulsar lo que ya funcionó)</h3>
      <p style={{ margin: "0 0 10px", color: C.tenue, fontSize: 13 }}>
        Cada martes el agente busca la publicación de Facebook de las últimas 2 semanas que más pagos, pruebas o registros trajo sin anuncio y te la <b>propone</b>.
        Sólo se lanza si apruebas. Cada anuncio tiene fecha de fin y un tope por semana; si gastara más de lo aprobado, se pausa solo. Esto sí cuesta dinero.
      </p>
      {!d.listo && <p style={{ fontSize: 13, color: C.rojo, fontWeight: 600 }}>Falta el token de anuncios en el servidor (META_ADS_TOKEN). Mientras no esté, no se propone ni se lanza nada.</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={!!c.activo} onChange={(e) => setC({ ...c, activo: e.target.checked })} /> Prendido
        </label>
        <label>Cuenta publicitaria <input value={c.cuenta} onChange={(e) => setC({ ...c, cuenta: e.target.value })} placeholder="734227081734669" style={{ width: 170, padding: "4px 6px", border: `1px solid ${C.borde}`, borderRadius: 6 }} /></label>
        <label>Presupuesto por semana (MXN) <input type="number" min={0} max={d.tope_semanal} value={c.presupuesto_semanal} onChange={(e) => setC({ ...c, presupuesto_semanal: Number(e.target.value) })} style={{ width: 90, padding: "4px 6px", border: `1px solid ${C.borde}`, borderRadius: 6 }} /></label>
        <label>Días por anuncio <input type="number" min={3} max={14} value={c.dias} onChange={(e) => setC({ ...c, dias: Number(e.target.value) })} style={{ width: 60, padding: "4px 6px", border: `1px solid ${C.borde}`, borderRadius: 6 }} /></label>
        <button type="button" style={boton("primario")} disabled={!!ocupado} onClick={() => void hacer({ accion: "config", ...c }, "✓ Guardado")}>Guardar</button>
        <button type="button" style={boton("normal")} disabled={!!ocupado || !d.config.activo} onClick={() => void hacer({ accion: "proponer" }, "✓ Hay una propuesta nueva abajo")}>Buscar propuesta ahora</button>
      </div>
      <div style={{ fontSize: 12, color: C.tenue, marginTop: 4 }}>
        Mínimo de Meta: {pesos(d.minimo_diario)} al día ({pesos(d.minimo_diario * 7)} por semana). Tope del sistema: {pesos(d.tope_semanal)} por semana.
        {c.presupuesto_semanal > 0 && c.presupuesto_semanal < d.minimo_diario * 7 && <b style={{ color: C.rojo }}> Con menos de {pesos(d.minimo_diario * 7)} por semana no se puede prender.</b>}
      </div>
      {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 6 }}>{nota.t}</div>}
      {(d.anuncios || []).map((a: any) => {
        const [txt, col] = ESTADO[a.estado] || [a.estado, C.tenue]
        const r = a.resultados || {}
        return (
          <div key={a.id} style={{ borderTop: `1px solid ${C.borde}`, padding: "10px 0", display: "grid", gap: 4, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ color: col, fontSize: 12 }}>{txt}</b>
              <b style={{ flex: 1 }}>{a.titulo || a.post_id}</b>
              <span style={{ color: C.tenue }}>{pesos(a.diario)} al día · {a.dias} días · máx. {pesos(Number(a.diario) * Number(a.dias))}</span>
            </div>
            <div style={{ color: C.tenue }}>{a.motivo}{a.fin ? ` · termina ${new Date(a.fin).toLocaleDateString("es-MX")}` : ""}{a.error ? ` · ${a.error}` : ""}</div>
            {a.resultados && <div>Gastado {pesos(r.gasto)} · alcance {Number(r.alcance || 0).toLocaleString("es-MX")} · clics {r.clics || 0}</div>}
            {a.estado === "propuesta" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={boton("primario")} disabled={!!ocupado} onClick={() => { if (confirm(`¿Lanzar este anuncio por hasta ${pesos(Number(a.diario) * Number(a.dias))}?`)) void hacer({ accion: "aprobar", id: a.id }, "✓ Anuncio lanzado en Meta") }}>{ocupado === "aprobar" + a.id ? "Lanzando…" : "Aprobar y lanzar"}</button>
                <button type="button" style={boton("normal")} disabled={!!ocupado} onClick={() => void hacer({ accion: "rechazar", id: a.id }, "Propuesta rechazada")}>Rechazar</button>
              </div>
            )}
            {a.estado === "activo" && (
              <div><button type="button" style={boton("peligro")} disabled={!!ocupado} onClick={() => void hacer({ accion: "pausar", id: a.id }, "Anuncio pausado")}>Pausar ya</button></div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** Botón "Generar todo el temario ahora": un borrador con imagen por cada tema pendiente. */
function Temario({ alCambiar }: { alCambiar: () => void }) {
  const [pub, setPub] = useState<{ clave: string; nombre: string; total: number; pendientes: number }[] | null>(null)
  const [elegidos, setElegidos] = useState<string[]>([])
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    api<any>("/plan", { accion: "temas" }).then((d) => { setPub(d.publicos); setElegidos(d.publicos.filter((p: any) => p.pendientes).map((p: any) => p.clave)) }).catch(() => setPub([]))
  }, [])
  if (!pub?.length) return null
  const total = pub.filter((p) => elegidos.includes(p.clave)).reduce((s, p) => s + p.pendientes, 0)
  return (
    <div style={{ border: `1px dashed ${C.borde}`, borderRadius: 10, padding: 10, margin: "8px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
        <b>📚 Todo el temario</b>
        {pub.map((p) => (
          <label key={p.clave} style={{ display: "flex", gap: 4, alignItems: "center", opacity: p.pendientes ? 1 : 0.5 }}>
            <input type="checkbox" disabled={!p.pendientes} checked={elegidos.includes(p.clave)} onChange={(e) => setElegidos(e.target.checked ? [...elegidos, p.clave] : elegidos.filter((x) => x !== p.clave))} />
            {p.nombre.split(" (")[0]} ({p.pendientes} de {p.total})
          </label>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" style={{ ...boton("primario"), opacity: ocupado || !total ? 0.6 : 1 }} disabled={ocupado || !total}
          onClick={async () => {
            setOcupado(true)
            try {
              const d = await api<any>("/plan", { accion: "temario", publicos: elegidos })
              setNota({ ok: true, t: `✓ Escribiendo ${d.temas} borradores (uno por día desde mañana, 7 pm). Tarda unos minutos; aparecen en Pendientes con su imagen.` })
              alCambiar()
            } catch (e) {
              setNota({ ok: false, t: `✗ ${(e as Error).message}` })
            } finally {
              setOcupado(false)
            }
          }}>{ocupado ? "Generando…" : `Generar todo el temario ahora (${total})`}</button>
      </div>
      <div style={{ fontSize: 12, color: C.tenue, marginTop: 4 }}>Un borrador por cada tema que no ha salido en 30 días. No se aprueban solos: los revisas tú en Pendientes.</div>
      {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 4 }}>{nota.t}</div>}
    </div>
  )
}

/** Fechas especiales: videos de productos con la etiqueta de cada fecha (Día de las Madres, Muertos, Navidad…). */
function FechasEspeciales() {
  const [fechas, setFechas] = useState<FechaE[] | null>(null)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [nota, setNota] = useState<Record<string, { ok: boolean; t: string }>>({})
  const [haciendo, setHaciendo] = useState<string | null>(null)
  const api = async (cuerpo?: unknown) => {
    const r = await fetch("/admin/hetna-fabrica/temporadas", { credentials: "include", ...(cuerpo === undefined ? { headers: cabeceras() } : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
    return d
  }
  const cargar = async () => setFechas((await api().catch(() => ({ fechas: [] }))).fechas || [])
  useEffect(() => { void cargar() }, [])
  const avisar = (clave: string, ok: boolean, t: string) => setNota((n) => ({ ...n, [clave]: { ok, t } }))
  return (
    <section style={caja}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>📅 Fechas especiales: videos de productos</h3>
      <p style={{ margin: "0 0 10px", color: C.tenue, fontSize: 13 }}>
        En la temporada de cada fecha se hacen solos (de madrugada) una imagen y un video con hasta 3 productos que tengan su <b>etiqueta</b> o <b>categoría</b>, con el fondo de la fecha.
        Diario la última semana; antes, cada 3 días. Nada sale después del día de la fecha. Si ningún producto tiene la etiqueta, no se hace video: ponle la etiqueta al producto en Productos.
      </p>
      {!fechas && <p style={{ fontSize: 13, color: C.tenue }}>Cargando…</p>}
      {(fechas || []).map((f) => (
        <div key={f.clave} style={{ borderTop: `1px solid ${C.borde}`, padding: "10px 0", display: "grid", gap: 6, opacity: f.activa ? 1 : 0.55 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ flex: 1, minWidth: 180 }}>{f.nombre}</b>
            <span style={{ fontSize: 12, color: C.tenue }}>{f.fecha} · {f.faltan === 0 ? "hoy" : `faltan ${f.faltan} días`}</span>
            {f.en_temporada && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: C.verde, borderRadius: 999, padding: "2px 8px" }}>En temporada</span>}
            <span style={{ fontSize: 12, fontWeight: 700, color: f.productos.length ? C.verde : C.rojo }}>{f.productos.length ? `${f.productos.length}${f.productos.length >= 6 ? "+" : ""} productos` : "Sin productos"}</span>
            <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={f.activa} onChange={async (e) => { try { const d = await api({ clave: f.clave, activa: e.target.checked }); setFechas(d.fechas) } catch (er) { avisar(f.clave, false, (er as Error).message) } }} /> Activa
            </label>
            <button type="button" disabled={haciendo === f.clave || !f.productos.length} style={{ ...boton("normal"), opacity: haciendo === f.clave || !f.productos.length ? 0.6 : 1 }}
              onClick={async () => {
                setHaciendo(f.clave)
                try { const d = await api({ clave: f.clave, hacer: true }); avisar(f.clave, true, `✓ Haciendo la imagen y el video con: ${d.productos.join(", ")}. En unos minutos aparecen en Pendientes.`) } catch (er) { avisar(f.clave, false, `✗ ${(er as Error).message}`) } finally { setHaciendo(null) }
              }}>{haciendo === f.clave ? "Haciendo…" : "🎬 Hacer video ahora"}</button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
            <span style={{ color: C.tenue }}>Etiquetas o categorías:</span>
            <input value={edit[f.clave] ?? f.etiquetas.join(", ")} onChange={(e) => setEdit({ ...edit, [f.clave]: e.target.value })} style={{ flex: 1, minWidth: 220, padding: "4px 8px", border: `1px solid ${C.borde}`, borderRadius: 6, fontSize: 12 }} />
            {edit[f.clave] !== undefined && (
              <button type="button" style={boton("primario")} onClick={async () => {
                try { const d = await api({ clave: f.clave, etiquetas: edit[f.clave].split(",").map((x) => x.trim()).filter(Boolean) }); setFechas(d.fechas); setEdit(({ [f.clave]: _, ...r }) => r); avisar(f.clave, true, "✓ Guardado") } catch (er) { avisar(f.clave, false, `✗ ${(er as Error).message}`) }
              }}>Guardar</button>
            )}
          </div>
          {f.productos.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {f.productos.map((p) => (
                <span key={p.id} title={p.titulo} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, border: `1px solid ${C.borde}`, borderRadius: 6, padding: "2px 6px", maxWidth: 220 }}>
                  {p.foto && <img src={p.foto} alt="" style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 4 }} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</span>
                </span>
              ))}
            </div>
          )}
          {nota[f.clave] && <div style={{ fontSize: 12, fontWeight: 600, color: nota[f.clave].ok ? C.verde : C.rojo }}>{nota[f.clave].t}</div>}
        </div>
      ))}
    </section>
  )
}

function Fabrica({ alCambiar, irA }: { alCambiar: () => void; irA: (v: string) => void }) {
  const [d, setD] = useState<{ trabajos: Trabajo[]; fondos: FondoB[]; musica: MusicaB[]; temas: string[]; ffmpeg: boolean; runpod?: { configurado: boolean; ok?: boolean; workers?: any } } | null>(null)
  const [f, setF] = useState({ guion: "", tema: "", mercado: "mx", publico: "clientes", tema_visual: "", voz: "hombre", ia_escenas: true })
  const [subiendo, setSubiendo] = useState<number | null>(null)
  const [nota, setNota] = useState("")
  const [verBib, setVerBib] = useState(false)
  const [fondo, setFondo] = useState({ tema: "laser", fuente: "", licencia: "" })
  const [mus, setMus] = useState({ titulo: "", estilo: "", licencia: "" })
  const cargar = useCallback(async () => {
    try {
      setD(await apiFab())
    } catch (e) {
      setNota((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])
  // Mientras algo se produce, se actualiza solo
  useEffect(() => {
    if (!d?.trabajos.some((t) => ["pendiente", "produciendo"].includes(t.estado))) return
    const t = setInterval(() => void cargar(), 8000)
    return () => clearInterval(t)
  }, [d, cargar])
  const crear = async () => {
    setNota("")
    try {
      await apiFab({ accion: "crear", ...f, tema_visual: f.tema_visual || undefined })
      setNota("Listo: la Fábrica está escribiendo y produciendo tu paquete. Tarda unos minutos; aquí abajo verás el avance.")
      setF({ ...f, guion: "", tema: "" })
      void cargar()
    } catch (e) {
      setNota((e as Error).message)
    }
  }
  const palabras = f.guion.trim() ? f.guion.trim().split(/\s+/).length : 0
  const subirArchivo = async (archivo: File) => subirImagen(archivo)
  return (
    <div>
      {!d?.ffmpeg && d && <p style={{ ...caja, color: C.rojo, fontSize: 13 }}>Falta FFmpeg en el servidor: los cortos de video no se pueden producir. En el VPS corre: apt-get install -y ffmpeg</p>}
      {d && (
        <p style={{ fontSize: 12, color: d.runpod?.configurado ? (d.runpod.ok ? C.verde : "#8A5A00") : C.tenue, margin: "0 0 10px" }}>
          {d.runpod?.configurado
            ? d.runpod.ok ? "✓ RunPod conectado: voz, imágenes con IA, video largo y tus videos están activos (la GPU se prende sólo cuando hay trabajo)." : "RunPod configurado pero no respondió; revisa el endpoint."
            : "RunPod sin configurar: la Fábrica funciona sin voz, sin imágenes con IA y sin video largo. Ver infra/fabrica-ia/README.md."}
        </p>
      )}
      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Del guion a todas las redes</h3>
        <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 8px" }}>
          Pega tu guion (o escribe sólo el tema) y la Fábrica hace: 5 cortos verticales con música, un carrusel, la publicación de cada red con su tarjeta, el título, descripción, capítulos, guion y miniatura del video largo de YouTube, y un artículo para Aprendizaje CNC. Todo queda como borrador en la semana para que lo revises.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <textarea style={{ ...campo, minHeight: 160 }} placeholder="Guion: lo que quieres explicar o contar. Ej. 5 errores al pedir corte láser y cómo evitarlos…" value={f.guion} onChange={(e) => setF({ ...f, guion: e.target.value })} />
          <span style={{ fontSize: 12, color: C.tenue }}>
            {palabras} palabras{palabras ? ` · el video largo duraría unos ${Math.max(1, Math.round(palabras / 145))} min` : ""} (un video de 8 min necesita unas 1,150 palabras)
          </span>
          <input style={campo} placeholder="…o sólo el tema (si no tienes guion)" value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
            <label>Público{" "}
              <select style={{ ...campo, width: "auto", padding: 5 }} value={f.publico} onChange={(e) => setF({ ...f, publico: e.target.value })}>
                <option value="clientes">Clientes y makers</option>
                <option value="empresas">Empresas</option>
                <option value="talleres">Talleres</option>
                <option value="proveedores">Proveedores</option>
              </select>
            </label>
            <label>Mercado{" "}
              <select style={{ ...campo, width: "auto", padding: 5 }} value={f.mercado} onChange={(e) => setF({ ...f, mercado: e.target.value })}>
                <option value="mx">México</option><option value="us">Estados Unidos</option><option value="co">Colombia</option><option value="cl">Chile</option><option value="pe">Perú</option><option value="ar">Argentina</option><option value="br">Brasil</option>
              </select>
            </label>
            <label>Fondo{" "}
              <select style={{ ...campo, width: "auto", padding: 5 }} value={f.tema_visual} onChange={(e) => setF({ ...f, tema_visual: e.target.value })}>
                <option value="">Que lo elija la IA</option>
                {(d?.temas || []).map((t) => <option key={t} value={t}>{NOMBRE_TEMA[t] || t}</option>)}
              </select>
            </label>
            <label>Voz{" "}
              <select style={{ ...campo, width: "auto", padding: 5 }} value={f.voz} onChange={(e) => setF({ ...f, voz: e.target.value })}>
                <option value="hombre">Hombre</option><option value="mujer">Mujer</option><option value="ninguna">Sin voz</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={f.ia_escenas} onChange={(e) => setF({ ...f, ia_escenas: e.target.checked })} /> Imágenes con IA en el video largo
            </label>
            <button type="button" style={boton("primario")} disabled={!f.guion.trim() && !f.tema.trim()} onClick={() => void crear()}>Producir paquete</button>
          </div>
          {nota && <p style={{ fontSize: 13, margin: 0 }}>{nota}</p>}
        </div>
      </section>

      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>🎥 Sube tu video grabado</h3>
        <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 8px" }}>
          Hasta 95 MB (MP4, MOV o WebM). La IA lo transcribe, te devuelve el video completo con subtítulos y saca los 5 mejores momentos como cortos verticales con gancho y subtítulos, cada uno con su texto por red. Usa el público, mercado y voz de arriba.
        </p>
        <label style={{ ...boton("normal"), fontWeight: 600, display: "inline-block" }}>
          {subiendo !== null ? `Subiendo… ${subiendo}%` : "+ Elegir video"}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            style={{ display: "none" }}
            disabled={subiendo !== null}
            onChange={(e) => {
              const a = e.target.files?.[0]
              if (!a) return
              if (a.size > 95 * 1024 * 1024) return setNota("El video pesa más de 95 MB: recórtalo o bájale la calidad.")
              const fd = new FormData()
              fd.append("archivo", a)
              fd.append("mercado", f.mercado)
              fd.append("publico", f.publico)
              fd.append("voz", f.voz)
              const xhr = new XMLHttpRequest()
              xhr.open("POST", "/admin/hetna-fabrica/video")
              xhr.withCredentials = true
              const h = cabeceras()
              if (h.authorization) xhr.setRequestHeader("authorization", h.authorization)
              xhr.upload.onprogress = (ev) => ev.lengthComputable && setSubiendo(Math.round((ev.loaded / ev.total) * 100))
              xhr.onload = () => {
                setSubiendo(null)
                let j: any = {}
                try { j = JSON.parse(xhr.responseText) } catch {}
                setNota(xhr.status < 300 ? "Video recibido: la Fábrica lo está transcribiendo y cortando. Tarda unos minutos." : j.message || `Error ${xhr.status}`)
                void cargar()
              }
              xhr.onerror = () => { setSubiendo(null); setNota("Se cortó la conexión al subir el video.") }
              setSubiendo(0)
              xhr.send(fd)
            }}
          />
        </label>
      </section>

      <FechasEspeciales />

      <section style={caja}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>Paquetes</h3>
          {[["producto", "🛒 Promover un producto"], ["blog", "📚 Promover un artículo"], ["cotizador", "💰 Promover el Cotizador"], ["3d", "🧊 Promover 3D Studio (foto a STL)"], ["cotizador-us", "🇺🇸 Cotizador en inglés"], ["3d-us", "🇺🇸 3D Studio en inglés"], ["herramienta", "🧰 Promover una herramienta"], ["radar", "📡 Radar por estado (para talleres)"], ["talleres", "🏭 Talleres listos (para clientes)"]].map(([tipo, t2]) => (
            <button key={tipo} type="button" style={boton("normal")} onClick={async () => { try { await apiFab({ accion: "promo", tipo: tipo.replace(/-us$/, ""), ...(tipo.endsWith("-us") ? { mercado: "us" } : {}) }); setNota("Haciendo la imagen y el video. En 1 a 10 minutos aparecen en Pendientes (filtra por \"Con video\"). Si no aparece nada, todavía no hay datos suficientes (mínimo 3 solicitudes o talleres) o ya se promovió hace poco."); } catch (e) { setNota((e as Error).message) } }}>{t2}</button>
          ))}
          <button type="button" style={boton("normal")} onClick={async () => { try { const x = await apiFab<any>({ accion: "semanales" }); setNota(x.creadas?.length ? `Creadas: ${x.creadas.join(", ")}.` : "No hubo piezas semanales nuevas (faltan evaluaciones, reseñas o cotizaciones suficientes)."); alCambiar() } catch (e) { setNota((e as Error).message) } }}>Generar piezas semanales ahora</button>
          <button type="button" style={boton("normal")} onClick={() => setVerBib(!verBib)}>{verBib ? "Cerrar biblioteca" : "🎵 Biblioteca de fondos y música"}</button>
        </div>
        {(d?.trabajos || []).length === 0 && <p style={{ color: C.tenue, fontSize: 13 }}>Todavía no hay paquetes.</p>}
        {(d?.trabajos || []).map((t) => {
          const [txt, col] = ESTADO_TRABAJO[t.estado] || [t.estado, C.tenue]
          const pz = t.piezas || {}
          return (
            <div key={t.id} style={{ borderTop: `1px solid ${C.borde}`, padding: "10px 0", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ color: col, fontSize: 12 }}>{txt}</b>
                <b style={{ flex: 1 }}>{t.titulo || t.entrada?.tema || (t.entrada?.guion || "").slice(0, 80)}</b>
                <span style={{ fontSize: 12, color: C.tenue }}>{fecha(t.created_at)}</span>
                {t.estado === "listo" && <button type="button" style={{ ...boton("normal"), padding: "3px 10px" }} onClick={() => irA("pendientes")}>Revisar borradores →</button>}
                {["error", "listo"].includes(t.estado) && <button type="button" style={{ ...boton("normal"), padding: "3px 10px" }} onClick={async () => { await apiFab({ accion: "reintentar", id: t.id }); void cargar() }}>{t.estado === "error" ? "Reintentar" : "Producir de nuevo"}</button>}
              </div>
              {t.error && <span style={{ color: C.rojo, fontSize: 12 }}>{t.error}</span>}
              {pz.aviso && <span style={{ color: "#8A5A00", fontSize: 12 }}>{pz.aviso}</span>}
              {(pz.cortos?.length || pz.carrusel?.length) ? (
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {(pz.cortos || []).map((c: any) => <video key={c.url} src={c.url} controls preload="metadata" style={{ height: 180, borderRadius: 6, background: "#000" }} />)}
                  {(pz.carrusel || []).map((u: string) => <img key={u} src={u} alt="" style={{ height: 180, borderRadius: 6 }} />)}
                  {pz.miniatura && <img src={pz.miniatura} alt="" style={{ height: 120, borderRadius: 6, alignSelf: "center" }} />}
                </div>
              ) : null}
              {pz.articulo && <span style={{ fontSize: 12, color: C.tenue }}>Artículo guardado como borrador en Aprendizaje CNC.</span>}
              {(pz.aviso_voz || pz.aviso_largo) && <span style={{ color: "#8A5A00", fontSize: 12 }}>{[pz.aviso_voz, pz.aviso_largo].filter(Boolean).join(" ")}</span>}
              {(pz.largo?.clave || pz.completo) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[pz.largo?.clave && ["Descargar video largo", pz.largo.clave], pz.completo && ["Descargar tu video con subtítulos", pz.completo]].filter(Boolean).map(([t2, clave]: any) => (
                    <button key={clave} type="button" style={{ ...boton("normal"), padding: "3px 10px" }} onClick={async () => { try { const x = await apiFab<any>({ accion: "descargar", clave }); window.open(x.url, "_blank") } catch (er) { setNota((er as Error).message) } }}>
                      ⬇ {t2}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>

      {verBib && d && (
        <section style={caja}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Fondos por tema</h3>
          <p style={{ color: C.tenue, fontSize: 12, margin: "0 0 8px" }}>
            Fotos reales (tuyas, de talleres con permiso, o de bancos gratuitos con licencia comercial como Pexels o Pixabay) o imágenes de IA. Si un tema no tiene fotos, se usa una escena dibujada. Anota de dónde salió y su licencia.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select style={{ ...campo, width: "auto", padding: 5 }} value={fondo.tema} onChange={(e) => setFondo({ ...fondo, tema: e.target.value })}>
              {d.temas.map((t) => <option key={t} value={t}>{NOMBRE_TEMA[t] || t}</option>)}
            </select>
            <input style={{ ...campo, width: 180, padding: 5 }} placeholder="Fuente (ej. Pexels, taller X)" value={fondo.fuente} onChange={(e) => setFondo({ ...fondo, fuente: e.target.value })} />
            <input style={{ ...campo, width: 220, padding: 5 }} placeholder="Liga de la licencia (opcional)" value={fondo.licencia} onChange={(e) => setFondo({ ...fondo, licencia: e.target.value })} />
            {d.runpod?.configurado && (
              <button type="button" style={boton("normal")} onClick={async () => { try { await apiFab({ accion: "fondos_ia", tema: fondo.tema, cantidad: 4 }); setNota(`Generando 4 fondos de "${NOMBRE_TEMA[fondo.tema] || fondo.tema}" con IA. Aparecen aquí en unos minutos (recarga la pestaña).`) } catch (er) { setNota((er as Error).message) } }}>
                ✨ Generar 4 con IA
              </button>
            )}
            <label style={{ ...boton("normal"), fontWeight: 600 }}>
              + Subir foto
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={async (e) => { const a = e.target.files?.[0]; if (!a) return; try { const url = await subirArchivo(a); await apiFab({ accion: "fondo", ...fondo, url }); void cargar() } catch (er) { setNota((er as Error).message) } }} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {d.fondos.map((x) => (
              <div key={x.id} style={{ position: "relative" }}>
                <img src={x.url} alt="" title={`${NOMBRE_TEMA[x.tema] || x.tema}${x.fuente ? ` · ${x.fuente}` : ""}`} style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 6 }} />
                <span style={{ position: "absolute", left: 4, bottom: 4, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 10, padding: "1px 5px", borderRadius: 4 }}>{NOMBRE_TEMA[x.tema] || x.tema}</span>
                <button type="button" title="Quitar" onClick={async () => { await apiFab({ accion: "borrar_fondo", id: x.id }); void cargar() }} style={{ position: "absolute", top: 2, right: 2, border: 0, borderRadius: 99, cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>

          <h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>Música</h3>
          <p style={{ color: C.tenue, fontSize: 12, margin: "0 0 8px" }}>
            Sólo pistas con licencia para uso comercial en redes (por ejemplo, Pixabay Music). Pon la liga de la licencia: es tu comprobante si alguien reclama.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ ...campo, width: 180, padding: 5 }} placeholder="Título de la pista" value={mus.titulo} onChange={(e) => setMus({ ...mus, titulo: e.target.value })} />
            <input style={{ ...campo, width: 140, padding: 5 }} placeholder="Estilo (ej. energética)" value={mus.estilo} onChange={(e) => setMus({ ...mus, estilo: e.target.value })} />
            <input style={{ ...campo, width: 240, padding: 5 }} placeholder="Liga de la licencia" value={mus.licencia} onChange={(e) => setMus({ ...mus, licencia: e.target.value })} />
            <label style={{ ...boton("normal"), fontWeight: 600 }}>
              + Subir audio (MP3)
              <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/mp4" style={{ display: "none" }} onChange={async (e) => { const a = e.target.files?.[0]; if (!a) return; try { const url = await subirArchivo(a); await apiFab({ accion: "musica", ...mus, url }); setMus({ titulo: "", estilo: "", licencia: "" }); void cargar() } catch (er) { setNota((er as Error).message) } }} />
            </label>
          </div>
          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
            {d.musica.map((m) => (
              <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
                <b>{m.titulo}</b>
                <span style={{ color: C.tenue }}>{m.estilo}</span>
                <audio src={m.url} controls preload="none" style={{ height: 30 }} />
                {m.licencia && <a href={m.licencia} target="_blank" rel="noreferrer" style={{ color: C.naranja, fontSize: 12 }}>licencia ↗</a>}
                <button type="button" style={{ ...boton("normal"), padding: "2px 8px", fontSize: 12 }} onClick={async () => { await apiFab({ accion: "borrar_musica", id: m.id }); void cargar() }}>Quitar</button>
              </div>
            ))}
            {d.musica.length === 0 && <span style={{ color: C.tenue, fontSize: 12 }}>Sin música todavía: los cortos saldrán sin música hasta que subas pistas.</span>}
          </div>
        </section>
      )}
    </div>
  )
}

async function apiCamp<T>(cuerpo?: unknown): Promise<T> {
  const r = await fetch("/admin/hetna-campanas", {
    credentials: "include",
    ...(cuerpo === undefined ? { headers: cabeceras() } : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
  })
  const d = (await r.json().catch(() => ({}))) as any
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d as T
}

/** Motor de campañas de anuncios: Google, Meta y TikTok. */
function CampanasAds() {
  const [d, setD] = useState<any>(null)
  const [f, setF] = useState<any>({ que: "cotizador", objetivo: "registros", zona: "Todo México", diario: 100, dias: 7, plataformas: ["meta", "google", "tiktok"] })
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const cargar = useCallback(async () => setD(await apiCamp<any>().catch((e) => ({ error: (e as Error).message }))), [])
  useEffect(() => { void cargar() }, [cargar])
  // Mientras haya una generándose, se actualiza cada 10 s
  useEffect(() => {
    if (!d?.campanas?.some((c: any) => c.estado === "generando")) return
    const t = setTimeout(() => void cargar(), 10_000)
    return () => clearTimeout(t)
  }, [d, cargar])
  if (!d) return <p>Cargando…</p>
  if (d.error) return <p style={{ color: C.rojo }}>{d.error}</p>
  const op = d.opciones
  const pesos = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString("es-MX")
  const NOMBRE_PLAT: Record<string, string> = { meta: "Meta (Facebook e Instagram)", google: "Google Ads (búsqueda)", tiktok: "TikTok Ads" }
  const hacer = async (cuerpo: any, msj: string, clave: string) => {
    setOcupado(clave)
    try {
      const r = await apiCamp<any>(cuerpo)
      if (cuerpo.accion === "csv_google") {
        const url = URL.createObjectURL(new Blob(["﻿" + r.csv], { type: "text/csv;charset=utf-8" }))
        const a = document.createElement("a")
        a.href = url
        a.download = r.nombre
        a.click()
        URL.revokeObjectURL(url)
      }
      if (cuerpo.accion === "meta" && r.administrador) window.open(r.administrador, "_blank", "noopener")
      setNota({ ok: true, t: msj })
      void cargar()
    } catch (e) {
      setNota({ ok: false, t: `✗ ${(e as Error).message}` })
    } finally {
      setOcupado(null)
    }
  }
  const copiar = (t: string) => { void navigator.clipboard?.writeText(t); setNota({ ok: true, t: "✓ Copiado" }) }
  const campo: CSSProperties = { padding: "6px 8px", border: `1px solid ${C.borde}`, borderRadius: 6, fontSize: 13 }
  return (
    <div>
      <section style={caja}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>🚀 Campañas Ads: el motor arma tu campaña completa</h3>
        <p style={{ margin: "0 0 10px", color: C.tenue, fontSize: 13 }}>
          Escoge qué vender y el motor arma públicos, palabras clave, 3 versiones de textos e imágenes con el estilo de HETNA, con los datos reales de tu sistema.
          Meta se crea en tu cuenta <b>en pausa</b> (tú la activas); Google sale como archivo para Google Ads Editor y TikTok listo para copiar en TikTok Ads Manager. No se gasta nada hasta que tú lo actives.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", fontSize: 13 }}>
          <label>Qué vender<br /><select style={{ ...campo, width: "100%" }} value={f.que} onChange={(e) => setF({ ...f, que: e.target.value })}>{Object.entries(op.que).map(([k, v]: any) => <option key={k} value={k}>{v.nombre}</option>)}</select></label>
          <label>Objetivo<br /><select style={{ ...campo, width: "100%" }} value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })}>{op.objetivos.map((o: string) => <option key={o} value={o}>{{ clics: "Visitas (clics)", registros: "Registros", ventas: "Ventas" }[o] || o}</option>)}</select></label>
          <label>Zona<br /><input style={{ ...campo, width: "100%" }} value={f.zona} onChange={(e) => setF({ ...f, zona: e.target.value })} placeholder="Todo México, Jalisco, CDMX…" /></label>
          <label>Presupuesto por día (MXN)<br /><input type="number" min={20} style={{ ...campo, width: "100%" }} value={f.diario} onChange={(e) => setF({ ...f, diario: Number(e.target.value) })} /></label>
          <label>Días<br /><input type="number" min={3} max={30} style={{ ...campo, width: "100%" }} value={f.dias} onChange={(e) => setF({ ...f, dias: Number(e.target.value) })} /></label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 10, fontSize: 13 }}>
          {op.plataformas.map((p: string) => (
            <label key={p} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={f.plataformas.includes(p)} onChange={(e) => setF({ ...f, plataformas: e.target.checked ? [...f.plataformas, p] : f.plataformas.filter((x: string) => x !== p) })} /> {NOMBRE_PLAT[p]}
            </label>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ color: C.tenue }}>Total máx.: {pesos(f.diario * f.dias)} por plataforma</span>
          <button type="button" style={boton("primario")} disabled={!!ocupado || !f.plataformas.length} onClick={() => void hacer({ accion: "generar", ...f }, "✓ Armando la campaña (1 o 2 minutos). Aparece abajo en cuanto esté.", "generar")}>{ocupado === "generar" ? "Enviando…" : "Generar campaña"}</button>
        </div>
        {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 8 }}>{nota.t}</div>}
      </section>

      {(d.campanas || []).map((c: any) => {
        const p = c.plan
        const abiertaEsta = abierta === c.id
        const r = c.resultados || {}
        return (
          <section key={c.id} style={caja}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ fontSize: 12, color: c.estado === "error" ? C.rojo : c.estado === "generando" ? "#8A5A00" : c.estado === "creada_meta" ? C.verde : C.tenue }}>
                {{ generando: "Armando…", lista: "Lista", creada_meta: "Creada en Meta (en pausa)", error: "Error" }[c.estado as string] || c.estado}
              </b>
              <b style={{ flex: 1 }}>{c.nombre}</b>
              <span style={{ color: C.tenue, fontSize: 12 }}>{pesos(c.diario)}/día · {c.dias} días · {c.zona}</span>
              {p && <button type="button" style={boton("normal")} onClick={() => setAbierta(abiertaEsta ? null : c.id)}>{abiertaEsta ? "Cerrar" : "Ver campaña"}</button>}
              {c.estado !== "creada_meta" && <button type="button" style={boton("normal")} disabled={!!ocupado} onClick={() => { if (confirm("¿Borrar esta campaña?")) void hacer({ accion: "borrar", id: c.id }, "Campaña borrada", "b" + c.id) }}>Borrar</button>}
            </div>
            {c.error && <div style={{ color: C.rojo, fontSize: 12, marginTop: 4 }}>{c.error}</div>}
            {Object.keys(r).length > 0 && (
              <div style={{ fontSize: 12, color: C.tenue, marginTop: 4 }}>
                {Object.entries(r).map(([pl, x]: any) => `${NOMBRE_PLAT[pl] || pl}: ${x.clics} clics${x.registro_cliente ? `, ${x.registro_cliente} registros` : ""}${x.prueba_cotizador ? `, ${x.prueba_cotizador} pruebas` : ""}${x.pago_cotizador || x.compra_creditos || x.venta ? `, ${(x.pago_cotizador || 0) + (x.compra_creditos || 0) + (x.venta || 0)} pagos` : ""}`).join(" · ")}
              </div>
            )}
            {abiertaEsta && p && (
              <div style={{ display: "grid", gap: 12, marginTop: 10, fontSize: 13 }}>
                <div><b>Estrategia:</b> {p.resumen}<br /><b>A quién:</b> {p.publico}</div>
                {(c.creativos || []).length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.creativos.map((x: any) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer"><img src={x.url} alt={x.titulo} style={{ height: 160, borderRadius: 8, border: `1px solid ${C.borde}` }} /></a>)}
                  </div>
                )}
                {c.plataformas.includes("meta") && (
                  <div style={{ borderTop: `1px solid ${C.borde}`, paddingTop: 8 }}>
                    <b>Meta</b> · edad {p.meta.edad_min}–{p.meta.edad_max} · intereses: {p.meta.intereses.join(", ") || "—"} · botón {p.meta.cta}
                    {p.meta.textos.map((t: any, i: number) => (
                      <div key={i} style={{ background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 8, padding: 8, marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: C.tenue }}>Versión {i + 1}</div>
                        <div>{t.principal}</div><b>{t.titulo}</b> <span style={{ color: C.tenue }}>{t.descripcion}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {c.meta?.campana ? (
                        <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${d.cuenta_meta}&selected_campaign_ids=${c.meta.campana}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>Abrir en el Administrador de anuncios →</a>
                      ) : (
                        <button type="button" style={boton("primario")} disabled={!!ocupado || !d.meta_listo} onClick={() => { if (confirm(`Se crea en tu cuenta de Meta EN PAUSA (no gasta hasta que la actives). Máximo ${pesos(c.diario * c.dias)}. ¿Crear?`)) void hacer({ accion: "meta", id: c.id }, "✓ Creada en Meta en pausa. Revísala y actívala en el Administrador de anuncios.", "m" + c.id) }}>{ocupado === "m" + c.id ? "Creando…" : "Crear en Meta (en pausa)"}</button>
                      )}
                      {!d.meta_listo && <span style={{ color: C.tenue, fontSize: 12 }}>Falta el token o la cuenta en Resultados → Anuncios en Meta.</span>}
                    </div>
                  </div>
                )}
                {c.plataformas.includes("google") && (
                  <div style={{ borderTop: `1px solid ${C.borde}`, paddingTop: 8 }}>
                    <b>Google Ads</b> · {p.google.grupos.length} grupos · negativas: {p.google.negativas.slice(0, 12).join(", ") || "—"}
                    {p.google.grupos.map((g: any, i: number) => (
                      <div key={i} style={{ background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 8, padding: 8, marginTop: 6 }}>
                        <b>{g.nombre}</b>
                        <div style={{ fontSize: 12 }}><b>Palabras:</b> {g.palabras.join(" · ")}</div>
                        <div style={{ fontSize: 12 }}><b>Títulos:</b> {g.titulos.join(" | ")}</div>
                        <div style={{ fontSize: 12 }}><b>Descripciones:</b> {g.descripciones.join(" | ")}</div>
                      </div>
                    ))}
                    <button type="button" style={{ ...boton("primario"), marginTop: 6 }} disabled={!!ocupado} onClick={() => void hacer({ accion: "csv_google", id: c.id }, "✓ Archivo descargado. Ábrelo en Google Ads Editor: Cuenta → Importar → Desde archivo. Queda en pausa.", "g" + c.id)}>Descargar para Google Ads Editor</button>
                  </div>
                )}
                {c.plataformas.includes("tiktok") && (
                  <div style={{ borderTop: `1px solid ${C.borde}`, paddingTop: 8 }}>
                    <b>TikTok Ads</b> · edad {p.tiktok.edad_min}–{p.tiktok.edad_max} · intereses: {p.tiktok.intereses.join(", ") || "—"} · botón "{p.tiktok.cta}"
                    {p.tiktok.textos.map((t: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 8, padding: 8, marginTop: 6 }}>
                        <span style={{ flex: 1 }}>{t}</span>
                        <button type="button" style={boton("normal")} onClick={() => copiar(t)}>Copiar</button>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: C.tenue, marginTop: 6 }}>
                      En TikTok Ads Manager: crea la campaña con objetivo de tráfico, usa las imágenes verticales (9:16) de arriba o un video de la Fábrica, pega un texto y pon esta liga: {c.ligas?.tiktok}
                      <button type="button" style={{ ...boton("normal"), marginLeft: 6 }} onClick={() => copiar(c.ligas?.tiktok || "")}>Copiar liga</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

const VISTAS = [
  ["referencias", "Referencias"],
  ["fabrica", "Fábrica"],
  ["estrategia", "Estrategia"],
  ["radar", "Radar"],
  ["pendientes", "Pendientes"],
  ["videos", "Videos de talleres"],
  ["calendario", "Calendario"],
  ["publicada", "Publicadas"],
  ["conversaciones", "Conversaciones"],
  ["resultados", "Resultados"],
  ["campanas", "Campañas Ads"],
  ["config", "Configuración"],
] as const

export default function SocialHubPage() {
  const [vista, setVista] = useState<(typeof VISTAS)[number][0]>("pendientes")
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  // Filtros de las listas: red social, mercado y material (imagen/video)
  const [fRed, setFRed] = useState("")
  const [fMercado, setFMercado] = useState("")
  const [fMaterial, setFMaterial] = useState("")
  const pasa = useCallback(
    (p: Pub) => {
      if (fRed && !(p.redes || []).includes(fRed)) return false
      if (fMercado && (p.mercado || "mx") !== fMercado) return false
      if (fMaterial) {
        const m = ((p as any).medios || []) as { url: string; tipo?: string }[]
        const video = m.some((x) => x.tipo === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(x.url))
        const tipo = video ? "video" : m.length > 1 ? "carrusel" : m.length ? "imagen" : "sin"
        if (tipo !== fMaterial) return false
      }
      return true
    },
    [fRed, fMercado, fMaterial]
  )
  const cargar = useCallback(async () => {
    try {
      setDatos(await api<Datos>(""))
      setError("")
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const lista = useMemo(() => {
    const ps = (datos?.publicaciones || []).filter(pasa)
    if (vista === "pendientes") return ps.filter((p) => ["borrador", "error", "parcial"].includes(p.estado))
    if (vista === "publicada") return ps.filter((p) => p.estado === "publicada")
    return []
  }, [datos, vista, pasa])
  const calendario = useMemo(() => {
    const ps = (datos?.publicaciones || []).filter((p) => p.estado === "programada" && pasa(p)).sort((a, b) => String(a.programada_para).localeCompare(String(b.programada_para)))
    const dias: Record<string, Pub[]> = {}
    for (const p of ps) {
      const d = p.programada_para ? new Date(p.programada_para).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) : "Sin fecha"
      ;(dias[d] ||= []).push(p)
    }
    return Object.entries(dias)
  }, [datos, pasa])

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto", color: C.texto }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Social Hub</h1>
      <p style={{ color: C.tenue, fontSize: 14, margin: "4px 0 16px" }}>
        Crea, programa y mide tus publicaciones en redes desde un solo lugar. Lo que pasa en HETNA (licitaciones autorizadas, talleres nuevos, productos y temas del foro) llega aquí solo.
      </p>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {VISTAS.map(([v, t]) => {
          const n =
            v === "pendientes"
              ? (datos?.publicaciones || []).filter((p) => ["borrador", "error", "parcial"].includes(p.estado)).length
              : v === "calendario"
                ? (datos?.publicaciones || []).filter((p) => p.estado === "programada").length
                : 0
          return (
            <button key={v} type="button" onClick={() => setVista(v)} style={{ ...boton("normal"), background: vista === v ? "#142033" : C.fondo, color: vista === v ? "#fff" : C.texto }}>
              {t}
              {n ? ` (${n})` : ""}
            </button>
          )
        })}
      </div>
      {!datos ? (
        !error && <p>Cargando…</p>
      ) : vista === "fabrica" ? (
        <Fabrica alCambiar={() => void cargar()} irA={(v) => setVista(v as any)} />
      ) : vista === "radar" ? (
        <Radar alCambiar={() => void cargar()} />
      ) : vista === "estrategia" ? (
        <Estrategia alCambiar={() => void cargar()} irA={(v) => setVista(v as any)} />
      ) : vista === "videos" ? (
        <VideosTalleres redes={datos.redes} config={datos.config} alCambiar={() => void cargar()} />
      ) : vista === "referencias" ? (
        <Referencias />
      ) : vista === "conversaciones" ? (
        <Conversaciones />
      ) : vista === "resultados" ? (
        <Resultados />
      ) : vista === "campanas" ? (
        <CampanasAds />
      ) : vista === "config" ? (
        <Configuracion datos={datos} alGuardar={() => void cargar()} />
      ) : (
        <>
          {vista === "pendientes" && <Nueva redes={datos.redes} config={datos.config} mercados={datos.mercados} alCrear={() => void cargar()} />}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "10px 0" }}>
            <b style={{ fontSize: 13 }}>Filtrar:</b>
            {[["", "Todas"], ...datos.redes.filter((r) => (datos.publicaciones || []).some((p) => (p.redes || []).includes(r.clave))).map((r) => [r.clave, r.nombre])].map(([clave, nom]) => {
              const n = clave ? (datos.publicaciones || []).filter((p) => (p.redes || []).includes(clave) && (vista === "calendario" ? p.estado === "programada" : vista === "publicada" ? p.estado === "publicada" : ["borrador", "error", "parcial"].includes(p.estado))).length : 0
              return (
                <button key={clave || "todas"} type="button" onClick={() => setFRed(clave)} style={{ ...boton("normal"), padding: "3px 10px", fontSize: 12, background: fRed === clave ? "#142033" : C.fondo, color: fRed === clave ? "#fff" : C.texto }}>
                  {nom}{clave ? ` (${n})` : ""}
                </button>
              )
            })}
            <select style={{ ...campo, width: "auto", padding: 4, fontSize: 12 }} value={fMercado} onChange={(e) => setFMercado(e.target.value)}>
              <option value="">Todos los países</option>
              {(datos.mercados || []).map((m) => <option key={m.clave} value={m.clave}>{m.nombre}</option>)}
            </select>
            <select style={{ ...campo, width: "auto", padding: 4, fontSize: 12 }} value={fMaterial} onChange={(e) => setFMaterial(e.target.value)}>
              <option value="">Con o sin material</option>
              <option value="video">🎬 Con video</option>
              <option value="carrusel">🖼️ Carrusel</option>
              <option value="imagen">🖼 Con imagen</option>
              <option value="sin">⚠ Sin imagen ni video</option>
            </select>
          </div>
          {vista === "calendario" ? (
            calendario.length === 0 ? (
              <p style={{ color: C.tenue }}>No hay publicaciones programadas.</p>
            ) : (
              calendario.map(([dia, ps]) => (
                <div key={dia}>
                  <h3 style={{ fontSize: 14, textTransform: "capitalize", margin: "16px 0 6px" }}>{dia}</h3>
                  {ps.map((p) => (
                    <Tarjeta key={p.id} p={p} redes={datos.redes} alCambiar={() => void cargar()} />
                  ))}
                </div>
              ))
            )
          ) : lista.length === 0 ? (
            <p style={{ color: C.tenue }}>{vista === "pendientes" ? "Nada pendiente: todo lo automático está saliendo solo." : "Todavía no hay publicaciones."}</p>
          ) : (
            lista.map((p) => <Tarjeta key={p.id} p={p} redes={datos.redes} alCambiar={() => void cargar()} />)
          )}
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Social Hub",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  ),
}
