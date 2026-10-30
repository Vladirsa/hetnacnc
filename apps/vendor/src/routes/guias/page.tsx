// @ts-nocheck
// Pantalla "Guías" del panel del taller (/seller > Guías).
// Pedidos pagados con Envíos HETNA: el taller cotiza y compra la guía de
// Skydropx con un clic. Al comprarla, el pedido queda como enviado con su
// número de guía, el cliente recibe un correo y el taller descarga la etiqueta.
// La guía la paga HETNA con lo que el cliente pagó de envío.
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Camion = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 3h15v13H1z" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)

export const config: RouteConfig = {
  label: "Guías",
  icon: Camion,
}

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px", lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 12 },
  fila: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" },
  meta: { color: "#6B675C", fontSize: 13, margin: "2px 0 0" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  caja: { background: "#F7F5F0", borderRadius: 10, padding: 12, marginTop: 12, fontSize: 14 },
  error: { color: "#B3261E", fontSize: 13, margin: "8px 0 0" },
}

const ESTADO = {
  cotizada: { t: "Cotizada", c: "#6B675C", bg: "#F3F1EA" },
  generando: { t: "Generando guía…", c: "#8A5A00", bg: "#FFF6DB" },
  lista: { t: "Enviado", c: "#1E5BB3", bg: "#E8F0FC" },
  entregada: { t: "Entregado", c: "#1E7B3A", bg: "#E7F5EC" },
  error: { t: "Hubo un problema", c: "#B3261E", bg: "#FDECEA" },
}

const RASTREO = {
  created: "Guía creada", picked_up: "Recolectado", in_transit: "En tránsito", out_for_delivery: "En reparto",
  delivered: "Entregado", failed_attempt: "Intento fallido", exception: "Incidencia", returned_to_sender: "Devuelto",
}

const pesos = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const fecha = (s) => new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short" })

async function api(ruta, init = {}) {
  const r = await fetch(`/vendor/hetna-guias${ruta}`, { credentials: "include", ...init })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message || `Error ${r.status}`)
  return d
}

// Fotos de evidencia: con la guía pegada y visible. Las 4 primeras son obligatorias.
const ESPACIOS = [
  ["alto", "Alto", "Cinta métrica de la base a lo más alto"],
  ["largo", "Largo", "Cinta métrica de extremo a extremo"],
  ["ancho", "Ancho", "Cinta métrica del lado corto"],
  ["bascula", "Báscula", "Que se lean el peso y la guía"],
]

