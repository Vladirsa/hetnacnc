// Pantalla "Catálogos por cargar" del dashboard (menú lateral).
// "Te cargamos tu catálogo": los talleres del Cotizador mandan su lista de
// precios como la tengan (Excel, PDF, fotos). Aquí HETNA:
//   1. Baja sus archivos y la plantilla.
//   2. Pasa la lista a la plantilla y la sube: primero "Revisar" (no cambia nada),
//      luego "Cargar" (escribe en el catálogo del taller y le avisa).
//   3. O la marca "Rechazada" con un mensaje si no se pudo leer.
import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

const C = {
  borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)", tenue: "var(--fg-subtle, #6b6a63)", azul: "#142033", rojo: "#b42318", verde: "#1E7B3A", ambar: "#8A5A00",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const tenue: CSSProperties = { color: C.tenue, fontSize: 12 }
const boton = (tipo: "primario" | "normal" | "peligro" = "normal"): CSSProperties => ({
  cursor: "pointer", borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none",
  background: tipo === "primario" ? C.azul : tipo === "peligro" ? C.rojo : C.fondo, color: tipo === "normal" ? C.texto : "#fff",
})

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

type Solicitud = {
  id: string
  estado: "recibida" | "en_proceso" | "lista" | "rechazada"
  respuesta: string | null
  productos_cargados: number
  nota: string | null
  creada: string
  taller: { id: string; nombre: string; telefono: string | null; plan: string | null }
  descargas: { nombre: string; url: string | null }[]
}
type Prueba = { taller: string; total: number; nuevos: number; ya_existian: number; errores: string[]; ejemplos: { nombre: string; precio: number; unidad: string; categoria: string | null }[] }
type Carga = { taller: string; cargados: number; ya_existian: number; fallidos: string[]; errores: string[] }

const ETIQUETA: Record<Solicitud["estado"], { t: string; c: string }> = {
  recibida: { t: "Recibida", c: C.ambar },
  en_proceso: { t: "En proceso", c: C.azul },
  lista: { t: "Lista", c: C.verde },
  rechazada: { t: "Rechazada", c: C.rojo },
}

async function pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { credentials: "include", ...init, headers: { ...cabeceras(), ...(init.headers || {}) } })
  const d = (await r.json().catch(() => ({}))) as any
  if (r.status === 401) throw new Error("No se pudo verificar tu sesión. Cierra sesión, vuelve a entrar y recarga.")
  if (!r.ok) throw new Error(d.error || d.message || `Error ${r.status}`)
  return d as T
}

