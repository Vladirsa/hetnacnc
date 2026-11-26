// @ts-nocheck
// Pantalla "Mis servicios" del panel del taller (/seller > Mis servicios).
// Servicios con precio "desde" que salen en el perfil del taller y en las
// páginas de Diseño 2D/3D y Programación CAM, con el botón «Pedir cotización»
// que abre una solicitud directa a este taller. No se compran en el carrito.
// Ver packages/api/src/lib/paquetes-servicio.ts.
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Etiqueta = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
)

export const config: RouteConfig = {
  label: "Mis servicios",
  icon: Etiqueta,
}

const S = {
  page: { maxWidth: 860, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  card: { background: "rgba(255,255,255,0.82)", border: "1px solid rgba(20,32,51,0.08)", boxShadow: "0 8px 24px -12px rgba(20,32,51,0.18)", borderRadius: 16, padding: 16, marginBottom: 12 },
  meta: { color: "#6B675C", fontSize: 13, margin: "2px 0 0" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#142033", margin: "10px 0 4px" },
  input: { width: "100%", border: "1px solid #C9C5BA", borderRadius: 10, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #C9C5BA", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
}

const EJEMPLOS = [
  { titulo: "Vectorizar logo o dibujo para corte", desde: 350, entrega_dias: 2, categoria: "diseno-2d-3d", descripcion: "Te entrego DXF y SVG limpios, listos para láser, router o plasma." },
  { titulo: "Modelado 3D de pieza a partir de plano o foto", desde: 900, entrega_dias: 4, categoria: "diseno-2d-3d", descripcion: "Archivo STEP y STL. Incluye una ronda de cambios." },
  { titulo: "Programación CAM y G-code para router", desde: 600, entrega_dias: 2, categoria: "programacion-cam", descripcion: "Trayectorias de desbaste y acabado para tu máquina y tu herramienta." },
]

const vacio = () => ({ titulo: "", desde: "", entrega_dias: "", descripcion: "", categoria: "diseno-2d-3d" })

export default function MisServiciosPage() {
  const [datos, setDatos] = useState(null)
  const [lista, setLista] = useState([])
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetch("/vendor/hetna-paquetes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setDatos(d)
        setLista(d.paquetes || [])
      })
      .catch(() => setMsg({ ok: false, t: "No se pudieron cargar tus servicios. Recarga la página." }))
  }, [])

  const cambiar = (i, campo, v) => setLista((l) => l.map((p, j) => (j === i ? { ...p, [campo]: v } : p)))
  const quitar = (i) => setLista((l) => l.filter((_, j) => j !== i))

  async function guardar() {
    setGuardando(true)
    setMsg(null)
    try {
      const res = await fetch("/vendor/hetna-paquetes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paquetes: lista }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || "No se pudo guardar.")
      setLista(d.paquetes)
      setMsg({ ok: true, t: "Guardado. Ya salen en tu perfil (puede tardar unos minutos en verse)." })
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setGuardando(false)
    }
  }

  if (!datos && !msg) return <div style={S.page}><p style={S.meta}>Cargando…</p></div>
  const categorias = datos?.categorias || {}
  const max = datos?.max || 12

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px", color: "#142033", letterSpacing: "-0.02em" }}>Mis servicios</h1>
      <p style={S.meta}>
        Publica lo que haces con un precio «desde»: diseño CAD, modelado 3D, programación CAM, vectorizado… Sale en tu perfil y en las páginas de Diseño
        2D/3D y Programación CAM de HETNA, con un botón «Pedir cotización» que te llega directo como solicitud. El precio final lo mandas tú en tu propuesta.
      </p>
      {datos?.handle && (
        <p style={S.meta}>
          Así se ve tu perfil:{" "}
          <a href={`/mx/talleres/${datos.handle}`} target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
            hetnacnc.com/mx/talleres/{datos.handle}
          </a>
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        {lista.length === 0 && (
          <div style={S.card}>
            <p style={{ margin: 0, fontWeight: 700 }}>Todavía no publicas servicios.</p>
            <p style={S.meta}>Empieza con un ejemplo y cámbialo a tu gusto:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {EJEMPLOS.map((e) => (
                <button key={e.titulo} type="button" style={S.btn2} onClick={() => setLista((l) => [...l, { ...e }])}>
                  + {e.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {lista.map((p, i) => (
          <div key={p.id || i} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#142033" }}>Servicio {i + 1}</strong>
              <button type="button" onClick={() => quitar(i)} style={{ ...S.btn2, padding: "5px 12px", color: "#B3261E" }}>
                Quitar
              </button>
            </div>
            <label style={S.label}>Nombre del servicio</label>
            <input style={S.input} maxLength={80} value={p.titulo} onChange={(e) => cambiar(i, "titulo", e.target.value)} placeholder="Vectorizar logo para corte láser" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <div>
                <label style={S.label}>Precio desde (MXN)</label>
                <input style={S.input} inputMode="numeric" value={p.desde} onChange={(e) => cambiar(i, "desde", e.target.value.replace(/[^\d]/g, ""))} placeholder="350" />
              </div>
              <div>
                <label style={S.label}>Entrega (días hábiles)</label>
                <input style={S.input} inputMode="numeric" value={p.entrega_dias ?? ""} onChange={(e) => cambiar(i, "entrega_dias", e.target.value.replace(/[^\d]/g, ""))} placeholder="2" />
              </div>
              <div>
                <label style={S.label}>Dónde aparece</label>
                <select style={S.input} value={p.categoria} onChange={(e) => cambiar(i, "categoria", e.target.value)}>
                  {Object.entries(categorias).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label style={S.label}>Qué incluye</label>
            <textarea
              style={{ ...S.input, minHeight: 70 }}
              maxLength={600}
              value={p.descripcion}
              onChange={(e) => cambiar(i, "descripcion", e.target.value)}
              placeholder="Formatos que entregas, rondas de cambios, qué necesitas del cliente…"
            />
          </div>
        ))}

        {lista.length > 0 && lista.length < max && (
          <button type="button" style={S.btn2} onClick={() => setLista((l) => [...l, vacio()])}>
            + Agregar otro servicio
          </button>
        )}
      </div>

      <p style={{ ...S.meta, marginTop: 14 }}>Sin teléfonos, correos ni redes: los clientes te contactan y te pagan dentro de HETNA.</p>
      {msg && <p style={{ margin: "10px 0 0", fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</p>}
      <button type="button" onClick={guardar} disabled={guardando} style={{ ...S.btn, marginTop: 12, opacity: guardando ? 0.6 : 1 }}>
        {guardando ? "Guardando…" : "Guardar servicios"}
      </button>
    </div>
  )
}
