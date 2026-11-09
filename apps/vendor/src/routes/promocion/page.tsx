// @ts-nocheck
// "Promociona tu taller" — Marketing HETNA: talleres promotores.
// Kit de difusión (insignias para redes y estados de WhatsApp, QR, textos
// listos y resultados de su liga medida) y videos de sus trabajos con
// autorización para que HETNA los publique con crédito.
// Backend: packages/api/src/lib/promocion.ts
import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 11l18-8v18L3 13z" />
    <path d="M7 12v5a2 2 0 0 0 4 0v-4" />
  </svg>
)

export const config: RouteConfig = {
  label: "Promociona tu taller",
  icon: Icono,
}

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  h2: { fontSize: 16, fontWeight: 700, margin: "0 0 6px" },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px" },
  hint: { color: "#6B675C", fontSize: 13, margin: "0 0 10px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 18, marginBottom: 14 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  chip: (on) => ({ background: on ? "#142033" : "#F3F1EA", color: on ? "#fff" : "#40403A", border: 0, borderRadius: 999, padding: "6px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer" }),
  area: { width: "100%", minHeight: 60, border: "1px solid #D9D5C9", borderRadius: 8, padding: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
}

const TONOS = { oro: "#E8A33D", verde: "#2E9E57", marca: "#C2560A" }
const FORMATOS = { cuadrado: [1080, 1080, "Publicación (cuadrado)"], vertical: [1080, 1920, "Estado de WhatsApp / historia"] }
const ESTADOS = { pendiente: ["En revisión", "#8A5A00", "#FFF8EE"], aprobado: ["Aprobado: sale en redes", "#1E7B3A", "#E6F4EA"], rechazado: ["No aprobado", "#B3261E", "#FDECEA"], retirado: ["Retirado", "#6B675C", "#F3F1EA"] }

function partir(ctx, texto, ancho) {
  const palabras = String(texto || "").split(/\s+/)
  const lineas = []
  let act = ""
  for (const p of palabras) {
    const prueba = act ? `${act} ${p}` : p
    if (ctx.measureText(prueba).width <= ancho || !act) act = prueba
    else {
      lineas.push(act)
      act = p
    }
  }
  if (act) lineas.push(act)
  return lineas
}

// Dibuja la insignia en el canvas (todo en el navegador del taller)
async function dibujar(canvas, kit, ins, formato) {
  const [W, H] = FORMATOS[formato]
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  const vertical = H > W
  // Fondo azul HETNA con cuadrícula de plano
  ctx.fillStyle = "#142033"
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = "rgba(255,255,255,0.06)"
  ctx.lineWidth = 2
  for (let x = 0; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  const M = 80
  let y = vertical ? 200 : 110
  // Marca
  ctx.fillStyle = "#C2560A"
  ctx.font = "800 54px system-ui, -apple-system, Segoe UI, sans-serif"
  ctx.fillText("HETNA", M, y)
  ctx.fillStyle = "#ffffff"
  ctx.font = "500 54px system-ui, -apple-system, Segoe UI, sans-serif"
  ctx.fillText(" CNC", M + ctx.measureText("HETNA").width + 4, y)
  // Cinta de la insignia
  y += vertical ? 170 : 90
  const tono = TONOS[ins.tono] || TONOS.marca
  ctx.fillStyle = tono
  ctx.fillRect(M, y, 14, vertical ? 300 : 230)
  // Título
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${vertical ? 104 : 88}px system-ui, -apple-system, Segoe UI, sans-serif`
  let ty = y + (vertical ? 96 : 82)
  for (const l of partir(ctx, ins.titulo, W - M * 2 - 40).slice(0, 3)) {
    ctx.fillText(l, M + 40, ty)
    ty += vertical ? 116 : 98
  }
  ctx.fillStyle = "rgba(255,255,255,0.75)"
  ctx.font = `500 ${vertical ? 44 : 38}px system-ui, -apple-system, Segoe UI, sans-serif`
  for (const l of partir(ctx, ins.detalle, W - M * 2 - 40).slice(0, 2)) {
    ctx.fillText(l, M + 40, ty + 6)
    ty += vertical ? 56 : 48
  }
  // Nombre del taller
  ty += vertical ? 120 : 60
  ctx.fillStyle = tono
  ctx.font = `700 ${vertical ? 40 : 34}px system-ui, -apple-system, Segoe UI, sans-serif`
  ctx.fillText(ins.clave === "en-hetna" ? "TALLER" : "OTORGADO A", M, ty)
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${vertical ? 70 : 58}px system-ui, -apple-system, Segoe UI, sans-serif`
  ty += vertical ? 82 : 68
  for (const l of partir(ctx, kit.taller.nombre, W - M * 2).slice(0, 2)) {
    ctx.fillText(l, M, ty)
    ty += vertical ? 80 : 66
  }
  if (kit.taller.lugar) {
    ctx.fillStyle = "rgba(255,255,255,0.7)"
    ctx.font = `500 ${vertical ? 40 : 34}px system-ui, -apple-system, Segoe UI, sans-serif`
    ctx.fillText(`📍 ${kit.taller.lugar}`, M, ty)
  }
  // QR con la liga medida
  const lado = vertical ? 330 : 250
  const qx = W - M - lado
  const qy = H - M - lado - (vertical ? 120 : 70)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(qx - 18, qy - 18, lado + 36, lado + 36)
  const qr = document.createElement("canvas")
  await QRCode.toCanvas(qr, kit.liga, { width: lado, margin: 0, color: { dark: "#142033", light: "#ffffff" } })
  ctx.drawImage(qr, qx, qy, lado, lado)
  // Llamada a la acción
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${vertical ? 54 : 44}px system-ui, -apple-system, Segoe UI, sans-serif`
  const cy = H - M - (vertical ? 60 : 30)
  ctx.fillText("Cotiza con nosotros", M, cy - (vertical ? 70 : 56))
  ctx.fillStyle = "#F2A25F"
  ctx.font = `600 ${vertical ? 40 : 32}px system-ui, -apple-system, Segoe UI, sans-serif`
  ctx.fillText(kit.liga.replace(/^https?:\/\//, ""), M, cy)
}

function Insignias({ kit }) {
  const [sel, setSel] = useState(kit.insignias[0]?.clave)
  const [formato, setFormato] = useState("cuadrado")
  const [nota, setNota] = useState("")
  const ref = useRef(null)
  const ins = kit.insignias.find((i) => i.clave === sel) || kit.insignias[0]
  useEffect(() => {
    if (ref.current && ins) dibujar(ref.current, kit, ins, formato).catch(() => setNota("No se pudo dibujar la imagen."))
  }, [sel, formato, kit.liga])
  const blob = () => new Promise((r) => ref.current.toBlob(r, "image/png"))
  const nombreArchivo = () => `${kit.taller.handle}-${ins.clave}-${formato}.png`.replace(/[^\w.-]/g, "-")
  const descargar = async () => {
    const b = await blob()
    const url = URL.createObjectURL(b)
    const a = document.createElement("a")
    a.href = url
    a.download = nombreArchivo()
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
  const compartir = async () => {
    try {
      const archivo = new File([await blob()], nombreArchivo(), { type: "image/png" })
      if (navigator.canShare?.({ files: [archivo] })) await navigator.share({ files: [archivo], text: kit.textos.whatsapp })
      else setNota("Tu navegador no permite compartir directo: descárgala y súbela a tu red.")
    } catch {}
  }
  if (!ins) return null
  const [W, H] = FORMATOS[formato]
  return (
    <section style={S.card}>
      <h2 style={S.h2}>Insignias para tus redes</h2>
      <p style={S.hint}>Publícalas en Facebook, Instagram o tu estado de WhatsApp. El QR y la liga llevan a tu perfil y cuentan las visitas que traes. Se actualizan solas cuando subes en el ranking o te verificas.</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {kit.insignias.map((i) => (
          <button key={i.clave} type="button" style={S.chip(i.clave === sel)} onClick={() => setSel(i.clave)}>{i.titulo}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {Object.entries(FORMATOS).map(([k, v]) => (
          <button key={k} type="button" style={S.chip(formato === k)} onClick={() => setFormato(k)}>{v[2]}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <canvas ref={ref} style={{ width: formato === "vertical" ? 220 : 320, height: formato === "vertical" ? (220 * H) / W : 320, borderRadius: 10, border: "1px solid #E7E4DC" }} />
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" style={S.btn} onClick={descargar}>⬇ Descargar imagen</button>
          <button type="button" style={S.btn2} onClick={compartir}>📲 Compartir (celular)</button>
          {nota && <span style={{ fontSize: 13, color: "#8A5A00", maxWidth: 260 }}>{nota}</span>}
        </div>
      </div>
      {kit.ranking.length === 0 && (
        <p style={{ ...S.hint, marginTop: 12 }}>💡 Cuando tus clientes te evalúen en HETNA podrás ganar la insignia "Top" de tu especialidad en tu estado.</p>
      )}
    </section>
  )
}

function Textos({ kit }) {
  const [copiado, setCopiado] = useState("")
  const nombres = { whatsapp: "WhatsApp (estado o mensaje)", facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn" }
  return (
    <section style={S.card}>
      <h2 style={S.h2}>Textos listos para publicar</h2>
      <p style={S.hint}>Cópialos junto con la insignia. Ya llevan tu liga medida.</p>
      {Object.entries(kit.textos).map(([red, texto]) => (
        <div key={red} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <b style={{ fontSize: 13 }}>{nombres[red] || red}</b>
            <button
              type="button"
              style={{ ...S.btn2, padding: "3px 10px", fontSize: 12 }}
              onClick={() => navigator.clipboard?.writeText(texto).then(() => { setCopiado(red); setTimeout(() => setCopiado(""), 2000) })}
            >
              {copiado === red ? "✓ Copiado" : "Copiar"}
            </button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", background: "#FAF9F6", borderRadius: 8, padding: 10, fontSize: 13 }}>{texto}</div>
        </div>
      ))}
    </section>
  )
}

function Videos({ kit, alCambiar }) {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  const [archivo, setArchivo] = useState(null)
  const [descripcion, setDescripcion] = useState("")
  const [autorizo, setAutorizo] = useState(false)
  const [progreso, setProgreso] = useState(null)
  const [nota, setNota] = useState(null)
  const solicitud = params.get("solicitud") || ""
  const enviar = () => {
    if (!archivo) return setNota({ ok: false, t: "Elige un video." })
    if (archivo.size > kit.max_mb * 1024 * 1024) return setNota({ ok: false, t: `El video pesa más de ${kit.max_mb} MB. Recórtalo a 15–60 segundos.` })
    const fd = new FormData()
    fd.append("archivo", archivo)
    fd.append("descripcion", descripcion)
    fd.append("autorizo", autorizo ? "true" : "")
    if (solicitud) fd.append("solicitud_id", solicitud)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/vendor/hetna-promocion/videos")
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgreso(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      setProgreso(null)
      let d = {}
      try { d = JSON.parse(xhr.responseText) } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setNota({ ok: true, t: "¡Listo! HETNA lo revisa y te avisamos cuando salga en redes." })
        setArchivo(null)
        setDescripcion("")
        setAutorizo(false)
        alCambiar()
      } else setNota({ ok: false, t: d.message || `Error ${xhr.status}` })
    }
    xhr.onerror = () => { setProgreso(null); setNota({ ok: false, t: "Se cortó la conexión. Intenta de nuevo." }) }
    setNota(null)
    setProgreso(0)
    xhr.send(fd)
  }
  const retirar = async (id) => {
    if (!confirm("¿Retirar este video? Ya no lo publicaremos.")) return
    await fetch(`/vendor/hetna-promocion/videos/${id}`, { method: "DELETE", credentials: "include" })
    alCambiar()
  }
  return (
    <section style={S.card}>
      <h2 style={S.h2}>📹 Videos de tus trabajos</h2>
      <p style={S.hint}>
        Sube 10 a 60 segundos de tu máquina trabajando o el antes y después de una pieza. HETNA los publica en sus redes con el nombre de tu taller y la liga a tu perfil: es publicidad gratis para ti.
        Lo que más funciona: video vertical, que se vea la máquina cortando desde el primer segundo, sin música con derechos.
      </p>
      {solicitud && <p style={{ ...S.hint, color: "#1E7B3A" }}>Este video quedará ligado al pedido que entregaste.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        <label style={S.btn2}>
          {archivo ? `🎬 ${archivo.name} (${(archivo.size / 1048576).toFixed(1)} MB)` : "+ Elegir video (MP4, MOV o WebM)"}
          <input type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: "none" }} onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
        <input style={{ ...S.area, minHeight: 0, height: 40 }} maxLength={300} placeholder="¿Qué se ve? (ej. Corte láser de acero de 6 mm para una base de máquina)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#40403A", background: "#FAF9F6", borderRadius: 8, padding: 10 }}>
          <input type="checkbox" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} style={{ marginTop: 3 }} />
          <span>{kit.autorizacion.texto}</span>
        </label>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={S.btn} disabled={progreso !== null || !archivo || !autorizo} onClick={enviar}>
            {progreso !== null ? `Subiendo… ${progreso}%` : "Subir video"}
          </button>
          {nota && <span style={{ fontSize: 13, color: nota.ok ? "#1E7B3A" : "#B3261E" }}>{nota.t}</span>}
        </div>
      </div>
      {kit.videos.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {kit.videos.map((v) => {
            const [txt, col, bg] = ESTADOS[v.estado] || ESTADOS.pendiente
            return (
              <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13, borderTop: "1px solid #E7E4DC", paddingTop: 8 }}>
                <video src={v.url} style={{ width: 90, height: 60, objectFit: "cover", borderRadius: 6, background: "#000" }} muted preload="metadata" />
                <span style={{ flex: 1, minWidth: 160 }}>{v.descripcion || "Video sin descripción"}</span>
                <span style={{ background: bg, color: col, borderRadius: 999, padding: "2px 8px", fontWeight: 700, fontSize: 12 }}>{txt}</span>
                {v.motivo && <span style={{ color: "#B3261E" }}>{v.motivo}</span>}
                {v.estado !== "retirado" && (
                  <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => retirar(v.id)}>Retirar</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function PromocionPage() {
  const [kit, setKit] = useState(null)
  const [error, setError] = useState("")
  const [copiado, setCopiado] = useState(false)
  const cargar = () =>
    fetch("/vendor/hetna-promocion", { credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.message || `Error ${r.status}`)
        setKit(d)
      })
      .catch((e) => setError(e.message))
  useEffect(() => { cargar() }, [])
  if (error) return <div style={S.page}><p style={{ color: "#B3261E" }}>{error}</p></div>
  if (!kit) return <div style={S.page}><p>Cargando…</p></div>
  const r = kit.resultados || {}
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Promociona tu taller</h1>
      <p style={S.sub}>Comparte tu taller en tus redes con insignias y textos listos. Cada visita, cliente y solicitud que llega por tu liga se cuenta aquí.</p>

      <section style={{ ...S.card, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={S.h2}>Tu liga</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ background: "#F3F1EA", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}>{kit.liga}</code>
            <button type="button" style={{ ...S.btn2, padding: "4px 10px" }} onClick={() => navigator.clipboard?.writeText(kit.liga).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })}>
              {copiado ? "✓ Copiada" : "Copiar"}
            </button>
          </div>
          <p style={{ ...S.hint, marginTop: 8 }}>Lleva a tu perfil público: {kit.taller.perfil_url.replace(/^https?:\/\//, "")}</p>
        </div>
        <div style={{ display: "flex", gap: 18, textAlign: "center" }}>
          {[["Visitas", r.clics || 0], ["Clientes nuevos", r.registro_cliente || 0], ["Solicitudes", r.solicitud || 0]].map(([k, n]) => (
            <div key={k}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#142033" }}>{n}</div>
              <div style={{ fontSize: 12, color: "#6B675C" }}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      <Insignias kit={kit} />
      <Textos kit={kit} />
      <Videos kit={kit} alCambiar={cargar} />
    </div>
  )
}
