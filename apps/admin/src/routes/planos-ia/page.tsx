// Dashboard > Planos IA: planos de la Biblioteca guardados en la base de datos
// (packages/api/src/lib/planos-biblioteca.ts). Los propone el agente semanal o
// se importan a mano; nada se publica solo: aquí se ven en vista previa y se
// publican o rechazan. Al publicar se crea su producto en la tienda.
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
}

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

function Tarjeta({ p, alTerminar }: { p: Plano; alTerminar: (m: string) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
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
          </>
        )}
      </div>
    </div>
  )
}

export default function PlanosIaPage() {
  const [planos, setPlanos] = useState<Plano[] | null>(null)
  const [aviso, setAviso] = useState("")
  const [json, setJson] = useState("")
  const [importando, setImportando] = useState(false)
  const cargar = () =>
    pedir()
      .then((d) => setPlanos(d.planos))
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
