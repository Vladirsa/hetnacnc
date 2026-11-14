// Pantalla "Categorías ocultas" del dashboard (catálogo honesto, tarea 1 de la
// auditoría de mejoras). Lista las categorías que la tienda no muestra porque
// no tienen productos publicados. No se borra nada: en cuanto una tenga un
// producto publicado, vuelve a salir sola en el menú, la tienda y el mapa del
// sitio (puede tardar hasta 5 minutos).
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Fila = { id: string; nombre: string; handle: string; ruta: string; productos: number; servicio: boolean }
type Datos = { ocultas: Fila[]; visibles: Fila[] }

const tokenLocal = (): string | null => {
  try {
    return localStorage.getItem("medusa_auth_token")
  } catch {
    return null
  }
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 900, margin: "0 auto", padding: "24px 16px 60px" },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "6px 0 18px", lineHeight: 1.5 },
  h2: { fontSize: 16, fontWeight: 700, margin: "22px 0 8px" },
  tabla: { width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #E7E4DC", color: "#6B675C", fontWeight: 600 },
  td: { padding: "8px 10px", borderBottom: "1px solid #F1EEE7" },
}

export default function CategoriasOcultas() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const t = tokenLocal()
    fetch("/admin/hetna-categorias-vacias", { credentials: "include", headers: t ? { authorization: `Bearer ${t}` } : {} })
      .then(async (r) => {
        if (r.status === 401) throw new Error("Tu sesión venció. Vuelve a entrar al dashboard.")
        if (!r.ok) throw new Error(`Error ${r.status}`)
        return r.json()
      })
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [])

  const Tabla = ({ filas, conteo }: { filas: Fila[]; conteo: boolean }) => (
    <table style={S.tabla}>
      <thead>
        <tr>
          <th style={S.th}>Categoría</th>
          <th style={S.th}>Dirección</th>
          {conteo && <th style={S.th}>Productos</th>}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.id}>
            <td style={S.td}>{f.ruta}</td>
            <td style={{ ...S.td, color: "#6B675C" }}>/categories/{f.handle}</td>
            {conteo && <td style={S.td}>{f.servicio && !f.productos ? "Servicio (siempre visible)" : f.productos}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Categorías ocultas</h1>
      <p style={S.sub}>
        La tienda no muestra una categoría si ni ella ni sus subcategorías tienen productos publicados: no sale en el menú, en
        la portada ni en el mapa del sitio, y su página queda fuera de Google con un aviso para cotizar. Nada se borra. Para
        reactivar una, publica un producto en ella: vuelve a salir sola en unos minutos.
      </p>
      {error && <p style={{ color: "#B91C1C" }}>{error}</p>}
      {!datos && !error && <p style={S.sub}>Cargando…</p>}
      {datos && (
        <>
          <h2 style={S.h2}>Ocultas ({datos.ocultas.length})</h2>
          {datos.ocultas.length ? <Tabla filas={datos.ocultas} conteo={false} /> : <p style={S.sub}>Ninguna: todas tienen productos.</p>}
          <h2 style={S.h2}>Visibles ({datos.visibles.length})</h2>
          <Tabla filas={datos.visibles} conteo />
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Categorías ocultas",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-2.4 3.4M6.1 6.1A12.5 12.5 0 0 0 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4-.9" />
    </svg>
  ),
}
