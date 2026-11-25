// Social Hub: Plan, Estrategia, Radar, Fábrica de contenido, Estudio diario,
// fechas especiales y campañas. Separado de routes/social/page.tsx (24 nov 2026).
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { C, api, boton, caja, campo, copiar, fecha, cabeceras, MSG_SESION, subirImagen } from "./comun"

export function Puntaje({ p }: { p: { puntaje: number; revisiones: { ok: boolean; texto: string; consejo?: string }[] } }) {
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

export type Hueco = { id: string; fecha: string; red: string; mercado: string; publico: string; pilar: string; formato: string; estado: string; post_id: string | null; titulo?: string }
export type GuiaVista = { red: string; nombre: string; auto: boolean; formatos: string[]; frecuencia: number; horas: number[]; dias: number[]; publicos: string[]; liga: string; hashtags: [number, number]; media: string; claves: string }
export type Estrat = {
  config: { mercados: Record<string, number> }
  guias: GuiaVista[]
  publicos: { clave: string; nombre: string; objetivo: string; destino: string; pilares: string[] }[]
  mercados: { clave: string; nombre: string; zona: string; nota: string; pct: number; redes: string[] }[]
}
export const NOMBRE_PUBLICO: Record<string, string> = { clientes_empresa: "Empresas", clientes_particulares: "Particulares", talleres: "Talleres", proveedores: "Proveedores" }
export const ESTADO_HUECO: Record<string, [string, string]> = {
  vacio: ["Sin contenido", C.tenue],
  borrador: ["Borrador por revisar", "#8A5A00"],
  falta_material: ["Falta video", C.rojo],
  programada: ["Programada", "#1a3a5c"],
  publicada: ["Publicada", C.verde],
  parcial: ["Parcial", "#8A5A00"],
  descartada: ["Descartada", C.tenue],
}
export const DIAS = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
export const lunes = (d = new Date()) => {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}

export function Plan({ alCambiar, irA }: { alCambiar: () => void; irA: (v: string) => void }) {
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

export function Estrategia({ alCambiar, irA }: { alCambiar: () => void; irA: (v: string) => void }) {
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

export type Hallazgo = { id: string; tipo: string; mercado: string; titulo: string; resumen: string | null; url: string; lugar: string | null; relevancia: number; accion: string | null; datos: Record<string, string> | null; estado: string; mensaje: string; created_at: string }
export type BusquedaR = { id: string; tipo: string; mercado: string; consulta: string; activa: boolean }
export const TIPO_RADAR: Record<string, string> = { cliente: "🎯 Clientes", taller: "🏭 Talleres", contenido: "💡 Contenido", competencia: "👀 Competencia", evento: "📅 Eventos", mencion: "🔔 Menciones" }

export function Radar({ alCambiar }: { alCambiar: () => void }) {
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

export type Trabajo = { id: string; entrada: any; estado: string; error: string | null; piezas: any; created_at: string; titulo: string | null }
export type FondoB = { id: string; tema: string; url: string; fuente: string | null; licencia: string | null }
export type MusicaB = { id: string; titulo: string; url: string; estilo: string | null; licencia: string | null }
export const NOMBRE_TEMA: Record<string, string> = { laser: "Corte láser", plasma: "Plasma", router: "Router", torno: "Torno y fresado", taller: "Taller", lamina: "Láminas y materiales", impresion3d: "Impresión 3D", general: "General" }
export const ESTADO_TRABAJO: Record<string, [string, string]> = { pendiente: ["En cola", "#8A5A00"], produciendo: ["Produciendo…", "#1a3a5c"], listo: ["Listo", C.verde], error: ["Error", C.rojo] }

export async function apiFab<T>(cuerpo?: unknown): Promise<T> {
  const r = await fetch("/admin/hetna-fabrica", {
    credentials: "include",
    ...(cuerpo === undefined ? { headers: cabeceras() } : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
  })
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (!r.ok) throw new Error((d as any)?.message || `Error ${r.status}`)
  return d
}

export type FechaE = { clave: string; nombre: string; fecha: string; faltan: number; anticipacion: number; en_temporada: boolean; tema: string; activa: boolean; etiquetas: string[]; sugeridas: string[]; productos: { id: string; titulo: string; foto: string | null }[]; ultima: string | null }

/** Agente de anuncios de Meta: impulsa con dinero lo que ya funcionó solo. Nada sale sin aprobar. */
export function Anuncios() {
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
export function Temario({ alCambiar }: { alCambiar: () => void }) {
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
/** Estudio diario: un video al día hecho por la cadena de agentes (guion, voz, escenas con IA de video, publicación). */
export function EstudioDiario() {
  const [d, setD] = useState<any>(null)
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [temaExp, setTemaExp] = useState("")
  const api = async (cuerpo?: unknown) => {
    const r = await fetch("/admin/hetna-fabrica/estudio", { credentials: "include", ...(cuerpo === undefined ? { headers: cabeceras() } : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }) })
    const x = await r.json().catch(() => ({}))
    if (r.status === 401) throw new Error(MSG_SESION)
    if (!r.ok) throw new Error(x?.message || `Error ${r.status}`)
    return x
  }
  const cargar = () => api().then(setD).catch((e) => setNota({ ok: false, t: (e as Error).message }))
  useEffect(() => { void cargar() }, [])
  if (!d) return nota ? <section style={caja}><b>🎬 Estudio diario</b> <span style={{ color: C.rojo, fontSize: 13 }}>{nota.t}</span></section> : null
  const hacer = async (tipo?: string) => {
    setOcupado(true)
    try { await api({ hacer: true, tipo }); setNota({ ok: true, t: "✓ Haciendo el video: guion, voz y escenas con IA. Tarda de 5 a 15 minutos y aparece en Pendientes. Recarga esta tarjeta para ver el avance." }) } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) }
  }
  return (
    <section style={caja}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>🎬 Estudio diario (video con IA)</h3>
      <p style={{ margin: "0 0 8px", color: C.tenue, fontSize: 13 }}>
        Un video vertical al día para YouTube, Instagram, TikTok y Facebook: el guionista escribe con gancho en el primer segundo (fórmulas AIDA, FAB, títulos y CTA), se pone la voz, cada escena se anima con IA de video sin repetir tomas y se programa a la hora que mejor ha funcionado.
        Martes, jueves y sábado: novela <b>«El Taller»</b> (ficción con {d.personajes.map((p: any) => p.nombre).join(", ")}); los demás días, educativo.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={!!d.activo} disabled={ocupado || !d.listo} onChange={async (e) => { try { setD(await api({ activo: e.target.checked })) } catch (er) { setNota({ ok: false, t: (er as Error).message }) } }} /> Hacer uno cada día (de madrugada)
        </label>
        <button type="button" style={boton("primario")} disabled={ocupado || !d.listo} onClick={() => void hacer()}>🎬 Hacer el de hoy ({d.toca_hoy})</button>
        <button type="button" style={boton("normal")} disabled={ocupado || !d.listo} onClick={() => void hacer(d.toca_hoy === "novela" ? "educativo" : "novela")}>Hacer uno {d.toca_hoy === "novela" ? "educativo" : "de novela"}</button>
        <button type="button" style={boton("normal")} onClick={() => void cargar()}>Actualizar</button>
        <button type="button" style={boton("normal")} disabled={ocupado} title="Hace una imagen pro de muestra (cuesta ~0.06 USD)" onClick={async () => { setOcupado(true); setNota({ ok: true, t: "Haciendo la imagen de prueba (unos 30 segundos)…" }); try { const r = await api({ accion: "imagen_prueba" }); window.open(r.url, "_blank", "noopener"); setNota({ ok: true, t: `✓ Imagen de prueba lista: «${r.idea.linea1} ${r.idea.linea2}». Se abrió en otra pestaña.` }) } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) } }}>🖼️ Imagen pro de prueba</button>
        <button type="button" style={boton("normal")} disabled={ocupado} title="Busca en el servidor los videos que se hicieron pero no se guardaron por un error" onClick={async () => { setOcupado(true); try { const r = await api({ accion: "recuperar" }); setNota({ ok: true, t: r.recuperados ? `✓ Recuperé ${r.recuperados} videos: ábrelos con "Ver video" y publícalos si te gustan.` : "No encontré videos perdidos." }); void cargar() } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) } }}>Recuperar videos</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, marginTop: 8, borderTop: `1px solid ${C.borde}`, paddingTop: 8 }}>
        <b>📐 Explicativo</b>
        <span style={{ color: C.tenue }}>65 a 80 s con dibujos técnicos y voz (~0.15 USD). Queda en Pendientes y te llega a Telegram.</span>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={d.explicativo !== false} disabled={ocupado} onChange={async (e) => { try { setD(await api({ explicativo: e.target.checked })) } catch (er) { setNota({ ok: false, t: (er as Error).message }) } }} /> Uno cada día
        </label>
        <input value={temaExp} onChange={(e) => setTemaExp(e.target.value)} placeholder="Tema (opcional): ej. cómo elegir la fresa" maxLength={200} style={{ flex: 1, minWidth: 200, padding: "4px 8px", border: `1px solid ${C.borde}`, borderRadius: 6 }} />
        <button type="button" style={boton("primario")} disabled={ocupado} onClick={async () => { setOcupado(true); try { await api({ accion: "explicativo", tema: temaExp.trim() || undefined }); setTemaExp(""); setNota({ ok: true, t: "✓ Haciendo el explicativo: guion, voz y dibujos. Tarda de 3 a 8 minutos; llega a Pendientes y a Telegram." }) } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) } }}>📐 Hacer explicativo</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, marginTop: 6 }}>
        <b>🎬 Video largo YouTube</b>
        <span style={{ color: C.tenue }}>Horizontal, 4 a 6 minutos con capítulos (~0.80 USD). Usa el mismo campo de tema. Tarda de 30 a 60 minutos.</span>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={d.largo !== false} disabled={ocupado} onChange={async (e) => { try { setD(await api({ largo: e.target.checked })) } catch (er) { setNota({ ok: false, t: (er as Error).message }) } }} /> Uno cada semana (domingo)
        </label>
        <button type="button" style={boton("normal")} disabled={ocupado} onClick={async () => { setOcupado(true); try { await api({ accion: "explicativo_largo", tema: temaExp.trim() || undefined }); setTemaExp(""); setNota({ ok: true, t: "✓ Haciendo el video largo para YouTube. Tarda de 30 a 60 minutos; llega a Pendientes y a Telegram." }) } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) } }}>🎬 Hacer video largo</button>
      </div>
      <div style={{ fontSize: 12, color: C.tenue, marginTop: 6 }}>
        {d.listo ? <span style={{ color: C.verde, fontWeight: 600 }}>Listo para trabajar</span> : <span style={{ color: C.rojo, fontWeight: 600 }}>Falta {d.falta} en el servidor</span>}
        {" · "}Gasto hoy: {d.gasto_hoy} USD (tope {d.tope_dia}) · este mes: {d.gasto_mes} USD
        {d.motor && <>{" · "}Motor de video: {d.motor}</>}
      </div>
      {d.videos?.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {d.videos.map((v: any) => (
            <div key={v.id} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${C.borde}`, paddingTop: 4 }}>
              <span style={{ color: C.tenue }}>{v.dia}</span>
              <span>{v.tipo === "novela" ? "🎬" : v.tipo === "explicativo" ? "📐" : v.tipo === "explicativo_largo" ? "🎞️" : "🎓"}</span>
              <b style={{ flex: 1, minWidth: 180 }}>{v.titulo || v.tema || "(guion en proceso)"}</b>
              <span style={{ color: v.estado === "listo" ? C.verde : v.estado === "error" ? C.rojo : C.tenue, fontWeight: 600 }}>{v.estado === "listo" ? "Listo" : v.estado === "error" ? "Error" : "Haciendo…"}</span>
              <span style={{ color: C.tenue }}>{v.costo.toFixed(2)} USD</span>
              {v.video && <a href={v.video} target="_blank" rel="noreferrer">Ver video</a>}
              {v.publicable && <button type="button" style={boton("primario")} disabled={ocupado} onClick={async () => { setOcupado(true); try { const r = await api({ accion: "publicar", id: v.id }); setNota({ ok: true, t: r.estado === "programada" && r.hora != null ? `✓ Programado para las ${r.hora}:00` : "✓ Quedó en Pendientes del Social Hub para que lo apruebes" }); void cargar() } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) } }}>Publicar</button>}
              {v.error && <span style={{ color: C.rojo, width: "100%" }}>{v.error}</span>}
            </div>
          ))}
        </div>
      )}
      {d.datos && <EstudioDatos datos={d.datos} api={api} alCambiar={cargar} avisar={setNota} />}
      {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 6 }}>{nota.t}</div>}
    </section>
  )
}

/** Agentes de datos del Estudio: tendencias (1), referencias del dueño y retención (7). */
export function EstudioDatos({ datos, api, alCambiar, avisar }: { datos: any; api: (c?: unknown) => Promise<any>; alCambiar: () => void; avisar: (n: { ok: boolean; t: string }) => void }) {
  const [url, setUrl] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const g = datos.google || {}
  const correr = async (cuerpo: any, ok: (x: any) => string) => {
    setOcupado(true)
    try { const x = await api(cuerpo); if (cuerpo.accion === "google" && x.url) { window.open(x.url, "_blank", "noopener"); avisar({ ok: true, t: "Se abrió Google: entra con la cuenta del canal de YouTube y acepta. Luego aprieta Actualizar." }) } else avisar({ ok: true, t: ok(x) }); alCambiar() } catch (e) { avisar({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) }
  }
  return (
    <div style={{ borderTop: `1px solid ${C.borde}`, marginTop: 10, paddingTop: 8, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b>📊 Datos (tendencias y retención)</b>
        <span style={{ color: g.conectado ? C.verde : C.tenue, fontWeight: 600 }}>{!g.configurado ? "Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor" : g.conectado ? `YouTube conectado${g.canal ? ` (${g.canal})` : ""}` : "YouTube sin conectar"}</span>
        <span style={{ flex: 1 }} />
        {g.configurado && <button type="button" style={boton(g.conectado ? "normal" : "primario")} disabled={ocupado} onClick={() => void correr({ accion: "google" }, () => "")}>{g.conectado ? "Volver a conectar" : "Conectar Google (YouTube)"}</button>}
        {g.conectado && <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void correr({ accion: "tendencias" }, (x) => `✓ Revisé ${x.revisados} videos; ${x.alarmas.length} alarmas (${datos.umbral}× la media).`)}>Revisar tendencias</button>}
        {g.conectado && <button type="button" style={boton("normal")} disabled={ocupado} onClick={() => void correr({ accion: "retencion" }, (x) => x.notas.length ? `✓ ${x.notas.length} notas para el guionista.` : "Todavía no hay videos del Estudio con 2 días publicados en YouTube.")}>Revisar retención</button>}
      </div>
      {!g.configurado && <div style={{ color: C.tenue, fontSize: 12, marginTop: 4 }}>URI de redireccionamiento para Google Cloud: {g.redirect}</div>}
      {datos.tendencias?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12, color: C.tenue }}>Lo que más está pegando (vistas contra la media de su canal):</div>
          {datos.tendencias.map((t: any) => (
            <div key={t.url} style={{ fontSize: 12 }}>
              {t.alarma ? "🚨" : "•"} <a href={t.url} target="_blank" rel="noreferrer">{t.titulo}</a> <span style={{ color: C.tenue }}>· {t.canal} · {Number(t.vistas).toLocaleString("es-MX")} vistas · <b>{t.veces}×</b></span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pega la liga de un video que te guste (TikTok, Instagram o YouTube)" style={{ flex: 1, minWidth: 260, padding: "4px 8px", border: `1px solid ${C.borde}`, borderRadius: 6, fontSize: 12 }} />
        <button type="button" style={boton("normal")} disabled={ocupado || !url.trim()} onClick={() => void correr({ accion: "referencia", url }, (x) => { setUrl(""); return `✓ Referencia guardada: ${x.titulo}` })}>Agregar referencia</button>
      </div>
      {datos.referencias?.length > 0 && <div style={{ fontSize: 12, color: C.tenue, marginTop: 4 }}>Referencias: {datos.referencias.map((r: any) => r.titulo).join(" · ")}</div>}
      {datos.notas?.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12 }}>
          <div style={{ color: C.tenue }}>Notas para el guionista:</div>
          {datos.notas.map((n: any, i: number) => <div key={i}>📉 {n.nota}</div>)}
        </div>
      )}
    </div>
  )
}

/** Buen Fin: fechas, descuento y cupón los pone el dueño; sin eso no se publica nada. */
export function BuenFin() {
  const [d, setD] = useState<any>(null)
  const [f, setF] = useState<any>(null)
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const api = async (cuerpo?: unknown) => {
    const r = await fetch("/admin/hetna-fabrica/buen-fin", { credentials: "include", ...(cuerpo === undefined ? { headers: cabeceras() } : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }) })
    const x = await r.json().catch(() => ({}))
    if (r.status === 401) throw new Error(MSG_SESION)
    if (!r.ok) throw new Error(x?.message || `Error ${r.status}`)
    return x
  }
  const tomar = (x: any) => { setD(x); setF({ activo: x.activo, desde: x.desde, hasta: x.hasta, descuento: x.descuento, cupon: x.cupon, etiquetas: (x.etiquetas || []).join(", ") }) }
  useEffect(() => { api().then(tomar).catch((e) => setNota({ ok: false, t: (e as Error).message })) }, [])
  if (!f) return null
  const campo = { padding: "4px 8px", border: `1px solid ${C.borde}`, borderRadius: 6, fontSize: 13 }
  const guardar = async () => {
    setOcupado(true)
    try { tomar(await api({ ...f, etiquetas: String(f.etiquetas).split(",").map((x: string) => x.trim()).filter(Boolean) })); setNota({ ok: true, t: "✓ Guardado" }) } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) }
  }
  return (
    <section style={caja}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>🛍️ Buen Fin</h3>
      <p style={{ margin: "0 0 10px", color: C.tenue, fontSize: 13 }}>
        Pon las fechas y el descuento <b>tal como lo vas a dar</b>. 5 días antes sale un aviso cada 2 días y durante el Buen Fin una imagen y un video diarios con los productos que tengan la etiqueta. Nada sale después del último día. Sin estos datos no se publica nada.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Activo</label>
        <span>Del</span><input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} style={campo} />
        <span>al</span><input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} style={campo} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, marginTop: 6 }}>
        <input value={f.descuento} onChange={(e) => setF({ ...f, descuento: e.target.value })} placeholder="Descuento (ej. 10% en productos seleccionados)" style={{ ...campo, flex: 2, minWidth: 240 }} />
        <input value={f.cupon} onChange={(e) => setF({ ...f, cupon: e.target.value })} placeholder="Cupón (opcional, debe existir en Promociones)" style={{ ...campo, flex: 1, minWidth: 180 }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, marginTop: 6 }}>
        <span style={{ color: C.tenue }}>Etiqueta de los productos con descuento:</span>
        <input value={f.etiquetas} onChange={(e) => setF({ ...f, etiquetas: e.target.value })} style={{ ...campo, flex: 1, minWidth: 160 }} />
        <button type="button" style={boton("primario")} disabled={ocupado} onClick={() => void guardar()}>Guardar</button>
        <button type="button" style={boton("normal")} disabled={ocupado || !d?.etapa || !d?.productos?.length} onClick={async () => {
          setOcupado(true)
          try { const x = await api({ hacer: true }); setNota({ ok: true, t: `✓ Haciendo la imagen y el video con: ${x.productos.join(", ")}. En unos minutos aparecen en Pendientes.` }) } catch (e) { setNota({ ok: false, t: `✗ ${(e as Error).message}` }) } finally { setOcupado(false) }
        }}>🎬 Hacer ahora</button>
      </div>
      <div style={{ fontSize: 12, marginTop: 6, color: C.tenue }}>
        {d.etapa === "durante" ? "🟢 En curso" : d.etapa === "antes" ? "🟡 En días de aviso" : "⚪ Fuera de fechas"}
        {" · "}
        <span style={{ color: d.productos.length ? C.verde : C.rojo, fontWeight: 600 }}>{d.productos.length ? `${d.productos.length}${d.productos.length >= 6 ? "+" : ""} productos con la etiqueta` : "Ningún producto con la etiqueta"}</span>
        {d.cupon && <> · Cupón {d.cupon}: <span style={{ color: d.cupon_ok === false ? C.rojo : C.verde, fontWeight: 600 }}>{d.cupon_ok === false ? "no existe o no está activo" : d.cupon_ok ? "activo" : "sin revisar"}</span></>}
      </div>
      {nota && <div style={{ fontSize: 12, fontWeight: 600, color: nota.ok ? C.verde : C.rojo, marginTop: 4 }}>{nota.t}</div>}
    </section>
  )
}

export function FechasEspeciales() {
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
  const [invit, setInvit] = useState<Record<string, any>>({})
  const cargar = async () => { const d = await api().catch(() => ({ fechas: [] })); setFechas(d.fechas || []); setInvit(d.invitaciones || {}) }
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
            {f.faltan <= 45 && (() => {
              const k = `${f.clave}-${f.fecha.slice(0, 4)}`
              const v = invit[k]
              return (
                <button type="button" disabled={haciendo === f.clave || v?.activo} title="Correo y aviso a tus talleres para que publiquen productos de esta fecha (una vez por taller)" style={{ ...boton("normal"), opacity: v?.activo ? 0.6 : 1 }}
                  onClick={async () => {
                    setHaciendo(f.clave)
                    try { const d = await api({ clave: f.clave, invitar: true }); avisar(f.clave, true, d.hoy ? `✓ Invitando a ${d.hoy} talleres hoy a publicar productos de ${f.nombre}. Lo que publiquen con «${f.nombre}» en el nombre se etiqueta solo.` : "Ya se invitó a todos los talleres para esta fecha."); void cargar() } catch (er) { avisar(f.clave, false, `✗ ${(er as Error).message}`) } finally { setHaciendo(null) }
                  }}>{v?.activo ? `📨 Invitando (${v.invitados})` : v?.terminada ? `📨 Invitados (${v.invitados})` : "📨 Invitar a talleres"}</button>
              )
            })()}
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

export function Fabrica({ alCambiar, irA }: { alCambiar: () => void; irA: (v: string) => void }) {
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
                <option value="mx">México</option><option value="us">Estados Unidos</option><option value="co">Colombia</option><option value="cl">Chile</option><option value="pe">Perú</option><option value="ar">Argentina</option><option value="br">Brasil</option><option value="us_es">Hispanos en EE. UU.</option><option value="es">España</option>
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

      <EstudioDiario />
      <FechasEspeciales />
      <BuenFin />

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

export async function apiCamp<T>(cuerpo?: unknown): Promise<T> {
  const r = await fetch("/admin/hetna-campanas", {
    credentials: "include",
    ...(cuerpo === undefined ? { headers: cabeceras() } : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
  })
  const d = (await r.json().catch(() => ({}))) as any
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d as T
}

/** Motor de campañas de anuncios: Google, Meta y TikTok. */
export function CampanasAds() {
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
