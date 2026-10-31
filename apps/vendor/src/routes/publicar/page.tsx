// @ts-nocheck
// Panel del taller > Publicar producto: por pasos y con ayuda, como Mercado
// Libre. Fotos → título → categoría → precio y existencias → envío →
// descripción → revisar y publicar. Todo se publica de una vez con
// POST /vendor/hetna-publicar (packages/api/src/lib/publicar-rapido.ts): el
// producto, la oferta con su precio y existencias, y los envíos del taller.
//
// Lo que va escribiendo se guarda en este navegador (localStorage), para que
// no pierda nada si cierra la pestaña a la mitad.
import { useEffect, useMemo, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 5v14M5 12h14" />
    <rect x="3" y="3" width="18" height="18" rx="3" />
  </svg>
)

export const config: RouteConfig = {
  label: "Publicar producto",
  icon: Icono,
}

const BORRADOR = "hetna-publicar-borrador"
const MAX_FOTOS = 8
const MAX_MB = 8

const VACIO = {
  fotos: [], // { url, blanco: true | false | null }
  titulo: "",
  categoria_id: "",
  precio: "",
  existencias: "1",
  condicion: "nuevo",
  sku: "",
  peso_kg: "",
  largo_cm: "",
  ancho_cm: "",
  alto_cm: "",
  descripcion: "",
}

// Paquetes comunes, para no tener que medir
const PAQUETES = [
  { nombre: "Sobre", nota: "papeles, calcomanías, piezas planas", peso_kg: "0.5", largo_cm: "30", ancho_cm: "25", alto_cm: "3" },
  { nombre: "Caja chica", nota: "fresas, refacciones chicas", peso_kg: "1", largo_cm: "20", ancho_cm: "15", alto_cm: "10" },
  { nombre: "Caja mediana", nota: "como de zapatos", peso_kg: "3", largo_cm: "40", ancho_cm: "30", alto_cm: "20" },
  { nombre: "Caja grande", nota: "spindles, motores, láminas chicas", peso_kg: "10", largo_cm: "60", ancho_cm: "40", alto_cm: "40" },
]

const PLANTILLA = `Material: 
Medidas: 
Qué incluye:
- 
- 
Para qué sirve: `

const PASOS = ["Fotos", "Título", "Categoría", "Precio", "Envío", "Descripción", "Publicar"]

const S = {
  page: { maxWidth: 760, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit", color: "#142033" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 18px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 14, padding: 22 },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 4px" },
  ayuda: { color: "#6B675C", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5 },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 },
  input: { width: "100%", height: 42, border: "1px solid #D9D5C9", borderRadius: 10, padding: "0 12px", fontSize: 15, boxSizing: "border-box", background: "#fff" },
  area: { width: "100%", minHeight: 180, border: "1px solid #D9D5C9", borderRadius: 10, padding: 12, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 10, padding: "12px 22px", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #D9D5C9", borderRadius: 10, padding: "11px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  error: { background: "#FDECEA", color: "#9B3225", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  ok: { background: "#E6F4EC", color: "#14683F", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 },
}

const opcion = (activa) => ({
  border: "1.5px solid " + (activa ? "#C2560A" : "#E7E4DC"),
  background: activa ? "#FFF4EC" : "#fff",
  borderRadius: 12,
  padding: "12px 14px",
  textAlign: "left",
  cursor: "pointer",
  fontSize: 14,
  color: "#142033",
})

const normalizar = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ")

const pesos = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const leerBorrador = () => {
  try {
    const b = JSON.parse(localStorage.getItem(BORRADOR) || "null")
    return b && typeof b === "object" ? { ...VACIO, ...b } : VACIO
  } catch {
    return VACIO
  }
}
const guardarBorrador = (d) => {
  try {
    localStorage.setItem(BORRADOR, JSON.stringify(d))
  } catch {
    // sin espacio o bloqueado: no pasa nada
  }
}
const borrarBorrador = () => {
  try {
    localStorage.removeItem(BORRADOR)
  } catch {
    // nada
  }
}

const subirFoto = async (archivo) => {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error(`"${archivo.name}": usa fotos JPG, PNG o WEBP.`)
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`"${archivo.name}" pesa más de ${MAX_MB} MB.`)
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/vendor/uploads", { method: "POST", credentials: "include", body: fd })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || `No se pudo subir "${archivo.name}".`)
  return d.files[0].url
}