async function bajarPlantilla() {
  const r = await fetch("/admin/hetna-catalogos/plantilla", { credentials: "include", headers: cabeceras() })
  if (!r.ok) throw new Error(`Error ${r.status}`)
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = "plantilla-catalogo-taller.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

const pesos = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Tarjeta({ s, alCambiar }: { s: Solicitud; alCambiar: () => void }) {
  const archivo = useRef<HTMLInputElement>(null)
  const [elegido, setElegido] = useState<File | null>(null)
  const [prueba, setPrueba] = useState<Prueba | null>(null)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState(s.respuesta || "")

  const subir = async (probar: boolean) => {
    if (!elegido) return
    setOcupado(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("archivo", elegido)
      const d = await pedir<any>(`/admin/hetna-catalogos/${s.id}/cargar${probar ? "?probar=1" : ""}`, { method: "POST", body: form })
      if (probar) setPrueba(d)
      else {
        setCarga(d)
        setPrueba(null)
        alCambiar()
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const cambiar = async (estado: Solicitud["estado"]) => {
    if (estado === "rechazada" && !mensaje.trim()) {
      setError("Escribe al taller qué falta antes de rechazar.")
      return
    }
    setOcupado(true)
    setError(null)
    try {
      await pedir(`/admin/hetna-catalogos/${s.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ estado, respuesta: mensaje }) })
      alCambiar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const et = ETIQUETA[s.estado]
  const tel = (s.taller.telefono || "").replace(/\D/g, "")
  return (
    <div style={caja}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{s.taller.nombre}</p>
          <p style={{ ...tenue, margin: "2px 0 0" }}>
            {new Date(s.creada).toLocaleString("es-MX")} · plan {s.taller.plan || "—"}
            {tel && <> · <a href={`https://wa.me/${tel.length === 10 ? `52${tel}` : tel}`} target="_blank" rel="noreferrer">WhatsApp</a></>}
          </p>
        </div>
        <span style={{ color: et.c, fontWeight: 700, fontSize: 13 }}>
          {et.t}{s.productos_cargados ? ` · ${s.productos_cargados} productos` : ""}
        </span>
      </div>
      {s.nota && <p style={{ margin: "8px 0 0", fontSize: 13 }}>Nota del taller: “{s.nota}”</p>}
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        Archivos:{" "}
        {s.descargas.map((a, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.nombre}</a> : <span style={tenue}>{a.nombre} (sin liga)</span>}
          </span>
        ))}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <input ref={archivo} type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={(e) => { setElegido(e.target.files?.[0] || null); setPrueba(null); setCarga(null) }} />
        <button style={boton()} onClick={() => archivo.current?.click()} disabled={ocupado}>{elegido ? `📄 ${elegido.name}` : "Elegir plantilla llena"}</button>
        <button style={boton()} onClick={() => subir(true)} disabled={!elegido || ocupado}>Revisar</button>
        <button style={boton("primario")} onClick={() => subir(false)} disabled={!prueba || !prueba.nuevos || ocupado}>Cargar {prueba ? prueba.nuevos : ""} al taller</button>
        {s.estado === "recibida" && <button style={boton()} onClick={() => cambiar("en_proceso")} disabled={ocupado}>Marcar en proceso</button>}
      </div>

      {prueba && (
        <div style={{ marginTop: 10, background: C.suave, borderRadius: 10, padding: 10, fontSize: 13 }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>
            Taller: {prueba.taller} · {prueba.total} en el archivo · <span style={{ color: C.verde }}>{prueba.nuevos} nuevos</span> · {prueba.ya_existian} ya existían
          </p>
          {prueba.ejemplos.map((e, i) => <p key={i} style={{ margin: "2px 0" }}>{e.nombre} <span style={tenue}>· {pesos(e.precio)} / {e.unidad}{e.categoria ? ` · ${e.categoria}` : ""}</span></p>)}
          {prueba.errores.map((e, i) => <p key={i} style={{ margin: "2px 0", color: C.ambar }}>⚠ {e}</p>)}
        </div>
      )}
      {carga && (
        <p style={{ marginTop: 10, color: C.verde, fontWeight: 700, fontSize: 13 }}>
          ✓ {carga.cargados} productos cargados a {carga.taller}. Ya le avisamos.{carga.fallidos.length ? ` ${carga.fallidos.length} no entraron: ${carga.fallidos.slice(0, 5).join(", ")}` : ""}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Mensaje para el taller (opcional; obligatorio para rechazar)"
          style={{ flex: "1 1 260px", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.borde}`, fontSize: 13, background: C.fondo, color: C.texto }} />
        {s.estado !== "lista" && <button style={boton()} onClick={() => cambiar("lista")} disabled={ocupado}>Marcar lista</button>}
        {s.estado !== "rechazada" && <button style={boton("peligro")} onClick={() => cambiar("rechazada")} disabled={ocupado}>Rechazar</button>}
      </div>
      {error && <p style={{ color: C.rojo, fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  )
}

export default function CatalogosPorCargar() {
  const [datos, setDatos] = useState<{ disponible: boolean; solicitudes: Solicitud[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)

  const cargar = () => {
    setError(null)
    pedir<{ disponible: boolean; solicitudes: Solicitud[] }>("/admin/hetna-catalogos").then(setDatos).catch((e) => setError(e.message))
  }
  useEffect(cargar, [])

  const lista = (datos?.solicitudes || []).filter((s) => verTodas || s.estado === "recibida" || s.estado === "en_proceso")
  return (
    <div style={{ padding: 20, maxWidth: 900, color: C.texto }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Catálogos por cargar</h1>
      <p style={{ ...tenue, fontSize: 13, margin: "0 0 16px" }}>
        Talleres del Cotizador que pidieron “Te cargamos tu catálogo”. Pasa su lista a la plantilla, revísala y cárgala: se escribe en su catálogo y le llega el aviso.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button style={boton()} onClick={() => bajarPlantilla().catch((e) => setError(e.message))}>⬇ Bajar plantilla</button>
        <button style={boton()} onClick={cargar}>↻ Actualizar</button>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} /> Ver también listas y rechazadas
        </label>
      </div>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {!datos && !error && <p style={tenue}>Cargando…</p>}
      {datos && !datos.disponible && (
        <div style={caja}>Falta correr <code>supabase/taller_vende_mas.sql</code> en la base del Cotizador (Supabase → SQL Editor).</div>
      )}
      {datos?.disponible && !lista.length && <p style={tenue}>No hay catálogos pendientes. 🎉</p>}
      {lista.map((s) => <Tarjeta key={s.id} s={s} alCambiar={cargar} />)}
    </div>
  )
}

export const config = {
  label: "Catálogos por cargar",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  ),
}
