// Pantalla "Cargar productos" del dashboard (menú lateral).
// Carga masiva de productos de la tienda HETNA con una plantilla de Excel:
//   1. Bajar la plantilla (trae las categorías actuales y ejemplos).
//   2. Subirla llena: se revisa TODO sin cambiar nada (errores renglón por renglón).
//   3. Confirmar: se crean/actualizan los productos con su oferta (precio y existencias).
import { useRef, useState } from "react"
import type { CSSProperties } from "react"

const C = {
  borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)", tenue: "var(--fg-subtle, #6b6a63)", azul: "#142033", rojo: "#b42318", verde: "#1E7B3A", ambar: "#8A5A00",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const tenue: CSSProperties = { color: C.tenue, fontSize: 12 }
const boton = (tipo: "primario" | "normal" = "normal"): CSSProperties => ({
  cursor: "pointer", borderRadius: 10, padding: "8px 13px", fontSize: 13, fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none", background: tipo === "primario" ? C.azul : C.fondo, color: tipo === "normal" ? C.texto : "#fff",
})

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

type Problema = { fila: number | null; columna?: string; mensaje: string }
type Item = { handle: string; nombre: string; variantes: number; categoria: string; estado: string }
type Respuesta = {
  modo: "revisar" | "importar"
  renglones: number
  productos: number
  crear: Item[]
  actualizar: Item[]
  errores: Problema[]
  avisos: Problema[]
  resultados?: { handle: string; nombre: string; accion: string; ofertas: number; mensaje?: string }[]
  message?: string
}

async function enviar(archivo: File, modo: "revisar" | "importar", soloValidos = false): Promise<Respuesta> {
  const form = new FormData()
  form.append("archivo", archivo)
  form.append("modo", modo)
  if (soloValidos) form.append("solo_validos", "1")
  const r = await fetch("/admin/hetna-productos/importar", { method: "POST", credentials: "include", headers: cabeceras(), body: form })
  const d = (await r.json().catch(() => ({}))) as Respuesta
  if (r.status === 401) throw new Error("No se pudo verificar tu sesión. Cierra sesión, vuelve a entrar y recarga.")
  if (!r.ok && !d.renglones) throw new Error(d.message || `Error ${r.status}`)
  return d
}

async function bajarPlantilla() {
  const r = await fetch("/admin/hetna-productos/plantilla", { credentials: "include", headers: cabeceras() })
  if (!r.ok) throw new Error(`Error ${r.status}`)
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = "plantilla-productos-hetna.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

function Lista({ titulo, items, color }: { titulo: string; items: Item[]; color: string }) {
  if (!items.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 700, color }}>{titulo} ({items.length})</p>
      {items.slice(0, 200).map((i) => (
        <p key={i.handle} style={{ margin: "2px 0", fontSize: 13 }}>
          {i.nombre} <span style={tenue}>· {i.variantes} {i.variantes === 1 ? "variante" : "variantes"} · {i.categoria}{i.estado === "draft" ? " · borrador" : ""}</span>
        </p>
      ))}
    </div>
  )
}

