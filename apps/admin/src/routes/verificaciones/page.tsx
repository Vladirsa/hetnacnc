// Pantalla "Verificaciones" del dashboard (menú lateral).
// Aquí revisas los documentos que mandan los talleres (identificación, fachada,
// interior del taller) y apruebas o rechazas. Al aprobar, el taller recibe la
// insignia "Taller verificado" en la tienda.
//
// Los documentos son privados: se piden al backend con tu sesión de
// administrador y se muestran aquí sin quedar guardados en ningún lado.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Archivo = { id: string; tipo: string; mime: string; tamano: number; subido_en: string }
type Expediente = {
  seller_id: string
  nombre: string
  handle: string
  email: string
  telefono: string
  estado: "borrador" | "en_revision" | "verificado" | "rechazado"
  motivo: string | null
  enviado_en: string | null
  revisado_en: string | null
  archivos: Archivo[]
  faltan: string[]
}

const NOMBRES: Record<string, string> = {
  identificacion_frente: "Identificación (frente)",
  identificacion_reverso: "Identificación (reverso)",
  fachada: "Fachada",
  taller: "Interior / máquinas",
  comprobante_domicilio: "Comprobante de domicilio",
  constancia_fiscal: "Constancia de situación fiscal",
  acta_constitutiva: "Acta constitutiva / poder",
}

const ESTADOS: { v: string; t: string }[] = [
  { v: "en_revision", t: "Por revisar" },
  { v: "verificado", t: "Verificados" },
  { v: "rechazado", t: "Rechazados" },
  { v: "borrador", t: "Sin enviar" },
]

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

async function api<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin/hetna-verificacion${ruta}`, {
      credentials: "include",
      ...(cuerpo === undefined
        ? { headers: cabeceras() }
        : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
    })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

async function apiAdmin<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin${ruta}`, {
      credentials: "include",
      ...(cuerpo === undefined
        ? { headers: cabeceras() }
        : { method: "POST", headers: { ...cabeceras(), "content-type": "application/json" }, body: JSON.stringify(cuerpo) }),
    })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-MX") : "—")

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  rojo: "#b42318",
  verde: "#1E7B3A",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const boton = (tipo: "primario" | "normal" | "peligro"): CSSProperties => ({
  cursor: "pointer",
  borderRadius: 10,
  padding: "9px 14px",
  fontSize: 14,
  fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none",
  background: tipo === "primario" ? C.verde : tipo === "peligro" ? C.rojo : C.fondo,
  color: tipo === "normal" ? C.texto : "#fff",
})

