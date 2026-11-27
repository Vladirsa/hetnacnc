// @ts-nocheck
// Pantalla "Mercado Libre" del panel del taller (/seller/mercadolibre).
// El taller conecta su cuenta de Mercado Libre y publica sus productos de HETNA:
// antes de publicar ve la vista previa (título, categoría, precio, existencias,
// fotos y los datos que pide la categoría) y la confirma producto por producto.
// API: /vendor/hetna-mercadolibre (packages/api/src/lib/mercadolibre.ts)
import { T } from "../../lib/idioma"
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Bolsa = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
)

export const config: RouteConfig = {
  label: "Mercado Libre",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: Bolsa,
}

const S = {
  page: { maxWidth: 900, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 20, marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 700, margin: "0 0 4px" },
  hint: { color: "#6B675C", fontSize: 13, margin: "0 0 12px" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  campo: { width: "100%", boxSizing: "border-box", border: "1px solid #D9D5CA", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit" },
  etiqueta: { display: "block", fontSize: 13, fontWeight: 600, margin: "10px 0 4px" },
  error: { background: "#FDECEA", color: "#B3261E", borderRadius: 8, padding: "10px 12px", fontSize: 14, margin: "0 0 12px" },
  ok: { background: "#E7F5EC", color: "#1E7B3A", borderRadius: 8, padding: "10px 12px", fontSize: 14, margin: "0 0 12px" },
}

const NO_DISPONIBLE = {
  falta_app: "La conexión con Mercado Libre todavía no está activa en HETNA. El equipo de HETNA está terminando de configurarla.",
  falta_cifrado: "La conexión con Mercado Libre todavía no está activa en HETNA (falta la llave de cifrado del servidor).",
  falta_secreto: "La conexión con Mercado Libre todavía no está activa en HETNA (falta la firma del servidor).",
}

const pesos = (n) => (n == null ? "" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n))

async function api(cuerpo) {
  const r = await fetch("/vendor/hetna-mercadolibre", {
    method: cuerpo ? "POST" : "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message || `Error ${r.status}`)
  return d
}

function VistaPrevia({ productoId, alCerrar, alPublicar }) {
  const [v, setV] = useState(null)
  const [error, setError] = useState("")
  const [titulo, setTitulo] = useState("")
  const [categoria, setCategoria] = useState("")
  const [tipo, setTipo] = useState("gold_special")
  const [valores, setValores] = useState({})
  const [enviando, setEnviando] = useState(false)

  const cargar = (cat) => {
    setV(null)
    setError("")
    api({ accion: "vista_previa", producto_id: productoId, categoria_id: cat })
      .then((d) => {
        setV(d)
        setTitulo(d.titulo)
        setCategoria(d.categoria.id)
        setValores(d.valores || {})
      })
      .catch((e) => setError(e.message))
  }
  useEffect(() => cargar(undefined), [productoId])

  const enviar = async () => {
    setEnviando(true)
    setError("")
    try {
      const r = await api({ accion: "publicar", producto_id: productoId, categoria_id: categoria, titulo, tipo_publicacion: tipo, atributos: valores })
      alPublicar(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ ...S.card, borderColor: "#C2560A" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={S.h2}><T>Revisa antes de publicar</T></h2>
        <button style={S.btn2} onClick={alCerrar}><T>Cerrar</T></button>
      </div>
      {error && <p style={{ ...S.error, marginTop: 12 }}><T>{error}</T></p>}
      {!v && !error && <p style={S.hint}><T>Preguntando a Mercado Libre la categoría y los datos que pide…</T></p>}
      {v && (
        <>
          <label style={S.etiqueta}><T>Título (</T><T>{titulo.length}</T>/<T>{v.max_titulo}</T>)</label>
          <input style={S.campo} value={titulo} maxLength={v.max_titulo} onChange={(e) => setTitulo(e.target.value)} />
          <p style={{ ...S.hint, marginTop: 4 }}><T>Producto + marca + modelo + medidas. Sin "envío gratis", sin existencias y sin signos.</T></p>

          <label style={S.etiqueta}><T>Categoría</T></label>
          <select style={S.campo} value={categoria} onChange={(e) => { setCategoria(e.target.value); cargar(e.target.value) }}>
            {[v.categoria, ...v.categorias.filter((c) => c.id !== v.categoria.id)].map((c) => (
              <option key={c.id} value={c.id}>{c.nombre || c.id}</option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={S.etiqueta}><T>Precio</T></label>
              <div>{pesos(v.precio)}</div>
            </div>
            <div>
              <label style={S.etiqueta}><T>Existencias</T></label>
              <div><T>{v.existencia}</T></div>
            </div>
            <div>
              <label style={S.etiqueta}><T>Tipo de publicación</T></label>
              <select style={S.campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="gold_special">Clásica</option>
                <option value="gold_pro">Premium (meses sin intereses)</option>
              </select>
            </div>
          </div>
          <p style={{ ...S.hint, marginTop: 4 }}><T>El precio y las existencias son los de tu producto en HETNA. Mercado Libre cobra su comisión según el tipo de publicación.</T></p>

          {v.requeridos.length > 0 && (
            <>
              <h2 style={{ ...S.h2, marginTop: 16 }}><T>Datos que pide Mercado Libre</T></h2>
              {v.requeridos.map((a) => (
                <div key={a.id}>
                  <label style={S.etiqueta}><T>{a.nombre}</T><T>{a.condicional ? " (si aplica)" : " *"}</T></label>
                  {a.valores.length > 0 ? (
                    <select style={S.campo} value={valores[a.id] || ""} onChange={(e) => setValores({ ...valores, [a.id]: e.target.value })}>
                      <option value="">Elige…</option>
                      {a.valores.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  ) : (
                    <input style={S.campo} value={valores[a.id] || ""} onChange={(e) => setValores({ ...valores, [a.id]: e.target.value })} />
                  )}
                </div>
              ))}
              <p style={{ ...S.hint, marginTop: 6 }}><T>Escribe los datos reales de tu producto. Si no tiene código de barras, en "Motivo de GTIN vacío" elige la razón que corresponda.</T></p>
            </>
          )}

          <h2 style={{ ...S.h2, marginTop: 16 }}><T>Fotos (</T><T>{v.imagenes.length}</T>)</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {v.imagenes.map((u) => <img key={u} src={u} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #E7E4DC" }} />)}
          </div>

          <h2 style={{ ...S.h2, marginTop: 16 }}><T>Descripción</T></h2>
          <p style={S.hint}><T>Mercado Libre no permite ligas, teléfonos ni correos: ya se quitaron.</T></p>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, background: "#FAF9F6", border: "1px solid #E7E4DC", borderRadius: 8, padding: 10, maxHeight: 200, overflow: "auto" }}>{v.descripcion || "(sin descripción)"}</pre>

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button style={{ ...S.btn, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={enviar}>
              <T>{enviando ? "Publicando…" : "Publicar en Mercado Libre"}</T>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const MercadoLibrePage = () => {
  const [d, setD] = useState(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [revisando, setRevisando] = useState(null)

  const cargar = () => api().then(setD).catch((e) => setError(e.message))
  useEffect(() => {
    cargar()
    const r = new URLSearchParams(window.location.search).get("resultado")
    if (r === "ok") setAviso("¡Listo! Tu cuenta de Mercado Libre quedó conectada.")
    if (r === "error") setError("No se pudo conectar tu cuenta de Mercado Libre. Intenta de nuevo.")
  }, [])

  const conectar = async () => {
    try {
      const { url } = await api({ accion: "conectar" })
      window.location.href = url
    } catch (e) {
      setError(e.message)
    }
  }
  const desconectar = async () => {
    if (!confirm("¿Desconectar tu cuenta de Mercado Libre? Tus publicaciones siguen en Mercado Libre, pero HETNA ya no las actualizará.")) return
    await api({ accion: "desconectar" }).catch((e) => setError(e.message))
    cargar()
  }

  if (!d && !error) return <div style={S.page}><p style={S.sub}><T>Cargando…</T></p></div>

  const elegibles = (d?.productos || []).filter((p) => p.elegible)
  const otros = (d?.productos || []).filter((p) => !p.elegible)

  return (
    <div style={S.page}>
      <h1 style={S.h1}><T>Mercado Libre</T></h1>
      <p style={S.sub}><T>Publica tus productos de HETNA en tu cuenta de Mercado Libre con el mismo precio, fotos y existencias.</T></p>
      {error && <p style={S.error}><T>{error}</T></p>}
      {aviso && <p style={S.ok}><T>{aviso}</T></p>}

      {d && !d.disponible && <div style={S.card}><p style={{ margin: 0 }}>{NO_DISPONIBLE[d.motivo] || NO_DISPONIBLE.falta_app}</p></div>}

      {d?.disponible && (
        <div style={S.card}>
          {d.cuenta ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={S.h2}><T>Cuenta conectada:</T> {d.cuenta.apodo || d.cuenta.ml_user_id}</h2>
                <p style={{ ...S.hint, margin: 0 }}><T>Solo se publica lo que tú confirmes, producto por producto.</T></p>
              </div>
              <button style={S.btn2} onClick={desconectar}><T>Desconectar</T></button>
            </div>
          ) : (
            <>
              <h2 style={S.h2}><T>Conecta tu cuenta de Mercado Libre</T></h2>
              <p style={S.hint}><T>Entrarás a Mercado Libre para autorizar a HETNA a publicar en tu nombre. Puedes desconectarla cuando quieras.</T></p>
              <button style={S.btn} onClick={conectar}><T>Conectar Mercado Libre</T></button>
            </>
          )}
        </div>
      )}

      {revisando && (
        <VistaPrevia
          productoId={revisando}
          alCerrar={() => setRevisando(null)}
          alPublicar={(r) => {
            setRevisando(null)
            setAviso(r.aviso ? r.aviso : "¡Publicado en Mercado Libre!")
            cargar()
          }}
        />
      )}

      {d?.cuenta && (
        <div style={S.card}>
          <h2 style={S.h2}><T>Productos que se pueden publicar (</T><T>{elegibles.length}</T>)</h2>
          <p style={S.hint}><T>Productos físicos con precio, foto y existencias. Los que se fabrican bajo pedido, digitales y servicios no aplican.</T></p>
          {elegibles.length === 0 && <p style={{ margin: 0 }}><T>Todavía no tienes productos que cumplan. Revisa la lista de abajo para ver qué les falta.</T></p>}
          {elegibles.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #F0EEE7" }}>
              {p.imagen ? <img src={p.imagen} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} /> : <div style={{ width: 48, height: 48 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}><T>{p.titulo}</T></div>
                <div style={{ fontSize: 13, color: "#6B675C" }}>{pesos(p.precio)} · <T>{p.existencia}</T> <T>en existencia</T></div>
                {p.publicacion?.error && <div style={{ fontSize: 12, color: "#B3261E" }}><T>{p.publicacion.error}</T></div>}
              </div>
              {p.publicacion?.ml_item_id && p.publicacion.estado !== "closed" ? (
                <a href={p.publicacion.permalink || "#"} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#1E7B3A" }}>
                  <T>Publicado (</T><T>{p.publicacion.estado}</T>) ↗
                </a>
              ) : (
                <button style={S.btn2} onClick={() => setRevisando(p.id)}><T>Publicar</T></button>
              )}
            </div>
          ))}
        </div>
      )}

      {d?.cuenta && otros.length > 0 && (
        <div style={S.card}>
          <h2 style={S.h2}><T>No se pueden publicar (</T><T>{otros.length}</T>)</h2>
          {otros.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid #F0EEE7", fontSize: 13 }}>
              <span><T>{p.titulo}</T></span>
              <span style={{ color: "#6B675C", textAlign: "right" }}><T>{p.motivo}</T></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MercadoLibrePage
