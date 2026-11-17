// Pantalla "Importar catálogo" del panel de administración: HETNA publica de
// golpe productos físicos de distribuidores, como vendedor HETNA CNC.
// Backend: /admin/hetna-catalogo (packages/api/src/api/admin/hetna-catalogo).
//
// Se pega la tabla copiada de Excel o Google Sheets (o un CSV) con estos
// encabezados en la primera fila; primero se revisa y luego se publica.
import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"

const COLUMNAS = ["titulo", "categoria", "precio", "existencias", "peso_kg", "largo_cm", "ancho_cm", "alto_cm", "fotos", "descripcion", "condicion", "sku"]
const EJEMPLO =
  COLUMNAS.join("\t") +
  "\nFresa recta 2 filos 6 mm para MDF\tFresas y brocas\t189\t25\t0.1\t15\t5\t3\thttps://ejemplo.com/fresa.jpg\tFresa de carburo para router\tnuevo\tFR-6-2F"

type Categoria = { id: string; ruta: string; nombre: string }
type Resultado = { fila: number; ok: boolean; titulo: string; product_id?: string; handle?: string; error?: string }

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

/** Tabla pegada de Excel (tabuladores) o CSV con comas o punto y coma; respeta comillas. */
function leerTabla(texto: string): Record<string, string>[] {
  const lineas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim())
  if (lineas.length < 2) return []
  const sep = lineas[0].includes("\t") ? "\t" : lineas[0].includes(";") ? ";" : ","
  const partir = (l: string) => {
    const out: string[] = []
    let actual = ""
    let comillas = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (ch === '"') {
        if (comillas && l[i + 1] === '"') {
          actual += '"'
          i++
        } else comillas = !comillas
      } else if (ch === sep && !comillas) {
        out.push(actual)
        actual = ""
      } else actual += ch
    }
    out.push(actual)
    return out.map((x) => x.trim())
  }
  const enc = partir(lineas[0]).map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_"))
  return lineas.slice(1).map((l) => {
    const v = partir(l)
    return Object.fromEntries(enc.map((h, i) => [h, v[i] ?? ""]))
  })
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px 60px" },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  p: { color: "#6B675C", fontSize: 14, lineHeight: 1.5, margin: "6px 0 14px" },
  area: { width: "100%", minHeight: 220, fontFamily: "monospace", fontSize: 12, border: "1px solid #D9D5C9", borderRadius: 10, padding: 10 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer" },
  btn2: { background: "#fff", color: "#1B1B18", border: "1px solid #D9D5C9", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer" },
  td: { borderTop: "1px solid #EDEAE2", padding: "6px 8px", fontSize: 13, verticalAlign: "top" },
}

export default function ImportarCatalogo() {
  const [info, setInfo] = useState<{ vendedor: { name: string } | null; categorias: Categoria[]; max_filas: number } | null>(null)
  const [texto, setTexto] = useState("")
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [revisado, setRevisado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    fetch("/admin/hetna-catalogo", { credentials: "include", headers: cabeceras() })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setMsg("No se pudo cargar la lista de categorías."))
  }, [])

  const filas = useMemo(() => leerTabla(texto), [texto])

  const enviar = async (simular: boolean) => {
    setTrabajando(true)
    setMsg("")
    try {
      const r = await fetch("/admin/hetna-catalogo", {
        method: "POST",
        credentials: "include",
        headers: { ...cabeceras(), "content-type": "application/json" },
        body: JSON.stringify({ filas, simular }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.message || "No se pudo procesar.")
      setResultados(j.resultados || [])
      setRevisado(simular && (j.resultados || []).every((x: Resultado) => x.ok))
      const buenos = (j.resultados || []).filter((x: Resultado) => x.ok).length
      setMsg(simular ? `Revisión: ${buenos} de ${filas.length} listos para publicar.` : `Publicados ${buenos} de ${filas.length} como ${j.vendedor}.`)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Importar catálogo</h1>
      <p style={S.p}>
        Publica de golpe productos físicos de un distribuidor como <b>{info?.vendedor?.name || "HETNA CNC"}</b>. Copia la tabla desde Excel o Google
        Sheets (con los encabezados en la primera fila) y pégala aquí. Columnas: <code>{COLUMNAS.join(", ")}</code>. En <code>fotos</code> van las ligas
        separadas por <code>|</code>; peso en kilos y medidas del paquete en centímetros. Primero toca <b>Revisar</b>: no publica nada.
      </p>
      <textarea style={S.area} value={texto} onChange={(e) => { setTexto(e.target.value); setResultados(null); setRevisado(false) }} placeholder={EJEMPLO} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", flexWrap: "wrap" }}>
        <button type="button" style={S.btn2} onClick={() => setTexto(EJEMPLO)}>Pegar ejemplo</button>
        <button type="button" style={S.btn2} disabled={!filas.length || trabajando} onClick={() => enviar(true)}>
          Revisar {filas.length ? `(${filas.length})` : ""}
        </button>
        <button type="button" style={{ ...S.btn, opacity: revisado ? 1 : 0.5 }} disabled={!revisado || trabajando} onClick={() => enviar(false)}>
          Publicar {filas.length} productos
        </button>
        {trabajando && <span style={{ fontSize: 13, color: "#6B675C" }}>Trabajando…</span>}
        {msg && <span style={{ fontSize: 13, fontWeight: 600 }}>{msg}</span>}
      </div>
      {resultados && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E7E4DC", borderRadius: 10 }}>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.fila}>
                <td style={S.td}>{r.fila}</td>
                <td style={S.td}>{r.titulo || "(sin título)"}</td>
                <td style={{ ...S.td, color: r.ok ? "#1E7B3A" : "#9B3225" }}>{r.ok ? (r.handle ? `Publicado (${r.handle})` : "Listo") : r.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {info?.categorias?.length ? (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Categorías que puedes usar ({info.categorias.length})</summary>
          <ul style={{ fontSize: 13, color: "#40403A", columns: 2 }}>
            {info.categorias.map((c) => (
              <li key={c.id}>{c.ruta}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export const config = {
  label: "Importar catálogo",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
    </svg>
  ),
}
