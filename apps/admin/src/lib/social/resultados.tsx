// Social Hub: sección "Resultados" (clics, altas, solicitudes y ventas por red).
// Separada de routes/social/page.tsx (24 nov 2026).
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { C, ORIGEN, api, boton, caja, nombreRed } from "./comun"
import { Anuncios } from "./estudio"

export function Resultados() {
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
          <>
          <p style={{ color: C.tenue, fontSize: 12, margin: "0 0 8px" }}>
            Sólo cuenta a quien llegó por una liga medida de tus publicaciones. Las altas de toda la página (de cualquier lado) salen en el resumen semanal de Telegram.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Red</th>
                <th style={th}>Clics</th>
                <th style={th}>Clientes nuevos (desde redes)</th>
                <th style={th}>Talleres nuevos (desde redes)</th>
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
          </>
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
