// Página "Ficha única" del dashboard (menú lateral): escribes un correo, un
// teléfono o un nombre y ves en un solo lugar todo de esa persona o empresa
// (tienda, licitaciones, Escanear, taller, Cotizador, proveedor, WhatsApp) con
// la siguiente acción sugerida y un botón con el mensaje listo. Nada se manda
// solo. Backend: packages/api/src/lib/ficha-unica.ts.
import { useEffect, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

type Candidato = { tipo: "cliente" | "taller" | "licitacion" | "cotizador"; nombre: string; email: string | null; telefono: string | null; detalle: string }
type Accion = { clave: string; titulo: string; motivo: string; mensaje: string | null; liga?: string; ligas: { whatsapp: string | null; correo: string | null } }
type Ficha = {
  claves: { correos: string[]; telefonos: string[] }
  clientes: { id: string; nombre: string; email: string | null; telefono: string | null; creado: string; correo_verificado: boolean }[]
  pedidos: { cuantos: number; gastado: Record<string, number>; ultimo: string | null; recientes: { id: string; numero: number; estado: string; total: number; moneda: string; creado: string }[] }
  carritos: { id: string; total: number; moneda: string; actualizado: string; articulos: string[] }[]
  creditos: { saldo: number } | null
  reputacion: { promedio: number | null; evaluaciones: number } | null
  licitaciones: { folio: string; estado: string; creado: string; descripcion: string; propuestas: number; elegida: boolean }[]
  escanear: { id: string; folio: string; titulo: string; nombre_estado: string; creado: string }[]
  talleres: { id: string; nombre: string; email: string | null; telefono: string | null; estado: string | null; saldos: Record<string, Record<string, number>>; propuestas: Record<string, number>; resenas: { promedio: number | null; cuantas: number } }[]
  cotizador: { id: string; nombre: string | null; correo: string | null; telefono: string | null; plan: string | null; plan_efectivo: string; trial_hasta: string | null; creado: string | null }[]
  proveedor: { talleres: string[]; ordenes: number; abiertas: number; por_confirmar: number } | null
  whatsapp: { numeros: { numero: string; quien: string | null; avisos: boolean; verificado: boolean }[]; mensajes: { numero: string; rol: string; texto: string; fecha: string }[] }
  errores: string[]
}

const MSG_SESION = "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."
const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
async function api<T>(ruta: string): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin/hetna-ficha${ruta}`, { credentials: "include", headers: cabeceras() })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const cuerpo = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(cuerpo?.message || `Error ${r.status}`)
  return cuerpo
}

const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", suave: "var(--bg-subtle, #f7f7f5)", texto: "var(--fg-base, #1b1b18)", tenue: "var(--fg-subtle, #6b6a63)", naranja: "#C2560A", verde: "#0F7A4A", rojo: "#b42318", wa: "#1f9d55" }
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16 }
const boton = (color?: string): CSSProperties => ({ cursor: "pointer", borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 700, border: color ? "none" : `1px solid ${C.borde}`, background: color || C.fondo, color: color ? "#fff" : C.texto, textDecoration: "none", display: "inline-block" })
const tenue: CSSProperties = { color: C.tenue, fontSize: 12.5 }
const fecha = (s?: string | null) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—")
const dinero = (n: number, m = "mxn") => `$${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}${m.toLowerCase() === "mxn" ? "" : ` ${m.toUpperCase()}`}`
const ETIQUETA: Record<Candidato["tipo"], string> = { cliente: "Cliente", taller: "Taller", licitacion: "Licitación", cotizador: "Cotizador" }

function Seccion({ titulo, vacia, children }: { titulo: string; vacia?: boolean; children: ReactNode }) {
  if (vacia) return null
  return (
    <section style={caja}>
      <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>{titulo}</h3>
      {children}
    </section>
  )
}

const FichaPage = () => {
  const [q, setQ] = useState("")
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [acciones, setAcciones] = useState<Accion[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault()
    if (q.trim().length < 3) return setError("Escribe al menos 3 letras, un correo o un teléfono.")
    setError("")
    setCargando(true)
    setFicha(null)
    try {
      const r = await api<{ candidatos: Candidato[] }>(`?q=${encodeURIComponent(q.trim())}`)
      setCandidatos(r.candidatos)
      // Un solo resultado claro: se abre directo
      const unicos = new Set(r.candidatos.map((c) => `${(c.email || "").toLowerCase()}|${(c.telefono || "").replace(/\D/g, "").slice(-10)}`))
      if (r.candidatos.length && unicos.size === 1) await abrir(r.candidatos[0])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCargando(false)
    }
  }

  async function abrir(c: { email: string | null; telefono: string | null }) {
    setCargando(true)
    setError("")
    try {
      const p = new URLSearchParams()
      if (c.email) p.set("correo", c.email)
      if (c.telefono) p.set("telefono", c.telefono)
      const r = await api<{ ficha: Ficha; acciones: Accion[] }>(`/detalle?${p.toString()}`)
      setFicha(r.ficha)
      setAcciones(r.acciones)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCargando(false)
    }
  }

  // Liga directa: /ficha?q=correo
  useEffect(() => {
    const inicial = new URLSearchParams(window.location.search).get("q")
    if (inicial) {
      setQ(inicial)
      setTimeout(() => document.getElementById("ficha-buscar")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })), 0)
    }
  }, [])

  const f = ficha
  const titulo = f ? f.clientes[0]?.nombre || f.talleres[0]?.nombre || f.cotizador[0]?.nombre || f.claves.correos[0] || f.claves.telefonos[0] : ""

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 4, color: C.texto }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Ficha única</h1>
        <p style={{ ...tenue, margin: "4px 0 0" }}>Todo de un cliente, taller o proveedor en un solo lugar: tienda, licitaciones, Escanear, Cotizador, proveedor y WhatsApp.</p>
      </div>

      <form id="ficha-buscar" onSubmit={buscar} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Correo, teléfono o nombre" autoFocus
          style={{ flex: "1 1 320px", border: `1px solid ${C.borde}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, background: C.fondo, color: C.texto }} />
        <button type="submit" disabled={cargando} style={boton(C.naranja)}>{cargando ? "Buscando…" : "Buscar"}</button>
      </form>
      {error && <p style={{ margin: 0, color: C.rojo, fontSize: 13.5 }}>{error}</p>}

      {!f && candidatos && (
        <div style={caja}>
          {candidatos.length === 0 ? <p style={{ margin: 0, ...tenue }}>No encontramos a nadie con eso.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {candidatos.map((c, i) => (
                <button key={i} onClick={() => abrir(c)} style={{ ...boton(), textAlign: "left", fontWeight: 500, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span><b>{c.nombre}</b> <span style={tenue}>· {[c.email, c.telefono].filter(Boolean).join(" · ")}</span><br /><span style={tenue}>{c.detalle}</span></span>
                  <span style={{ ...tenue, fontWeight: 700 }}>{ETIQUETA[c.tipo]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {f && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>{titulo}</h2>
              <p style={{ ...tenue, margin: "2px 0 0" }}>{[...f.claves.correos, ...f.claves.telefonos].join(" · ")}</p>
            </div>
            {candidatos && candidatos.length > 1 && <button onClick={() => setFicha(null)} style={boton()}>← Otros resultados</button>}
          </div>

          <Seccion titulo="Siguiente acción" vacia={!acciones.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {acciones.map((a) => (
                <div key={a.clave} style={{ border: `1px solid ${C.borde}`, borderRadius: 10, padding: 12, background: C.suave }}>
                  <b style={{ fontSize: 14 }}>{a.titulo}</b>
                  {a.motivo && <div style={tenue}>{a.motivo}</div>}
                  {a.mensaje && <div style={{ fontSize: 13, margin: "8px 0", whiteSpace: "pre-wrap" }}>“{a.mensaje}”</div>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {a.ligas.whatsapp && <a href={a.ligas.whatsapp} target="_blank" rel="noreferrer" style={boton(C.wa)}>Abrir WhatsApp con el mensaje</a>}
                    {a.ligas.correo && <a href={a.ligas.correo} style={boton()}>Abrir correo</a>}
                    {a.mensaje && <button onClick={() => navigator.clipboard?.writeText(a.mensaje || "")} style={boton()}>Copiar mensaje</button>}
                    {a.liga && <a href={a.liga} style={boton()}>Ir a la página</a>}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ ...tenue, margin: "8px 0 0" }}>Nada se manda solo: revisa el mensaje y mándalo tú.</p>
          </Seccion>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <Seccion titulo="Tienda" vacia={!f.clientes.length && !f.pedidos.cuantos && !f.carritos.length}>
              {f.clientes.map((c) => (
                <div key={c.id} style={{ marginBottom: 6 }}>
                  <b>{c.nombre}</b> <span style={tenue}>· desde {fecha(c.creado)} · {c.correo_verificado ? "correo confirmado" : "correo sin confirmar"}</span>
                </div>
              ))}
              <div style={{ fontSize: 13.5 }}>
                {f.pedidos.cuantos} pedido(s)
                {Object.entries(f.pedidos.gastado).map(([m, n]) => <span key={m}> · {dinero(n, m)}</span>)}
                {f.pedidos.ultimo && <span style={tenue}> · último {fecha(f.pedidos.ultimo)}</span>}
              </div>
              {f.pedidos.recientes.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                  {f.pedidos.recientes.map((o) => <li key={o.id}>#{o.numero} · {dinero(o.total, o.moneda)} · {o.estado} · <span style={tenue}>{fecha(o.creado)}</span></li>)}
                </ul>
              )}
              {f.carritos.map((c) => <div key={c.id} style={{ marginTop: 6, fontSize: 13 }}>🛒 Carrito de {dinero(c.total, c.moneda)} ({fecha(c.actualizado)}): {c.articulos.join(", ")}</div>)}
              {f.creditos && <div style={{ marginTop: 6, fontSize: 13 }}>Créditos de diseño: <b>{f.creditos.saldo}</b></div>}
              {f.reputacion && f.reputacion.evaluaciones > 0 && <div style={{ fontSize: 13 }}>Como comprador: {f.reputacion.promedio} ★ ({f.reputacion.evaluaciones} evaluaciones de talleres)</div>}
            </Seccion>

            <Seccion titulo="Licitaciones" vacia={!f.licitaciones.length}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {f.licitaciones.map((l) => <li key={l.folio}><b>{l.folio}</b> · {l.estado} · {l.propuestas} propuesta(s){l.elegida ? " · eligió taller" : ""} · <span style={tenue}>{fecha(l.creado)}</span>{l.descripcion && <div style={tenue}>{l.descripcion}</div>}</li>)}
              </ul>
            </Seccion>

            <Seccion titulo="Escanear" vacia={!f.escanear.length}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {f.escanear.map((e) => <li key={e.id}><b>{e.folio}</b> · {e.titulo} · {e.nombre_estado} · <span style={tenue}>{fecha(e.creado)}</span></li>)}
              </ul>
            </Seccion>

            <Seccion titulo="Taller en la tienda" vacia={!f.talleres.length}>
              {f.talleres.map((t) => (
                <div key={t.id} style={{ fontSize: 13, marginBottom: 8 }}>
                  <b>{t.nombre}</b> <span style={tenue}>· {t.estado || "sin estado"}</span>
                  {Object.entries(t.saldos).map(([m, s]) => <div key={m}>Saldos: disponible {dinero(s.disponible || 0, m)} · pendiente {dinero(s.pendiente || 0, m)} · pagado {dinero(s.pagado || 0, m)}{(s.retenido || 0) > 0 ? ` · retenido ${dinero(s.retenido, m)}` : ""}</div>)}
                  <div>Propuestas: {Object.entries(t.propuestas).map(([k, n]) => `${n} ${k}`).join(" · ") || "ninguna"}</div>
                  {t.resenas.cuantas > 0 && <div>Reseñas: {t.resenas.promedio} ★ ({t.resenas.cuantas})</div>}
                </div>
              ))}
            </Seccion>

            <Seccion titulo="App del Cotizador" vacia={!f.cotizador.length}>
              {f.cotizador.map((n) => (
                <div key={n.id} style={{ fontSize: 13, marginBottom: 6 }}>
                  <b>{n.nombre || n.correo}</b> · plan <b>{n.plan_efectivo}</b>
                  {n.plan_efectivo === "prueba" && n.trial_hasta && <span> (vence {fecha(n.trial_hasta)})</span>}
                  {n.creado && <span style={tenue}> · desde {fecha(n.creado)}</span>}
                </div>
              ))}
            </Seccion>

            <Seccion titulo="Proveedor de talleres" vacia={!f.proveedor}>
              {f.proveedor && (
                <div style={{ fontSize: 13 }}>
                  {f.proveedor.ordenes} orden(es) de compra · {f.proveedor.abiertas} abiertas · {f.proveedor.por_confirmar} sin confirmar
                  <div style={tenue}>Le compran: {f.proveedor.talleres.join(", ")}</div>
                </div>
              )}
            </Seccion>

            <Seccion titulo="WhatsApp" vacia={!f.whatsapp.numeros.length}>
              {f.whatsapp.numeros.map((n) => (
                <div key={n.numero} style={{ fontSize: 13 }}>
                  +{n.numero} {n.quien && <span style={tenue}>· {n.quien}</span>} {n.verificado && <span style={tenue}>· verificado</span>}
                  {!n.avisos && <b style={{ color: C.rojo }}> · pidió BAJA</b>}
                </div>
              ))}
              {f.whatsapp.mensajes.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                  {f.whatsapp.mensajes.map((m, i) => (
                    <div key={i} style={{ fontSize: 12.5, padding: "6px 8px", borderRadius: 8, background: m.rol === "cliente" ? C.suave : "rgba(31,157,85,.08)" }}>
                      <span style={tenue}>{m.rol} · {new Date(m.fecha).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <div style={{ whiteSpace: "pre-wrap" }}>{m.texto}</div>
                    </div>
                  ))}
                </div>
              )}
            </Seccion>
          </div>

          {f.errores.length > 0 && (
            <p style={{ ...tenue, margin: 0 }}>No se pudo leer: {f.errores.join(" · ")}</p>
          )}
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Ficha única",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="11" r="2.5" />
      <path d="M5.5 17c.7-1.8 2-2.8 3.5-2.8s2.8 1 3.5 2.8M14 9h4M14 13h4" />
    </svg>
  ),
}

export default FichaPage