function Problemas({ titulo, lista, color }: { titulo: string; lista: Problema[]; color: string }) {
  if (!lista.length) return null
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color }}>{titulo} ({lista.length})</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr style={{ textAlign: "left", color: C.tenue }}><th style={{ padding: 4, width: 70 }}>Renglón</th><th style={{ padding: 4, width: 200 }}>Columna</th><th style={{ padding: 4 }}>Qué pasa</th></tr></thead>
        <tbody>
          {lista.slice(0, 300).map((p, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.borde}` }}>
              <td style={{ padding: 4, fontWeight: 700 }}>{p.fila ?? "—"}</td>
              <td style={{ padding: 4 }}>{p.columna || ""}</td>
              <td style={{ padding: 4 }}>{p.mensaje}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ImportarProductos() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [rev, setRev] = useState<Respuesta | null>(null)
  const [fin, setFin] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const revisar = async (f: File | null) => {
    if (!f) return
    setArchivo(f); setRev(null); setFin(null); setError(null); setOcupado("Revisando el archivo…")
    try { setRev(await enviar(f, "revisar")) } catch (e) { setError((e as Error).message) } finally { setOcupado(null) }
  }
  const importar = async (soloValidos: boolean) => {
    if (!archivo) return
    setError(null); setOcupado("Creando productos… (puede tardar unos minutos si son muchos o traen fotos)")
    try {
      const r = await enviar(archivo, "importar", soloValidos)
      if (r.message && !r.resultados) setError(r.message)
      setFin(r)
    } catch (e) { setError((e as Error).message) } finally { setOcupado(null) }
  }
  const listos = rev ? rev.crear.length + rev.actualizar.length : 0
  const errores = rev?.errores.length ?? 0

  return (
    <div style={{ padding: 24, maxWidth: 1050, color: C.texto }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>Cargar productos</h1>
      <p style={{ ...tenue, margin: "0 0 14px", fontSize: 13 }}>
        Sube muchos productos de la tienda HETNA de una vez con una plantilla de Excel. Primero se revisa todo; nada se publica hasta que confirmas.
      </p>

      <div style={{ ...caja, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>1. Baja la plantilla</p>
          <p style={{ ...tenue, margin: "0 0 10px" }}>Trae las categorías de la tienda, ejemplos (fresas, consumibles, filamento) e instrucciones. Precio: el final con IVA incluido.</p>
          <button type="button" style={boton("primario")} onClick={() => bajarPlantilla().catch((e) => setError(e.message))}>Bajar plantilla</button>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>2. Súbela llena</p>
          <p style={{ ...tenue, margin: "0 0 10px" }}>Se revisa renglón por renglón sin cambiar nada. Si un producto ya existe (mismo agrupador), se actualiza; no se duplica.</p>
          <input ref={input} type="file" accept=".xlsx" disabled={!!ocupado} onChange={(e) => revisar(e.target.files?.[0] || null)} />
        </div>
      </div>

      {ocupado && <p style={{ ...tenue, fontSize: 13 }}>{ocupado}</p>}
      {error && <p style={{ color: C.rojo, fontSize: 13, background: "#FDECEA", padding: 10, borderRadius: 8 }}>{error}</p>}

      {rev && !fin && (
        <div style={caja}>
          <p style={{ margin: 0, fontWeight: 700 }}>3. Revisión de "{archivo?.name}"</p>
          <p style={{ ...tenue, margin: "4px 0 0" }}>{rev.renglones} renglones · {rev.productos} productos · {rev.crear.length} nuevos · {rev.actualizar.length} a actualizar · {errores} errores</p>
          <Problemas titulo="Errores (hay que corregirlos)" lista={rev.errores} color={C.rojo} />
          <Problemas titulo="Avisos (se puede importar, pero revísalos)" lista={rev.avisos} color={C.ambar} />
          <Lista titulo="Se van a crear" items={rev.crear} color={C.verde} />
          <Lista titulo="Se van a actualizar" items={rev.actualizar} color={C.azul} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {!errores && listos > 0 && <button type="button" style={boton("primario")} disabled={!!ocupado} onClick={() => importar(false)}>Importar {listos} {listos === 1 ? "producto" : "productos"}</button>}
            {errores > 0 && listos > 0 && <button type="button" style={boton()} disabled={!!ocupado} onClick={() => importar(true)}>Importar sólo los {listos} sin errores</button>}
            <button type="button" style={boton()} disabled={!!ocupado} onClick={() => { setRev(null); setArchivo(null); if (input.current) input.current.value = "" }}>Subir otro archivo</button>
          </div>
        </div>
      )}

      {fin?.resultados && (
        <div style={caja}>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Listo</p>
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            {fin.resultados.filter((r) => r.accion === "creado").length} creados · {fin.resultados.filter((r) => r.accion === "actualizado").length} actualizados ·{" "}
            <span style={{ color: fin.resultados.some((r) => r.accion === "error") ? C.rojo : C.tenue }}>{fin.resultados.filter((r) => r.accion === "error").length} con error</span>
          </p>
          {fin.resultados.map((r) => (
            <p key={r.handle} style={{ margin: "2px 0", fontSize: 13, color: r.accion === "error" ? C.rojo : C.texto }}>
              {r.accion === "error" ? "✗" : "✓"} {r.nombre} <span style={tenue}>· {r.accion}{r.ofertas ? ` · ${r.ofertas} con precio y existencias` : ""}{r.mensaje ? ` · ${r.mensaje}` : ""}</span>
            </p>
          ))}
          <Problemas titulo="Avisos" lista={fin.avisos} color={C.ambar} />
        </div>
      )}
    </div>
  )
}

export const config = {
  label: "Cargar productos",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  ),
}
