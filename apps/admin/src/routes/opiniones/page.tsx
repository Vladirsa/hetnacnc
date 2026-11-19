// Dashboard > Opiniones: lo que dicen talleres y clientes registrados de HETNA
// (buzón de Mi cuenta, tarjeta del tablero del taller y encuesta de los 7 días).
// Arriba el NPS de los últimos 90 días: % que nos recomendaría (9-10) menos %
// que no (0-6). Backend: GET /admin/hetna-opiniones (packages/api/src/lib/opiniones.ts).
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Nps = { nps: number | null; promotores: number; pasivos: number; detractores: number; total: number }
type Opinion = {
  id: number
  quien: "taller" | "cliente"
  nombre: string | null
  email: string | null
  puntaje: number | null
  comentario: string | null
  origen: "buzon" | "encuesta"
  pagina: string | null
  created_at: string
}
type Datos = { opiniones: Opinion[]; nps: { todos: Nps; taller: Nps; cliente: Nps } }

const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", tenue: "var(--fg-subtle, #6b6a63)" }
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16 }

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

const colorPuntaje = (p: number) => (p <= 6 ? "#B42318" : p <= 8 ? "#B54708" : "#1E7B3A")

function TarjetaNps({ titulo, n }: { titulo: string; n: Nps }) {
  return (
    <div style={{ ...caja, flex: "1 1 200px" }}>
      <p style={{ margin: 0, fontSize: 13, color: C.tenue }}>{titulo}</p>
      <p style={{ margin: "4px 0", fontSize: 28, fontWeight: 800, color: n.nps === null ? C.tenue : n.nps >= 30 ? "#1E7B3A" : n.nps >= 0 ? "#B54708" : "#B42318" }}>
        {n.nps === null ? "—" : n.nps}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: C.tenue }}>
        {n.total ? `${n.total} calificaciones · 🟢 ${n.promotores} · 🟡 ${n.pasivos} · 🔴 ${n.detractores}` : "Sin calificaciones todavía"}
      </p>
    </div>
  )
}

export default function OpinionesPage() {
  const [d, setD] = useState<Datos | null>(null)
  const [quien, setQuien] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    setError("")
    fetch(`/admin/hetna-opiniones${quien ? `?quien=${quien}` : ""}`, { credentials: "include", headers: cabeceras() })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudieron cargar las opiniones.")
        setD(await r.json())
      })
      .catch((e) => setError((e as Error).message))
  }, [quien])

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Opiniones de talleres y clientes</h1>
      <p style={{ color: C.tenue, margin: "0 0 16px", fontSize: 14 }}>
        Llegan del botón «¿Qué mejorarías?» (Mi cuenta y tablero del taller) y de la encuesta que sale sola a los 7 días del registro. Cada una también te
        llega por Telegram.
      </p>

      {error && <p style={{ color: "#B42318" }}>{error}</p>}
      {!d && !error && <p style={{ color: C.tenue }}>Cargando…</p>}

      {d && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <TarjetaNps titulo="NPS general (90 días)" n={d.nps.todos} />
            <TarjetaNps titulo="NPS talleres" n={d.nps.taller} />
            <TarjetaNps titulo="NPS clientes" n={d.nps.cliente} />
          </div>
          <p style={{ fontSize: 12, color: C.tenue, margin: "0 0 16px" }}>
            NPS = % que califica 9 o 10 menos % que califica 0 a 6. Arriba de 30 es bueno; abajo de 0, hay que corregir algo.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[
              ["", "Todas"],
              ["taller", "Talleres"],
              ["cliente", "Clientes"],
            ].map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => setQuien(v)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: `1px solid ${C.borde}`,
                  background: quien === v ? "#C2560A" : C.fondo,
                  color: quien === v ? "#fff" : "inherit",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {!d.opiniones.length && <div style={{ ...caja, color: C.tenue }}>Todavía no hay opiniones.</div>}
          <div style={{ display: "grid", gap: 10 }}>
            {d.opiniones.map((o) => (
              <div key={o.id} style={caja}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  {o.puntaje !== null && <span style={{ fontWeight: 800, fontSize: 18, color: colorPuntaje(o.puntaje) }}>{o.puntaje}/10</span>}
                  <span style={{ fontWeight: 700 }}>{o.nombre || o.email || "—"}</span>
                  <span style={{ fontSize: 12, color: C.tenue }}>
                    {o.quien === "taller" ? "Taller" : "Cliente"} · {o.origen === "encuesta" ? "encuesta 7 días" : o.pagina || "buzón"} ·{" "}
                    {new Date(o.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  {o.email && (
                    <a href={`mailto:${o.email}`} style={{ marginLeft: "auto", fontSize: 13, color: "#C2560A" }}>
                      Responder
                    </a>
                  )}
                </div>
                {o.comentario && <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{o.comentario}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Opiniones",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </svg>
  ),
}
