// Página "Llaves API" del dashboard: qué funciones del servidor usa cada clave
// secreta (n8n, bot de WhatsApp). Sólo se observa; nada se bloquea todavía.
// Con dos semanas de datos se arma la lista blanca de cada llave.
// Backend: packages/api/src/lib/llaves-uso.ts.
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Llave = { llave: string; nombre: string; revocada: boolean; desde: string | null; rutas: { metodo: string; ruta: string; veces: number; ultimo_estado: number | null; ultima: string }[] }

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", tenue: "var(--fg-subtle, #6b6a63)", texto: "var(--fg-base, #1b1b18)", rojo: "#b42318" }
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16 }
const fecha = (s?: string | null) => (s ? new Date(s).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")

const LlavesPage = () => {
  const [llaves, setLlaves] = useState<Llave[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/admin/hetna-llaves", { credentials: "include", headers: cabeceras() })
      .then(async (r) => {
        const c = await r.json().catch(() => ({}))
        if (r.status === 401) throw new Error("No se pudo verificar tu sesión de administrador. Vuelve a entrar y recarga.")
        if (!r.ok) throw new Error(c?.message || `Error ${r.status}`)
        setLlaves(c.llaves || [])
      })
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 4, color: C.texto }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Llaves API</h1>
        <p style={{ margin: "4px 0 0", color: C.tenue, fontSize: 13 }}>
          Qué usa cada clave secreta (n8n, bot de WhatsApp…). Por ahora sólo se observa: nada se bloquea. En dos semanas, con esta lista, cada llave queda limitada a lo que de verdad usa.
        </p>
      </div>
      {error && <p style={{ color: C.rojo, margin: 0 }}>{error}</p>}
      {llaves && llaves.length === 0 && <div style={caja}>Todavía no hay peticiones con clave API anotadas. Aparecen aquí unos minutos después de que n8n o el bot usen el servidor.</div>}
      {llaves?.map((l) => (
        <section key={l.llave} style={caja}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{l.nombre} {l.revocada && <span style={{ color: C.rojo }}>(revocada)</span>}</h3>
          <p style={{ margin: "2px 0 10px", color: C.tenue, fontSize: 12.5 }}>Observando desde {fecha(l.desde)} · {l.rutas.length} funciones</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.tenue }}><th>Método</th><th>Ruta</th><th>Veces</th><th>Último resultado</th><th>Última vez</th></tr>
            </thead>
            <tbody>
              {l.rutas.map((r) => (
                <tr key={`${r.metodo} ${r.ruta}`} style={{ borderTop: `1px solid ${C.borde}` }}>
                  <td style={{ padding: "4px 6px 4px 0" }}>{r.metodo}</td>
                  <td style={{ padding: "4px 6px 4px 0", fontFamily: "monospace" }}>{r.ruta}</td>
                  <td>{r.veces}</td>
                  <td style={{ color: (r.ultimo_estado || 0) >= 400 ? C.rojo : undefined }}>{r.ultimo_estado ?? "—"}</td>
                  <td>{fecha(r.ultima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}

export const config = {
  label: "Llaves API",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" />
    </svg>
  ),
}

export default LlavesPage
