// Página "Social Hub" del dashboard (Licitaciones 3.0, Fase 5A).
// Crear, adaptar por red, programar, publicar y medir publicaciones en redes.
// La lógica vive en packages/api/src/lib/social-hub.ts; publica el flujo de
// n8n "Social Hub - Publicar". Usa la misma sesión del dashboard.
import { useCallback, useEffect, useMemo, useState } from "react"
import { C, api, boton, caja, campo, copiar, fecha, aLocal, cabeceras, ORIGEN, ESTADO, subirImagen } from "../../lib/social/comun"
import type { RedInfo, Pub, Config, Datos } from "../../lib/social/comun"
import { Resultados } from "../../lib/social/resultados"
import { CampanasAds, Estrategia, Fabrica, Puntaje, Radar } from "../../lib/social/estudio"

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
            title={(r as any).nota || (r.auto ? "Se publica sola" : "Copiar y pegar (la red no permite automatizar)")}
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
  const [titulo, setTitulo] = useState(p.titulo)
  const [destino, setDestino] = useState(p.url_destino || "")
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
    setTitulo(p.titulo)
    setDestino(p.url_destino || "")
  }, [p.id, p.textos, p.redes, p.titulo, p.url_destino])
  const nombre = (c: string) => redes.find((r) => r.clave === c)?.nombre || c
  const auto = (c: string) => !!redes.find((r) => r.clave === c)?.auto
  // Ligas creadas desde esta tarjeta (sin recargar la lista, para no perder lo que aún no se guarda)
  const [ligasNuevas, setLigasNuevas] = useState<Record<string, string>>({})
  const ligaDe = (red: string) => p.ligas.find((l) => l.red === red && !l.grupo)?.url || ligasNuevas[red]
  // Copiar antes de publicar: crea (o reusa) la liga medida de esa red, la misma que usará la publicación
  const copiarTexto = async (red: string) => {
    let liga = ligaDe(red)
    try {
      if (!liga) {
        const url = (await api<{ url: string }>(`/${p.id}`, { accion: "liga", red })).url
        liga = url
        setLigasNuevas((m) => ({ ...m, [red]: url }))
      }
      copiar((textos[red] || "").split("{{liga}}").join(liga))
      setNotaOk(true)
      setNota(`Texto de ${nombre(red)} copiado con su liga medida.`)
    } catch (e) {
      setNotaOk(false)
      setNota((e as Error).message)
    }
  }
  // Devuelve si salió bien, para no seguir con el segundo paso (programar o publicar) si el guardado falló
  const hacer = async (cuerpo: Record<string, unknown>, ok: string): Promise<boolean> => {
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
      return true
    } catch (e) {
      setNotaOk(false)
      setNota((e as Error).message)
      return false
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
          <label style={{ fontSize: 12, color: C.tenue, display: "grid", gap: 4 }}>
            Título interno
            <input style={{ ...campo, fontSize: 13 }} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: C.tenue, display: "grid", gap: 4 }}>
            <span>
              Liga de destino (a dónde llevan las ligas medidas){" "}
              {p.url_destino && (
                <a href={p.url_destino} target="_blank" rel="noreferrer" style={{ color: C.naranja }}>
                  abrir ↗
                </a>
              )}
            </span>
            <input style={{ ...campo, fontSize: 13 }} placeholder="https://hetnacnc.com/mx/…" value={destino} onChange={(e) => setDestino(e.target.value)} />
          </label>
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
                  await hacer({ accion: "guardar", titulo, url_destino: destino, textos, redes: sel, medios: [{ url, tipo: a.type.startsWith("video") ? "video" : "imagen" }] }, "Listo, quedó agregado.")
                } catch (er) {
                  setNota((er as Error).message)
                }
              }}
            />
          </label>
          <Chips redes={sel} todas={redes} alCambiar={setSel} />
          {sel.map((red) => {
            const r = p.resultado?.[red]
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
                  <button type="button" style={{ ...boton("normal"), padding: "2px 8px", fontSize: 12 }} onClick={() => void copiarTexto(red)}>
                    Copiar
                  </button>
                </div>
                <textarea style={{ ...campo, minHeight: 80, fontSize: 13 }} value={textos[red] || ""} onChange={(e) => setTextos({ ...textos, [red]: e.target.value })} />
              </div>
            )
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => hacer({ accion: "guardar", titulo, url_destino: destino, textos, redes: sel }, "Guardado.")}>
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
                if (!(await hacer({ accion: "guardar", titulo, url_destino: destino, textos, redes: sel }, ""))) return
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
                if (!(await hacer({ accion: "guardar", titulo, url_destino: destino, textos, redes: sel }, ""))) return
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
      else if (cuerpo.accion === "invitar") setNota({ ok: true, t: d.hoy ? `✓ Invitación iniciada: se están mandando ${d.hoy} correos hoy (${d.talleres} talleres, ${d.clientes} clientes); mañana sigue con los demás.` : "No hay a quién invitar: todos ya verificaron o ya fueron invitados." })
      else if (cuerpo.accion === "bot") setNota({ ok: true, t: cuerpo.activo ? "✓ Agente de ventas encendido" : "Agente de ventas apagado" })
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
      {e?.bot && (
        <label style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 6, fontSize: 13 }}>
          <input type="checkbox" checked={!!e.bot.activo} disabled={ocupado || !e.bot.ia} onChange={(x) => void hacer({ accion: "bot", activo: x.target.checked })} />
          <span>
            <b>Agente de ventas</b>: atiende a quien escribe al WhatsApp como un vendedor: entiende qué busca, recomienda el producto, la cotización o la herramienta que le sirve con su liga y lo lleva a comprar. Sólo con datos reales (no inventa precios). Los clientes calientes y lo que necesita a una persona te llegan por Telegram con el resumen. Si contestas tú desde el celular, se calla 12 h en ese chat.
            {!e.bot.ia && <span style={{ color: C.rojo }}> ({e.bot.ia_motivo || "La IA no está disponible en el servidor"})</span>}
            <span style={{ color: C.tenue }}> · Hoy: {e.bot.respuestas_hoy} respuestas en {e.bot.chats_hoy} chats · {e.bot.calientes_7d ?? 0} clientes calientes (7 días) · {e.bot.pasados} pasados a ti</span>
          </span>
        </label>
      )}
      {e?.invitacion && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap", fontSize: 13 }}>
          <button type="button" style={boton(e.invitacion.activo ? "normal" : "primario")} disabled={ocupado || e.invitacion.activo} onClick={() => void hacer({ accion: "invitar" })}>
            {e.invitacion.activo ? "📨 Invitación en curso" : "📨 Invitar a verificar su WhatsApp"}
          </button>
          <span style={{ color: C.tenue, fontSize: 12 }}>
            Correo + aviso en la plataforma a talleres y clientes registrados (no por WhatsApp). {e.invitacion.lote_dia} al día hasta terminar, una vez por persona. Invitados: {e.invitacion.invitados}{e.invitacion.terminada ? " · terminada" : ""}
          </span>
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
/** Pinterest: conectar la cuenta de HETNA y elegir el tablero donde salen los pines. */
function PinterestConexion() {
  const [e, setE] = useState<any>(null)
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const cargar = () => api<any>("/pinterest").then((x) => { setE(x); setFalla(null) }).catch((er) => setFalla((er as Error).message))
  useEffect(() => { void cargar() }, [])
  if (!e)
    return (
      <div style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 10, marginTop: 8, fontSize: 13 }}>
        <b>📌 Pinterest</b> <span style={{ color: falla ? C.rojo : C.tenue }}>{falla ? `No se pudo leer el estado: ${falla}` : "Cargando…"}</span>
      </div>
    )
  const hacer = async (cuerpo: any) => {
    setOcupado(true)
    try {
      const d = await api<any>("/pinterest", cuerpo)
      if (cuerpo.accion === "conectar" && d.url) {
        window.open(d.url, "_blank", "noopener")
        setNota({ ok: true, t: "Se abrió Pinterest en otra pestaña: entra con la cuenta de HETNA y acepta. Cuando diga \"Pinterest conectado\", regresa aquí y aprieta \"Probar\"." })
      } else if (cuerpo.accion === "probar") setNota(d.ok ? { ok: true, t: `✓ Conectado como ${d.usuario || "tu cuenta"}` } : { ok: false, t: `✗ ${d.error}` })
      else if (cuerpo.accion === "tablero") setNota({ ok: true, t: "✓ Tablero guardado" })
      else setNota({ ok: true, t: "Pinterest desconectado" })
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
        <b>📌 Pinterest</b>
        <span style={{ color: e.conectado ? C.verde : C.tenue, fontWeight: 600 }}>{!e.configurado ? "Faltan las llaves en el servidor" : e.conectado ? `Conectado${e.usuario ? ` (${e.usuario})` : ""}` : "Sin conectar"}</span>
        {e.conectado && (
          <select value={e.tablero || ""} disabled={ocupado} onChange={(x) => void hacer({ accion: "tablero", id: x.target.value })} style={{ padding: "3px 6px", border: `1px solid ${C.borde}`, borderRadius: 6, fontSize: 12 }}>
            <option value="" disabled>Elige el tablero</option>
            {(e.tableros || []).map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        )}
        <span style={{ flex: 1 }} />
        {e.configurado && <button type="button" style={boton(e.conectado ? "normal" : "primario")} disabled={ocupado} onClick={() => void hacer({ accion: "conectar" })}>{e.conectado ? "Volver a conectar" : "Conectar Pinterest"}</button>}
        {e.conectado && <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void hacer({ accion: "probar" })}>Probar</button>}
        {e.conectado && <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void hacer({ accion: "desconectar" })}>Desconectar</button>}
      </div>
      <div style={{ color: C.tenue, fontSize: 12, marginTop: 4 }}>
        Las publicaciones con imagen que lleven Pinterest salen solas como pin en el tablero elegido, con la liga a la tienda. Las de video se quedan para copiar y pegar.
        {!e.configurado && ` Guarda PINTEREST_APP_ID y PINTEREST_APP_SECRET en el .env del backend. URI de redireccionamiento para la app: ${e.redirect}`}
      </div>
      {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 4 }}>{nota.t}</div>}
    </div>
  )
}

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
  // "Por responder" incluye los que quedaron en "nuevo" (sin IA o si la IA falló al clasificarlos)
  const [filtro, setFiltro] = useState("propuesta,nuevo")
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
        {[["propuesta,nuevo", "Por responder"], ["respondido", "Respondidos"], ["ignorado", "Ignorados"], ["error", "Con error"], ["", "Todos"]].map(([v, t]) => (
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
      <PinterestConexion />
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
        <input type="checkbox" checked={c.imagen_pro !== false} onChange={(e) => setC({ ...c, imagen_pro: e.target.checked })} />
        Imágenes pro: foto realista con IA de una persona en un taller con el tema, logo, título grande en blanco y naranja y barra con la web y el WhatsApp (~0.06 USD cada una, máximo 8 al día). Los productos de la tienda siguen con su foto real.
      </label>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={c.imagen_nueva !== false} onChange={(e) => setC({ ...c, imagen_nueva: e.target.checked })} />
        Imágenes con el estilo nuevo (los mismos fondos que los videos animados). Si se apaga o falla, salen con el estilo anterior
      </label>
      <div style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <span>Ritmo: máximo</span>
        <input type="number" min={0} max={12} value={c.max_dia ?? 3} onChange={(e) => setC({ ...c, max_dia: Number(e.target.value) })} style={{ width: 56, padding: "2px 6px", border: `1px solid ${C.borde}`, borderRadius: 6 }} />
        <span>publicaciones al día, separadas al menos</span>
        <input type="number" min={0} max={12} value={c.separacion_h ?? 3} onChange={(e) => setC({ ...c, separacion_h: Number(e.target.value) })} style={{ width: 56, padding: "2px 6px", border: `1px solid ${C.borde}`, borderRadius: 6 }} />
        <span>horas (las historias no cuentan; muchas seguidas se ven como spam)</span>
      </div>
      <div style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <span>Borrar del servidor las imágenes y videos generados para redes después de</span>
        <input type="number" min={0} max={365} value={c.borrar_medios_dias ?? 30} onChange={(e) => setC({ ...c, borrar_medios_dias: Number(e.target.value) })} style={{ width: 64, padding: "2px 6px", border: `1px solid ${C.borde}`, borderRadius: 6 }} />
        <span>días (0 = nunca). Las redes guardan su copia; no toca fotos de productos ni archivos de talleres, ni lo que sigue pendiente.</span>
      </div>
      <div style={{ fontSize: 14, marginTop: 6 }}>
        Mercados que se publican en las cuentas de HETNA (los demás quedan en borrador). Colombia, Chile, Perú, Argentina, Hispanos en EE. UU. y España
        reciben además la publicación semanal del pre-registro.
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          {[["mx", "México"], ["us", "EE. UU. (inglés)"], ["us_es", "Hispanos en EE. UU."], ["co", "Colombia"], ["cl", "Chile"], ["pe", "Perú"], ["ar", "Argentina"], ["es", "España"], ["br", "Brasil"]].map(([k, nombre]) => {
            const lista = c.mercados_redes && c.mercados_redes.length ? c.mercados_redes : ["mx"]
            return (
              <label key={k} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={lista.includes(k)}
                  disabled={k === "mx"}
                  onChange={(e) => setC({ ...c, mercados_redes: e.target.checked ? [...new Set([...lista, k])] : lista.filter((x) => x !== k) })}
                />
                {nombre}
              </label>
            )
          })}
        </div>
      </div>
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
        {datos.n8n ? "✓ Conectado a n8n (flujo Social Hub - Publicar)." : "✗ Falta configurar N8N_SOCIAL_URL (o N8N_REDES_URL) en el servidor."}
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
