// Página "Trabajos CAM" del dashboard (menú lateral).
// Las piezas que los clientes mandan desde el Laboratorio CAM 3/4/5 ejes
// (hetnacnc.com/mx/cam/lab). Aquí se ve la configuración de su máquina, se
// descargan su modelo y su G-code, se cambia el estado y se suben los
// archivos finales que el cliente descarga en "Mis trabajos CAM".
//
// Habla directo con el backend (/admin/cam/jobs, mismo dominio) con la sesión
// con la que entraste al dashboard.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

// ---------- Tipos ----------
type Estado = "received" | "in_cart" | "paid" | "in_review" | "delivered" | "cancelled"

type Trabajo = {
  id: string
  status: Estado
  service: "cam_3" | "cam_4" | "cam_5" | "post"
  tier: string | null
  email: string | null
  customer_id: string | null
  order_id: string | null
  model_name: string
  model_file_id: string | null
  gcode_file_id: string | null
  deliverables: { id: string; url: string; name: string }[] | null
  controller: string | null
  kinematics: string | null
  config: Record<string, any>
  stats: Record<string, number> | null
  review_requested: boolean
  customer_notes: string | null
  internal_notes: string | null
  created_at: string
  paid_at: string | null
  delivered_at: string | null
}

const ESTADOS: Record<Estado, { texto: string; fondo: string; color: string }> = {
  received: { texto: "Recibido", fondo: "#e7e4dc", color: "#44433d" },
  in_cart: { texto: "En carrito", fondo: "#dbe8fb", color: "#1d4f91" },
  paid: { texto: "Pagado", fondo: "#fde8cf", color: "#9a4a05" },
  in_review: { texto: "En revisión", fondo: "#ece1fb", color: "#5b2a9b" },
  delivered: { texto: "Entregado", fondo: "#d9f2e3", color: "#16794f" },
  cancelled: { texto: "Cancelado", fondo: "#f8dada", color: "#9b1c1c" },
}

const SERVICIOS: Record<Trabajo["service"], string> = {
  cam_3: "CAM 3 ejes",
  cam_4: "CAM 4 ejes",
  cam_5: "CAM 5 ejes",
  post: "Posprocesador",
}

const POR_PAGINA = 30

// ---------- Comunicación con el backend ----------
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
  const t = tokenLocal()
  return t ? { authorization: `Bearer ${t}` } : {}
}

async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin/cam${ruta}`, {
      ...init,
      credentials: "include",
      headers: { ...cabeceras(), ...(init.headers || {}) },
    })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const cuerpo = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(cuerpo?.message || `Error ${r.status}`)
  return cuerpo
}

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-MX") : "—")

// ---------- Estilos ----------
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
const boton = (primario: boolean): CSSProperties => ({
  cursor: "pointer",
  borderRadius: 10,
  padding: "9px 14px",
  fontSize: 14,
  fontWeight: 700,
  border: primario ? "none" : `1px solid ${C.borde}`,
  background: primario ? C.naranja : C.fondo,
  color: primario ? "#fff" : C.texto,
})
const campo: CSSProperties = {
  border: `1px solid ${C.borde}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 14,
  background: C.fondo,
  color: C.texto,
}
const celda: CSSProperties = { padding: "10px 12px", borderBottom: `1px solid ${C.borde}`, fontSize: 13.5, textAlign: "left" }

function Insignia({ estado }: { estado: Estado }) {
  const e = ESTADOS[estado] ?? ESTADOS.received
  return (
    <span style={{ background: e.fondo, color: e.color, borderRadius: 999, padding: "3px 10px", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {e.texto}
    </span>
  )
}

function Aviso({ tono, children }: { tono: "ok" | "error"; children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 14,
        background: tono === "ok" ? "#d9f2e3" : "#f8dada",
        color: tono === "ok" ? "#16794f" : "#9b1c1c",
      }}
    >
      {children}
    </div>
  )
}

