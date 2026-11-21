// Dashboard > Diseños gratis: SVG con licencia libre (dominio público, CC0,
// CC BY, CC BY-SA) que el agente encontró en Wikimedia Commons
// (packages/api/src/lib/disenos-gratis.ts). «Publicar gratis» baja el archivo,
// lo limpia, arma la ficha con IA (con el crédito al autor) y lo publica como
// descarga gratis en la tienda de HETNA.
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Candidato = {
  id: number
  titulo: string
  autor: string | null
  licencia: string
  pagina_url: string
  preview_url: string | null
  tema: string | null
  producto_url: string | null
  error: string | null
}
type Datos = { pendientes: Candidato[]; publicados: Candidato[]; temas: string[] }

const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", tenue: "var(--fg-subtle, #6b6a63)", naranja: "#C2560A" }
const boton: CSSProperties = { background: C.naranja, color: "#fff", border: 0, borderRadius: 8, padding: "7px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13 }
const botonClaro: CSSProperties = { ...boton, background: "transparent", color: "inherit", border: `1px solid ${C.borde}` }

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
const pedir = async (cuerpo?: unknown) => {
  const r = await fetch("/admin/hetna-disenos-gratis", {
    method: cuerpo ? "POST" : "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...cabeceras() },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(d?.message || "No se pudo completar.")
  return d
}

export default function DisenosGratisPage() {
  const [d, setD] = useState<Datos | null>(null)
  const [aviso, setAviso] = useState("")
  const [ocupado, setOcupado] = useState<number | "buscar" | null>(null)
  const [tema, setTema] = useState("")
  const cargar = () => pedir().then(setD).catch((e) => setAviso((e as Error).message))
  useEffect(() => {
    void cargar()
  }, [])

  const accion = async (id: number, a: "publicar" | "descartar") => {
    setOcupado(id)
    setAviso(a === "publicar" ? "Publicando (armando la ficha con IA, tarda unos 30 segundos)…" : "")
    try {
      const r = await pedir({ id, accion: a })
      setAviso(a === "publicar" ? `✅ Publicado: ${r.url}` : "Descartado")
    } catch (e) {
      setAviso(`No se pudo: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
      void cargar()
    }
  }
  const buscar = async () => {
    if (!tema.trim()) return
    setOcupado("buscar")
    try {
      const r = await pedir({ buscar: tema.trim() })
      setAviso(`${r.nuevos} diseño(s) nuevo(s) de «${tema}».`)
      await cargar()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Diseños gratis</h1>
      <p style={{ color: C.tenue, margin: "0 0 12px", fontSize: 14 }}>
        Archivos SVG con licencia libre que encontró el agente (sólo dominio público, CC0, CC BY y CC BY-SA; nunca «no comercial», logos ni marcas). Al
        publicar se cita al autor y la licencia en la ficha. Revisa la imagen antes: si no sirve para cortar o grabar, descártalo.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          list="temas-disenos"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Buscar más: mandala, celtic knot, skull…"
          style={{ padding: "7px 10px", border: `1px solid ${C.borde}`, borderRadius: 8, minWidth: 280, background: C.fondo, color: "inherit" }}
        />
        <datalist id="temas-disenos">{d?.temas.map((t) => <option key={t} value={t} />)}</datalist>
        <button type="button" style={botonClaro} disabled={ocupado !== null} onClick={() => void buscar()}>
          {ocupado === "buscar" ? "Buscando…" : "Buscar"}
        </button>
        <span style={{ fontSize: 12, color: C.tenue }}>Wikimedia busca mejor en inglés.</span>
      </div>
      {aviso && <p style={{ background: "#F7F5F0", border: `1px solid ${C.borde}`, borderRadius: 10, padding: 10, wordBreak: "break-all" }}>{aviso}</p>}
      {!d && <p style={{ color: C.tenue }}>Cargando…</p>}
      {d && !d.pendientes.length && <p style={{ color: C.tenue }}>No hay diseños por revisar. El agente busca más los martes y viernes.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
        {d?.pendientes.map((c) => (
          <div key={c.id} style={{ background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 10 }}>
            <div style={{ background: "#fff", borderRadius: 8, height: 180, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {c.preview_url ? <img src={c.preview_url} alt={c.titulo} style={{ maxWidth: "100%", maxHeight: 180 }} loading="lazy" /> : "Sin vista previa"}
            </div>
            <p style={{ margin: "8px 0 2px", fontWeight: 700, fontSize: 13 }}>{c.titulo}</p>
            <p style={{ margin: 0, fontSize: 12, color: C.tenue }}>
              {c.licencia} · {c.autor || "autor sin nombre"} ·{" "}
              <a href={c.pagina_url} target="_blank" rel="noreferrer">
                fuente
              </a>
            </p>
            {c.error && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#B42318" }}>{c.error}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" style={boton} disabled={ocupado !== null} onClick={() => void accion(c.id, "publicar")}>
                {ocupado === c.id ? "Publicando…" : "Publicar gratis"}
              </button>
              <button type="button" style={botonClaro} disabled={ocupado !== null} onClick={() => void accion(c.id, "descartar")}>
                Descartar
              </button>
            </div>
          </div>
        ))}
      </div>
      {d && d.publicados.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "20px 0 8px" }}>Publicados</h2>
          {d.publicados.map((c) => (
            <p key={c.id} style={{ margin: "0 0 4px", fontSize: 13 }}>
              ✅ <a href={c.producto_url || "#"} target="_blank" rel="noreferrer">{c.titulo}</a> · {c.licencia}
            </p>
          ))}
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Diseños gratis",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
    </svg>
  ),
}
