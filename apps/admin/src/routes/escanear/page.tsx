// Página "Escanear" del dashboard (menú lateral): las solicitudes de
// ingeniería inversa (packages/api/src/lib/escanear.ts). Aquí se asigna
// diseñador, se cambia el estado, se registran las medidas comprobadas y las
// tolerancias, y se suben el render y el modelo rediseñado que el cliente
// aprueba en hetnacnc.com/mx/user/escanear.
//
// Fase 1 (uso interno): sin precios. Los tiempos de cada paso se anotan solos
// al cambiar de estado; de ahí saldrán los precios y los plazos.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Archivo = { id: string; tipo: "escaneo" | "foto" | "render" | "modelo"; nombre: string; tamano: number; de: "cliente" | "equipo"; creado: string }
type Verif = { medida: string; esperado_mm: number; medido_mm: number; tolerancia_mm: number; ok?: boolean; nota?: string }
type Solicitud = {
  id: string
  folio_texto: string
  correo: string | null
  nombre_cliente: string | null
  titulo: string
  descripcion: string
  uso: string
  salida: string
  material_original: string | null
  material_deseado: string | null
  medidas: { nombre: string; mm: number }[]
  zona: string | null
  estado: string
  nombre_estado: string
  archivos: Archivo[]
  comentarios: { de: string; texto: string; accion?: string; creado: string }[]
  disenador: string | null
  notas_internas: string | null
  verificacion: Verif[]
  tiempos: Record<string, string>
  duraciones: { de: string; a: string; minutos: number }[]
  creado: string
}
type Lista = { estados: { valor: string; nombre: string }[]; usos: Record<string, string>; salidas: Record<string, string>; publico: boolean; solicitudes: Solicitud[] }

