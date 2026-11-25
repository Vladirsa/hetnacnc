// Dashboard > Planos IA: planos de la Biblioteca guardados en la base de datos
// (packages/api/src/lib/planos-biblioteca.ts). Los propone el agente semanal o
// se importan a mano; nada se publica solo: aquí se ven en vista previa, se
// editan si hace falta y se publican o rechazan. Al publicar se crea su producto
// en la tienda.
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Plano = {
  slug: string
  nombre: string
  categoria: string
  estado: "borrador" | "publicado" | "rechazado"
  origen: "manual" | "ia"
  razon: string | null
  revision: { avisos?: string[]; resumen?: { piezas: number; ancho: number; fondo: number; alto: number; hojas: number } } | null
  resumen: string | null
  piezas: number
  created_at: string
  publicado_en: string | null
  vista_previa: string
  datos?: DatosPlano
}

type Pieza = { nombre: string; material: string; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
type DatosPlano = {
  slug: string
  categoria: string
  nombre: string
  resumen: string
  descripcion: string
  nivel: string
  horas: string
  ruedas?: number
  juego?: { cantidad: number; nombre: string }
  piezas: Pieza[]
  pasos: { titulo: string; nota: string; piezas: string[] }[]
  herrajes: string[]
  herramientas: string[]
  notas: string[]
}
const MATERIALES = ["triplay-18", "triplay-12", "triplay-9", "triplay-6"]

type Agente = { ia: boolean; corriendo: boolean; estado?: string; inicio?: string; fin?: string | null; creados?: number; bitacora?: string[] | null }

const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", tenue: "var(--fg-subtle, #6b6a63)", naranja: "#C2560A" }
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 12 }
const boton: CSSProperties = { background: C.naranja, color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 14 }
const botonClaro: CSSProperties = { ...boton, background: "transparent", color: "inherit", border: `1px solid ${C.borde}` }
const campo: CSSProperties = { width: "100%", padding: "8px 10px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 13, background: C.fondo, color: "inherit", boxSizing: "border-box", fontFamily: "monospace" }
const ESTADO: Record<Plano["estado"], [string, string]> = { borrador: ["Por revisar", "#8A5A00"], publicado: ["Publicado", "#1E7B3A"], rechazado: ["Rechazado", "#6B675C"] }

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
const pedir = async (cuerpo?: unknown) => {
  const r = await fetch("/admin/hetna-planos", {
    method: cuerpo ? "POST" : "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...cabeceras() },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(d?.message || "No se pudo completar.")
  return d
}


// Editor de un borrador: textos, piezas (medidas en mm: x = ancho, y = fondo
// desde el frente, z = alto desde el piso) y pasos. Al guardar se vuelve a
// revisar con el motor de la tienda; si algo falla, no se guarda.
function Editor({ p, alGuardar, alCerrar }: { p: Plano; alGuardar: (m: string) => void; alCerrar: () => void }) {
  const [d, setD] = useState<DatosPlano>(() => JSON.parse(JSON.stringify(p.datos)))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const lineas = (a: string[]) => a.join("\n")
  const deLineas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean)
  const pieza = (i: number, c: Partial<Pieza>) => setD({ ...d, piezas: d.piezas.map((q, j) => (j === i ? { ...q, ...c } : q)) })
  const paso = (i: number, c: Partial<DatosPlano["pasos"][number]>) => setD({ ...d, pasos: d.pasos.map((q, j) => (j === i ? { ...q, ...c } : q)) })
  const guardar = async () => {
    setGuardando(true)
    setError("")
    try {
      await pedir({ slug: p.slug, editar: d })
      alGuardar(`Guardado: ${d.nombre}. Pasó la revisión.`)
    } catch (e) {
      setError((e as Error).message)
      setGuardando(false)
    }
  }
  const num: CSSProperties = { ...campo, width: 70, padding: "4px 6px" }
  const etiqueta: CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, margin: "8px 0 2px" }
  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${C.borde}`, paddingTop: 10 }}>
      <label style={etiqueta}>Nombre</label>
      <input style={campo} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
      <label style={etiqueta}>Resumen</label>
      <input style={campo} value={d.resumen} onChange={(e) => setD({ ...d, resumen: e.target.value })} />
      <label style={etiqueta}>Descripción</label>
      <textarea style={{ ...campo, minHeight: 60 }} value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div>
          <label style={etiqueta}>Categoría</label>
          <select style={{ ...campo, width: 120 }} value={d.categoria} onChange={(e) => setD({ ...d, categoria: e.target.value })}>
            <option>Taller</option>
            <option>Casa</option>
          </select>
        </div>
        <div>
          <label style={etiqueta}>Nivel</label>
          <select style={{ ...campo, width: 130 }} value={d.nivel} onChange={(e) => setD({ ...d, nivel: e.target.value })}>
            <option>Fácil</option>
            <option>Intermedio</option>
          </select>
        </div>
        <div>
          <label style={etiqueta}>Horas</label>
          <input style={{ ...campo, width: 110 }} value={d.horas} onChange={(e) => setD({ ...d, horas: e.target.value })} />
        </div>
      </div>

      <label style={etiqueta}>Piezas (mm · x = ancho, y = fondo desde el frente, z = alto desde el piso)</label>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.tenue }}>
              <th align="left">Nombre</th><th>Material</th><th>x0</th><th>x1</th><th>y0</th><th>y1</th><th>z0</th><th>z1</th><th></th>
            </tr>
          </thead>
          <tbody>
            {d.piezas.map((q, i) => (
              <tr key={i}>
                <td><input style={{ ...campo, width: 170, padding: "4px 6px" }} value={q.nombre} onChange={(e) => pieza(i, { nombre: e.target.value })} /></td>
                <td>
                  <select style={{ ...campo, width: 110, padding: "4px 6px" }} value={q.material} onChange={(e) => pieza(i, { material: e.target.value })}>
                    {MATERIALES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </td>
                {(["x0", "x1", "y0", "y1", "z0", "z1"] as const).map((k) => (
                  <td key={k}><input type="number" style={num} value={q[k]} onChange={(e) => pieza(i, { [k]: Number(e.target.value) })} /></td>
                ))}
                <td><button type="button" style={{ ...botonClaro, padding: "2px 8px" }} onClick={() => setD({ ...d, piezas: d.piezas.filter((_, j) => j !== i) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" style={{ ...botonClaro, marginTop: 6, padding: "4px 10px" }} onClick={() => setD({ ...d, piezas: [...d.piezas, { nombre: "Pieza nueva", material: "triplay-18", x0: 0, x1: 100, y0: 0, y1: 100, z0: 0, z1: 18 }] })}>
        + Pieza
      </button>

      <label style={etiqueta}>Pasos (en «piezas» van nombres o prefijos separados por coma)</label>
      {d.pasos.map((ps, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr auto", gap: 6, marginBottom: 6 }}>
          <input style={campo} value={ps.titulo} onChange={(e) => paso(i, { titulo: e.target.value })} />
          <input style={campo} value={ps.nota} onChange={(e) => paso(i, { nota: e.target.value })} />
          <input style={campo} value={ps.piezas.join(", ")} onChange={(e) => paso(i, { piezas: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
          <button type="button" style={{ ...botonClaro, padding: "2px 8px" }} onClick={() => setD({ ...d, pasos: d.pasos.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" style={{ ...botonClaro, padding: "4px 10px" }} onClick={() => setD({ ...d, pasos: [...d.pasos, { titulo: "Paso nuevo", nota: "", piezas: [] }] })}>
        + Paso
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div>
          <label style={etiqueta}>Herrajes (uno por renglón)</label>
          <textarea style={{ ...campo, minHeight: 90 }} value={lineas(d.herrajes)} onChange={(e) => setD({ ...d, herrajes: deLineas(e.target.value) })} />
        </div>
        <div>
          <label style={etiqueta}>Herramientas</label>
          <textarea style={{ ...campo, minHeight: 90 }} value={lineas(d.herramientas)} onChange={(e) => setD({ ...d, herramientas: deLineas(e.target.value) })} />
        </div>
        <div>
          <label style={etiqueta}>Notas</label>
          <textarea style={{ ...campo, minHeight: 90 }} value={lineas(d.notas)} onChange={(e) => setD({ ...d, notas: deLineas(e.target.value) })} />
        </div>
      </div>
      {error && <p style={{ color: "#B42318", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" style={boton} disabled={guardando} onClick={() => void guardar()}>
          {guardando ? "Revisando…" : "Guardar cambios"}
        </button>
        <button type="button" style={botonClaro} disabled={guardando} onClick={alCerrar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Tarjeta({ p, alTerminar }: { p: Plano; alTerminar: (m: string) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [editando, setEditando] = useState(false)
  const accion = async (a: "publicar" | "rechazar") => {
    if (a === "publicar" && !confirm(`¿Publicar «${p.nombre}»? Saldrá en /planos, en la tienda y en redes.`)) return
    setOcupado(true)
    setError("")
    try {
      const r = await pedir({ slug: p.slug, accion: a })
      alTerminar(a === "publicar" ? `Publicado: ${r?.url || p.slug}${r?.producto === "pendiente" ? " (el producto de la tienda no se pudo crear; corre crear-productos-planos.ts)" : ""}` : "Rechazado")
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }
  const r = p.revision?.resumen
  return (
    <div style={caja}>
      <p style={{ margin: 0, fontSize: 12, color: C.tenue }}>
        <b style={{ color: ESTADO[p.estado][1] }}>{ESTADO[p.estado][0]}</b> · {p.categoria} · {p.origen === "ia" ? "Agente" : "A mano"} · {new Date(p.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
      </p>
      <p style={{ margin: "4px 0", fontWeight: 700, fontSize: 16 }}>{p.nombre}</p>
      {p.resumen && <p style={{ margin: "0 0 6px", fontSize: 14 }}>{p.resumen}</p>}
      {r && (
        <p style={{ margin: "0 0 6px", fontSize: 13, color: C.tenue }}>
          {r.ancho} × {r.fondo} × {r.alto} mm · {r.piezas} piezas · {r.hojas} {r.hojas === 1 ? "hoja" : "hojas"}
        </p>
      )}
      {p.razon && <p style={{ margin: "0 0 6px", fontSize: 13, color: C.tenue, whiteSpace: "pre-wrap" }}>Por qué: {p.razon}</p>}
      {p.revision?.avisos?.length ? <p style={{ margin: "0 0 6px", fontSize: 13, color: "#8A5A00" }}>Avisos de la revisión: {p.revision.avisos.join(" · ")}</p> : null}
      {error && <p style={{ color: "#B42318", fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <a href={p.vista_previa} target="_blank" rel="noreferrer" style={{ ...botonClaro, textDecoration: "none" }}>
          Ver plano completo ↗
        </a>
        {p.estado === "borrador" && (
          <>
            <button type="button" style={boton} disabled={ocupado} onClick={() => void accion("publicar")}>
              Publicar
            </button>
            <button type="button" style={botonClaro} disabled={ocupado} onClick={() => void accion("rechazar")}>
              Rechazar
            </button>
            {p.datos && !editando && (
              <button type="button" style={botonClaro} onClick={() => setEditando(true)}>
                Editar
              </button>
            )}
          </>
        )}
      </div>
      {editando && p.datos && (
        <Editor
          p={p}
          alCerrar={() => setEditando(false)}
          alGuardar={(m) => {
            setEditando(false)
            alTerminar(m)
          }}
        />
      )}
    </div>
  )
}

export default function PlanosIaPage() {
  const [planos, setPlanos] = useState<Plano[] | null>(null)
  const [agente, setAgente] = useState<Agente | null>(null)
  const [aviso, setAviso] = useState("")
  const [json, setJson] = useState("")
  const [importando, setImportando] = useState(false)
  const cargar = () =>
    pedir()
      .then((d) => {
        setPlanos(d.planos)
        setAgente(d.agente || null)
      })
      .catch((e) => setAviso((e as Error).message))
  useEffect(() => {
    void cargar()
  }, [])
  const importar = async () => {
    setImportando(true)
    try {
      const r = await pedir({ importar: JSON.parse(json) })
      setAviso(`Borrador guardado: ${r.slug}. Revísalo abajo.`)
      setJson("")
      await cargar()
    } catch (e) {
      setAviso(e instanceof SyntaxError ? "El texto no es un JSON válido." : (e as Error).message)
    } finally {
      setImportando(false)
    }
  }
  const generar = async () => {
    try {
      await pedir({ generar: true })
      setAviso("El agente está trabajando: investiga y diseña los planos (tarda de 10 a 30 minutos). Los borradores aparecen aquí; recarga en un rato.")
      await cargar()
    } catch (e) {
      setAviso((e as Error).message)
    }
  }
  const borradores = (planos || []).filter((p) => p.estado === "borrador")
  const otros = (planos || []).filter((p) => p.estado !== "borrador")

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Planos IA</h1>
      <p style={{ color: C.tenue, margin: "0 0 12px", fontSize: 14 }}>
        Planos nuevos para la Biblioteca. Cada uno pasó la revisión automática (piezas que se tocan, grosores, caben en la hoja, pasos completos). Ábrelo
        completo, revisa que tenga sentido como mueble y publícalo: sale en /planos, en la tienda con ofertas de talleres y en redes. Nada se publica solo.
      </p>
      {aviso && <div style={{ ...caja, fontSize: 14 }}>{aviso}</div>}
      <div style={caja}>
        <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Agente semanal (lunes 7:23)</p>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: C.tenue }}>
          {!agente?.ia
            ? "Falta la llave de IA (ANTHROPIC_API_KEY) en el servidor."
            : agente.corriendo
              ? "Trabajando ahora…"
              : agente.inicio
                ? `Última corrida: ${new Date(agente.inicio).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} · ${agente.estado} · ${agente.creados || 0} planos nuevos`
                : "Todavía no ha corrido."}
        </p>
        <button type="button" style={boton} disabled={!agente?.ia || agente?.corriendo} onClick={() => void generar()}>
          Generar ahora
        </button>
        {agente?.bitacora?.length ? (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>Bitácora de la última corrida</summary>
            <ul style={{ fontSize: 12, color: C.tenue, margin: "6px 0 0", paddingLeft: 18 }}>
              {agente.bitacora.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <h2 style={{ fontSize: 16, margin: "16px 0 8px" }}>Por revisar ({borradores.length})</h2>
      {planos && !borradores.length && <p style={{ color: C.tenue, fontSize: 14 }}>No hay borradores.</p>}
      {borradores.map((p) => (
        <Tarjeta key={p.slug} p={p} alTerminar={(m) => (setAviso(m), void cargar())} />
      ))}
      {otros.length > 0 && <h2 style={{ fontSize: 16, margin: "20px 0 8px" }}>Publicados y rechazados</h2>}
      {otros.map((p) => (
        <Tarjeta key={p.slug} p={p} alTerminar={(m) => (setAviso(m), void cargar())} />
      ))}
      <details style={{ ...caja, marginTop: 20 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Importar un plano (JSON)</summary>
        <p style={{ fontSize: 13, color: C.tenue }}>Mismo formato que los planos de la Biblioteca (slug, categoria, nombre, resumen, descripcion, nivel, horas, piezas, pasos, herrajes, herramientas, notas). Queda como borrador.</p>
        <textarea style={{ ...campo, minHeight: 160 }} value={json} onChange={(e) => setJson(e.target.value)} />
        <button type="button" style={{ ...boton, marginTop: 8 }} disabled={importando || !json.trim()} onClick={() => void importar()}>
          {importando ? "Revisando…" : "Guardar borrador"}
        </button>
      </details>
    </div>
  )
}

export const config = {
  label: "Planos IA",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
}