// Documento privado: se baja con la sesión y se muestra como blob
function Documento({ sellerId, a }: { sellerId: string; a: Archivo }) {
  const [url, setUrl] = useState<string | null>(null)
  const [falla, setFalla] = useState(false)
  useEffect(() => {
    let vivo = true
    let creado: string | null = null
    fetch(`/admin/hetna-verificacion/${sellerId}/archivos/${a.id}`, { credentials: "include", headers: cabeceras() })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (!vivo) return
        creado = URL.createObjectURL(b)
        setUrl(creado)
      })
      .catch(() => vivo && setFalla(true))
    return () => {
      vivo = false
      if (creado) URL.revokeObjectURL(creado)
    }
  }, [sellerId, a.id])

  const marco: CSSProperties = {
    width: 180, height: 130, borderRadius: 8, border: `1px solid ${C.borde}`, background: C.suave,
    overflow: "hidden", display: "grid", placeItems: "center", fontSize: 12, color: C.tenue,
  }
  return (
    <figure style={{ margin: 0 }}>
      <a href={url ?? undefined} target="_blank" rel="noreferrer" style={marco} title="Abrir en grande">
        {falla ? "No se pudo cargar" : !url ? "Cargando..." : a.mime === "application/pdf" ? "📄 Abrir PDF" : (
          <img src={url} alt={NOMBRES[a.tipo] ?? a.tipo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </a>
      <figcaption style={{ fontSize: 12, color: C.tenue, marginTop: 4 }}>{NOMBRES[a.tipo] ?? a.tipo}</figcaption>
    </figure>
  )
}

function Tarjeta({ e, alCambiar }: { e: Expediente; alCambiar: () => void }) {
  const [motivo, setMotivo] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const tieneConstancia = e.archivos.some((a) => a.tipo === "constancia_fiscal")
  const [empresa, setEmpresa] = useState(tieneConstancia)

  const decidir = async (accion: "aprobar" | "rechazar" | "revocar") => {
    setError("")
    if (accion !== "aprobar" && !motivo.trim()) {
      setError("Escribe el motivo para que el taller sepa qué corregir.")
      return
    }
    setOcupado(true)
    try {
      await api(`/${e.seller_id}`, { accion, motivo, empresa: accion === "aprobar" && empresa })
      alCambiar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <article style={caja}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{e.nombre}</h3>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: C.tenue }}>
            {e.email} {e.telefono && `· ${e.telefono}`} · enviado: {fecha(e.enviado_en)}
            {e.revisado_en && ` · revisado: ${fecha(e.revisado_en)}`}
          </p>
          {e.handle && (
            <a href={`/mx/talleres/${e.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: C.naranja }}>
              Ver su página pública ↗
            </a>
          )}
        </div>
      </div>

      {e.motivo && e.estado === "rechazado" && (
        <p style={{ fontSize: 13, color: C.rojo, margin: "10px 0 0" }}>Motivo del rechazo: {e.motivo}</p>
      )}
      {e.faltan.length > 0 && (
        <p style={{ fontSize: 13, color: C.tenue, margin: "10px 0 0" }}>Falta: {e.faltan.join(" · ")}</p>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        {e.archivos.map((a) => (
          <Documento key={a.id} sellerId={e.seller_id} a={a} />
        ))}
      </div>

      {(e.estado === "en_revision" || e.estado === "verificado") && (
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.tenue }}>
            Revisa que el nombre de la identificación coincida con el responsable del taller, que la fachada y el
            interior sean de un taller real y que las fotos no sean de internet.
          </p>
          <textarea
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
            placeholder={e.estado === "verificado" ? "Motivo para quitar la verificación" : "Motivo del rechazo (solo si lo rechazas). Ej. la identificación no se lee, falta foto de la fachada…"}
            style={{ minHeight: 60, borderRadius: 8, border: `1px solid ${C.borde}`, padding: 8, fontFamily: "inherit", fontSize: 14 }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {e.estado === "en_revision" ? (
              <>
                {tieneConstancia && (
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={empresa} onChange={(ev) => setEmpresa(ev.target.checked)} />
                    También “Empresa verificada” (revisé la constancia fiscal)
                  </label>
                )}
                <button style={boton("primario")} disabled={ocupado} onClick={() => void decidir("aprobar")}>✓ Aprobar y verificar</button>
                <button style={boton("peligro")} disabled={ocupado} onClick={() => void decidir("rechazar")}>Rechazar</button>
              </>
            ) : (
              <button style={boton("peligro")} disabled={ocupado} onClick={() => void decidir("revocar")}>Quitar verificación</button>
            )}
          </div>
          {error && <p style={{ margin: 0, fontSize: 13, color: C.rojo }}>{error}</p>}
        </div>
      )}
    </article>
  )
}

type Cert = { id: string; taller: string; handle: string; tipo: string; nombre: string | null; emisor: string | null; numero: string | null; vigencia: string | null; archivo: string | null; url: string | null; estado: string; motivo: string | null }

function Certificaciones() {
  const [lista, setLista] = useState<Cert[] | null>(null)
  const [error, setError] = useState("")
  const [motivos, setMotivos] = useState<Record<string, string>>({})
  const cargar = useCallback(async () => {
    try {
      const d = await apiAdmin<{ certificaciones: Cert[] }>("/hetna-certificaciones?estado=pendiente")
      setLista(d.certificaciones)
    } catch (e) {
      setError((e as Error).message)
      setLista([])
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])
  const decidir = async (id: string, accion: "aprobar" | "rechazar") => {
    setError("")
    try {
      await apiAdmin(`/hetna-certificaciones/${id}`, { accion, motivo: motivos[id] || "" })
      void cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>Certificaciones por revisar</h2>
      <p style={{ color: C.tenue, fontSize: 13, margin: "4px 0 12px" }}>
        Revisa que el documento sea legible, que el nombre coincida con el taller y que esté vigente. Al aprobar aparece en su perfil y sube su posicionamiento (no su calificación).
      </p>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {lista === null ? (
        <p>Cargando...</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>No hay certificaciones pendientes.</p>
      ) : (
        lista.map((c) => (
          <article key={c.id} style={caja}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {c.taller} · {c.nombre || c.tipo}
            </p>
            <p style={{ margin: "4px 0", fontSize: 13, color: C.tenue }}>
              {[c.tipo, c.emisor && `Emisor: ${c.emisor}`, c.numero && `No. ${c.numero}`, c.vigencia && `Vigente hasta ${c.vigencia}`].filter(Boolean).join(" · ")}
            </p>
            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer" style={{ color: C.naranja, fontSize: 13 }}>
                Ver documento ({c.archivo}) ↗
              </a>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <input
                placeholder="Motivo (sólo si la rechazas)"
                value={motivos[c.id] || ""}
                onChange={(ev) => setMotivos({ ...motivos, [c.id]: ev.target.value })}
                style={{ flex: 1, minWidth: 200, borderRadius: 8, border: `1px solid ${C.borde}`, padding: 6 }}
              />
              <button style={boton("primario")} onClick={() => void decidir(c.id, "aprobar")}>✓ Aprobar</button>
              <button style={boton("peligro")} onClick={() => void decidir(c.id, "rechazar")}>Rechazar</button>
            </div>
          </article>
        ))
      )}
    </section>
  )
}

type Miembro = { id: string; email: string; nombre: string; empresa: string; desde: string | null; hasta: string | null }

function Membresias() {
  const [lista, setLista] = useState<Miembro[] | null>(null)
  const [email, setEmail] = useState("")
  const [hasta, setHasta] = useState("")
  const [nota, setNota] = useState("")
  const cargar = useCallback(async () => {
    try {
      const d = await apiAdmin<{ miembros: Miembro[] }>("/hetna-membresias")
      setLista(d.miembros)
    } catch (e) {
      setNota((e as Error).message)
      setLista([])
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])
  const cambiar = async (correo: string, activa: boolean) => {
    setNota("")
    try {
      await apiAdmin("/hetna-membresias", { email: correo, activa, hasta: hasta || undefined })
      setNota(activa ? `Membresía activada para ${correo}. Le mandamos un correo.` : `Membresía quitada a ${correo}.`)
      setEmail("")
      void cargar()
    } catch (e) {
      setNota((e as Error).message)
    }
  }
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>Membresía Empresarial de clientes</h2>
      <p style={{ color: C.tenue, fontSize: 13, margin: "4px 0 12px" }}>
        Gratis por ahora. Incluye licitaciones privadas y restringidas, resumen con IA, “sólo talleres verificados” y que HETNA le busque proveedor. El cliente debe tener cuenta en la tienda con ese correo.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="correo@empresa.com" style={{ minWidth: 240, borderRadius: 8, border: `1px solid ${C.borde}`, padding: 6 }} />
        <label style={{ fontSize: 13 }}>
          Hasta (opcional){" "}
          <input type="date" value={hasta} onChange={(ev) => setHasta(ev.target.value)} style={{ borderRadius: 8, border: `1px solid ${C.borde}`, padding: 5 }} />
        </label>
        <button style={boton("primario")} disabled={!email.trim()} onClick={() => void cambiar(email.trim(), true)}>Activar membresía</button>
      </div>
      {nota && <p style={{ fontSize: 13 }}>{nota}</p>}
      {lista && lista.length > 0 && (
        <table style={{ width: "100%", marginTop: 12, fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id} style={{ borderTop: `1px solid ${C.borde}` }}>
                <td style={{ padding: 6 }}>{m.email}</td>
                <td style={{ padding: 6 }}>{[m.nombre, m.empresa].filter(Boolean).join(" · ")}</td>
                <td style={{ padding: 6, color: C.tenue }}>desde {fecha(m.desde)}{m.hasta ? ` · hasta ${m.hasta.slice(0, 10)}` : ""}</td>
                <td style={{ padding: 6, textAlign: "right" }}>
                  <button style={boton("peligro")} onClick={() => void cambiar(m.email, false)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default function VerificacionesPage() {
  const [estado, setEstado] = useState("en_revision")
  const [lista, setLista] = useState<Expediente[] | null>(null)
  const [error, setError] = useState("")

  const cargar = useCallback(async () => {
    setError("")
    setLista(null)
    try {
      const d = await api<{ expedientes: Expediente[] }>(`?estado=${estado}`)
      setLista(d.expedientes)
    } catch (e) {
      setError((e as Error).message)
      setLista([])
    }
  }, [estado])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 80px", color: C.texto }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Verificación de talleres</h1>
      <p style={{ color: C.tenue, fontSize: 14, margin: "4px 0 16px" }}>
        Los talleres suben su identificación y fotos de su taller desde su panel (Verificación). Al aprobar, se muestra
        “✓ Taller verificado” en su página y sus productos.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {ESTADOS.map((x) => (
          <button key={x.v} onClick={() => setEstado(x.v)}
            style={{ ...boton("normal"), background: estado === x.v ? C.texto : C.fondo, color: estado === x.v ? C.fondo : C.texto }}>
            {x.t}
          </button>
        ))}
      </div>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {lista === null ? (
        <p>Cargando...</p>
      ) : lista.length === 0 ? (
        <p style={{ color: C.tenue }}>No hay talleres en esta lista.</p>
      ) : (
        lista.map((e) => <Tarjeta key={e.seller_id} e={e} alCambiar={() => void cargar()} />)
      )}
      <Certificaciones />
      <Membresias />
    </div>
  )
}

export const config = {
  label: "Verificaciones",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
}
