// Pantalla "Cuentas de clientes" del dashboard (menú lateral).
// Quién confirmó su correo y quién no. Las cuentas que no confirman en 7 días
// y no tienen pedidos se borran solas cada día (casi siempre son robots o
// correos inventados): aquí se ve cuándo. También puedes reenviar la liga.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Cliente = {
  id: string
  email: string
  nombre: string
  telefono: string
  creado: string
  pedidos: number
  confirmado: boolean
  confirmado_en: string | null
  se_borra: string | null
}
type Respuesta = { cuentas: Record<string, number>; dias_para_confirmar: number; clientes: Cliente[] }

const ESTADOS = [
  { v: "sin_confirmar", t: "Sin confirmar" },
  { v: "confirmados", t: "Confirmados" },
  { v: "todos", t: "Todos" },
]

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

async function api<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`/admin/hetna-clientes${ruta}`, {
    credentials: "include",
    ...(cuerpo === undefined
      ? { headers: cabeceras() }
      : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
  })
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error("Tu sesión venció. Cierra sesión, vuelve a entrar y recarga.")
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

const fecha = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—")

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  rojo: "#b42318",
  verde: "#1E7B3A",
  ambar: "#9A5B00",
}
const chip = (fondo: string, color: string): CSSProperties => ({
  display: "inline-block", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700, background: fondo, color,
})
const celda: CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${C.borde}`, fontSize: 13, verticalAlign: "top" }

function Fila({ c }: { c: Cliente }) {
  const [aviso, setAviso] = useState("")
  const reenviar = async () => {
    setAviso("Mandando…")
    try {
      await api("/reenviar", { id: c.id })
      setAviso("Listo, liga y código enviados.")
    } catch (e) {
      setAviso((e as Error).message)
    }
  }
  return (
    <tr>
      <td style={celda}>
        <div style={{ fontWeight: 600 }}>{c.nombre || <span style={{ color: C.rojo }}>(sin nombre)</span>}</div>
        <div style={{ color: C.tenue }}>{c.email}</div>
        {c.telefono && <div style={{ color: C.tenue }}>{c.telefono}</div>}
      </td>
      <td style={celda}>{fecha(c.creado)}</td>
      <td style={celda}>
        {c.confirmado ? (
          <span style={chip("#E7F5EC", C.verde)}>✓ Correo confirmado</span>
        ) : (
          <span style={chip("#FFF4E0", C.ambar)}>Sin confirmar</span>
        )}
        {c.confirmado && c.confirmado_en && <div style={{ color: C.tenue, marginTop: 4 }}>el {fecha(c.confirmado_en)}</div>}
      </td>
      <td style={celda}>{c.pedidos}</td>
      <td style={celda}>
        {c.se_borra ? <span style={{ color: C.rojo }}>Se borra el {fecha(c.se_borra)}</span> : !c.confirmado ? "No se borra (tiene pedidos)" : "—"}
        {!c.confirmado && (
          <div style={{ marginTop: 4 }}>
            <button type="button" onClick={reenviar} style={{ cursor: "pointer", background: "none", border: "none", padding: 0, color: "#0369A1", fontWeight: 600, textDecoration: "underline" }}>
              Reenviar liga y código
            </button>
            {aviso && <div style={{ color: C.tenue, marginTop: 2 }}>{aviso}</div>}
          </div>
        )}
      </td>
    </tr>
  )
}

export default function CuentasClientes() {
  const [estado, setEstado] = useState("sin_confirmar")
  const [q, setQ] = useState("")
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    try {
      setDatos(await api<Respuesta>(`?estado=${estado}&q=${encodeURIComponent(q)}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [estado, q])

  useEffect(() => {
    const t = setTimeout(() => void cargar(), 250)
    return () => clearTimeout(t)
  }, [cargar])

  return (
    <div style={{ padding: 20, color: C.texto, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Cuentas de clientes</h1>
      <p style={{ color: C.tenue, margin: "0 0 16px", fontSize: 14 }}>
        Toda cuenta nueva confirma su correo con una liga o un código de 6 dígitos. Las que no confirman en{" "}
        {datos?.dias_para_confirmar ?? 7} días y no tienen pedidos se borran solas: casi siempre son robots o correos inventados.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {ESTADOS.map((x) => (
          <button key={x.v} type="button" onClick={() => setEstado(x.v)}
            style={{ cursor: "pointer", borderRadius: 10, padding: "8px 14px", fontSize: 14, fontWeight: 700, border: `1px solid ${C.borde}`,
              background: estado === x.v ? C.texto : C.fondo, color: estado === x.v ? C.fondo : C.texto }}>
            {x.t} {datos ? `(${datos.cuentas[x.v] ?? 0})` : ""}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar correo o nombre"
          style={{ flex: 1, minWidth: 200, borderRadius: 10, border: `1px solid ${C.borde}`, padding: "8px 12px", fontSize: 14, background: C.fondo, color: C.texto }} />
      </div>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {!datos ? (
        <p>Cargando...</p>
      ) : datos.clientes.length === 0 ? (
        <p style={{ color: C.tenue }}>No hay cuentas en esta lista.</p>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.borde}`, borderRadius: 12, background: C.fondo }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.suave, textAlign: "left" }}>
                {["Cliente", "Creada", "Correo", "Pedidos", "Limpieza"].map((t) => (
                  <th key={t} style={{ ...celda, fontWeight: 700 }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>{datos.clientes.map((c) => <Fila key={c.id} c={c} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export const config = {
  label: "Cuentas de clientes",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="m16 11 2 2 4-4" />
    </svg>
  ),
}
