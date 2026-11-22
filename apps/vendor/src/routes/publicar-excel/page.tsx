// @ts-nocheck
// Panel del taller > Publicar con Excel: muchos productos de una vez.
//   1. Baja la plantilla (GET /vendor/hetna-publicar/plantilla).
//   2. Elige el Excel lleno y las fotos (en la columna "Fotos" va el nombre de
//      cada archivo). Las fotos se suben a la tienda con /vendor/uploads, igual
//      que en Publicar producto.
//   3. Se revisa todo sin publicar nada (POST /vendor/hetna-publicar/excel,
//      modo "revisar") y, al confirmar, se publican (modo "importar").
// El servidor (lib/importar-productos) sólo actualiza productos de este taller.
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
// Sin "config": no sale en el menú, se entra desde Publicar producto.

const MAX_MB = 8
const C = { azul: "#142033", tenue: "#6B675C", borde: "#E7E4DC", rojo: "#9B3225", ambar: "#9A6A06", verde: "#14683F", naranja: "#C2560A" }
const S = {
  page: { maxWidth: 860, margin: "0 auto", padding: "24px 16px 80px", color: C.azul },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: C.tenue, fontSize: 14, margin: "4px 0 18px" },
  caja: { background: "#fff", border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 },
  paso: { margin: "0 0 4px", fontWeight: 700 },
  ayuda: { color: C.tenue, fontSize: 13, margin: "0 0 10px" },
  btn: { cursor: "pointer", border: 0, borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 700, background: C.naranja, color: "#fff" },
  btn2: { cursor: "pointer", border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, background: "#fff", color: C.azul },
}

async function bajarPlantilla() {
  const r = await fetch("/vendor/hetna-publicar/plantilla", { credentials: "include" })
  if (!r.ok) throw new Error("No se pudo bajar la plantilla. Recarga la página.")
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = "plantilla-productos-taller.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

async function subirFoto(archivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error(`"${archivo.name}": usa fotos JPG, PNG o WEBP.`)
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`"${archivo.name}" pesa más de ${MAX_MB} MB.`)
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/vendor/uploads", { method: "POST", credentials: "include", body: fd })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || `No se pudo subir "${archivo.name}".`)
  return d.files[0].url
}

async function enviar(excel, fotos, modo, soloValidos = false) {
  const fd = new FormData()
  fd.append("archivo", excel)
  fd.append("fotos", JSON.stringify(fotos))
  fd.append("modo", modo)
  if (soloValidos) fd.append("solo_validos", "1")
  const r = await fetch("/vendor/hetna-publicar/excel", { method: "POST", credentials: "include", body: fd })
  const d = await r.json().catch(() => null)
  if (r.status === 401) throw new Error("Tu sesión terminó. Vuelve a entrar.")
  if (!d) {
    // Sin respuesta del servidor (p. ej. tardó demasiado): al publicar, puede que sí haya avanzado
    throw new Error(
      modo === "importar"
        ? "La publicación está tardando más de lo normal. Espera 5 minutos y revisa tus productos antes de volver a intentar."
        : "No se pudo revisar el archivo. Intenta de nuevo en un momento."
    )
  }
  if (!r.ok && !Array.isArray(d.errores)) throw new Error(d.message || "No se pudo revisar el archivo.")
  return d
}