function Evidencia({ p, alCambiar }) {
  const g = p.guia
  const [ev, setEv] = useState(g.evidencia || [])
  const [subiendo, setSubiendo] = useState("")
  const [error, setError] = useState("")
  const [ligas, setLigas] = useState(null)
  const listas = ESPACIOS.filter(([t]) => ev.some((e) => e.tipo === t)).length

  const subir = async (tipo, archivo) => {
    if (!archivo) return
    setError("")
    setSubiendo(tipo)
    try {
      const fd = new FormData()
      fd.append("tipo", tipo)
      fd.append("archivo", archivo)
      const r = await fetch(`/vendor/hetna-guias/${p.id}/evidencia`, { method: "POST", credentials: "include", body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo subir la foto.")
      setEv(d.evidencia)
      setLigas(null)
      if (d.completa) alCambiar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo("")
    }
  }
  const ver = async () => {
    try {
      const d = await api(`/${p.id}/evidencia`)
      setLigas(Object.fromEntries((d.evidencia || []).map((f) => [f.tipo, f.url])))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ ...S.caja, background: listas === 4 ? "#F3FAF5" : "#FFF8EE", border: `1px solid ${listas === 4 ? "#BFE0CC" : "#F2C98F"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <b>Evidencia del paquete ({listas} de 4)</b>
        {ev.length > 0 && (
          <button type="button" onClick={ver} style={{ ...S.btn2, padding: "4px 10px", fontSize: 12 }}>Ver fotos</button>
        )}
      </div>
      <p style={{ ...S.meta, marginTop: 4 }}>
        Con la etiqueta ya pegada, toma estas fotos antes de entregar la caja. Si la paquetería reporta sobrepeso, son tu prueba.
        Sin ellas no podrás generar otra guía después de 24 horas.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginTop: 10 }}>
        {ESPACIOS.map(([tipo, titulo, ayuda]) => {
          const hecho = ev.find((e) => e.tipo === tipo)
          return (
            <label key={tipo} style={{ display: "block", cursor: "pointer", background: "#fff", border: `1px ${hecho ? "solid #1E7B3A" : "dashed #C9C5BA"}`, borderRadius: 10, padding: 10, fontSize: 12 }}>
              <b style={{ fontSize: 13 }}>{hecho ? "✓ " : ""}{titulo}</b>
              <div style={{ color: "#6B675C" }}>{ayuda}</div>
              <div style={{ marginTop: 4, fontWeight: 600, color: hecho ? "#1E7B3A" : "#C2560A" }}>
                {subiendo === tipo ? "Subiendo…" : hecho ? "Cambiar" : "+ Subir foto"}
                {hecho && ligas?.[tipo] && (
                  <a href={ligas[tipo]} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }} onClick={(e) => e.stopPropagation()}>abrir</a>
                )}
              </div>
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!subiendo}
                onChange={(e) => subir(tipo, e.target.files?.[0])} />
            </label>
          )
        })}
      </div>
      {error && <p style={S.error}>{error}</p>}
    </div>
  )
}

function Pedido({ p, alCambiar }) {
  const [cot, setCot] = useState(null)
  const [acepta, setAcepta] = useState(false)
  const [trabajando, setTrabajando] = useState("")
  const [error, setError] = useState("")
  const g = p.guia
  const est = g ? ESTADO[g.estado] : null
  const yaTiene = g && ["generando", "lista", "entregada"].includes(g.estado)

  const cotizar = async () => {
    setError("")
    setTrabajando("cotizar")
    try {
      setCot((await api(`/${p.id}/cotizar`, { method: "POST" })).cotizacion)
    } catch (e) {
      setError(e.message)
    } finally {
      setTrabajando("")
    }
  }

  const comprar = async () => {
    setError("")
    setTrabajando("comprar")
    try {
      await api(`/${p.id}/comprar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acepta }),
      })
      setCot(null)
      setAcepta(false)
      await alCambiar()
    } catch (e) {
      setError(e.message)
    } finally {
      setTrabajando("")
    }
  }

  const descargar = async () => {
    setError("")
    setTrabajando("etiqueta")
    try {
      const r = await fetch(`/vendor/hetna-guias/${p.id}/etiqueta`, { credentials: "include" })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "No se pudo descargar la etiqueta.")
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = `guia-${g?.guia || p.folio}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      setError(e.message)
    } finally {
      setTrabajando("")
    }
  }

  return (
    <section style={S.card}>
      <div style={S.fila}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
            Pedido #{p.folio} <span style={{ fontWeight: 400, color: "#6B675C", fontSize: 13 }}>· {fecha(p.fecha)}</span>
          </p>
          <p style={S.meta}>{p.cliente} · {p.destino}</p>
          <p style={S.meta}>{p.articulos} {p.articulos === 1 ? "artículo" : "artículos"} · {p.envio} · el cliente pagó {pesos(p.envio_pagado)}</p>
        </div>
        {est && (
          <span style={{ background: est.bg, color: est.c, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            {est.t}
          </span>
        )}
      </div>

      {yaTiene && g.guia && (
        <div style={S.caja}>
          <p style={{ margin: 0 }}><b>{g.paqueteria || "Paquetería"}</b> · Guía <b>{g.guia}</b></p>
          {g.rastreo_estado && <p style={{ ...S.meta, marginTop: 4 }}>Rastreo: {RASTREO[g.rastreo_estado] || g.rastreo_estado}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {g.tiene_etiqueta && (
              <button type="button" style={S.btn} onClick={descargar} disabled={!!trabajando}>
                {trabajando === "etiqueta" ? "Descargando…" : "Descargar etiqueta (PDF)"}
              </button>
            )}
            {g.rastreo_url && (
              <a href={g.rastreo_url} target="_blank" rel="noreferrer" style={{ ...S.btn2, textDecoration: "none" }}>Rastrear</a>
            )}
          </div>
          {g.estado === "lista" && (
            <p style={{ ...S.meta, marginTop: 10 }}>Imprime la etiqueta, pégala en la caja, toma las 4 fotos de abajo y entrégala a la paquetería (o espera la recolección).</p>
          )}
        </div>
      )}

      {yaTiene && g.guia && ["lista", "entregada"].includes(g.estado) && <Evidencia p={p} alCambiar={alCambiar} />}

      {g?.estado === "generando" && !g.guia && (
        <p style={{ ...S.meta, marginTop: 10 }}>Skydropx está generando la guía. Aparece aquí en unos minutos; no la vuelvas a comprar.</p>
      )}

      {!yaTiene && p.por_enviar && (
        <>
          {g?.estado === "error" && g.error && <p style={S.error}>La última vez falló: {g.error}</p>}
          {!cot && (
            <div style={{ marginTop: 12 }}>
              <button type="button" style={S.btn2} onClick={cotizar} disabled={!!trabajando}>
                {trabajando === "cotizar" ? "Cotizando…" : "Cotizar guía"}
              </button>
            </div>
          )}
          {cot && (
            <div style={S.caja}>
              <p style={{ margin: 0 }}>
                <b>{cot.paqueteria}</b> {cot.servicio} · {cot.dias} {Number(cot.dias) === 1 ? "día" : "días"}
              </p>
              <p style={{ ...S.meta, marginTop: 4 }}>
                De {cot.origen} a {cot.destino} · Paquete {cot.paquete.largo}×{cot.paquete.ancho}×{cot.paquete.alto} cm, {cot.paquete.peso} kg
              </p>
              <p style={{ ...S.meta, marginTop: 4 }}>Costo de la guía {pesos(cot.costo)} · el cliente pagó {pesos(cot.pagado_cliente)}</p>
              {cot.se_puede_comprar ? (
                <>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
                  <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>
                    Confirmo que la caja ya embalada mide <b>{cot.paquete.largo}×{cot.paquete.ancho}×{cot.paquete.alto} cm</b> y pesa{" "}
                    <b>{cot.paquete.peso} kg</b> o menos. Si la paquetería reporta más (sobrepeso), lo pago yo o se descuenta de mis pagos.
                    Subiré las 4 fotos (alto, largo, ancho y báscula) con la guía visible antes de entregarla.
                  </span>
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={{ ...S.btn, opacity: acepta ? 1 : 0.5 }} onClick={comprar} disabled={!!trabajando || !acepta}>
                    {trabajando === "comprar" ? "Generando guía…" : "Comprar guía"}
                  </button>
                  <button type="button" style={S.btn2} onClick={() => setCot(null)} disabled={!!trabajando}>Cancelar</button>
                </div>
                </>
              ) : (
                <p style={S.error}>
                  La guía cuesta bastante más de lo que pagó el cliente. Escríbenos y la generamos nosotros.
                </p>
              )}
              <p style={{ ...S.meta, marginTop: 8, fontSize: 12 }}>
                Las medidas y el peso salen de tus productos. Si no coinciden con la caja real, corrígelos en el producto antes de comprar la guía.
              </p>
            </div>
          )}
        </>
      )}

      {error && <p style={S.error}>{error}</p>}
    </section>
  )
}

export default function GuiasPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [verTodos, setVerTodos] = useState(false)

  const cargar = () =>
    api("")
      .then((d) => {
        setDatos(d)
        setError("")
      })
      .catch((e) => setError(e.message))

  useEffect(() => {
    cargar()
  }, [])

  if (error) return <div style={S.page}>No se pudo cargar: {error}. Recarga la página.</div>
  if (!datos) return <div style={S.page}>Cargando…</div>

  const pedidos = datos.pedidos || []
  // Pendientes: por enviar, generando, o con guía pero sin las 4 fotos
  const pendientes = pedidos.filter(
    (p) => p.por_enviar || p.guia?.estado === "generando" || (p.guia?.estado === "lista" && !p.guia?.evidencia_completa)
  )
  const visibles = verTodos ? pedidos : pendientes

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Guías de envío</h1>
      <p style={S.sub}>
        Los pedidos que el cliente pagó con <b>Envíos HETNA</b>. Cotiza y compra la guía aquí: el pedido queda como
        enviado, el cliente recibe su número de guía por correo y tú descargas la etiqueta para pegarla en la caja.
        La guía la paga HETNA con lo que el cliente pagó de envío.
      </p>

      {!datos.activo && (
        <section style={S.card}>Envíos HETNA no está activo por ahora. Envía por tu cuenta y captura la guía en el pedido.</section>
      )}

      {datos.activo && (datos.bloqueo?.sobrepesos?.length > 0 || datos.bloqueo?.sin_evidencia?.length > 0) && (
        <section style={{ ...S.card, background: "#FDECEA", borderColor: "#F5B5AE" }}>
          <b style={{ color: "#8A1C14" }}>No puedes generar nuevas guías por ahora</b>
          {datos.bloqueo.sobrepesos.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              Tienes sobrepesos por pagar:
              {datos.bloqueo.sobrepesos.map((s) => (
                <div key={s.folio} style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span>{s.folio} · {s.referencia} · <b>{pesos(s.monto)}</b></span>
                  {s.pago_url && <a href={s.pago_url} target="_blank" rel="noreferrer" style={{ ...S.btn, textDecoration: "none", padding: "5px 12px", fontSize: 13 }}>Pagar</a>}
                </div>
              ))}
            </div>
          )}
          {datos.bloqueo.sin_evidencia.length > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 14 }}>
              Faltan las fotos de evidencia de: <b>{datos.bloqueo.sin_evidencia.join(", ")}</b>. Súbelas en cada pedido (en “Todos”).
            </p>
          )}
        </section>
      )}

      {datos.activo && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button type="button" style={verTodos ? S.btn2 : S.btn} onClick={() => setVerTodos(false)}>
              Por enviar ({pendientes.length})
            </button>
            <button type="button" style={verTodos ? S.btn : S.btn2} onClick={() => setVerTodos(true)}>
              Todos ({pedidos.length})
            </button>
          </div>
          {!visibles.length && (
            <section style={S.card}>
              {verTodos ? "Todavía no tienes pedidos con Envíos HETNA en los últimos 60 días." : "No tienes pedidos por enviar. 🎉"}
            </section>
          )}
          {visibles.map((p) => (
            <Pedido key={p.id} p={p} alCambiar={cargar} />
          ))}

          {datos.sobrepesos?.length > 0 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: "24px 0 8px" }}>Sobrepesos</h2>
              {datos.sobrepesos.map((s) => (
                <section key={s.folio} style={S.card}>
                  <div style={S.fila}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{s.folio} · {s.referencia}</p>
                      <p style={S.meta}>
                        {s.kg_cotizado != null && s.kg_reportado != null ? `Cotizado ${s.kg_cotizado} kg · reportado ${s.kg_reportado} kg · ` : ""}
                        {pesos(s.monto)} · {s.estado_nombre}
                      </p>
                    </div>
                    {s.pago_url && <a href={s.pago_url} target="_blank" rel="noreferrer" style={{ ...S.btn, textDecoration: "none" }}>Pagar</a>}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
