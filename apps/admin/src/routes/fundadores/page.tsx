// Pantalla "Fundadores" del dashboard (aparece en el menú lateral).
// Aquí marcas a un taller como fundador: insignia + 6 meses de plan Pro gratis, con cupo máximo.
// Usa la misma sesión con la que entraste al dashboard; los datos pasan por el sitio (/api/pub/fundadores/...).
import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"

type Fila = {
  id: string
  nombre: string
  handle: string
  fundador: boolean
  desde: string | null
  vence: string | null
  diasRestantes: number | null
}
type Lista = { ok: true; filas: Fila[]; cupo: number; usados: number; meses: number }
type Falla = { ok: false; error: string }
type Simple = { ok: true } | Falla

const MSG_SESION =
  "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."

const tokenLocal = (): string | null => {
  try {
    return localStorage.getItem("medusa_auth_token")
  } catch {
    return null
  }
}

const cabeceras = (): Record<string, string> => {
  const h: Record<string, string> = { "x-hetna-pub": "1" }
  const t = tokenLocal()
  if (t) h.authorization = `Bearer ${t}`
  return h
}

async function api<T>(ruta: string, cuerpo?: unknown): Promise<T | Falla> {
  try {
    const init: RequestInit =
      cuerpo === undefined
        ? { headers: cabeceras(), credentials: "include" }
        : {
            method: "POST",
            headers: { ...cabeceras(), "content-type": "application/json" },
            body: JSON.stringify(cuerpo),
            credentials: "include",
          }
    const r = await fetch(`/api/pub/fundadores/${ruta}`, init)
    return (await r.json()) as T | Falla
  } catch {
    return { ok: false, error: "No se pudo conectar con el sitio. Revisa tu internet e intenta de nuevo." }
  }
}

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  rojo: "#b42318",
}

const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16 }
const boton = (primario: boolean, peligro = false): CSSProperties => ({
  cursor: "pointer",
  borderRadius: 10,
  padding: "9px 14px",
  fontSize: 14,
  fontWeight: 700,
  border: primario ? "none" : `1px solid ${C.borde}`,
  background: primario ? C.naranja : C.fondo,
  color: primario ? "#fff" : peligro ? C.rojo : C.texto,
})

const dia = (t: string | null) => (t ? t.slice(0, 10) : "")

function Estado({ f }: { f: Fila }) {
  if (!f.fundador) return <span style={{ color: C.tenue, fontSize: 13 }}>Taller normal</span>
  let texto = "Fundador (sin fecha de plan Pro)"
  let fondo = "#e7e4dc"
  let color = "#44433d"
  if (f.vence && f.diasRestantes !== null) {
    if (f.diasRestantes <= 0) {
      texto = `Plan Pro vencido el ${dia(f.vence)}`
      fondo = "#f8dada"
      color = "#9b1c1c"
    } else if (f.diasRestantes <= 30) {
      texto = `Pro hasta ${dia(f.vence)} (${f.diasRestantes} días)`
      fondo = "#fde8cf"
      color = "#9a4a05"
    } else {
      texto = `Pro hasta ${dia(f.vence)} (${f.diasRestantes} días)`
      fondo = "#d9f2e3"
      color = "#16794f"
    }
  }
  return (
    <span style={{ background: fondo, color, borderRadius: 999, padding: "3px 10px", fontSize: 12.5, fontWeight: 700 }}>
      ★ {texto}
    </span>
  )
}

export const config = {
  label: "Fundadores",
  icon: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  ),
}