function Problemas({ titulo, lista, color }) {
  if (!lista?.length) return null
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color }}>{titulo} ({lista.length})</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: C.tenue }}>
            <th style={{ padding: 4, width: 70 }}>Renglón</th>
            <th style={{ padding: 4, width: 190 }}>Columna</th>
            <th style={{ padding: 4 }}>Qué pasa</th>
          </tr>
        </thead>
        <tbody>
          {lista.slice(0, 200).map((p, i) => (
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

function Lista({ titulo, items, color }) {
  if (!items?.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 700, color }}>{titulo} ({items.length})</p>
      {items.map((i) => (
        <p key={i.handle} style={{ margin: "2px 0", fontSize: 13 }}>
          {i.nombre}{" "}
          <span style={{ color: C.tenue, fontSize: 12 }}>
            · {i.variantes} {i.variantes === 1 ? "presentación" : "presentaciones"} · {i.categoria}
            {i.estado === "draft" ? " · borrador" : ""}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function PublicarExcel() {
  const [excel, setExcel] = useState(null)
  const [fotos, setFotos] = useState([]) // File[]
  const subidas = useRef(new Map()) // "nombre|tamaño" → liga (para no volver a subir)
  const [rev, setRev] = useState(null)
  const [fin, setFin] = useState(null)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState("")

  const mapaFotos = async () => {
    const mapa = {}
    let n = 0
    for (const f of fotos) {
      const clave = `${f.name}|${f.size}`
      if (!subidas.current.has(clave)) {
        n++
        setOcupado(`Subiendo fotos… ${n}`)
        subidas.current.set(clave, await subirFoto(f))
      }
      mapa[f.name] = subidas.current.get(clave)
    }
    return mapa
  }

  const revisar = async () => {
    if (!excel) return setError("Elige primero el Excel lleno.")
    setError(""); setRev(null); setFin(null)
    try {
      const mapa = await mapaFotos()
      setOcupado("Revisando el archivo…")
      setRev(await enviar(excel, mapa, "revisar"))
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado("")
    }
  }

  const publicar = async (soloValidos) => {
    setError("")
    try {
      const mapa = await mapaFotos()
      setOcupado("Publicando… puede tardar un par de minutos.")
      const r = await enviar(excel, mapa, "importar", soloValidos)
      if (r.message && !r.resultados) {
        setRev(r)
        setError(r.message)
      } else setFin(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado("")
    }
  }

  const listos = rev ? rev.crear.length + rev.actualizar.length : 0
  const errores = rev?.errores?.length ?? 0

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Publicar con Excel</h1>
      <p style={S.sub}>
        Sube muchos productos de una vez (hasta 25 productos y 100 renglones por archivo, de 2 MB como máximo). Primero se revisa todo y nada se publica hasta que confirmas. Para uno solo,
        usa <Link to="/publicar" style={{ color: C.naranja, fontWeight: 700 }}>Publicar producto</Link>.
      </p>

      <div style={S.caja}>
        <p style={S.paso}>1. Baja la plantilla</p>
        <p style={S.ayuda}>Trae las categorías de la tienda, ejemplos e instrucciones. Precio: el final con IVA incluido. Peso y medidas: del paquete ya empacado.</p>
        <button type="button" style={S.btn2} onClick={() => bajarPlantilla().catch((e) => setError(e.message))}>
          Bajar plantilla
        </button>
      </div>

      <div style={S.caja}>
        <p style={S.paso}>2. Elige el Excel lleno y las fotos</p>
        <p style={S.ayuda}>
          En la columna "Fotos" de cada producto escribe el nombre del archivo (por ejemplo <b>fresa-6mm.jpg</b>) y aquí elige esas mismas fotos.
          Fondo blanco, como en Publicar producto. JPG, PNG o WEBP de hasta {MAX_MB} MB.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 13 }}>
            <b>Excel (.xlsx):</b>{" "}
            <input type="file" accept=".xlsx" disabled={!!ocupado} onChange={(e) => { setExcel(e.target.files?.[0] || null); setRev(null); setFin(null) }} />
          </label>
          <label style={{ fontSize: 13 }}>
            <b>Fotos:</b>{" "}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!!ocupado} onChange={(e) => { setFotos(Array.from(e.target.files || [])); setRev(null); setFin(null) }} />
            {fotos.length > 0 && <span style={{ color: C.tenue }}> {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</span>}
          </label>
        </div>
        <button type="button" style={{ ...S.btn, marginTop: 12, opacity: excel && !ocupado ? 1 : 0.5 }} disabled={!excel || !!ocupado} onClick={revisar}>
          Revisar
        </button>
      </div>

      {ocupado && <p style={{ color: C.tenue, fontSize: 14 }}>{ocupado}</p>}
      {error && <p style={{ color: C.rojo, fontSize: 14, background: "#FDECEA", padding: 10, borderRadius: 8 }}>{error}</p>}

      {rev && !fin && (
        <div style={S.caja}>
          <p style={S.paso}>3. Revisión</p>
          <p style={S.ayuda}>
            {rev.productos} productos · {rev.crear.length} nuevos · {rev.actualizar.length} a actualizar · {errores} errores
          </p>
          <Problemas titulo="Errores (hay que corregirlos en el Excel)" lista={rev.errores} color={C.rojo} />
          <Problemas titulo="Avisos (se puede publicar, pero revísalos)" lista={rev.avisos} color={C.ambar} />
          <Lista titulo="Se van a publicar" items={rev.crear} color={C.verde} />
          <Lista titulo="Se van a actualizar" items={rev.actualizar} color={C.azul} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {!errores && listos > 0 && (
              <button type="button" style={S.btn} disabled={!!ocupado} onClick={() => publicar(false)}>
                Publicar {listos} {listos === 1 ? "producto" : "productos"}
              </button>
            )}
            {errores > 0 && listos > 0 && (
              <button type="button" style={S.btn2} disabled={!!ocupado} onClick={() => publicar(true)}>
                Publicar sólo los {listos} sin errores
              </button>
            )}
          </div>
        </div>
      )}

      {fin?.resultados && (
        <div style={S.caja}>
          <p style={S.paso}>Listo</p>
          <p style={S.ayuda}>
            {fin.resultados.filter((r) => r.accion === "creado").length} publicados · {fin.resultados.filter((r) => r.accion === "actualizado").length} actualizados ·{" "}
            {fin.resultados.filter((r) => r.accion === "error").length} con error
          </p>
          {fin.resultados.map((r) => (
            <p key={r.handle} style={{ margin: "2px 0", fontSize: 13, color: r.accion === "error" ? C.rojo : C.azul }}>
              {r.accion === "error" ? "✗" : "✓"} {r.nombre}
              <span style={{ color: C.tenue, fontSize: 12 }}> · {r.accion}{r.mensaje ? ` · ${r.mensaje}` : ""}</span>
            </p>
          ))}
          <Problemas titulo="Avisos" lista={fin.avisos} color={C.ambar} />
        </div>
      )}
    </div>
  )
}
