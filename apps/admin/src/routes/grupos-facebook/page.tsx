// Dashboard > Grupos de Facebook: respuesta rápida a publicaciones tipo
// "¿alguien que fabrique esta pieza?". Pegas el texto o la captura (Ctrl+V), la
// IA saca pieza, medidas y material, y te da para copiar:
//   1) el comentario para quien publicó, con la liga a /cotizar ya llena;
//   2) el mensaje para los talleres que comentan ofreciendo hacerla.
// Nada se publica solo: se copia y se pega a mano (las reglas de Facebook
// prohíben automatizarlo). Las ligas llevan utm_source=facebook_grupo para ver
// en Analytics lo que llega de los grupos. Backend: POST /admin/hetna-grupos
// (packages/api/src/lib/respuesta-grupos.ts).
import { useState } from "react"
import type { CSSProperties, ClipboardEvent } from "react"

type Datos = {
  pieza: string
  medidas: string
  material: string
  proceso: string
  cantidad: string
  ciudad: string
  cliente_real: boolean
  nota: string
}
type Respuesta = { datos: Datos; liga: string; comentario: string; mensaje_taller: string }

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  verde: "#1E7B3A",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const campo: CSSProperties = { width: "100%", padding: "8px 10px", border: `1px solid ${C.borde}`, borderRadius: 8, fontSize: 14, background: C.fondo, color: "inherit", boxSizing: "border-box" }
const boton: CSSProperties = { background: C.naranja, color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 14 }
const botonClaro: CSSProperties = { ...boton, background: C.suave, color: "inherit", border: `1px solid ${C.borde}` }

const CIUDADES = ["León", "Guadalajara", "Monterrey", "Ciudad de México", "Puebla", "Tlaxcala", "Querétaro", "Toluca", "Aguascalientes", "San Luis Potosí", "Mérida", "Tijuana"]

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

async function pedir(cuerpo: unknown): Promise<Respuesta> {
  const r = await fetch("/admin/hetna-grupos", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...cabeceras() },
    body: JSON.stringify(cuerpo),
  })
  const d = await r.json().catch(() => null)
  if (!r.ok || !d) throw new Error(d?.message || "No se pudo procesar la publicación.")
  return d
}

const aDataUrl = (f: File) =>
  new Promise<string>((ok, mal) => {
    const lector = new FileReader()
    lector.onload = () => ok(String(lector.result))
    lector.onerror = () => mal(new Error("No se pudo leer la imagen."))
    lector.readAsDataURL(f)
  })

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [listo, setListo] = useState(false)
  return (
    <button
      type="button"
      style={listo ? { ...boton, background: C.verde } : boton}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setListo(true)
          setTimeout(() => setListo(false), 1800)
        } catch {
          /* sin portapapeles: el texto se puede seleccionar a mano */
        }
      }}
    >
      {listo ? "¡Copiado!" : etiqueta}
    </button>
  )
}