export default function PaginaFundadores() {
  const [datos, setDatos] = useState<Lista | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [buscar, setBuscar] = useState("")

  const cargar = useCallback(async () => {
    setCargando(true)
    const r = await api<Lista>("lista")
    setCargando(false)
    if (r.ok) {
      setDatos(r)
      setError("")
    } else {
      setError(r.error === "sin_sesion" ? MSG_SESION : r.error)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const accion = async (f: Fila, tipo: "marcar" | "quitar") => {
    const pregunta =
      tipo === "marcar"
        ? `¿Marcar a "${f.nombre}" como Taller fundador?\nSe le dan ${datos?.meses ?? 6} meses de plan Pro gratis a partir de hoy.`
        : `¿Quitar la marca de fundador a "${f.nombre}"?\nPerderá la insignia y se libera un lugar del cupo.`
    if (!window.confirm(pregunta)) return
    setTrabajando(f.id)
    setAviso("")
    const r = await api<Simple>(tipo, { id: f.id })
    setTrabajando(null)
    if (r.ok) {
      setAviso(tipo === "marcar" ? `Listo: ${f.nombre} ya es fundador.` : `Listo: se quitó la marca a ${f.nombre}.`)
      await cargar()
    } else {
      setAviso(r.error === "sin_sesion" ? MSG_SESION : r.error)
    }
  }

  const filas = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    const todas = datos?.filas ?? []
    return q ? todas.filter((f) => `${f.nombre} ${f.handle}`.toLowerCase().includes(q)) : todas
  }, [datos, buscar])

  const lleno = datos ? datos.usados >= datos.cupo : false
  const pct = datos ? Math.min(100, Math.round((datos.usados / datos.cupo) * 100)) : 0

  return (
    <div style={{ display: "grid", gap: 16, padding: 24, maxWidth: 960 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.texto }}>Talleres fundadores</h1>
        <p style={{ margin: "6px 0 0", color: C.tenue, fontSize: 14 }}>
          Marca a los primeros talleres verificados. Reciben la insignia de Taller fundador y {datos?.meses ?? 6} meses de plan
          Pro gratis. Un día antes de que se cumplan 30 días para el vencimiento, n8n te avisa por Telegram.
        </p>
      </header>

      {datos && (
        <section style={caja}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 18, color: C.texto }}>
              {datos.usados} de {datos.cupo} lugares usados
            </strong>
            <span style={{ color: lleno ? C.rojo : C.tenue, fontSize: 13.5, fontWeight: 600 }}>
              {lleno ? "Cupo lleno" : `Quedan ${datos.cupo - datos.usados}`}
            </span>
          </div>
          <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: C.suave, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: lleno ? C.rojo : C.naranja }} />
          </div>
        </section>
      )}

      {aviso && (
        <p style={{ margin: 0, padding: "10px 14px", borderRadius: 10, background: C.suave, color: C.texto, fontWeight: 600, fontSize: 14 }}>
          {aviso}
        </p>
      )}
      {error && <p style={{ margin: 0, color: C.rojo, fontWeight: 600 }}>{error}</p>}
      {cargando && !datos && <p style={{ color: C.tenue }}>Cargando talleres…</p>}

      {datos && (
        <section style={{ ...caja, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.borde}` }}>
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar taller por nombre…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${C.borde}`,
                background: C.fondo,
                color: C.texto,
                fontSize: 14,
              }}
            />
          </div>
          {filas.length === 0 && <p style={{ padding: 16, margin: 0, color: C.tenue }}>No hay talleres que coincidan.</p>}
          {filas.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                padding: "12px 16px",
                borderBottom: `1px solid ${C.borde}`,
              }}
            >
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: C.texto }}>{f.nombre}</div>
                <div style={{ fontSize: 12.5, color: C.tenue }}>{f.handle ? `/${f.handle}` : f.id}</div>
              </div>
              <Estado f={f} />
              <div style={{ display: "flex", gap: 8 }}>
                {!f.fundador && (
                  <button
                    type="button"
                    disabled={lleno || trabajando === f.id}
                    onClick={() => accion(f, "marcar")}
                    style={{ ...boton(true), opacity: lleno || trabajando === f.id ? 0.5 : 1 }}
                  >
                    {trabajando === f.id ? "Guardando…" : "Marcar fundador"}
                  </button>
                )}
                {f.fundador && !f.vence && (
                  <button type="button" disabled={trabajando === f.id} onClick={() => accion(f, "marcar")} style={boton(true)}>
                    Registrar {datos.meses} meses de Pro
                  </button>
                )}
                {f.fundador && (
                  <button type="button" disabled={trabajando === f.id} onClick={() => accion(f, "quitar")} style={boton(false, true)}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
