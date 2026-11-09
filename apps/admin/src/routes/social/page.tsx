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
  resultado: Record<string, { ok: boolean; manual?: boolean; error?: string; url?: string }> | null
  adaptada_ia: boolean
  created_at: string
  ligas: Liga[]
  mercado?: string | null
  notas?: string | null
  puntajes?: Record<string, { puntaje: number; revisiones: { ok: boolean; texto: string; consejo?: string }[] }>
}
type Config = { redes: string[]; automatico: Record<string, boolean>; horario: { desde: number; hasta: number }; retraso_min: number }
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
const ORIGEN: Record<string, string> = { manual: "Manual", licitacion: "Licitación", taller: "Taller nuevo", producto: "Producto", foro: "Foro", taller_video: "Video de taller" }
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
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    setTextos(p.textos || {})
    setSel(p.redes)
  }, [p.id, p.textos, p.redes])
  const nombre = (c: string) => redes.find((r) => r.clave === c)?.nombre || c
  const auto = (c: string) => !!redes.find((r) => r.clave === c)?.auto
  const ligaDe = (red: string) => p.ligas.find((l) => l.red === red && !l.grupo)?.url
  const hacer = async (cuerpo: Record<string, unknown>, ok: string) => {
    setOcupado(true)
    setNota("")
    try {
      await api(`/${p.id}`, cuerpo)
      setNota(ok)
      alCambiar()
    } catch (e) {
      setNota((e as Error).message)
    } finally {
      setOcupado(false)
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
          {p.mercado && p.mercado !== "mx" && <span style={{ fontSize: 12, color: C.tenue }}>🌎 Mercado: {p.mercado.toUpperCase()} (las cuentas de este mercado se manejan a mano)</span>}
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
              <div key={red} style={{ background: C.suave, borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <b style={{ fontSize: 13 }}>{nombre(red)}</b>
                  {p.puntajes?.[red] && <Puntaje p={p.puntajes[red]} />}
                  {!auto(red) && <span style={{ fontSize: 12, color: C.tenue }}>✋ copiar y pegar</span>}
                  {r && (r.ok ? <span style={{ fontSize: 12, color: C.verde }}>✓ {r.manual ? "lista para pegar" : "publicada"}</span> : <span style={{ fontSize: 12, color: C.rojo }}>✗ {r.error}</span>)}
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
          {nota && <p style={{ fontSize: 13, margin: 0 }}>{nota}</p>}
        </div>
      )}
    </article>
  )
}

function Resultados() {
  const [dias, setDias] = useState(30)
  const [m, setM] = useState<any>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    api<any>(`/metricas?dias=${dias}`).then(setM).catch((e) => setError((e as Error).message))
  }, [dias])
  if (error) return <p style={{ color: C.rojo }}>{error}</p>
  if (!m) return <p>Cargando…</p>
  const th: CSSProperties = { textAlign: "left", padding: 6, fontSize: 12, color: C.tenue }
  const td: CSSProperties = { padding: 6, borderTop: `1px solid ${C.borde}` }
  return (
    <div>
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
      <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 8px" }}>Activa sólo las que ya estén conectadas en n8n (Facebook y Telegram ya lo están). ✋ = copiar y pegar.</p>
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
          Reparto del esfuerzo (0 = apagado). Cada mercado publica a su hora local y en su idioma. Hoy las cuentas conectadas son las de México: lo de otros mercados queda para copiar y pegar hasta abrir sus cuentas.
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

const VISTAS = [
  ["estrategia", "Estrategia"],
  ["pendientes", "Pendientes"],
  ["videos", "Videos de talleres"],
  ["calendario", "Calendario"],
  ["publicada", "Publicadas"],
  ["resultados", "Resultados"],
  ["config", "Configuración"],
] as const

export default function SocialHubPage() {
  const [vista, setVista] = useState<(typeof VISTAS)[number][0]>("pendientes")
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
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
    const ps = datos?.publicaciones || []
    if (vista === "pendientes") return ps.filter((p) => ["borrador", "error", "parcial"].includes(p.estado))
    if (vista === "publicada") return ps.filter((p) => p.estado === "publicada")
    return []
  }, [datos, vista])
  const calendario = useMemo(() => {
    const ps = (datos?.publicaciones || []).filter((p) => p.estado === "programada").sort((a, b) => String(a.programada_para).localeCompare(String(b.programada_para)))
    const dias: Record<string, Pub[]> = {}
    for (const p of ps) {
      const d = p.programada_para ? new Date(p.programada_para).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) : "Sin fecha"
      ;(dias[d] ||= []).push(p)
    }
    return Object.entries(dias)
  }, [datos])

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
      ) : vista === "estrategia" ? (
        <Estrategia alCambiar={() => void cargar()} irA={(v) => setVista(v as any)} />
      ) : vista === "videos" ? (
        <VideosTalleres redes={datos.redes} config={datos.config} alCambiar={() => void cargar()} />
      ) : vista === "resultados" ? (
        <Resultados />
      ) : vista === "config" ? (
        <Configuracion datos={datos} alGuardar={() => void cargar()} />
      ) : (
        <>
          {vista === "pendientes" && <Nueva redes={datos.redes} config={datos.config} mercados={datos.mercados} alCrear={() => void cargar()} />}
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