export default function GruposFacebookPage() {
  const [texto, setTexto] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [imagen, setImagen] = useState<string>("")
  const [r, setR] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")

  const ponerImagen = async (f?: File | null) => {
    if (!f || !f.type.startsWith("image/")) return
    if (f.size > 5 * 1024 * 1024) return setError("La captura pesa más de 5 MB.")
    setError("")
    setImagen(await aDataUrl(f))
  }

  const alPegar = (e: ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files || []).find((x) => x.type.startsWith("image/"))
    if (f) {
      e.preventDefault()
      void ponerImagen(f)
    }
  }

  const leer = async () => {
    setCargando(true)
    setError("")
    try {
      setR(await pedir({ texto, ciudad, imagen: imagen || undefined }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const editar = (k: keyof Datos, v: string) => r && setR({ ...r, datos: { ...r.datos, [k]: v } })
  const rearmar = async () => {
    if (!r) return
    setCargando(true)
    try {
      setR(await pedir({ datos: r.datos }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }} onPaste={alPegar}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Grupos de Facebook: respuesta rápida</h1>
      <p style={{ color: C.tenue, margin: "0 0 16px", fontSize: 14 }}>
        Para publicaciones tipo “¿alguien que fabrique esta pieza?”. Pega el texto o la captura (Ctrl+V en esta página) y te damos el comentario para el
        cliente, con la pieza ya capturada en HETNA, y el mensaje para los talleres que comentan. Se copia y se pega a mano; máximo 10 a 15 mensajes a
        talleres por día.
      </p>

      <div style={caja}>
        <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Texto de la publicación</label>
        <textarea
          style={{ ...campo, minHeight: 90, fontFamily: "inherit" }}
          placeholder="Alguien que fabrique este tipo de piezas? Base 150x60 de 10 mm, oreja de 6 mm con barreno de 20…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <label style={{ fontSize: 13 }}>
            Ciudad del grupo{" "}
            <input list="ciudades-grupo" style={{ ...campo, width: 200, display: "inline-block" }} value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="León" />
            <datalist id="ciudades-grupo">
              {CIUDADES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label style={{ ...botonClaro, display: "inline-block" }}>
            {imagen ? "Cambiar captura" : "Subir captura"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => void ponerImagen(e.target.files?.[0])} />
          </label>
          {imagen && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <img src={imagen} alt="Captura" style={{ height: 48, borderRadius: 6, border: `1px solid ${C.borde}` }} />
              <button type="button" style={{ ...botonClaro, padding: "4px 10px" }} onClick={() => setImagen("")}>
                Quitar
              </button>
            </span>
          )}
          <button type="button" style={{ ...boton, marginLeft: "auto" }} disabled={cargando || (!texto.trim() && !imagen)} onClick={() => void leer()}>
            {cargando ? "Leyendo…" : "Leer publicación"}
          </button>
        </div>
        {error && <p style={{ color: "#B42318", margin: "10px 0 0", fontSize: 13 }}>{error}</p>}
      </div>

      {r && (
        <>
          {!r.datos.cliente_real && (
            <div style={{ ...caja, background: "#FFFAEB", borderColor: "#F0D58A" }}>
              ⚠ Parece una publicación para juntar interacciones, no un cliente real. Comenta si quieres, pero dale prioridad a otras.
            </div>
          )}
          <div style={caja}>
            <p style={{ fontWeight: 700, margin: "0 0 10px" }}>Datos de la pieza (corrígelos si hace falta)</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {(
                [
                  ["pieza", "Pieza"],
                  ["medidas", "Medidas"],
                  ["material", "Material"],
                  ["proceso", "Proceso"],
                  ["cantidad", "Cantidad"],
                  ["ciudad", "Ciudad"],
                ] as [keyof Datos, string][]
              ).map(([k, nombre]) => (
                <label key={k} style={{ fontSize: 12, fontWeight: 600, color: C.tenue }}>
                  {nombre}
                  <input style={{ ...campo, marginTop: 4 }} value={String(r.datos[k] ?? "")} onChange={(e) => editar(k, e.target.value)} />
                </label>
              ))}
            </div>
            {r.datos.nota && <p style={{ fontSize: 13, color: C.tenue, margin: "10px 0 0" }}>📝 {r.datos.nota}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={botonClaro} disabled={cargando} onClick={() => void rearmar()}>
                Actualizar textos con estos datos
              </button>
              <a href={r.liga} target="_blank" rel="noreferrer" style={{ ...botonClaro, textDecoration: "none" }}>
                Ver cómo la recibe el cliente ↗
              </a>
            </div>
          </div>

          <div style={caja}>
            <p style={{ fontWeight: 700, margin: "0 0 6px" }}>1. Comentario para quien publicó</p>
            <p style={{ fontSize: 13, color: C.tenue, margin: "0 0 8px" }}>De preferencia comenta como la página HetNa CNC, no con tu perfil.</p>
            <textarea readOnly style={{ ...campo, minHeight: 120, fontFamily: "inherit" }} value={r.comentario} onFocus={(e) => e.currentTarget.select()} />
            <div style={{ marginTop: 8 }}>
              <Copiar texto={r.comentario} etiqueta="Copiar comentario" />
            </div>
          </div>

          <div style={caja}>
            <p style={{ fontWeight: 700, margin: "0 0 6px" }}>2. Mensaje para los talleres que comentan (Messenger)</p>
            <p style={{ fontSize: 13, color: C.tenue, margin: "0 0 8px" }}>
              Uno por uno y a mano. Si no contesta, no insistas; si tiene correo o página, pásalo a la hoja de prospectos y entra a la campaña de correo.
            </p>
            <textarea readOnly style={{ ...campo, minHeight: 120, fontFamily: "inherit" }} value={r.mensaje_taller} onFocus={(e) => e.currentTarget.select()} />
            <div style={{ marginTop: 8 }}>
              <Copiar texto={r.mensaje_taller} etiqueta="Copiar mensaje" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Grupos de Facebook",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
}
