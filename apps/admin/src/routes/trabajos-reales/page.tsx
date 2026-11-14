// Pantalla "Trabajos reales" del dashboard (auditoría de mejoras, tareas 5 y 6).
//
//   - Trabajos reales: foto de la pieza terminada, ciudad, material, tipo de
//     trabajo y tiempo de entrega. Salen en el inicio y en Cotizar sólo si
//     están publicados Y tienen permiso del cliente. Sin ninguno, la sección
//     no aparece en el sitio.
//   - Ejemplo de cotización: un trabajo respondido, sin datos del cliente,
//     para la página Cotizar.
//
// La foto se sube con el mismo subidor del panel de Publicidad (/api/pub/subir).
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Caso = {
  id: string
  titulo: string
  foto_url: string
  ciudad: string | null
  material: string | null
  tipo_trabajo: string | null
  tiempo_entrega: string | null
  permiso_cliente: boolean
  publicado: boolean
  orden: number
}
type Ejemplo = { pieza: string; material: string; cantidad: string; precio: string; tiempo: string; propuestas: string }

const VACIO = { titulo: "", foto_url: "", ciudad: "", material: "", tipo_trabajo: "", tiempo_entrega: "", permiso_cliente: false, publicado: false, orden: 0 }
const EJ_VACIO: Ejemplo = { pieza: "", material: "", cantidad: "", precio: "", tiempo: "", propuestas: "" }