// ---------- Página ----------
const TrabajosCamPage = () => {
  const [estado, setEstado] = useState<"" | Estado>("")
  const [q, setQ] = useState("")
  const [offset, setOffset] = useState(0)
  const [lista, setLista] = useState<{ jobs: Trabajo[]; count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    const qs = new URLSearchParams({ limit: String(POR_PAGINA), offset: String(offset) })
    if (estado) qs.set("status", estado)
    if (q.trim()) qs.set("q", q.trim())
    try {
      setLista(await api<{ jobs: Trabajo[]; count: number }>(`/jobs?${qs}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [estado, q, offset])

  useEffect(() => {
    const t = setTimeout(() => void cargar(), q ? 300 : 0)
    return () => clearTimeout(t)
  }, [cargar, q])

  const jobs = lista?.jobs ?? []
  const total = lista?.count ?? 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: C.texto }}>
      <div style={{ ...caja, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Trabajos CAM</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: C.tenue }}>
            Piezas que los clientes mandaron desde el Laboratorio CAM 3, 4 y 5 ejes.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            style={campo}
            placeholder="Buscar pieza, correo o folio"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOffset(0)
            }}
          />
          <select
            style={campo}
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as "" | Estado)
              setOffset(0)
            }}
          >
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADOS) as Estado[]).map((k) => (
              <option key={k} value={k}>
                {ESTADOS[k].texto}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <Aviso tono="error">{error}</Aviso> : null}

      <div style={{ ...caja, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.suave }}>
              {["Fecha", "Pieza", "Servicio", "Nivel", "Cliente", "Estado"].map((h) => (
                <th key={h} style={{ ...celda, fontWeight: 700, color: C.tenue }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!lista && !error ? (
              <tr>
                <td style={celda} colSpan={6}>
                  Cargando…
                </td>
              </tr>
            ) : null}
            {lista && !jobs.length ? (
              <tr>
                <td style={{ ...celda, color: C.tenue }} colSpan={6}>
                  Todavía no hay trabajos{estado ? " con ese estado" : ""}.
                </td>
              </tr>
            ) : null}
            {jobs.map((j) => (
              <tr key={j.id} onClick={() => setAbierto(j.id)} style={{ cursor: "pointer" }}>
                <td style={celda}>{fecha(j.created_at)}</td>
                <td style={{ ...celda, fontWeight: 600, wordBreak: "break-all" }}>{j.model_name}</td>
                <td style={celda}>
                  {SERVICIOS[j.service]}
                  {j.review_requested ? " + revisión" : ""}
                </td>
                <td style={celda}>{j.tier ?? "—"}</td>
                <td style={celda}>{j.email ?? j.customer_id ?? "—"}</td>
                <td style={celda}>
                  <Insignia estado={j.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > POR_PAGINA ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: C.tenue }}>
          <button style={boton(false)} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - POR_PAGINA))}>
            Anterior
          </button>
          <span>
            {offset + 1}–{Math.min(offset + POR_PAGINA, total)} de {total}
          </span>
          <button style={boton(false)} disabled={offset + POR_PAGINA >= total} onClick={() => setOffset(offset + POR_PAGINA)}>
            Siguiente
          </button>
        </div>
      ) : null}

      {abierto ? (
        <Detalle
          id={abierto}
          onCerrar={() => setAbierto(null)}
          onCambio={() => void cargar()}
        />
      ) : null}
    </div>
  )
}

// ---------- Detalle de un trabajo ----------
function Detalle({ id, onCerrar, onCambio }: { id: string; onCerrar: () => void; onCambio: () => void }) {
  const [job, setJob] = useState<Trabajo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [estado, setEstado] = useState<Estado>("received")
  const [notas, setNotas] = useState("")
  const [archivos, setArchivos] = useState<File[]>([])
  const [entregar, setEntregar] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  const poner = (j: Trabajo) => {
    setJob(j)
    setEstado(j.status)
    setNotas(j.internal_notes ?? "")
  }

  useEffect(() => {
    setJob(null)
    setError(null)
    setOk(null)
    api<{ job: Trabajo }>(`/jobs/${id}`)
      .then(({ job }) => poner(job))
      .catch((e) => setError((e as Error).message))
  }, [id])

  const guardar = async () => {
    setOcupado(true)
    setError(null)
    setOk(null)
    try {
      const { job } = await api<{ job: Trabajo }>(`/jobs/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: estado, internal_notes: notas }),
      })
      poner(job)
      setOk("Trabajo actualizado.")
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const subir = async () => {
    if (!archivos.length) return
    setOcupado(true)
    setError(null)
    setOk(null)
    try {
      const form = new FormData()
      archivos.forEach((f) => form.append("files", f))
      form.append("mark_delivered", entregar ? "true" : "false")
      const { job } = await api<{ job: Trabajo }>(`/jobs/${id}/deliverables`, { method: "POST", body: form })
      poner(job)
      setArchivos([])
      setOk(entregar ? "Archivos subidos y trabajo entregado." : "Archivos subidos.")
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const descargar = async (fileId: string) => {
    try {
      const { url } = await api<{ url: string }>(`/jobs/${id}/files/${encodeURIComponent(fileId)}?json=1`)
      window.open(url, "_blank", "noopener")
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const cfg = job?.config ?? {}
  const st = job?.stats ?? {}
  const filas: [string, string][] = job
    ? [
        ["Folio", job.id],
        ["Servicio", `${SERVICIOS[job.service]}${job.tier ? ` · ${job.tier}` : ""}${job.review_requested ? " + revisión" : ""}`],
        ["Cliente", job.email ?? job.customer_id ?? "—"],
        ["Pedido", job.order_id ?? "—"],
        ["Controlador", cfg.controller?.name ?? job.controller ?? "—"],
        ["Cinemática", cfg.machine?.kinematics ?? job.kinematics ?? "—"],
        ["Herramienta", cfg.tool ? `T${cfg.tool.number} ${cfg.tool.name} Ø${cfg.tool.diameter}` : "—"],
        ["Material", cfg.cutting?.material ?? "—"],
        ["Tiempo estimado", st.minutes != null ? `${Number(st.minutes).toFixed(1)} min` : "—"],
        ["Puntos de corte", st.points != null ? String(st.points) : "—"],
        ["Colisiones sin resolver", st.collisions != null ? String(st.collisions) : "—"],
        ["Creado", fecha(job.created_at)],
        ["Pagado", fecha(job.paid_at)],
        ["Entregado", fecha(job.delivered_at)],
      ]
    : []

  const enlace: CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: C.naranja,
    fontWeight: 600,
    fontSize: 14,
    textAlign: "left",
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", height: "100%", overflowY: "auto", background: C.fondo, padding: 20, display: "flex", flexDirection: "column", gap: 16, color: C.texto }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, wordBreak: "break-all" }}>{job?.model_name ?? "Trabajo CAM"}</h2>
          <button style={boton(false)} onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        {error ? <Aviso tono="error">{error}</Aviso> : null}
        {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
        {!job && !error ? <p style={{ color: C.tenue }}>Cargando…</p> : null}

        {job ? (
          <>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", margin: 0, fontSize: 13.5 }}>
              {filas.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt style={{ color: C.tenue }}>{k}</dt>
                  <dd style={{ margin: 0, wordBreak: "break-all" }}>{v}</dd>
                </div>
              ))}
            </dl>

            {job.customer_notes ? (
              <div style={caja}>
                <strong style={{ fontSize: 13.5 }}>Notas del cliente</strong>
                <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontSize: 14 }}>{job.customer_notes}</p>
              </div>
            ) : null}

            <div style={{ ...caja, display: "flex", flexDirection: "column", gap: 6 }}>
              <strong style={{ fontSize: 13.5 }}>Archivos</strong>
              {job.model_file_id ? (
                <button style={enlace} onClick={() => void descargar(job.model_file_id!)}>
                  Modelo 3D del cliente
                </button>
              ) : null}
              {job.gcode_file_id ? (
                <button style={enlace} onClick={() => void descargar(job.gcode_file_id!)}>
                  G-code generado en el laboratorio
                </button>
              ) : null}
              {(job.deliverables ?? []).map((d) => (
                <button key={d.id} style={enlace} onClick={() => void descargar(d.id)}>
                  Entregable: {d.name}
                </button>
              ))}
            </div>

            <div style={{ ...caja, display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontSize: 13.5 }}>Estado y notas internas</strong>
              <select style={campo} value={estado} onChange={(e) => setEstado(e.target.value as Estado)}>
                {(Object.keys(ESTADOS) as Estado[]).map((k) => (
                  <option key={k} value={k}>
                    {ESTADOS[k].texto}
                  </option>
                ))}
              </select>
              <textarea style={{ ...campo, minHeight: 90 }} value={notas} onChange={(e) => setNotas(e.target.value)} />
              <button style={boton(true)} disabled={ocupado} onClick={() => void guardar()}>
                {ocupado ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>

            <div style={{ ...caja, display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontSize: 13.5 }}>Entregar archivos al cliente</strong>
              <input type="file" multiple onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={entregar} onChange={(e) => setEntregar(e.target.checked)} />
                Marcar como entregado
              </label>
              <button style={boton(false)} disabled={ocupado || !archivos.length} onClick={() => void subir()}>
                Subir {archivos.length ? `${archivos.length} archivo(s)` : "archivos"}
              </button>
            </div>

            <details>
              <summary style={{ cursor: "pointer", fontSize: 13.5, color: C.tenue }}>Configuración completa (JSON)</summary>
              <pre style={{ marginTop: 8, maxHeight: 320, overflow: "auto", background: C.suave, borderRadius: 8, padding: 10, fontSize: 12 }}>
                {JSON.stringify(job.config, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </div>
    </div>
  )
}

export const config = {
  label: "Trabajos CAM",
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
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
    </svg>
  ),
}

export default TrabajosCamPage