const MSG_SESION = "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."
const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/admin/escanear${ruta}`, { ...init, credentials: "include", headers: { ...cabeceras(), ...(init.headers || {}) } })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const cuerpo = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(cuerpo?.message || `Error ${r.status}`)
  return cuerpo
}
const json = (cuerpo: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })

const C = { borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", suave: "var(--bg-subtle, #f7f7f5)", texto: "var(--fg-base, #1b1b18)", tenue: "var(--fg-subtle, #6b6a63)", naranja: "#C2560A", verde: "#0F7A4A", rojo: "#b42318" }
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16 }
const boton = (primario: boolean): CSSProperties => ({ cursor: "pointer", borderRadius: 10, padding: "8px 13px", fontSize: 13.5, fontWeight: 700, border: primario ? "none" : `1px solid ${C.borde}`, background: primario ? C.naranja : C.fondo, color: primario ? "#fff" : C.texto })
const campo: CSSProperties = { border: `1px solid ${C.borde}`, borderRadius: 8, padding: "7px 9px", fontSize: 13.5, background: C.fondo, color: C.texto }
const fecha = (s?: string) => (s ? new Date(s).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`
const duracion = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} días`)

function Detalle({ s, lista, alCambiar }: { s: Solicitud; lista: Lista; alCambiar: (s: Solicitud) => void }) {
  const [disenador, setDisenador] = useState(s.disenador || "")
  const [notas, setNotas] = useState(s.notas_internas || "")
  const [verif, setVerif] = useState<Verif[]>(s.verificacion.length ? s.verificacion : s.medidas.map((m) => ({ medida: m.nombre, esperado_mm: m.mm, medido_mm: 0, tolerancia_mm: 0.2 })))
  const [comentario, setComentario] = useState("")
  const [nota, setNota] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    setDisenador(s.disenador || "")
    setNotas(s.notas_internas || "")
    setVerif(s.verificacion.length ? s.verificacion : s.medidas.map((m) => ({ medida: m.nombre, esperado_mm: m.mm, medido_mm: 0, tolerancia_mm: 0.2 })))
  }, [s.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function hacer(f: () => Promise<{ solicitud: Solicitud }>, ok: string) {
    setOcupado(true)
    setNota(null)
    try {
      const r = await f()
      alCambiar(r.solicitud)
      setNota({ ok: true, t: ok })
    } catch (e) {
      setNota({ ok: false, t: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }
  const guardar = (cuerpo: Record<string, unknown>, ok: string) => hacer(() => api(`/${s.id}`, json(cuerpo)), ok)

  async function subir(lista: FileList | null, tipo: Archivo["tipo"]) {
    if (!lista?.length) return
    for (const f of Array.from(lista)) {
      const form = new FormData()
      form.append("tipo", tipo)
      form.append("archivo", f, f.name)
      await hacer(() => api(`/${s.id}/archivos`, { method: "POST", body: form }), `✓ ${f.name} subido`)
    }
  }
  async function bajar(a: Archivo) {
    try {
      const r = await api<{ url: string }>(`/${s.id}/archivos/${a.id}`)
      window.open(r.url, "_blank", "noopener")
    } catch (e) {
      setNota({ ok: false, t: (e as Error).message })
    }
  }
  const quitar = (a: Archivo) => window.confirm(`¿Quitar ${a.nombre}?`) && hacer(() => api(`/${s.id}/archivos/${a.id}`, { method: "DELETE" }), "Archivo quitado")
  const tieneRender = s.archivos.some((a) => a.tipo === "render" || a.tipo === "modelo")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={caja}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: C.tenue, fontWeight: 700 }}>{s.folio_texto} · {fecha(s.creado)}</div>
            <h2 style={{ margin: "2px 0 0", fontSize: 18 }}>{s.titulo}</h2>
            <div style={{ fontSize: 13, color: C.tenue }}>{s.nombre_cliente || "Sin nombre"} · {s.correo || "sin correo"}</div>
          </div>
          <label style={{ fontSize: 13 }}>
            Estado{" "}
            <select style={campo} value={s.estado} disabled={ocupado} onChange={(e) => guardar({ estado: e.target.value }, `Estado: ${lista.estados.find((x) => x.valor === e.target.value)?.nombre}`)}>
              {lista.estados.map((e) => <option key={e.valor} value={e.valor} disabled={e.valor === "render_listo" && !tieneRender}>{e.nombre}</option>)}
            </select>
          </label>
        </div>
        <p style={{ margin: "10px 0 0", whiteSpace: "pre-line", fontSize: 14 }}>{s.descripcion}</p>
        <div style={{ marginTop: 8, fontSize: 13, color: C.tenue, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
          <span>Tipo: <b style={{ color: C.texto }}>{lista.usos[s.uso] || s.uso}</b></span>
          <span>Salida: <b style={{ color: C.texto }}>{lista.salidas[s.salida] || s.salida}</b></span>
          {s.material_original && <span>Original: <b style={{ color: C.texto }}>{s.material_original}</b></span>}
          {s.material_deseado && <span>Deseado: <b style={{ color: C.texto }}>{s.material_deseado}</b></span>}
          {s.zona && <span>Zona: <b style={{ color: C.texto }}>{s.zona}</b></span>}
        </div>
        <div style={{ marginTop: 6, fontSize: 13 }}>Medidas a mano: {s.medidas.map((m) => `${m.nombre} ${m.mm} mm`).join(" · ")}</div>
        {!tieneRender && <div style={{ marginTop: 8, fontSize: 12.5, color: C.tenue }}>Para pasar a «Render listo» sube primero el render o el modelo rediseñado.</div>}
        {nota && <div style={{ marginTop: 10, fontSize: 13.5, color: nota.ok ? C.verde : C.rojo }}>{nota.t}</div>}
      </div>

      <div style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Archivos</h3>
        {s.archivos.length === 0 && <div style={{ fontSize: 13, color: C.tenue }}>Todavía no hay archivos.</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {s.archivos.map((a) => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${C.borde}` }}>
                <td style={{ padding: "6px 4px", fontWeight: 700, textTransform: "uppercase", fontSize: 11, color: C.tenue }}>{a.tipo}</td>
                <td style={{ padding: "6px 4px" }}><button type="button" style={{ ...boton(false), padding: "3px 8px", fontWeight: 600 }} onClick={() => bajar(a)}>{a.nombre}</button></td>
                <td style={{ padding: "6px 4px", color: C.tenue }}>{mb(a.tamano)} · {a.de} · {fecha(a.creado)}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}><button type="button" style={{ ...boton(false), padding: "3px 8px", color: C.rojo }} onClick={() => quitar(a)}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {([["render", "Subir render (imagen)", "image/*"], ["modelo", "Subir modelo rediseñado (STL, STEP, 3MF, DXF)", ".stl,.obj,.step,.stp,.3mf,.dxf,.zip"], ["escaneo", "Subir escaneo", ".stl,.obj,.ply,.3mf,.zip"], ["foto", "Subir fotos", "image/*"]] as const).map(([tipo, texto, accept]) => (
            <label key={tipo} style={{ ...boton(tipo === "render" || tipo === "modelo"), opacity: ocupado ? 0.6 : 1 }}>
              {texto}
              <input type="file" accept={accept} multiple style={{ display: "none" }} disabled={ocupado} onChange={(e) => subir(e.target.files, tipo)} />
            </label>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: C.tenue }}>Hasta 95 MB por archivo. El cliente ve los renders como imágenes y el STL del modelo en el visor 3D.</div>
      </div>

      <div style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Equipo y verificación</h3>
        <label style={{ fontSize: 13 }}>Diseñador asignado <input style={{ ...campo, width: 220 }} maxLength={80} value={disenador} onChange={(e) => setDisenador(e.target.value)} placeholder="Nombre" /></label>
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>Medidas comprobadas (mm)</div>
        <table style={{ borderCollapse: "collapse", fontSize: 13, marginTop: 4 }}>
          <thead><tr style={{ color: C.tenue, textAlign: "left" }}><th>Medida</th><th>Esperada</th><th>Medida real</th><th>Tolerancia ±</th><th></th></tr></thead>
          <tbody>
            {verif.map((v, i) => {
              const ok = Math.abs((v.medido_mm || 0) - (v.esperado_mm || 0)) <= (v.tolerancia_mm || 0)
              const set = (k: keyof Verif, val: string) => setVerif(verif.map((x, j) => (j === i ? { ...x, [k]: k === "medida" ? val : Number(val) || 0 } : x)))
              return (
                <tr key={i}>
                  <td><input style={{ ...campo, width: 160 }} value={v.medida} onChange={(e) => set("medida", e.target.value)} /></td>
                  <td><input style={{ ...campo, width: 80 }} inputMode="decimal" value={v.esperado_mm} onChange={(e) => set("esperado_mm", e.target.value)} /></td>
                  <td><input style={{ ...campo, width: 80 }} inputMode="decimal" value={v.medido_mm} onChange={(e) => set("medido_mm", e.target.value)} /></td>
                  <td><input style={{ ...campo, width: 70 }} inputMode="decimal" value={v.tolerancia_mm} onChange={(e) => set("tolerancia_mm", e.target.value)} /></td>
                  <td style={{ color: v.medido_mm ? (ok ? C.verde : C.rojo) : C.tenue, fontWeight: 700, paddingLeft: 6 }}>{v.medido_mm ? (ok ? "✓" : "Fuera") : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button type="button" style={{ ...boton(false), marginTop: 6, padding: "4px 9px" }} onClick={() => setVerif([...verif, { medida: "", esperado_mm: 0, medido_mm: 0, tolerancia_mm: 0.2 }])}>+ Medida</button>
        <label style={{ display: "block", marginTop: 10, fontSize: 13 }}>
          Notas internas (el cliente no las ve)
          <textarea style={{ ...campo, width: "100%", minHeight: 70, marginTop: 4 }} maxLength={5000} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
        <button
          type="button"
          style={{ ...boton(true), marginTop: 8 }}
          disabled={ocupado}
          onClick={() => guardar({ disenador: disenador || null, notas_internas: notas || null, verificacion: verif.filter((v) => v.medida.trim() && v.medido_mm > 0) }, "✓ Guardado")}
        >
          Guardar equipo y medidas
        </button>
      </div>

      <div style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Comentarios con el cliente</h3>
        {s.comentarios.map((c, i) => (
          <div key={i} style={{ fontSize: 13.5, padding: "6px 8px", background: c.de === "equipo" ? C.suave : "#FFF8F1", borderRadius: 8, marginBottom: 6 }}>
            <b>{c.de === "equipo" ? "HETNA" : "Cliente"}</b>{c.accion === "aprobar" ? " · APROBÓ" : c.accion === "ajuste" ? " · pidió ajuste" : ""} <span style={{ color: C.tenue, fontSize: 12 }}>{fecha(c.creado)}</span>
            <div style={{ whiteSpace: "pre-line" }}>{c.texto}</div>
          </div>
        ))}
        <textarea style={{ ...campo, width: "100%", minHeight: 60 }} maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Mensaje para el cliente (lo ve en su solicitud)" />
        <button type="button" style={{ ...boton(false), marginTop: 6 }} disabled={ocupado || !comentario.trim()} onClick={() => guardar({ comentario }, "✓ Comentario enviado").then(() => setComentario(""))}>Enviar comentario</button>
      </div>

      <div style={caja}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Tiempos reales (para definir precios y plazos)</h3>
        {s.duraciones.length === 0 ? (
          <div style={{ fontSize: 13, color: C.tenue }}>Se anotan solos al cambiar de estado.</div>
        ) : (
          s.duraciones.map((d, i) => (
            <div key={i} style={{ fontSize: 13.5 }}>
              {lista.estados.find((e) => e.valor === d.de)?.nombre} → {lista.estados.find((e) => e.valor === d.a)?.nombre}: <b>{duracion(d.minutos)}</b>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const EscanearPage = () => {
  const [lista, setLista] = useState<Lista | null>(null)
  const [error, setError] = useState("")
  const [filtro, setFiltro] = useState("")
  const [elegida, setElegida] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setError("")
      setLista(await api<Lista>(filtro ? `?estado=${filtro}` : ""))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [filtro])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const s = lista?.solicitudes.find((x) => x.id === elegida) || null
  const actualizar = (n: Solicitud) => setLista((l) => (l ? { ...l, solicitudes: l.solicitudes.map((x) => (x.id === n.id ? { ...x, ...n } : x)) } : l))

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, color: C.texto }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>🧩 Escanear</h1>
        <div style={{ fontSize: 13.5, color: C.tenue, marginTop: 4 }}>
          Ingeniería inversa: escanear, rediseñar, aprobar el render y fabricar. Fase 1 de uso interno, sin precios.{" "}
          {lista && (lista.publico ? <b style={{ color: C.naranja }}>Abierto al público (ESCANEAR_PUBLICO=on).</b> : "Sólo pueden pedir las cuentas de la casa y las de ESCANEAR_CORREOS.")}{" "}
          Los clientes entran en hetnacnc.com/mx/user/escanear.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select style={campo} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          {lista?.estados.map((e) => <option key={e.valor} value={e.valor}>{e.nombre}</option>)}
        </select>
        <button type="button" style={boton(false)} onClick={() => cargar()}>Recargar</button>
      </div>
      {error && <div style={{ ...caja, color: C.rojo }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ ...caja, padding: 6 }}>
          {!lista && !error && <div style={{ padding: 10, fontSize: 13, color: C.tenue }}>Cargando…</div>}
          {lista && lista.solicitudes.length === 0 && <div style={{ padding: 10, fontSize: 13, color: C.tenue }}>No hay solicitudes todavía.</div>}
          {lista?.solicitudes.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setElegida(x.id)}
              style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", border: "none", borderRadius: 8, padding: "8px 10px", background: x.id === elegida ? C.suave : "transparent", color: C.texto }}
            >
              <div style={{ fontSize: 11.5, color: C.tenue, fontWeight: 700 }}>{x.folio_texto} · {x.nombre_estado}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{x.titulo}</div>
              <div style={{ fontSize: 12, color: C.tenue }}>{x.disenador ? `Diseña: ${x.disenador}` : "Sin diseñador"} · {fecha(x.creado)}</div>
            </button>
          ))}
        </div>
        {s && lista ? <Detalle s={s} lista={lista} alCambiar={actualizar} /> : <div style={{ ...caja, fontSize: 13.5, color: C.tenue }}>Elige una solicitud.</div>}
      </div>
    </div>
  )
}

export const config = {
  label: "Escanear",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M12 7l4 2.5v5L12 17l-4-2.5v-5z" />
    </svg>
  ),
}

export default EscanearPage
