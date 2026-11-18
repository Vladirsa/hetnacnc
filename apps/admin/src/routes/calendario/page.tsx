// Pantalla "Google Calendar" del dashboard (menú lateral).
// Liga para suscribir tu Google Calendar a: pedidos de la tienda, cierres de
// licitaciones, entregas prometidas e hitos de producción (lib/calendario.ts).
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

const C = {
  borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)", tenue: "var(--fg-subtle, #6b6a63)", azul: "#142033", rojo: "#b42318", verde: "#1E7B3A",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const boton = (primario = false): CSSProperties => ({
  cursor: "pointer", borderRadius: 10, padding: "8px 13px", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-block",
  border: primario ? "none" : `1px solid ${C.borde}`, background: primario ? C.azul : C.fondo, color: primario ? "#fff" : C.texto,
})

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

type Ligas = { listo: boolean; url?: string; webcal?: string; google?: string }

export default function CalendarioGoogle() {
  const [d, setD] = useState<Ligas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiada, setCopiada] = useState(false)

  useEffect(() => {
    fetch("/admin/hetna-calendario", { credentials: "include", headers: cabeceras() })
      .then(async (r) => {
        if (r.status === 401) throw new Error("No se pudo verificar tu sesión. Cierra sesión, vuelve a entrar y recarga.")
        if (!r.ok) throw new Error(`Error ${r.status}`)
        setD(await r.json())
      })
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div style={{ padding: 20, maxWidth: 760, color: C.texto }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Google Calendar</h1>
      <p style={{ color: C.tenue, fontSize: 13, margin: "0 0 16px" }}>
        Ve en tu calendario los pedidos de la tienda, los cierres de licitaciones, las entregas prometidas y los hitos de producción. Se suscribe una vez y Google lo actualiza solo cada pocas horas.
      </p>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {!d && !error && <p style={{ color: C.tenue }}>Cargando…</p>}
      {d && !d.listo && (
        <div style={caja}>Falta <code>CALENDARIO_SECRET</code> (o <code>JWT_SECRET</code>) en el <code>.env</code> del servidor.</div>
      )}
      {d?.listo && (
        <>
          <div style={caja}>
            <p style={{ margin: "0 0 10px", fontWeight: 700 }}>1. Suscríbete</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={d.google} target="_blank" rel="noreferrer" style={boton(true)}>Agregar a Google Calendar</a>
              <a href={d.webcal} style={boton()}>Abrir en iPhone / Outlook</a>
              <button
                style={boton()}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(d.url || "")
                    setCopiada(true)
                  } catch {
                    setCopiada(false)
                  }
                }}
              >
                {copiada ? "✓ Liga copiada" : "Copiar liga"}
              </button>
            </div>
            <p style={{ color: C.tenue, fontSize: 12, margin: "10px 0 0", wordBreak: "break-all" }}>{d.url}</p>
          </div>
          <div style={caja}>
            <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Si el botón no funciona</p>
            <p style={{ margin: 0, fontSize: 13 }}>
              En Google Calendar (computadora): <b>Otros calendarios → + → Desde URL</b>, pega la liga y listo.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: C.tenue }}>
              Trata esta liga como una contraseña: quien la tenga ve tu calendario.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Google Calendar",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
}
