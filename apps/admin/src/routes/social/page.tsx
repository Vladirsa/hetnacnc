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
}
type Config = { redes: string[]; automatico: Record<string, boolean>; horario: { desde: number; hasta: number }; retraso_min: number }
type Datos = { publicaciones: Pub[]; redes: RedInfo[]; config: Config; n8n: boolean }

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
const ORIGEN: Record<string, string> = { manual: "Manual", licitacion: "Licitación", taller: "Taller nuevo", producto: "Producto", foro: "Foro" }
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

function Nueva({ redes, config, alCrear }: { redes: RedInfo[]; config: Config; alCrear: () => void }) {
  const [f, setF] = useState({ titulo: "", texto_base: "", url: "https://hetnacnc.com/mx", programada_para: "" })
  const [sel, setSel] = useState<string[]>(config.redes)
  const [img, setImg] = useState("")
  const [nota, setNota] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const crear = async () => {
    setOcupado(true)
    setNota("")
    try {
      await api("", { ...f, redes: sel, medios: img ? [{ url: img }] : [], programada_para: f.programada_para ? new Date(f.programada_para).toISOString() : null })
      setF({ titulo: "", texto_base: "", url: "https://hetnacnc.com/mx", programada_para: "" })
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
          {p.medios?.[0]?.url && <img src={p.medios[0].url} alt="" style={{ maxWidth: 220, borderRadius: 8 }} />}
          <Chips redes={sel} todas={redes} alCambiar={setSel} />
          {sel.map((red) => {
            const r = p.resultado?.[red]
            const final = (textos[red] || "").replace("{{liga}}", ligaDe(red) || "{{liga}}")
            return (
              <div key={red} style={{ background: C.suave, borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <b style={{ fontSize: 13 }}>{nombre(red)}</b>
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

const VISTAS = [
  ["pendientes", "Pendientes"],
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
      ) : vista === "resultados" ? (
        <Resultados />
      ) : vista === "config" ? (
        <Configuracion datos={datos} alGuardar={() => void cargar()} />
      ) : (
        <>
          {vista === "pendientes" && <Nueva redes={datos.redes} config={datos.config} alCrear={() => void cargar()} />}
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