const token = (): string | null => {
  try {
    return localStorage.getItem("medusa_auth_token")
  } catch {
    return null
  }
}
const cab = (extra: Record<string, string> = {}) => {
  const t = token()
  return { ...(t ? { authorization: `Bearer ${t}` } : {}), ...extra }
}
async function api<T>(ruta: string, metodo = "GET", cuerpo?: unknown): Promise<T> {
  const r = await fetch(ruta, {
    method: metodo,
    credentials: "include",
    headers: cab(cuerpo === undefined ? {} : { "content-type": "application/json" }),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error("Tu sesión venció. Vuelve a entrar al dashboard.")
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 980, margin: "0 auto", padding: "24px 16px 60px" },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  h2: { fontSize: 17, fontWeight: 700, margin: "26px 0 8px" },
  sub: { color: "#6B675C", fontSize: 14, margin: "6px 0 14px", lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 },
  input: { height: 36, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 8px", fontSize: 14 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  btn2: { background: "transparent", color: "#B34D07", border: "1px solid #E7C3A5", borderRadius: 8, padding: "6px 12px", fontWeight: 600, cursor: "pointer" },
  err: { color: "#B91C1C", fontSize: 14 },
  ok: { color: "#17633A", fontSize: 14 },
}

export default function TrabajosReales() {
  const [casos, setCasos] = useState<Caso[]>([])
  const [form, setForm] = useState<typeof VACIO & { id?: string }>(VACIO)
  const [ej, setEj] = useState<Ejemplo>(EJ_VACIO)
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        api<{ casos: Caso[] }>("/admin/hetna-casos"),
        api<{ valor: Ejemplo | null }>("/admin/hetna-ajustes/ejemplo-cotizacion"),
      ])
      setCasos(c.casos)
      setEj({ ...EJ_VACIO, ...(e.valor || {}) })
    } catch (e) {
      setMsg({ err: (e as Error).message })
    }
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  const subirFoto = async (f: File) => {
    setSubiendo(true)
    setMsg({})
    try {
      const fd = new FormData()
      fd.append("archivo", f)
      const r = await fetch("/api/pub/subir", { method: "POST", headers: cab({ "x-hetna-pub": "1" }), body: fd, credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.error || d.message || "No se pudo subir la foto.")
      setForm((x) => ({ ...x, foto_url: d.url }))
    } catch (e) {
      setMsg({ err: (e as Error).message })
    } finally {
      setSubiendo(false)
    }
  }

  const guardar = async () => {
    setMsg({})
    try {
      const { id, ...datos } = form
      await api(id ? `/admin/hetna-casos/${id}` : "/admin/hetna-casos", "POST", datos)
      setForm(VACIO)
      setMsg({ ok: "Guardado." })
      cargar()
    } catch (e) {
      setMsg({ err: (e as Error).message })
    }
  }

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar este trabajo?")) return
    try {
      await api(`/admin/hetna-casos/${id}`, "DELETE")
      cargar()
    } catch (e) {
      setMsg({ err: (e as Error).message })
    }
  }

  const guardarEjemplo = async (quitar = false) => {
    setMsg({})
    try {
      await api("/admin/hetna-ajustes/ejemplo-cotizacion", "POST", quitar ? {} : ej)
      if (quitar) setEj(EJ_VACIO)
      setMsg({ ok: quitar ? "Ejemplo quitado." : "Ejemplo guardado." })
    } catch (e) {
      setMsg({ err: (e as Error).message })
    }
  }

  const campo = (k: keyof typeof VACIO, etiqueta: string, ph = "") => (
    <label style={S.label}>
      {etiqueta}
      <input style={S.input} value={String(form[k] ?? "")} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </label>
  )

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Trabajos reales</h1>
      <p style={S.sub}>
        Piezas terminadas para que un cliente nuevo vea que HETNA sí entrega. Salen en el inicio y en Cotizar sólo si están
        publicadas y con permiso del cliente. Nunca subas casos inventados.
      </p>
      {msg.err && <p style={S.err}>{msg.err}</p>}
      {msg.ok && <p style={S.ok}>{msg.ok}</p>}

      <div style={S.card}>
        <p style={{ margin: "0 0 10px", fontWeight: 700 }}>{form.id ? "Editar trabajo" : "Nuevo trabajo"}</p>
        <div style={S.grid}>
          {campo("titulo", "Qué se fabricó", "Letrero en MDF de 60 cm")}
          {campo("tipo_trabajo", "Tipo de trabajo", "Corte láser")}
          {campo("material", "Material", "MDF 6 mm")}
          {campo("ciudad", "Ciudad", "Puebla")}
          {campo("tiempo_entrega", "Tiempo de entrega", "4 días")}
          {campo("orden", "Orden (0 primero)")}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={S.label}>
            Foto de la pieza terminada
            <input type="file" accept="image/webp,image/jpeg,image/png,image/avif" onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} />
          </label>
          {subiendo && <span style={S.sub}>Subiendo…</span>}
          {form.foto_url && <img src={form.foto_url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8 }} />}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14 }}>
          <label>
            <input type="checkbox" checked={form.permiso_cliente} onChange={(e) => setForm({ ...form, permiso_cliente: e.target.checked })} /> Tengo
            permiso del cliente para publicarlo
          </label>
          <label>
            <input type="checkbox" checked={form.publicado} onChange={(e) => setForm({ ...form, publicado: e.target.checked })} /> Publicado
          </label>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button type="button" style={S.btn} onClick={guardar} disabled={subiendo}>
            Guardar
          </button>
          {form.id && (
            <button type="button" style={S.btn2} onClick={() => setForm(VACIO)}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <h2 style={S.h2}>Cargados ({casos.length})</h2>
      {!casos.length && <p style={S.sub}>Todavía ninguno. La sección no aparece en el sitio hasta que publiques el primero.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {casos.map((c) => (
          <div key={c.id} style={{ ...S.card, display: "flex", gap: 12, alignItems: "center" }}>
            <img src={c.foto_url} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6 }} />
            <div style={{ flex: 1, fontSize: 14 }}>
              <strong>{c.titulo}</strong>
              <div style={{ color: "#6B675C" }}>{[c.tipo_trabajo, c.material, c.ciudad, c.tiempo_entrega].filter(Boolean).join(" · ")}</div>
              <div style={{ color: c.publicado && c.permiso_cliente ? "#17633A" : "#8A887F" }}>
                {c.publicado && c.permiso_cliente ? "Visible en el sitio" : !c.permiso_cliente ? "Sin permiso del cliente" : "No publicado"}
              </div>
            </div>
            <button type="button" style={S.btn2} onClick={() => setForm({ ...VACIO, ...c, ciudad: c.ciudad || "", material: c.material || "", tipo_trabajo: c.tipo_trabajo || "", tiempo_entrega: c.tiempo_entrega || "" })}>
              Editar
            </button>
            <button type="button" style={S.btn2} onClick={() => borrar(c.id)}>
              Borrar
            </button>
          </div>
        ))}
      </div>

      <h2 style={S.h2}>Ejemplo de cotización (página Cotizar)</h2>
      <p style={S.sub}>Un trabajo real ya respondido, sin datos del cliente. Si lo dejas vacío, la página no muestra ejemplo.</p>
      <div style={S.card}>
        <div style={S.grid}>
          {(
            [
              ["pieza", "Pieza", "Placa de acero con 4 barrenos"],
              ["material", "Material", "Acero 1/4 in"],
              ["cantidad", "Cantidad", "20 piezas"],
              ["propuestas", "Propuestas recibidas", "3"],
              ["precio", "Rango de precio", "$1,800 a $2,400"],
              ["tiempo", "Tiempo de entrega", "5 días hábiles"],
            ] as [keyof Ejemplo, string, string][]
          ).map(([k, et, ph]) => (
            <label key={k} style={S.label}>
              {et}
              <input style={S.input} value={ej[k]} placeholder={ph} onChange={(e) => setEj({ ...ej, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button type="button" style={S.btn} onClick={() => guardarEjemplo()}>
            Guardar ejemplo
          </button>
          <button type="button" style={S.btn2} onClick={() => guardarEjemplo(true)}>
            Quitar ejemplo
          </button>
        </div>
      </div>
    </div>
  )
}

export const config = {
  label: "Trabajos reales",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M21 17l-5-5-8 7" />
    </svg>
  ),
}