const revisarFondo = async (url) => {
  try {
    const r = await fetch("/vendor/hetna-publicar/revisar-foto", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    const d = await r.json()
    return d.blanco ?? null
  } catch {
    return null
  }
}

// ¿Qué le falta a cada paso? (texto para el taller, o "" si está bien)
const faltaEn = (paso, d, fondoBlanco) => {
  if (paso === 0) {
    if (!d.fotos.length) return "Sube al menos una foto."
    if (d.fotos.some((f) => f.subiendo)) return "Espera a que terminen de subir las fotos."
    if (fondoBlanco && d.fotos.some((f) => f.blanco === false)) return "Hay fotos sin fondo blanco: cámbialas o quítalas."
  }
  if (paso === 1) {
    const t = d.titulo.trim()
    if (t.length < 8) return "Escribe un título más completo (mínimo 8 letras)."
    if (t.length > 120) return "El título es muy largo (máximo 120 letras)."
  }
  if (paso === 2 && !d.categoria_id) return "Elige una categoría."
  if (paso === 3) {
    if (!(Number(d.precio) > 0)) return "Escribe el precio en pesos."
    if (!(Number(d.existencias) >= 1)) return "Escribe cuántas piezas tienes (al menos 1)."
  }
  if (paso === 4) {
    if (!(Number(d.peso_kg) > 0)) return "Escribe el peso del paquete en kilos o elige un paquete."
    if (!(Number(d.largo_cm) > 0 && Number(d.ancho_cm) > 0 && Number(d.alto_cm) > 0)) return "Escribe las medidas del paquete en centímetros."
  }
  return ""
}

const PublicarPage = () => {
  const [d, setD] = useState(VACIO)
  const [paso, setPaso] = useState(0)
  const [categorias, setCategorias] = useState([])
  const [fondoBlanco, setFondoBlanco] = useState(true)
  const [buscar, setBuscar] = useState("")
  const [error, setError] = useState("")
  const [publicando, setPublicando] = useState(false)
  const [listo, setListo] = useState(null) // { handle }

  useEffect(() => {
    setD(leerBorrador())
    fetch("/vendor/hetna-publicar", { credentials: "include" })
      .then((r) => r.json())
      .then((r) => {
        setCategorias(Array.isArray(r.categorias) ? r.categorias : [])
        setFondoBlanco(r.fondo_blanco !== false)
      })
      .catch(() => setError("No se pudieron cargar las categorías. Recarga la página."))
  }, [])

  const cambiar = (cambios) =>
    setD((p) => {
      const n = { ...p, ...cambios }
      guardarBorrador({ ...n, fotos: n.fotos.filter((f) => !f.subiendo) })
      return n
    })

  // ---- Fotos ----
  const agregarFotos = async (lista) => {
    setError("")
    const archivos = Array.from(lista || []).slice(0, MAX_FOTOS - d.fotos.length)
    if (!archivos.length) return
    const temporales = archivos.map((a, i) => ({ url: URL.createObjectURL(a), subiendo: true, clave: `${Date.now()}-${i}` }))
    setD((p) => ({ ...p, fotos: [...p.fotos, ...temporales] }))
    for (let i = 0; i < archivos.length; i++) {
      const t = temporales[i]
      try {
        const url = await subirFoto(archivos[i])
        const blanco = fondoBlanco ? await revisarFondo(url) : true
        setD((p) => {
          const n = { ...p, fotos: p.fotos.map((f) => (f.clave === t.clave ? { url, blanco } : f)) }
          guardarBorrador({ ...n, fotos: n.fotos.filter((f) => !f.subiendo) })
          return n
        })
      } catch (e) {
        setError(e.message)
        setD((p) => ({ ...p, fotos: p.fotos.filter((f) => f.clave !== t.clave) }))
      }
    }
  }
  const quitarFoto = (i) => cambiar({ fotos: d.fotos.filter((_, j) => j !== i) })
  const hacerPrincipal = (i) => cambiar({ fotos: [d.fotos[i], ...d.fotos.filter((_, j) => j !== i)] })

  // ---- Categorías sugeridas con las palabras del título ----
  const sugeridas = useMemo(() => {
    const palabras = normalizar(d.titulo)
      .split(" ")
      .map((w) => w.replace(/(es|s)$/, ""))
      .filter((w) => w.length >= 4)
    if (!palabras.length) return []
    return categorias
      .map((c) => {
        const r = normalizar(c.ruta)
        const n = normalizar(c.nombre)
        let puntos = 0
        for (const w of palabras) {
          if (n.includes(w)) puntos += 3
          else if (r.includes(w)) puntos += 1
        }
        if (c.final) puntos += 0.5
        return { c, puntos }
      })
      .filter((x) => x.puntos >= 1)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 5)
      .map((x) => x.c)
  }, [d.titulo, categorias])

  const encontradas = useMemo(() => {
    const q = normalizar(buscar).trim()
    if (!q) return []
    const ws = q.split(" ").filter(Boolean)
    return categorias.filter((c) => ws.every((w) => normalizar(c.ruta).includes(w))).slice(0, 30)
  }, [buscar, categorias])

  const categoria = categorias.find((c) => c.id === d.categoria_id)

  const falta = faltaEn(paso, d, fondoBlanco)
  const siguiente = () => {
    if (falta) return setError(falta)
    setError("")
    setPaso((p) => Math.min(p + 1, PASOS.length - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const atras = () => {
    setError("")
    setPaso((p) => Math.max(p - 1, 0))
  }

  const publicar = async () => {
    for (let i = 0; i < PASOS.length - 1; i++) {
      const f = faltaEn(i, d, fondoBlanco)
      if (f) {
        setPaso(i)
        setError(f)
        return
      }
    }
    setPublicando(true)
    setError("")
    try {
      const r = await fetch("/vendor/hetna-publicar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: d.titulo,
          fotos: d.fotos.map((f) => f.url),
          categoria_id: d.categoria_id,
          precio: d.precio,
          existencias: d.existencias,
          condicion: d.condicion,
          sku: d.sku,
          peso_kg: d.peso_kg,
          largo_cm: d.largo_cm,
          ancho_cm: d.ancho_cm,
          alto_cm: d.alto_cm,
          descripcion: d.descripcion,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.message || "No se pudo publicar. Intenta de nuevo.")
      borrarBorrador()
      setListo({ handle: j.handle })
    } catch (e) {
      setError(e.message)
    } finally {
      setPublicando(false)
    }
  }

  const otro = () => {
    setD(VACIO)
    setPaso(0)
    setListo(null)
    setBuscar("")
  }

  // ---------------------------------------------------------------------------

  if (listo) {
    return (
      <div style={S.page}>
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ fontSize: 44, margin: 0 }}>🎉</p>
          <h1 style={{ ...S.h1, marginTop: 8 }}>¡Listo, tu producto ya está a la venta!</h1>
          <p style={{ ...S.sub, marginTop: 8 }}>
            Ya aparece en la tienda. Cuando alguien lo compre te avisamos por correo y lo ves en Pedidos.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
            <a href={`/mx/products/${listo.handle}`} target="_blank" rel="noreferrer" style={{ ...S.btn, textDecoration: "none" }}>
              Ver en la tienda
            </a>
            <button type="button" style={S.btn2} onClick={otro}>
              Publicar otro producto
            </button>
          </div>
        </div>
      </div>
    )
  }

  const porcentaje = Math.round(((paso + 1) / PASOS.length) * 100)

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Publicar producto</h1>
      <p style={S.sub}>
        Paso {paso + 1} de {PASOS.length}: <b>{PASOS[paso]}</b>. Lo que escribas se guarda solo en este navegador.
      </p>

      <div style={{ height: 6, background: "#EFEBE3", borderRadius: 99, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ width: `${porcentaje}%`, height: "100%", background: "#C2560A", transition: "width .2s" }} />
      </div>

      <div style={S.card}>
        {paso === 0 && (
          <>
            <h2 style={S.h2}>Fotos del producto</h2>
            <p style={S.ayuda}>
              Hasta {MAX_FOTOS} fotos, <b>con fondo blanco</b> y bien iluminadas. La primera es la principal. Si tu foto no tiene
              fondo blanco, quítaselo gratis en{" "}
              <a href="https://www.remove.bg/es" target="_blank" rel="noreferrer">
                remove.bg
              </a>{" "}
              (Editar → Fondo → blanco).
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12 }}>
              {d.fotos.map((f, i) => (
                <div key={f.clave || f.url} style={{ border: "1px solid #E7E4DC", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                  <div style={{ aspectRatio: "1/1", background: `#F7F5F0 center/contain no-repeat url(${f.url})`, opacity: f.subiendo ? 0.5 : 1 }} />
                  <div style={{ padding: 8, fontSize: 12 }}>
                    {f.subiendo ? (
                      <span style={{ color: "#6B675C" }}>Subiendo…</span>
                    ) : f.blanco === false ? (
                      <span style={{ color: "#9B3225", fontWeight: 600 }}>⚠ Sin fondo blanco</span>
                    ) : i === 0 ? (
                      <span style={{ color: "#14683F", fontWeight: 600 }}>★ Principal</span>
                    ) : (
                      <button type="button" onClick={() => hacerPrincipal(i)} style={{ border: 0, background: "none", color: "#C2560A", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600 }}>
                        Hacer principal
                      </button>
                    )}
                    {!f.subiendo && (
                      <button type="button" onClick={() => quitarFoto(i)} style={{ float: "right", border: 0, background: "none", color: "#6B675C", cursor: "pointer", padding: 0, fontSize: 12 }}>
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {d.fotos.length < MAX_FOTOS && (
                <label style={{ border: "2px dashed #D9D5C9", borderRadius: 12, aspectRatio: "1/1", display: "grid", placeItems: "center", cursor: "pointer", color: "#6B675C", fontSize: 13, textAlign: "center", padding: 8 }}>
                  <span>
                    <span style={{ fontSize: 30, display: "block", lineHeight: 1 }}>＋</span>
                    Agregar fotos
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const archivos = e.target.files
                      void agregarFotos(archivos).finally(() => {
                        e.target.value = ""
                      })
                    }}
                  />
                </label>
              )}
            </div>
          </>
        )}

        {paso === 1 && (
          <>
            <h2 style={S.h2}>¿Qué vendes?</h2>
            <p style={S.ayuda}>
              Escribe como lo buscaría un cliente: <b>qué es + marca o material + medida o modelo</b>. Ejemplo: "Fresa de
              compresión 1/4 2 filos para MDF y triplay".
            </p>
            <label style={S.label}>Título</label>
            <input
              style={S.input}
              value={d.titulo}
              maxLength={120}
              placeholder="Ej. Spindle enfriado por aire 2.2 kW 220 V con variador"
              onChange={(e) => cambiar({ titulo: e.target.value })}
              autoFocus
            />
            <p style={{ ...S.ayuda, margin: "6px 0 0", textAlign: "right" }}>{d.titulo.trim().length} / 120</p>
          </>
        )}

        {paso === 2 && (
          <>
            <h2 style={S.h2}>Categoría</h2>
            <p style={S.ayuda}>Así te encuentran en la tienda y en los filtros.</p>
            {sugeridas.length > 0 && (
              <>
                <label style={S.label}>Te sugerimos</label>
                <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                  {sugeridas.map((c) => (
                    <button key={c.id} type="button" style={opcion(d.categoria_id === c.id)} onClick={() => cambiar({ categoria_id: c.id })}>
                      {c.ruta}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label style={S.label}>{sugeridas.length ? "¿No es ninguna? Búscala" : "Busca la categoría"}</label>
            <input style={S.input} value={buscar} placeholder="Ej. fresas, spindle, láser, madera…" onChange={(e) => setBuscar(e.target.value)} />
            {buscar.trim() && (
              <div style={{ display: "grid", gap: 6, marginTop: 10, maxHeight: 320, overflowY: "auto" }}>
                {encontradas.length ? (
                  encontradas.map((c) => (
                    <button key={c.id} type="button" style={opcion(d.categoria_id === c.id)} onClick={() => cambiar({ categoria_id: c.id })}>
                      {c.ruta}
                    </button>
                  ))
                ) : (
                  <p style={{ ...S.ayuda, margin: 0 }}>No encontramos esa categoría. Prueba con otra palabra.</p>
                )}
              </div>
            )}
            {categoria && (
              <p style={{ ...S.ok, marginTop: 14 }}>
                Elegiste: <b>{categoria.ruta}</b>
              </p>
            )}
          </>
        )}

        {paso === 3 && (
          <>
            <h2 style={S.h2}>Precio y existencias</h2>
            <p style={S.ayuda}>El precio es por pieza, en pesos mexicanos, con IVA incluido.</p>
            <div style={S.grid}>
              <div>
                <label style={S.label}>Precio (MXN)</label>
                <input style={S.input} inputMode="decimal" value={d.precio} placeholder="Ej. 349" onChange={(e) => cambiar({ precio: e.target.value.replace(/[^0-9.]/g, "") })} />
              </div>
              <div>
                <label style={S.label}>Piezas disponibles</label>
                <input style={S.input} inputMode="numeric" value={d.existencias} onChange={(e) => cambiar({ existencias: e.target.value.replace(/\D/g, "") })} />
              </div>
            </div>
            <label style={{ ...S.label, marginTop: 16 }}>Condición</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["nuevo", "Nuevo"],
                ["usado", "Usado"],
                ["reacondicionado", "Reacondicionado"],
              ].map(([v, t]) => (
                <button key={v} type="button" style={opcion(d.condicion === v)} onClick={() => cambiar({ condicion: v })}>
                  {t}
                </button>
              ))}
            </div>
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#6B675C" }}>Más opciones (SKU / código interno)</summary>
              <div style={{ marginTop: 10 }}>
                <label style={S.label}>SKU (opcional, si no, lo ponemos nosotros)</label>
                <input style={S.input} value={d.sku} maxLength={40} onChange={(e) => cambiar({ sku: e.target.value })} />
              </div>
            </details>
          </>
        )}

        {paso === 4 && (
          <>
            <h2 style={S.h2}>Envío</h2>
            <p style={S.ayuda}>
              El paquete ya empacado. Con esto la paquetería calcula el envío del cliente. Elige uno parecido o escribe tus
              medidas.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 16 }}>
              {PAQUETES.map((p) => {
                const activo = d.peso_kg === p.peso_kg && d.largo_cm === p.largo_cm && d.ancho_cm === p.ancho_cm && d.alto_cm === p.alto_cm
                return (
                  <button
                    key={p.nombre}
                    type="button"
                    style={opcion(activo)}
                    onClick={() => cambiar({ peso_kg: p.peso_kg, largo_cm: p.largo_cm, ancho_cm: p.ancho_cm, alto_cm: p.alto_cm })}
                  >
                    <b>{p.nombre}</b>
                    <span style={{ display: "block", fontSize: 12, color: "#6B675C", marginTop: 2 }}>
                      {p.largo_cm}×{p.ancho_cm}×{p.alto_cm} cm · {p.peso_kg} kg
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#6B675C" }}>{p.nota}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
              {[
                ["peso_kg", "Peso (kg)"],
                ["largo_cm", "Largo (cm)"],
                ["ancho_cm", "Ancho (cm)"],
                ["alto_cm", "Alto (cm)"],
              ].map(([k, t]) => (
                <div key={k}>
                  <label style={S.label}>{t}</label>
                  <input style={S.input} inputMode="decimal" value={d[k]} onChange={(e) => cambiar({ [k]: e.target.value.replace(/[^0-9.]/g, "") })} />
                </div>
              ))}
            </div>
          </>
        )}

        {paso === 5 && (
          <>
            <h2 style={S.h2}>Descripción</h2>
            <p style={S.ayuda}>
              Cuenta lo que el cliente necesita saber: material, medidas, qué incluye y para qué sirve. Los renglones que
              empiezan con "-" salen como lista. Es opcional, pero vende más.
            </p>
            {!d.descripcion.trim() && (
              <button type="button" style={{ ...S.btn2, marginBottom: 10 }} onClick={() => cambiar({ descripcion: PLANTILLA })}>
                Usar plantilla
              </button>
            )}
            <textarea style={S.area} value={d.descripcion} maxLength={8000} onChange={(e) => cambiar({ descripcion: e.target.value })} placeholder={PLANTILLA} />
          </>
        )}

        {paso === 6 && (
          <>
            <h2 style={S.h2}>Revisa y publica</h2>
            <p style={S.ayuda}>Así se va a ver. Si algo está mal, regresa al paso con "Cambiar".</p>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,220px) 1fr", gap: 18, alignItems: "start" }}>
              <div style={{ aspectRatio: "1/1", borderRadius: 12, border: "1px solid #E7E4DC", background: `#fff center/contain no-repeat url(${d.fotos[0]?.url || ""})` }} />
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>{d.titulo}</p>
                <p style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>{pesos(d.precio)}</p>
                <p style={{ ...S.ayuda, margin: 0 }}>
                  {({ nuevo: "Nuevo", usado: "Usado", reacondicionado: "Reacondicionado" })[d.condicion]} · {d.existencias} disponibles
                </p>
                <p style={{ ...S.ayuda, margin: "4px 0 0" }}>{categoria?.ruta}</p>
                <p style={{ ...S.ayuda, margin: "4px 0 0" }}>
                  Paquete: {d.largo_cm}×{d.ancho_cm}×{d.alto_cm} cm · {d.peso_kg} kg
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {PASOS.slice(0, 6).map((nombre, i) => (
                <button key={nombre} type="button" style={{ ...S.btn2, padding: "6px 12px", fontSize: 12 }} onClick={() => setPaso(i)}>
                  Cambiar {nombre.toLowerCase()}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <div style={S.error}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 22 }}>
          <button type="button" style={{ ...S.btn2, visibility: paso === 0 ? "hidden" : "visible" }} onClick={atras}>
            ← Atrás
          </button>
          {paso < PASOS.length - 1 ? (
            <button type="button" style={S.btn} onClick={siguiente}>
              Siguiente →
            </button>
          ) : (
            <button type="button" style={{ ...S.btn, opacity: publicando ? 0.7 : 1 }} disabled={publicando} onClick={publicar}>
              {publicando ? "Publicando…" : "Publicar ahora"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicarPage
