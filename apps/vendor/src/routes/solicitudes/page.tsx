// @ts-nocheck
import { T, traducir } from "../../lib/idioma"
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 13h6M9 17h4" />
  </svg>
)

export const config: RouteConfig = {
  label: "Solicitudes",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: Icono,
}

const VIDRIO = {
  background: "rgba(255,255,255,0.78)",
  WebkitBackdropFilter: "blur(14px) saturate(1.2)",
  backdropFilter: "blur(14px) saturate(1.2)",
  border: "1px solid rgba(20,32,51,0.06)",
  boxShadow: "0 8px 24px -12px rgba(20,32,51,0.18)",
}
const S = {
  page: { maxWidth: 980, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 26, fontWeight: 800, margin: 0, color: "#142033", letterSpacing: "-0.02em" },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px" },
  card: { ...VIDRIO, borderRadius: 16, padding: 18, marginBottom: 14 },
  tag: (bg, color) => ({ background: bg, color, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }),
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", height: 40, border: "1px solid #D9D5C9", borderRadius: 10, padding: "0 10px", fontSize: 14, boxSizing: "border-box", background: "#fff" },
  area: { width: "100%", minHeight: 70, border: "1px solid #D9D5C9", borderRadius: 10, padding: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 },
  btn: { background: "linear-gradient(180deg,#D9600B,#C2560A)", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px -8px rgba(217,96,11,0.7)" },
  btn2: { background: "transparent", color: "#C2560A", border: "1px solid rgba(217,96,11,0.5)", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  tab: (on) => ({ background: on ? "#142033" : "rgba(255,255,255,0.78)", color: on ? "#fff" : "#40403A", border: on ? "1px solid #142033" : "1px solid rgba(20,32,51,0.08)", borderRadius: 999, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }),
}

// Cuánto falta para que cierre una solicitud, con color de urgencia
function Plazo({ cierra }) {
  if (!cierra) return null
  const h = (new Date(cierra).getTime() - Date.now()) / 3600000
  if (h <= 0) return <span style={S.tag("#F3F1EA", "#6B675C")}><T>Cerrada</T></span>
  const texto = h < 1 ? "Cierra en menos de 1 h" : h < 48 ? `Cierra en ${Math.round(h)} h` : `Cierra en ${Math.round(h / 24)} días`
  return h < 24 ? <span style={S.tag("#FDECEA", "#B3261E")}>⏱ <T>{texto}</T></span> : <span style={S.tag("#F3F1EA", "#55544D")}><T>{texto}</T></span>
}

// Panel lateral para responder una solicitud sin perder la lista (rediseño nov 2026)
function PanelLateral({ titulo, sub, alCerrar, children }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") alCerrar() }
    window.addEventListener("keydown", esc)
    const antes = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = antes }
  }, [alCerrar])
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={alCerrar} style={{ position: "absolute", inset: 0, background: "rgba(20,32,51,0.35)" }} />
      <div role="dialog" aria-label={titulo} style={{ position: "relative", width: "min(520px, 100%)", height: "100%", overflowY: "auto", background: "#FFFFFF", boxShadow: "-12px 0 32px -12px rgba(20,32,51,0.35)", padding: "22px 22px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C2560A" }}><T>Responder solicitud</T></p>
            <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "#142033" }}><T>{titulo}</T></p>
            {sub && <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6B675C" }}><T>{sub}</T></p>}
          </div>
          <button type="button" onClick={alCerrar} aria-label={traducir("Cerrar")} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E7E4DC", background: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const CAMPOS = [
  ["necesidad", "Necesita"], ["tiene_archivo", "Archivo"], ["servicio", "Servicio"], ["material", "Material"], ["cantidad", "Cantidad"], ["medidas", "Medidas"],
  ["marca", "Marca preferida"], ["unidad", "Unidad"], ["acabado", "Acabado"], ["tolerancia", "Tolerancia"], ["medidas_archivo", "Leído del archivo"], ["fecha", "Para cuándo"], ["frecuencia", "Frecuencia"], ["presupuesto", "Presupuesto"], ["acepta_envio", "Acepta envío"],
]

const pesos = (n) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MOTIVOS = [
  ["sin_capacidad", "No tengo capacidad ahora"],
  ["no_material", "No trabajo ese material"],
  ["no_servicio", "No hago ese proceso"],
  ["mas_info", "Necesito más información"],
]

// El visor de planos vive en la tienda (lee el archivo en el navegador con la liga firmada)
const SITIO = (typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname)) ? "http://localhost:8000" : "https://hetnacnc.com"

const pesoLegible = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil((b || 0) / 1024)} KB`)

// Licitaciones 3.0: pedir al cliente acceso a planos y descripción completa
function PedirAcceso({ sol }) {
  const [estado, setEstado] = useState(sol.acceso || "ninguno")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  if (estado === "aprobado") return null
  const pedir = async () => {
    const mensaje = window.prompt("Mensaje opcional para el cliente (por qué necesitas ver los planos):", "") ?? null
    if (mensaje === null) return
    setEnviando(true)
    setError("")
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/acceso`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setEstado(d.acceso || "pendiente")
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {estado === "ninguno" && (
        <button type="button" style={{ ...S.btn2, padding: "4px 10px", fontSize: 12 }} disabled={enviando} onClick={pedir}>
          <T>{enviando ? "Enviando..." : "🔑 Pedir acceso al cliente"}</T>
        </button>
      )}
      {estado === "pendiente" && <span style={{ color: "#8A5A00", fontSize: 12 }}><T>⏳ Pediste acceso: esperando al cliente</T></span>}
      {estado === "rechazado" && <span style={{ color: "#6B675C", fontSize: 12 }}><T>El cliente no autorizó el acceso. Cotiza con lo visible o hazle una pregunta.</T></span>}
      {error && <span style={{ color: "#B3261E", fontSize: 12 }}><T>{error}</T></span>}
    </span>
  )
}

// Acuerdo de confidencialidad (NDA): si el cliente lo pidió, el taller lo lee
// y lo acepta antes de ver la descripción, los planos y las fotos, y antes de
// cotizar. Queda registrado quién, cuándo, IP y navegador.
function AcuerdoNda({ sol, alAceptar }) {
  const [texto, setTexto] = useState(null)
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const t = sol.trabajo || {}
  if (!t.nda_requerido || t.nda_aceptado) return null
  const leer = async () => {
    setError("")
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/nda`, { credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setTexto(d.texto || "")
    } catch (e) {
      setError(e.message)
    }
  }
  const aceptar = async () => {
    setEnviando(true)
    setError("")
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/nda`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acepto: true }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      alAceptar?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div style={{ margin: "10px 0", background: "#FFF6EE", border: "1px solid #F2D4B8", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
      <b><T>🔏 Este cliente pide acuerdo de confidencialidad.</T></b> <T>Para ver la descripción, los planos y las fotos, y para cotizar, primero léelo y acéptalo.</T>
      {texto === null ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" style={{ ...S.btn2, padding: "4px 10px", fontSize: 12 }} onClick={leer}>
            <T>Leer el acuerdo</T>
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div style={{ whiteSpace: "pre-line", maxHeight: 220, overflowY: "auto", background: "#fff", border: "1px solid #E7E4DC", borderRadius: 6, padding: 10, color: "#40403A" }}><T>{texto}</T></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            <T>Leí el acuerdo y lo acepto a nombre de mi taller.</T>
          </label>
          <button type="button" style={{ ...S.btn, marginTop: 8, padding: "6px 14px", fontSize: 13 }} disabled={!acepto || enviando} onClick={aceptar}>
            <T>{enviando ? "Guardando..." : "Aceptar acuerdo"}</T>
          </button>
        </div>
      )}
      {error && <div style={{ color: "#B3261E", marginTop: 6 }}><T>{error}</T></div>}
    </div>
  )
}

// Expediente digital del proyecto (sólo el taller elegido): se pide una liga de
// 1 hora a la tienda, donde se ve, se imprime o se guarda en PDF.
function BotonExpediente({ sol }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const abrir = async () => {
    setCargando(true)
    setError("")
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/expediente`, { credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.message || String(r.status))
      window.open(d.url, "_blank", "noopener")
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" style={{ ...S.btn2, padding: "6px 12px", fontSize: 13 }} disabled={cargando} onClick={abrir}>
        <T>{cargando ? "Abriendo..." : "📁 Expediente del proyecto"}</T>
      </button>
      <span style={{ color: "#6B675C", fontSize: 12 }}><T>Archivos, propuesta, pagos, avances y entrega en un solo historial.</T></span>
      {error && <span style={{ color: "#B3261E", fontSize: 12 }}><T>{error}</T></span>}
    </div>
  )
}

// Los archivos del cliente están en un bucket privado: la liga se pide al
// momento y dura una hora.
function ArchivosCliente({ sol }) {
  const [ligas, setLigas] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const archivos = sol.trabajo?.archivos || []
  if (!archivos.length) return null

  const pedir = async () => {
    setCargando(true)
    setError("")
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/archivos`, { credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setLigas(d.archivos || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ marginTop: 10, background: "#FAF9F6", border: "1px solid #E7E4DC", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
      {!ligas ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>📎 <T>{archivos.length}</T> <T>{archivos.length === 1 ? "archivo del cliente" : "archivos del cliente"}</T>: <T>{archivos.map((a) => a.nombre).join(", ")}</T></span>
          <button type="button" style={{ ...S.btn2, padding: "4px 10px", fontSize: 12 }} disabled={cargando} onClick={pedir}>
            <T>{cargando ? "Preparando..." : "Descargar"}</T>
          </button>
          {error && <span style={{ color: "#B3261E" }}><T>{error}</T></span>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {ligas.map((a, i) =>
            a.url ? (
              <span key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
                  ⬇ <T>{a.nombre}</T> <span style={{ color: "#6B675C", fontWeight: 400 }}>({pesoLegible(a.tamano)})</span>
                </a>
                {/\.(dxf|svg|stl|obj)$/i.test(a.nombre) && (
                  <a
                    href={`${SITIO}/mx/visor?u=${encodeURIComponent(a.ver_url || a.url)}&n=${encodeURIComponent(a.nombre)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1a3a5c", fontWeight: 600, fontSize: 12 }}
                  >
                    <T>👁 Ver la pieza</T>
                  </a>
                )}
              </span>
            ) : a.bloqueado ? (
              <span key={i} style={{ color: "#6B675C" }}>
                🔒 <T>{a.nombre}</T>:<T>{" "}</T>
                <T>{a.motivo === "nda"
                  ? "acepta el acuerdo de confidencialidad para descargarlo"
                  : a.motivo === "solo_elegido"
                    ? "el cliente lo comparte sólo con el taller que elija"
                    : "el cliente lo comparte sólo con talleres autorizados"}</T>
              </span>
            ) : (
              <span key={i} style={{ color: "#B3261E" }}><T>{a.nombre}</T><T>: no disponible, intenta más tarde</T></span>
            )
          )}
          {ligas.some((a) => a.bloqueado && !a.motivo) && <PedirAcceso sol={sol} />}
          <span style={{ color: "#6B675C", fontSize: 12 }}>
            <T>Las ligas duran una hora y cada descarga queda registrada (el cliente ve quién bajó sus archivos). Los planos son confidenciales:
            úsalos sólo para cotizar y fabricar este trabajo.</T>
          </span>
        </div>
      )}
    </div>
  )
}

function FormNoPuedo({ sol, alGuardar, alCancelar }) {
  const [motivo, setMotivo] = useState(sol.mi_respuesta?.motivo || "")
  const [nota, setNota] = useState(sol.mi_respuesta?.nota || "")
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    setEnviando(true)
    setMsg(null)
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/respuesta`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo, nota }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      alGuardar()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #E7E4DC", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MOTIVOS.map(([v, l]) => (
          <button key={v} type="button" style={S.tab(motivo === v)} onClick={() => setMotivo(v)}><T>{l}</T></button>
        ))}
      </div>
      {motivo && (
        <>
          <label style={{ ...S.label, marginTop: 10 }}>
            <T>{motivo === "mas_info" ? "¿Qué necesitas saber? (HETNA se lo pregunta al cliente)" : "Nota para HETNA (opcional)"}</T>
          </label>
          <textarea style={S.area} value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder={motivo === "mas_info" ? "Ej. ¿Qué espesor de lámina? ¿El archivo trae cotas?" : "Ej. Tengo la máquina ocupada hasta el día 15."} />
        </>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" style={{ ...S.btn, background: "#142033", opacity: !motivo || enviando ? 0.6 : 1 }} disabled={!motivo || enviando} onClick={enviar}>
          <T>{enviando ? "Guardando..." : motivo === "mas_info" ? "Pedir información" : "Guardar respuesta"}</T>
        </button>
        <button type="button" style={{ ...S.btn2, border: 0 }} onClick={alCancelar}><T>Cancelar</T></button>
        {msg && <span style={{ fontSize: 14, color: "#B3261E" }}><T>{msg}</T></span>}
      </div>
    </div>
  )
}

// Pedido ganado y pagado: el taller cuenta avances al cliente y marca la
// entrega con paquetería y guía. El cliente lo ve en su liga y le llega correo.

// Licitaciones 3.0 — Fase 4: conversación privada y acuerdo HETNA SafeDeal
const fechaCorta = (v) => (v ? new Date(v).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "")

function Conversacion({ sol }) {
  const [lista, setLista] = useState([])
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const cargar = () => fetch(`/vendor/hetna-solicitudes/${sol.id}/mensajes`, { credentials: "include" }).then((r) => r.json()).then((d) => setLista(d.mensajes || [])).catch(() => {})
  useEffect(() => {
    cargar()
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 20000)
    return () => clearInterval(t)
  }, [sol.id])
  const enviar = async () => {
    if (!texto.trim()) return
    setError("")
    const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/mensajes`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return setError(d.message || "No se pudo enviar.")
    setTexto("")
    cargar()
  }
  return (
    <div style={{ marginTop: 12, border: "1px solid #E7E4DC", borderRadius: 10, padding: 12 }}>
      <b style={{ fontSize: 14 }}><T>💬 Conversación con el cliente</T></b>
      <p style={{ fontSize: 12, color: "#6B675C", margin: "4px 0 0" }}><T>Mientras el cliente no comparta su contacto o no firmen el acuerdo, correos, teléfonos y ligas se ocultan.</T></p>
      <div style={{ maxHeight: 260, overflowY: "auto", background: "#FAF9F6", borderRadius: 8, padding: 8, marginTop: 8, display: "grid", gap: 6 }}>
        {lista.length === 0 && <span style={{ fontSize: 13, color: "#8A867B" }}><T>Sin mensajes todavía. Confirma con el cliente los detalles del trabajo.</T></span>}
        {lista.map((m) => (
          <div key={m.id} style={{ justifySelf: m.mio ? "end" : "start", maxWidth: "85%", background: m.mio ? "#142033" : "#fff", color: m.mio ? "#fff" : "#142033", border: m.mio ? 0 : "1px solid #E7E4DC", borderRadius: 12, padding: "6px 10px", fontSize: 13 }}>
            <div style={{ whiteSpace: "pre-wrap" }}><T>{m.texto}</T></div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{fechaCorta(m.fecha)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <textarea style={{ ...S.area, minHeight: 44 }} value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} placeholder={traducir("Escribe tu mensaje…")} />
        <button type="button" style={S.btn} onClick={enviar} disabled={!texto.trim()}><T>Enviar</T></button>
      </div>
      {error && <p style={{ color: "#B3261E", fontSize: 13 }}><T>{error}</T></p>}
    </div>
  )
}

function AcuerdoSafeDeal({ sol }) {
  const [a, setA] = useState(null)
  const [cond, setCond] = useState({})
  const [editando, setEditando] = useState(false)
  const [nota, setNota] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [firma, setFirma] = useState({ nombre: "", representacion: "", codigo: "", acepto: false, autorizo_contacto: false })
  const [enviado, setEnviado] = useState("")
  const base = `/vendor/hetna-solicitudes/${sol.id}/acuerdo`
  const cargar = async () => {
    const d = await fetch(base, { credentials: "include" }).then((r) => r.json()).catch(() => null)
    setA(d)
    if (d?.contrato) setCond(d.contrato.condiciones || {})
    else if (d?.sugerencia) setCond(d.sugerencia)
  }
  useEffect(() => { cargar() }, [sol.id])
  if (!a?.disponible) return null
  const k = a.contrato
  const firmado = k?.estado === "firmado"
  const hacer = async (cuerpo, ok) => {
    setOcupado(true)
    setNota(null)
    const r = await fetch(base, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
    const d = await r.json().catch(() => ({}))
    setOcupado(false)
    if (!r.ok) {
      setNota({ ok: false, t: d.message || "No se pudo." })
      cargar()
      return null
    }
    if (ok) setNota({ ok: true, t: ok })
    await cargar()
    return d
  }
  const bajar = async (tipo, version) => {
    const r = await fetch(`${base}/documento?tipo=${tipo}${version ? `&version=${version}` : ""}`, { credentials: "include" })
    if (!r.ok) return setNota({ ok: false, t: "No se pudo descargar." })
    const url = URL.createObjectURL(await r.blob())
    const el = document.createElement("a")
    el.href = url
    el.download = `${tipo}-${sol.folio || sol.id}-v${version || k?.version}.pdf`
    el.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  const campos = () => (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      {a.apartados.map((ap, i) => (
        <label key={ap.clave} style={{ fontSize: 13 }}>
          <b>{i + 1}. <T>{ap.titulo}</T></b>
          <textarea style={S.area} value={cond[ap.clave] || ""} maxLength={3000} onChange={(e) => setCond({ ...cond, [ap.clave]: e.target.value })} />
        </label>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={S.btn} disabled={ocupado} onClick={async () => { if (await hacer({ accion: "guardar", condiciones: cond }, "Guardado. El cliente debe revisar y aprobar.")) setEditando(false) }}><T>{k ? "Guardar cambios" : "Proponer al cliente"}</T></button>
        <button type="button" style={S.btn2} onClick={() => { setEditando(false); setCond(k?.condiciones || a.sugerencia || {}) }}><T>Cancelar</T></button>
      </div>
    </div>
  )
  return (
    <div style={{ marginTop: 12, border: "1px solid #E7E4DC", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ fontSize: 14 }}><T>🤝 Acuerdo HETNA SafeDeal</T></b>
        <span style={S.tag("#F3F1EA", "#6B675C")}><T>Opcional</T></span>
        {firmado && <span style={S.tag("#E6F4EA", "#1E7B3A")}><T>Firmado por ambos</T></span>}
      </div>
      {!firmado && (
        <p style={{ fontSize: 13, background: "#FFF8EE", border: "1px solid #F2C98F", borderRadius: 8, padding: "8px 10px", margin: "8px 0 0" }}>
          <b><T>⚠️ Recomendado para el bienestar de los dos.</T></b> <T>Deja por escrito qué entregas, cuándo, a qué precio y cómo te pagan. Te protege de cambios de alcance y pagos atrasados, y al cliente le da certeza sobre calidad y confidencialidad.</T>
        </p>
      )}
      {a.leyenda && <p style={{ fontSize: 12, color: "#C2560A", fontWeight: 600, margin: "6px 0 0" }}><T>{a.leyenda}</T></p>}
      {a.contactos_liberados && a.contacto_otro && (
        <p style={{ fontSize: 13, background: "#EEF6F0", borderRadius: 8, padding: "8px 10px" }}>
          <b><T>Contacto del cliente:</T></b> <T>{[a.contacto_otro.nombre, a.contacto_otro.empresa, a.contacto_otro.email, a.contacto_otro.telefono && `Tel. ${a.contacto_otro.telefono}`, a.contacto_otro.whatsapp && `WhatsApp ${a.contacto_otro.whatsapp}`].filter(Boolean).join(" · ")}</T>
        </p>
      )}
      {!k && !editando && <button type="button" style={{ ...S.btn, marginTop: 8 }} onClick={() => setEditando(true)}><T>Preparar el acuerdo</T></button>}
      {((!k && editando) || (k?.estado === "borrador" && editando)) && campos()}
      {k?.estado === "borrador" && !editando && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <p style={{ margin: 0 }}><T>Versión</T> <T>{k.version}</T> <T>· Cliente:</T> <T>{k.aprobo_cliente ? "✓ aprobó" : "pendiente"}</T> <T>· Taller:</T> <T>{k.aprobo_taller ? "✓ aprobó" : "pendiente"}</T></p>
          <div style={{ background: "#FAF9F6", borderRadius: 8, padding: 8, marginTop: 6 }}>
            {a.apartados.map((ap, i) => (
              <div key={ap.clave} style={{ marginBottom: 6 }}><b>{i + 1}. <T>{ap.titulo}</T></b><div style={{ whiteSpace: "pre-wrap", color: "#40403A" }}><T>{k.condiciones?.[ap.clave] || "—"}</T></div></div>
            ))}
          </div>
          <details style={{ fontSize: 12, color: "#6B675C", marginTop: 6 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}><T>Papel de HETNA (</T><T>{a.modalidad === "conecta" ? "el cliente te paga directo" : "el cliente paga por medio de HETNA"}</T>)</summary>
            <p style={{ margin: "4px 0 0" }}><T>{a.clausula_hetna}</T></p>
          </details>
          {k.pendientes?.length > 0 && (
            <p style={{ background: "#FFF7ED", color: "#7C2D12", borderRadius: 8, padding: "6px 10px", margin: "6px 0 0" }}>
              <T>Antes de aprobar, completen lo que dice «indicar» o «por definir» en:</T> <T>{k.pendientes.join(", ")}</T><T>. Usa «Proponer cambios».</T>
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {!k.yo_aprobe && <button type="button" style={S.btn} disabled={ocupado || k.pendientes?.length > 0} onClick={() => hacer({ accion: "aprobar", huella: k.huella }, "Aprobaste las condiciones.")}><T>✓ Apruebo estas condiciones</T></button>}
            <button type="button" style={S.btn2} onClick={() => setEditando(true)}><T>Proponer cambios</T></button>
          </div>
        </div>
      )}
      {k?.estado === "listo" && (
        <div style={{ marginTop: 8, fontSize: 13, display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}><T>Ambos aprobaron la versión</T> <T>{k.version}</T>. <a href="#" style={{ color: "#C2560A" }} onClick={(e) => { e.preventDefault(); bajar("contrato") }}><T>Descarga y revisa el PDF</T></a>.</p>
          <span style={{ fontSize: 11, color: "#8A867B", wordBreak: "break-all" }}><T>SHA-256:</T> <T>{k.sha256}</T></span>
          {!k.yo_firme ? (
            <div style={S.grid}>
              <input style={S.input} placeholder={traducir("Tu nombre completo")} value={firma.nombre} onChange={(e) => setFirma({ ...firma, nombre: e.target.value })} />
              <input style={S.input} placeholder={traducir("Taller o empresa que representas")} value={firma.representacion} onChange={(e) => setFirma({ ...firma, representacion: e.target.value })} />
              <label style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={firma.acepto} onChange={(e) => setFirma({ ...firma, acepto: e.target.checked })} /> <T>Leí el contrato (versión</T> <T>{k.version}</T><T>) y acepto firmarlo electrónicamente.</T></label>
              <label style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={firma.autorizo_contacto} onChange={(e) => setFirma({ ...firma, autorizo_contacto: e.target.checked })} /> <T>{a.autorizacion_contacto}</T></label>
              <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "#6B675C" }}><T>Al firmar las dos partes, te mandamos a tu correo una copia del contrato y de la constancia de firmas.</T></p>
              {!enviado ? (
                <button type="button" style={S.btn} disabled={ocupado || !firma.acepto || !firma.autorizo_contacto || firma.nombre.trim().length < 5} onClick={async () => { const d = await hacer({ accion: "codigo" }); if (d) setEnviado(d.correo || "tu correo") }}><T>Enviarme el código</T></button>
              ) : (
                <>
                  <input style={S.input} inputMode="numeric" maxLength={6} placeholder={`Código enviado a ${enviado}`} value={firma.codigo} onChange={(e) => setFirma({ ...firma, codigo: e.target.value.replace(/\D/g, "") })} />
                  <button type="button" style={S.btn} disabled={ocupado || firma.codigo.length !== 6 || !firma.autorizo_contacto} onClick={() => hacer({ accion: "firmar", ...firma, sha256: k.sha256 }, "¡Firmaste!")}><T>Firmar contrato</T></button>
                </>
              )}
            </div>
          ) : (
            <b style={{ color: "#1E7B3A" }}><T>✓ Ya firmaste. Falta la firma del cliente.</T></b>
          )}
          <button type="button" style={{ ...S.btn2, justifySelf: "start" }} disabled={ocupado} onClick={() => hacer({ accion: "guardar", condiciones: k.condiciones }, "Versión nueva creada: haz tus cambios.")}><T>Cambiar condiciones (versión nueva)</T></button>
        </div>
      )}
      {firmado && (
        <div style={{ marginTop: 8, fontSize: 13, display: "grid", gap: 6 }}>
          <span><T>Firmado el</T> {fechaCorta(k.firmado_en)} <T>por</T> <T>{k.firmas.map((f) => f.nombre).join(" y ")}</T><T>. Nadie puede modificar esta versión.</T></span>
          <span style={{ fontSize: 11, color: "#8A867B", wordBreak: "break-all" }}><T>SHA-256:</T> <T>{k.sha256}</T></span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={S.btn} onClick={() => bajar("contrato", k.version)}><T>Descargar contrato</T></button>
            <button type="button" style={S.btn2} onClick={() => bajar("constancia", k.version)}><T>Constancia de firmas</T></button>
            <button type="button" style={S.btn2} disabled={ocupado} onClick={() => hacer({ accion: "guardar", condiciones: k.condiciones }, "Versión nueva creada.")}><T>Modificar (versión nueva)</T></button>
          </div>
        </div>
      )}
      {nota && <p style={{ fontSize: 13, color: nota.ok ? "#1E7B3A" : "#B3261E" }}><T>{nota.t}</T></p>}
    </div>
  )
}


// Licitaciones 3.0 — Fase 4: Trust & Ranking. El taller evalúa al cliente
// (7 indicadores) y ve, ya publicada, la evaluación que el cliente le dio.
function RepCliente({ rep }) {
  if (!rep) return null
  // Lo que hizo el cliente en HETNA (no opinión): trabajos que pagó y cancelaciones después de elegir taller
  const m = rep.medido
  const hechos = m && (m.pagados || m.cancelados_tras_elegir)
    ? ` · pagó ${m.pagados} ${m.pagados === 1 ? "trabajo" : "trabajos"}${m.cancelados_tras_elegir ? ` · canceló ${m.cancelados_tras_elegir} tras elegir` : ""}`
    : ""
  if (!rep.evaluaciones) return <span style={S.tag("#F3F1EA", "#6B675C")} title={traducir("Todavía no tiene evaluaciones de otros talleres")}><T>Cliente nuevo</T><T>{hechos}</T></span>
  const buena = rep.promedio >= 4
  return (
    <span style={S.tag(buena ? "#E6F4EA" : "#FFF8EE", buena ? "#1E7B3A" : "#8A5A00")} title={rep.suficiente ? "Evaluado por talleres en trabajos pagados" : "Historial todavía insuficiente"}>
      <T>Cliente ★</T> <T>{rep.promedio}</T> · <T>{rep.evaluaciones}</T> <T>{rep.evaluaciones === 1 ? "evaluación" : "evaluaciones"}</T><T>{!rep.suficiente ? " (poco historial)" : ""}</T><T>{hechos}</T>
    </span>
  )
}

function EvaluarCliente({ sol }) {
  const [d, setD] = useState(null)
  const [notas, setNotas] = useState({})
  const [comentario, setComentario] = useState("")
  const [editando, setEditando] = useState(false)
  const [modo, setModo] = useState("")
  const [texto, setTexto] = useState("")
  const [nota, setNota] = useState(null)
  const base = `/vendor/hetna-solicitudes/${sol.id}/evaluacion`
  const cargar = () =>
    fetch(base, { credentials: "include" }).then((r) => r.json()).then((x) => {
      setD(x)
      if (x?.dada) {
        setNotas(Object.fromEntries((x.indicadores || []).map((i) => [i.clave, x.dada[i.clave] || 0])))
        setComentario(x.dada.comentario || "")
      }
    }).catch(() => {})
  useEffect(() => { cargar() }, [sol.id])
  if (!d || !d.indicadores) return null
  const post = async (cuerpo, ok) => {
    setNota(null)
    const r = await fetch(base, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
    const x = await r.json().catch(() => ({}))
    if (!r.ok) return setNota({ ok: false, t: x.message || "No se pudo." })
    setNota({ ok: true, t: ok })
    setEditando(false)
    setModo("")
    cargar()
  }
  const completo = d.indicadores.every((i) => notas[i.clave])
  const r = d.recibida
  return (
    <div style={{ marginTop: 12, border: "1px solid #E7E4DC", borderRadius: 10, padding: 12, fontSize: 13 }}>
      <b style={{ fontSize: 14 }}><T>⭐ Evaluación mutua</T></b>
      {!d.puede_evaluar && !d.dada && <p style={{ margin: "4px 0 0", color: "#6B675C" }}><T>Cuando entregues y el cliente haya pagado, podrás evaluarlo. Su reputación ayuda a otros talleres a elegir con quién trabajar.</T></p>}
      {d.puede_evaluar && (!d.dada || editando) && (
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <span style={{ color: "#6B675C" }}><T>Evalúa al cliente. Se publica cuando los dos evalúen (o en</T> <T>{d.dias_publicacion}</T> <T>días); antes nadie ve la evaluación del otro.</T></span>
          {d.indicadores.map((i) => (
            <div key={i.clave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span><T>{i.nombre}</T></span>
              <span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${i.nombre} ${n} de 5`} onClick={() => setNotas({ ...notas, [i.clave]: n })} style={{ background: "none", border: 0, fontSize: 20, cursor: "pointer", color: n <= (notas[i.clave] || 0) ? "#C2560A" : "#D9D5C9", padding: "0 1px" }}>★</button>
                ))}
              </span>
            </div>
          ))}
          <textarea style={S.area} maxLength={1000} placeholder={traducir("Comentario (opcional)")} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          <button type="button" style={{ ...S.btn, justifySelf: "start" }} disabled={!completo} onClick={() => post({ accion: "evaluar", ...notas, comentario }, "Evaluación guardada.")}><T>Enviar evaluación</T></button>
        </div>
      )}
      {d.dada && !editando && (
        <p style={{ margin: "6px 0 0" }}>
          <T>Evaluaste al cliente:</T> <b>{Number(d.dada.promedio).toFixed(1)} / 5</b><T>{d.dada.retenida ? " (en revisión de HETNA)" : d.dada.publicada ? " · publicada" : " · se publica cuando el cliente evalúe"}</T><T>{" "}</T>
          {!d.dada.publicada && <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => setEditando(true)}><T>Cambiar</T></button>}
        </p>
      )}
      {d.recibida_pendiente && <p style={{ margin: "6px 0 0", color: "#6B675C" }}><T>El cliente ya te evaluó. La verás cuando tú lo evalúes (o en</T> <T>{d.dias_publicacion}</T> <T>días).</T></p>}
      {r && (
        <div style={{ background: "#FAF9F6", borderRadius: 8, padding: 8, marginTop: 8 }}>
          <b><T>El cliente te evaluó:</T> {Number(r.promedio).toFixed(1)} / 5</b>
          {r.comentario && <div style={{ marginTop: 4 }}>“<T>{r.comentario}</T>”</div>}
          {r.respuesta && <div style={{ marginTop: 4, color: "#40403A" }}><T>Tu respuesta:</T> <T>{r.respuesta}</T></div>}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => setModo("responder")}><T>Responder</T></button>
            <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12, color: "#B3261E", borderColor: "#B3261E" }} onClick={() => setModo("reclamar")}><T>Pedir revisión</T></button>
          </div>
          {modo && (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <textarea style={{ ...S.area, minHeight: 44 }} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={modo === "reclamar" ? "¿Por qué no es correcta?" : "Respuesta pública"} />
              <button type="button" style={S.btn} onClick={() => post({ accion: modo, texto }, modo === "reclamar" ? "Reclamación enviada a HETNA." : "Respuesta publicada.")}><T>Enviar</T></button>
            </div>
          )}
        </div>
      )}
      {nota && <p style={{ color: nota.ok ? "#1E7B3A" : "#B3261E", margin: "6px 0 0" }}><T>{nota.t}</T></p>}
    </div>
  )
}

// Hitos de producción del pedido ganado: fecha planeada (se puede mover), "Listo"
// con nota y fotos. El cliente ve todo en su liga y le avisamos al terminar cada uno.
function Hitos({ sol }) {
  const [hitos, setHitos] = useState(null)
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const base = "/vendor/hetna-solicitudes/" + sol.id
  useEffect(() => {
    fetch(base + "/hitos", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setHitos(d.hitos || []))
      .catch(() => setHitos([]))
  }, [sol.id])
  const guardar = async (clave, datos) => {
    setOcupado(clave)
    setMsg(null)
    try {
      const r = await fetch(base + "/hitos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, ...datos }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setHitos(d.hitos || [])
      if (datos.hecho) setMsg({ ok: true, t: "Listo. Le avisamos al cliente." })
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setOcupado(null)
    }
  }
  const subirFoto = async (clave, archivo) => {
    if (!archivo) return
    setOcupado(clave)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append("archivo", archivo)
      fd.append("clave", clave)
      const r = await fetch(base + "/hito-foto", { method: "POST", credentials: "include", body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setHitos(d.hitos || [])
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setOcupado(null)
    }
  }
  if (!hitos) return <p style={{ fontSize: 12, color: "#6B675C", margin: "10px 0 0" }}><T>Cargando hitos…</T></p>
  if (!hitos.length) return null
  const color = { hecho: "#1E7B3A", atrasado: "#B3261E", pendiente: "#8A867B" }
  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #E7E4DC", paddingTop: 10 }}>
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#142033" }}>
        <T>Hitos de producción ·</T> <T>{hitos.filter((h) => h.estado === "hecho").length}</T> <T>de</T> <T>{hitos.length}</T> <T>listos</T>
      </p>
      {hitos.map((h) => (
        <div key={h.clave} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.2fr) 140px 1fr", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px dashed #E7E4DC" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 600, color: color[h.estado] }}>
            <input type="checkbox" checked={h.estado === "hecho"} disabled={ocupado === h.clave}
              onChange={(e) => guardar(h.clave, { hecho: e.target.checked })} />
            <T>{h.nombre}</T>
            {h.estado === "atrasado" && <span style={S.tag("#FDECEA", "#B3261E")}><T>Atrasado</T></span>}
          </label>
          <input type="date" style={{ ...S.input, height: 32 }} defaultValue={h.fecha_plan || ""} title={traducir("Fecha planeada")}
            onBlur={(e) => e.target.value && e.target.value !== h.fecha_plan && guardar(h.clave, { fecha_plan: e.target.value })} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ ...S.input, height: 32, flex: "1 1 160px" }} defaultValue={h.nota || ""} placeholder={traducir("Nota para el cliente")} maxLength={600}
              onBlur={(e) => e.target.value !== (h.nota || "") && guardar(h.clave, { nota: e.target.value })} />
            <label style={{ ...S.btn2, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
              <T>📷 Foto</T><T>{h.fotos.length ? " (" + h.fotos.length + ")" : ""}</T>
              <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
                onChange={(e) => { subirFoto(h.clave, e.target.files && e.target.files[0]); e.target.value = "" }} />
            </label>
            {h.fotos.filter((ft) => ft.url).map((ft) => (
              <a key={ft.clave} href={ft.url} target="_blank" rel="noreferrer">
                <img src={ft.url} alt={ft.nombre} style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid #E7E4DC" }} />
              </a>
            ))}
          </div>
        </div>
      ))}
      {msg && <p style={{ margin: "6px 0 0", fontSize: 12, color: msg.ok ? "#1E7B3A" : "#B3261E" }}><T>{msg.t}</T></p>}
    </div>
  )
}

function Pedido({ sol, alGuardar }) {
  const [modo, setModo] = useState(null) // "avance" | "entregada"
  const [f, setF] = useState({ nota: "", paqueteria: "", guia: "" })
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  if (!sol.pagada) {
    return (
      <p style={{ marginTop: 10, fontSize: 13, color: "#B34D07", background: "#FFF1E6", borderRadius: 8, padding: "8px 12px" }}>
        <T>Esperando el pago del cliente. No empieces a fabricar hasta que te avisemos que pagó.</T>
      </p>
    )
  }
  const yaEntregada = sol.etapa === "entregada" || sol.etapa === "cerrada"
  const precio = Number(sol.mi_propuesta?.precio || 0)
  const pagado = Number(sol.cobro?.pagado || 0)
  const falta = Math.max(0, Math.round((precio - pagado) * 100) / 100)

  const enviar = async () => {
    setEnviando(true)
    setMsg(null)
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/avance`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: modo, ...f }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setModo(null)
      setF({ nota: "", paqueteria: "", guia: "" })
      alGuardar()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ marginTop: 12, background: "#FAF9F6", border: "1px solid #E7E4DC", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={S.tag("#E6F4EA", "#1E7B3A")}><T>{sol.etapa_nombre || "En producción"}</T></span>
        {sol.envio?.guia && <span style={{ fontSize: 13 }}><T>Guía</T> <T>{sol.envio.paqueteria}</T> <strong><T>{sol.envio.guia}</T></strong></span>}
        {sol.etapa === "entregada" && <span style={{ fontSize: 13, color: "#6B675C" }}><T>Esperando que el cliente confirme que lo recibió.</T></span>}
      </div>
      {sol.cobro && (
        <p style={{ fontSize: 13, color: "#40403A", margin: "8px 0 0" }}>
          <T>{sol.cobro.modo === "taller"
            ? `Cobro directo a tu cuenta · pagado ${pesos(pagado)} de ${pesos(precio)}${falta > 0 ? ` · falta ${pesos(falta)}: el cliente lo paga desde su liga; avísale con un avance cuando esté listo.` : " · liquidado."}`
            : `Cobra HETNA · pagado ${pesos(pagado)}. Te transferimos el pago completo al confirmar la entrega.`}</T>
        </p>
      )}
      <Hitos sol={sol} />
      {!modo && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" style={S.btn2} onClick={() => setModo("avance")}><T>Contar un avance al cliente</T></button>
          {!yaEntregada && (
            <button type="button" style={S.btn} onClick={() => setModo("entregada")}><T>Marcar como entregado / enviado</T></button>
          )}
        </div>
      )}
      {modo && (
        <div style={{ marginTop: 10 }}>
          {modo === "entregada" && (
            <div style={S.grid}>
              <div>
                <label style={S.label}><T>Paquetería</T></label>
                <input style={S.input} value={f.paqueteria} onChange={(e) => set("paqueteria", e.target.value)} placeholder={traducir("Estafeta, DHL, entrega en persona…")} />
              </div>
              <div>
                <label style={S.label}><T>Número de guía</T></label>
                <input style={S.input} value={f.guia} onChange={(e) => set("guia", e.target.value)} />
              </div>
            </div>
          )}
          <label style={{ ...S.label, marginTop: 10 }}><T>{modo === "avance" ? "¿Qué avance le cuentas?" : "Nota para el cliente (opcional)"}</T></label>
          <textarea style={S.area} value={f.nota} onChange={(e) => set("nota", e.target.value)}
            placeholder={modo === "avance" ? "Ej. Ya cortamos las piezas; mañana pintamos." : "Ej. Va en 2 cajas."} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" style={{ ...S.btn, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={enviar}>
              <T>{enviando ? "Enviando..." : modo === "avance" ? "Enviar avance" : "Confirmar entrega"}</T>
            </button>
            <button type="button" style={{ ...S.btn2, border: 0 }} onClick={() => setModo(null)}><T>Cancelar</T></button>
            {msg && <span style={{ fontSize: 14, color: "#B3261E" }}><T>{msg}</T></span>}
          </div>
        </div>
      )}
    </div>
  )
}

// Preguntas al cliente antes de proponer. Las respuestas las ven todos los
// talleres; aquí salen las ya contestadas y las mías pendientes.
function Preguntas({ sol, alGuardar }) {
  const [texto, setTexto] = useState("")
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const lista = sol.preguntas || []
  const mias = lista.filter((q) => q.mia).length
  const puede = sol.estado === "abierta" && mias < 3

  const enviar = async () => {
    setEnviando(true)
    setMsg(null)
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/pregunta`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setTexto("")
      setAbierto(false)
      setMsg({ ok: true, t: "Pregunta enviada. Te avisamos por correo cuando el cliente conteste." })
      alGuardar()
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setEnviando(false)
    }
  }

  if (!lista.length && !puede) return null
  return (
    <div style={{ marginTop: 10, fontSize: 13 }}>
      {lista.length > 0 && (
        <div style={{ background: "#FAF9F6", border: "1px solid #E7E4DC", borderRadius: 8, padding: "8px 12px", display: "grid", gap: 6 }}>
          {lista.map((q) => (
            <div key={q.id}>
              <div><span style={{ color: "#6B675C" }}><T>{q.mia ? "Tú preguntaste:" : "Otro taller preguntó:"}</T></span> <T>{q.pregunta}</T></div>
              <div style={{ color: q.respuesta ? "#1E7B3A" : "#9B978C" }}>
                <strong><T>Cliente:</T></strong> <T>{q.respuesta || "todavía no contesta"}</T>
              </div>
            </div>
          ))}
        </div>
      )}
      {puede && !abierto && (
        <button type="button" style={{ ...S.btn2, border: 0, padding: "6px 0", color: "#C2560A" }} onClick={() => setAbierto(true)}>
          <T>¿Te falta un dato? Pregúntale al cliente</T>
        </button>
      )}
      {abierto && (
        <div style={{ marginTop: 6 }}>
          <textarea style={S.area} maxLength={600} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={traducir("Ej. ¿Qué espesor de acrílico? ¿Las piezas llevan barreno?")} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <button type="button" style={{ ...S.btn, background: "#142033", opacity: enviando || texto.trim().length < 8 ? 0.6 : 1 }} disabled={enviando || texto.trim().length < 8} onClick={enviar}>
              <T>{enviando ? "Enviando..." : "Enviar pregunta"}</T>
            </button>
            <button type="button" style={{ ...S.btn2, border: 0 }} onClick={() => setAbierto(false)}><T>Cancelar</T></button>
            <span style={{ color: "#6B675C", fontSize: 12 }}><T>La respuesta la verán todos los talleres. Hasta 3 preguntas.</T></span>
          </div>
        </div>
      )}
      {msg && <div style={{ marginTop: 6, color: msg.ok ? "#1E7B3A" : "#B3261E" }}><T>{msg.t}</T></div>}
    </div>
  )
}

// Contraofertas del cliente a mi propuesta: aceptar (mi propuesta toma su precio y
// días como versión nueva) o rechazar con una nota. También puedo corregir mi propuesta.
const ESTADO_CONTRA = {
  pendiente: ["Esperando tu respuesta", "#C2560A"],
  aceptada: ["Aceptada: tu propuesta se actualizó", "#1E7B3A"],
  rechazada: ["Rechazada", "#B3261E"],
  respondida: ["Respondida con tu propuesta corregida", "#1F5FBF"],
}
const pesosMx = (n) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 })
const queRide = (c) => [c.precio != null ? pesosMx(c.precio) : null, c.dias != null ? c.dias + " días" : null].filter(Boolean).join(" y ")
function Contraofertas({ sol, alResponder }) {
  const [enviando, setEnviando] = useState(null)
  const [msg, setMsg] = useState(null)
  const responder = async (c, accion) => {
    let nota = ""
    if (accion === "rechazar") {
      const r = window.prompt("¿Por qué no puedes? El cliente verá esta nota (opcional)", "")
      if (r === null) return
      nota = r
    } else if (!window.confirm("Tu propuesta quedará en " + queRide(c) + ". ¿Aceptar?")) return
    setEnviando(c.id)
    setMsg(null)
    try {
      const r = await fetch("/vendor/hetna-solicitudes/" + sol.id + "/contraoferta", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contraoferta_id: c.id, accion, nota }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setMsg({ ok: true, t: accion === "aceptar" ? "Aceptada. Tu propuesta se actualizó y le avisamos al cliente." : "Le avisamos al cliente." })
      alResponder()
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setEnviando(null)
    }
  }
  return (
    <div style={{ margin: "10px 0", border: "1px solid #F3D9C4", background: "#FFF8F2", borderRadius: 10, padding: "8px 12px" }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#142033" }}><T>Contraofertas del cliente</T></p>
      {sol.mi_propuesta.contraofertas.map((c) => (
        <div key={c.id} style={{ marginTop: 6, fontSize: 13, color: "#40403A" }}>
          <span>
            <T>Pide:</T> <T>{queRide(c) || "—"}</T>
            <T>{c.mensaje ? " · “" + c.mensaje + "”" : ""}</T>
          </span>
          <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: (ESTADO_CONTRA[c.estado] || [])[1] }}>{(ESTADO_CONTRA[c.estado] || [c.estado])[0]}</span>
          {c.nota_taller && <span style={{ display: "block", fontSize: 12, fontStyle: "italic", color: "#6B675C" }}><T>Tu nota: “</T><T>{c.nota_taller}</T>”</span>}
          {c.estado === "pendiente" && sol.estado === "abierta" && (
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              {(c.precio != null || c.dias != null) && (
                <button type="button" style={{ ...S.btn, padding: "6px 14px", fontSize: 13 }} disabled={enviando === c.id} onClick={() => responder(c, "aceptar")}><T>Aceptar</T></button>
              )}
              <button type="button" style={S.btn2} disabled={enviando === c.id} onClick={() => responder(c, "rechazar")}><T>Rechazar</T></button>
              <span style={{ fontSize: 12, color: "#6B675C", alignSelf: "center" }}><T>o corrige tu propuesta</T></span>
            </div>
          )}
        </div>
      ))}
      {msg && <p style={{ margin: "6px 0 0", fontSize: 12, color: msg.ok ? "#1E7B3A" : "#B3261E" }}><T>{msg.t}</T></p>}
    </div>
  )
}

// Responder rápido: lo que casi siempre es igual en las propuestas de un taller
// (garantía, condiciones de pago, vigencia, envío, anticipo) se recuerda de su
// última propuesta en este navegador y se pone solo en la siguiente.
const CLAVE_BASE = "hetna-propuesta-base"
function leerBase() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_BASE) || "null") || null
  } catch {
    return null
  }
}
function guardarBase(f) {
  try {
    const { condiciones_pago, garantia, vigencia_dias, incluye_envio, anticipo_pct, moneda } = f
    localStorage.setItem(CLAVE_BASE, JSON.stringify({ condiciones_pago, garantia, vigencia_dias, incluye_envio, anticipo_pct, moneda }))
  } catch {
    /* sin localStorage: nada */
  }
}
// Fecha de entrega a partir de los días de fabricación (hábiles: sin sábado ni domingo)
function fechaDesdeDias(dias) {
  const n = Math.round(Number(dias))
  if (!(n >= 1 && n <= 365)) return ""
  const d = new Date()
  let quedan = n
  while (quedan > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) quedan--
  }
  return d.toISOString().slice(0, 10)
}

function FormPropuesta({ sol, alGuardar, cobroTaller }) {
  const p = sol.mi_propuesta
  const base = p ? null : leerBase()
  const materialPedido = sol.trabajo?.material ? `${sol.trabajo.material} (el que pidió el cliente)` : ""
  const [f, setF] = useState({
    precio: p?.precio ?? "", dias: p?.dias ?? "", vigencia_dias: p?.vigencia_dias ?? base?.vigencia_dias ?? 15,
    incluye_envio: p?.incluye_envio ?? base?.incluye_envio ?? false, condiciones: p?.condiciones ?? "",
    anticipo_pct: p?.anticipo_pct ?? base?.anticipo_pct ?? 50,
    // Licitaciones 3.0 (Fase 2): propuesta formal
    moneda: p?.moneda ?? base?.moneda ?? "MXN", materiales: p?.materiales ?? materialPedido, operaciones: p?.operaciones ?? "",
    fecha_entrega: p?.fecha_entrega ?? "", condiciones_pago: p?.condiciones_pago ?? base?.condiciones_pago ?? "", garantia: p?.garantia ?? base?.garantia ?? "",
    observaciones: p?.observaciones ?? "",
    motivo_cambio: "",
  })
  const [adjuntos, setAdjuntos] = useState(p?.adjuntos || [])
  const [subiendo, setSubiendo] = useState(false)
  const subir = async (archivo) => {
    if (!archivo) return
    setSubiendo(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append("archivo", archivo)
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/adjunto`, { method: "POST", credentials: "include", body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setAdjuntos(d.adjuntos || [])
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setSubiendo(false)
    }
  }
  const quitar = async (clave) => {
    const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/adjunto`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok) setAdjuntos(d.adjuntos || [])
  }
  const directo = cobroTaller && (cobroTaller.mercadopago || cobroTaller.paypal)
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  // Al escribir los días, la fecha de entrega se calcula sola (si no la cambió a mano)
  const [fechaAMano, setFechaAMano] = useState(Boolean(p?.fecha_entrega))
  const setDias = (v) => setF((x) => ({ ...x, dias: v, ...(fechaAMano ? {} : { fecha_entrega: fechaDesdeDias(v) }) }))

  const enviar = async () => {
    setEnviando(true)
    setMsg(null)
    try {
      const r = await fetch(`/vendor/hetna-solicitudes/${sol.id}/propuesta`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Sin cuenta conectada cobra HETNA el 100 %: no se ofrece anticipo
        body: JSON.stringify({ ...f, anticipo_pct: directo ? f.anticipo_pct : 100 }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      guardarBase(f)
      setMsg({ ok: true, t: d.actualizada ? "Propuesta actualizada." : "Propuesta enviada. Le avisamos al cliente." })
      alGuardar()
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #E7E4DC", paddingTop: 14 }}>
      {base && (base.garantia || base.condiciones_pago) && (
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#17633A", background: "#EEF7F0", padding: "8px 10px", borderRadius: 8 }}>
          <T>Pusimos tu garantía y condiciones de pago de tu última propuesta. Sólo escribe precio y días; revisa lo demás.</T>
        </p>
      )}
      {p && (
        <div style={{ marginBottom: 10 }}>
          <label style={S.label}><T>Motivo del cambio (lo ve el cliente en el historial · versión</T> {p.version || 1} → {(p.version || 1) + 1})</label>
          <input style={S.input} value={f.motivo_cambio} onChange={(e) => set("motivo_cambio", e.target.value)} maxLength={500}
            placeholder={traducir("Ej: ajusté el precio por cantidad / cambié el material")} />
        </div>
      )}
      <div style={S.grid}>
        <div>
          <label style={S.label}><T>Precio total (</T><T>{f.moneda}</T><T>, con IVA) *</T></label>
          <input style={S.input} inputMode="decimal" value={f.precio} onChange={(e) => set("precio", e.target.value)} placeholder="3500" />
        </div>
        <div>
          <label style={S.label}><T>Moneda</T></label>
          <select style={S.input} value={f.moneda} onChange={(e) => set("moneda", e.target.value)}>
            <option value="MXN">Pesos (MXN)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        <div>
          <label style={S.label}><T>Días de fabricación *</T></label>
          <input style={S.input} type="number" min="1" value={f.dias} onChange={(e) => setDias(e.target.value)} placeholder="5" />
        </div>
        <div>
          <label style={S.label}><T>Fecha estimada de entrega *</T></label>
          <input style={S.input} type="date" min={new Date().toISOString().slice(0, 10)} value={f.fecha_entrega} onChange={(e) => { setFechaAMano(true); set("fecha_entrega", e.target.value) }} />
        </div>
        <div>
          <label style={S.label}><T>Vigencia (días) *</T></label>
          <input style={S.input} type="number" min="1" value={f.vigencia_dias} onChange={(e) => set("vigencia_dias", e.target.value)} />
        </div>
        <div>
          <label style={S.label}><T>Anticipo para empezar</T></label>
          <select style={S.input} value={f.anticipo_pct} onChange={(e) => set("anticipo_pct", Number(e.target.value))} disabled={!directo}>
            <option value={100}>Pago completo al elegir</option>
            <option value={70}>70% y el resto antes de entregar</option>
            <option value={50}>50% y el resto antes de entregar</option>
            <option value={30}>30% y el resto antes de entregar</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "end" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={f.incluye_envio} onChange={(e) => set("incluye_envio", e.target.checked)} />
            <T>El precio incluye envío</T>
          </label>
        </div>
      </div>
      <p style={{ color: "#6B675C", fontSize: 12, margin: "6px 0 0" }}>
        <T>{directo
          ? `Si ganas, el cliente te paga directo a tu ${cobroTaller.mercadopago ? "Mercado Pago" : "PayPal"}. HETNA no cobra comisión.`
          : `Sin Mercado Pago ni PayPal conectados, el cliente paga el 100% a HETNA y te lo transferimos completo al confirmar la entrega. Conéctalos en la app para pedir anticipo y cobrar directo.`}</T>
      </p>
      <p style={{ margin: "14px 0 4px", fontSize: 13, fontWeight: 700, color: "#142033" }}>
        <T>Propuesta formal</T> <span style={{ fontWeight: 400, color: "#6B675C" }}><T>— los campos con * son obligatorios para que el cliente compare todas las propuestas con los mismos datos</T></span>
      </p>
      <div style={S.grid}>
        <div>
          <label style={S.label}><T>Material y especificaciones *</T></label>
          <textarea style={S.area} value={f.materiales} onChange={(e) => set("materiales", e.target.value)} placeholder={traducir("Ej. Acero A36 cal. 14, pintura electrostática negra")} />
        </div>
        <div>
          <label style={S.label}><T>Operaciones / procesos</T></label>
          <textarea style={S.area} value={f.operaciones} onChange={(e) => set("operaciones", e.target.value)} placeholder={traducir("Ej. Corte plasma, doblez, soldadura MIG, pintura")} />
        </div>
        <div>
          <label style={S.label}><T>Condiciones de pago *</T></label>
          <textarea style={S.area} value={f.condiciones_pago} onChange={(e) => set("condiciones_pago", e.target.value)} placeholder={traducir("Ej. 50% para empezar y 50% contra entrega; factura CFDI")} />
        </div>
        <div>
          <label style={S.label}><T>Garantía *</T></label>
          <textarea style={S.area} value={f.garantia} onChange={(e) => set("garantia", e.target.value)} placeholder={traducir("Ej. Reposición sin costo por defecto de fabricación en 30 días")} />
        </div>
      </div>
      <label style={{ ...S.label, marginTop: 10 }}><T>Observaciones técnicas</T></label>
      <textarea style={S.area} value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} placeholder={traducir("Ej. Tolerancia ±0.2 mm; recomendamos radio de 1 mm en esquinas")} />
      <label style={{ ...S.label, marginTop: 10 }}><T>Condiciones (material incluido, acabado, tolerancias…)</T></label>
      <textarea style={S.area} value={f.condiciones} onChange={(e) => set("condiciones", e.target.value)} placeholder={traducir("Ej. Incluye material MDF 6 mm y lijado.")} />
      <div style={{ marginTop: 10, fontSize: 13 }}>
        <strong><T>Archivos adjuntos</T></strong> <span style={{ color: "#6B675C" }}><T>(tu cotización en PDF, planos o fotos de trabajos parecidos; máx. 5)</T></span>
        {!p && <div style={{ color: "#6B675C", marginTop: 4 }}><T>Primero envía tu propuesta; después podrás adjuntar archivos.</T></div>}
        {p && (
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {adjuntos.map((a) => (
              <span key={a.clave} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                📎 <T>{a.nombre}</T>
                <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => quitar(a.clave)}><T>Quitar</T></button>
              </span>
            ))}
            {adjuntos.length < 5 && (
              <label style={{ ...S.btn2, padding: "4px 10px", fontSize: 12, display: "inline-block", width: "fit-content", cursor: "pointer" }}>
                <T>{subiendo ? "Subiendo..." : "+ Adjuntar archivo"}</T>
                <input type="file" hidden disabled={subiendo} accept=".pdf,.dxf,.dwg,.step,.stp,.stl,.svg,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.doc,.docx" onChange={(e) => { subir(e.target.files?.[0]); e.target.value = "" }} />
              </label>
            )}
          </div>
        )}
      </div>
      <p style={{ color: "#6B675C", fontSize: 12, margin: "4px 0 10px" }}>
        <T>No escribas teléfonos, correos ni ligas: se ocultan automáticamente. Todo el trato va por HETNA.</T>
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={{ ...S.btn, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={enviar}>
          <T>{enviando ? "Enviando..." : p ? "Actualizar propuesta" : "Enviar propuesta"}</T>
        </button>
        {msg && <span style={{ fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}><T>{msg.t}</T></span>}
      </div>
    </div>
  )
}

function Cupo({ cupo }) {
  const sinLimite = cupo.limite === null || cupo.limite === undefined
  const agotado = !sinLimite && cupo.quedan === 0
  const pocas = !sinLimite && !agotado && cupo.quedan <= 1
  const color = agotado ? "#B3261E" : pocas ? "#B54708" : "#1E7B3A"
  const fondo = agotado ? "#FEF3F2" : pocas ? "#FFFAEB" : "#F0F7F1"
  return (
    <div style={{ ...S.card, background: fondo, borderColor: color + "55", marginBottom: 14, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontWeight: 700, color }}>
            <T>{sinLimite
              ? `Plan ${cupo.nombre}: propuestas sin límite`
              : agotado
                ? `Plan ${cupo.nombre}: ya usaste tus ${cupo.limite} propuesta${cupo.limite === 1 ? "" : "s"} de este mes`
                : `Plan ${cupo.nombre}: te ${cupo.quedan === 1 ? "queda" : "quedan"} ${cupo.quedan} de ${cupo.limite} propuesta${cupo.limite === 1 ? "" : "s"} este mes`}</T>
          </div>
          <div style={{ fontSize: 13, color: "#6B675C", marginTop: 2 }}>
            <T>{sinLimite
              ? "Cotiza todas las solicitudes que quieras."
              : "El cupo se renueva el día 1. Corregir una propuesta ya enviada y las solicitudes que te mandan directo a ti no cuentan."}</T>
          </div>
          {!sinLimite && (
            <div style={{ height: 6, background: "#E7E4DC", borderRadius: 3, marginTop: 8, overflow: "hidden", maxWidth: 320 }}>
              <div style={{ width: `${Math.min(100, (cupo.usadas / cupo.limite) * 100)}%`, height: "100%", background: color }} />
            </div>
          )}
        </div>
        {!sinLimite && (
          <div style={{ fontSize: 13, color: "#3D3A33", flex: "1 1 220px" }}>
            <T>{cupo.plan === "gratis" ? "Con el plan Taller mandas 5 al mes y con Pro, sin límite." : "Con el plan Pro mandas propuestas sin límite."}</T><T>{" "}</T>
            <T>Cámbialo en la app HETNA CNC para talleres, en</T> <b><T>Mi plan</T></b>.
          </div>
        )}
      </div>
    </div>
  )
}

// Fase 4: de qué clientes recibe solicitudes este taller (según su reputación)
function FiltroClientes({ filtro, alCambiar }) {
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState(filtro || { minimo: 0, nuevos: true })
  const [nota, setNota] = useState("")
  useEffect(() => { if (filtro) setF(filtro) }, [filtro?.minimo, filtro?.nuevos])
  const guardar = async () => {
    setNota("")
    const r = await fetch("/vendor/hetna-filtro-clientes", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minimo: f.minimo, nuevos: f.nuevos }) })
    if (!r.ok) return setNota("No se pudo guardar.")
    setNota("Guardado.")
    setAbierto(false)
    alCambiar?.()
  }
  const texto = !f.minimo ? "Recibes solicitudes de todos los clientes." : `Sólo clientes con ★ ${f.minimo} o más${f.nuevos ? " y clientes nuevos" : ""}.`
  return (
    <div style={{ ...S.card, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span>👥 <T>{texto}</T><T>{filtro?.ocultas ? ` (${filtro.ocultas} oculta${filtro.ocultas === 1 ? "" : "s"} por tu filtro)` : ""}</T></span>
        <button type="button" style={{ ...S.btn2, padding: "4px 10px", fontSize: 12 }} onClick={() => setAbierto(!abierto)}><T>{abierto ? "Cerrar" : "Elegir clientes"}</T></button>
      </div>
      {abierto && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <span style={{ color: "#6B675C" }}><T>Los talleres evalúan a cada cliente al terminar un trabajo. Si eliges un mínimo, no te llegarán solicitudes de clientes por debajo de él. Lo que te piden directo a ti y las invitaciones te llegan siempre.</T></span>
          <label><T>Recibir solicitudes de</T><T>{" "}</T>
            <select style={{ ...S.input, width: "auto", height: 32 }} value={f.minimo} onChange={(e) => setF({ ...f, minimo: Number(e.target.value) })}>
              <option value={0}>todos los clientes</option>
              <option value={4}>clientes con ★ 4 o más</option>
              <option value={4.5}>clientes con ★ 4.5 o más</option>
            </select>
          </label>
          {f.minimo > 0 && (
            <label><input type="checkbox" checked={f.nuevos} onChange={(e) => setF({ ...f, nuevos: e.target.checked })} /> <T>También clientes nuevos (todavía sin evaluaciones)</T></label>
          )}
          <button type="button" style={{ ...S.btn, justifySelf: "start" }} onClick={guardar}><T>Guardar</T></button>
        </div>
      )}
      {nota && <span style={{ color: "#1E7B3A" }}><T>{nota}</T></span>}
    </div>
  )
}

export default function SolicitudesPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [vista, setVista] = useState("nuevas")
  const [abierta, setAbierta] = useState(null)
  const [noPuedo, setNoPuedo] = useState(null)
  const [fServicio, setFServicio] = useState("")
  const [fEstado, setFEstado] = useState("")
  // Cupo del mes según el plan (packages/api/src/lib/licitacion-plan.ts). null = sin dato.
  const [cupo, setCupo] = useState(null)
  // Cómo cobra si gana: cuenta conectada en la app y comisión de su plan
  const [cobroTaller, setCobroTaller] = useState(null)
  const [filtroCli, setFiltroCli] = useState(null)

  // Desde el aviso del celular o del WhatsApp (?cotizar=<solicitud>): abre
  // directo el formulario, una sola vez (se quita de la dirección)
  const abrirDesdeAviso = (lista) => {
    try {
      const u = new URL(window.location.href)
      const id = u.searchParams.get("cotizar")
      if (!id) return
      if (lista.some((s) => s.id === id && s.estado === "abierta")) setAbierta(id)
      u.searchParams.delete("cotizar")
      window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash)
    } catch {
      /* nada */
    }
  }

  const cargar = () =>
    // ocultas=1: también las que el taller marcó como "no puedo"; se separan aquí.
    fetch("/vendor/hetna-solicitudes?ocultas=1", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setDatos(d.solicitudes || [])
        abrirDesdeAviso(d.solicitudes || [])
        setCupo(d.cupo || null)
        setCobroTaller(d.cobro_taller || null)
        setFiltroCli(d.filtro_clientes || null)
      })
      .catch((e) => setError("No se pudieron cargar las solicitudes (" + e + ")."))

  useEffect(() => {
    cargar()
  }, [])

  if (error) return <div style={S.page}><T>{error}</T></div>
  if (!datos) return <div style={S.page}><T>Cargando...</T></div>

  // Las opciones salen de las solicitudes mismas: sólo se ofrece filtrar por
  // lo que de verdad hay, y no hay otra lista de servicios que mantener.
  const opciones = (campo) =>
    [...new Set(datos.map((s) => (s.trabajo || {})[campo]).filter(Boolean))].sort()
  const pasaFiltros = (s) =>
    (!fServicio || s.trabajo?.servicio === fServicio) && (!fEstado || s.trabajo?.estado_mx === fEstado)

  // "Necesito más información" no la descarta: sigue por cotizar.
  const descartada = (s) => s.mi_respuesta && s.mi_respuesta.motivo !== "mas_info"
  const nuevas = datos.filter((s) => s.estado === "abierta" && !s.mi_propuesta && !descartada(s) && pasaFiltros(s))
  const enviadas = datos.filter((s) => s.mi_propuesta)
  const descartadas = datos.filter((s) => !s.mi_propuesta && descartada(s))
  const lista = vista === "nuevas" ? nuevas : vista === "enviadas" ? enviadas : descartadas
  const ganadas = enviadas.filter((s) => s.mi_propuesta?.estado === "elegida").length
  const urgentes = nuevas.filter((s) => s.cierra_en && (new Date(s.cierra_en).getTime() - Date.now()) / 3600000 < 24).length
  const solAbierta = abierta ? datos.find((s) => s.id === abierta) : null

  const deshacer = async (s) => {
    await fetch(`/vendor/hetna-solicitudes/${s.id}/respuesta`, { method: "DELETE", credentials: "include" }).catch(() => {})
    cargar()
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}><T>Bolsa de proyectos</T></h1>
      <p style={S.sub}>
        <T>Clientes que buscan taller. Manda tu precio y tiempo; el cliente compara y elige. Los talleres con membresía aparecen primero.</T>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
        {[
          ["Por cotizar", nuevas.length, urgentes ? `${urgentes} cierra${urgentes === 1 ? "" : "n"} en menos de 24 h` : "abiertas para ti", urgentes ? "#B3261E" : "#6B675C"],
          ["Mis propuestas", enviadas.filter((s) => s.mi_propuesta?.estado !== "elegida" && s.mi_propuesta?.estado !== "descartada").length, "esperando al cliente", "#6B675C"],
          ["Ganadas", ganadas, ganadas ? "¡a producir!" : "todavía ninguna", ganadas ? "#1E7B3A" : "#6B675C"],
        ].map(([t, n, pie, color]) => (
          <div key={t} style={{ ...S.card, marginBottom: 0, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#55544D", fontWeight: 600 }}><T>{t}</T></p>
            <p style={{ margin: "6px 0 2px", fontSize: 28, fontWeight: 800, color: "#142033" }}>{n}</p>
            <p style={{ margin: 0, fontSize: 12, color }}><T>{pie}</T></p>
          </div>
        ))}
      </div>

      {cupo && <Cupo cupo={cupo} />}

      <FiltroClientes filtro={filtroCli} alCambiar={cargar} />

      {cobroTaller && (
        <div style={{ ...S.card, padding: "10px 14px", fontSize: 13, background: cobroTaller.mercadopago || cobroTaller.paypal ? "#F0F7F1" : "#FFFAEB" }}>
          {cobroTaller.mercadopago || cobroTaller.paypal ? (
            <>
              <T>✓ Cobras directo a tu</T> <T>{[cobroTaller.mercadopago && "Mercado Pago", cobroTaller.paypal && "PayPal"].filter(Boolean).join(" y ")}</T><T>. Puedes pedir anticipo.</T>
              <strong><T>Sin comisión de HETNA</T></strong><T>: el pago es completo para ti.</T>
            </>
          ) : (
            <>
              <T>Conecta tu</T> <strong><T>Mercado Pago o PayPal</T></strong> <T>en la app HETNA CNC para talleres (Configuración → Cobros en línea) y cobra directo,
              con anticipo. Mientras, el cliente paga a HETNA y te transferimos el pago completo al entregar.</T> <strong><T>Sin comisión.</T></strong>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" style={S.tab(vista === "nuevas")} onClick={() => setVista("nuevas")}><T>Por cotizar (</T><T>{nuevas.length}</T>)</button>
        <button type="button" style={S.tab(vista === "enviadas")} onClick={() => setVista("enviadas")}><T>Mis propuestas (</T><T>{enviadas.length}</T>)</button>
        {descartadas.length > 0 && (
          <button type="button" style={S.tab(vista === "descartadas")} onClick={() => setVista("descartadas")}><T>No puedo (</T><T>{descartadas.length}</T>)</button>
        )}
      </div>

      {vista === "nuevas" && (opciones("servicio").length > 1 || opciones("estado_mx").length > 1) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <select style={{ ...S.input, width: "auto", minWidth: 180 }} value={fServicio} onChange={(e) => setFServicio(e.target.value)}>
            <option value="">Todos los servicios</option>
            {opciones("servicio").map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select style={{ ...S.input, width: "auto", minWidth: 180 }} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {opciones("estado_mx").map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      {!lista.length && (
        <div style={{ ...S.card, textAlign: "center", color: "#6B675C" }}>
          <T>{vista === "nuevas"
            ? "Por ahora no hay solicitudes nuevas. Te avisamos por correo cuando llegue una."
            : vista === "enviadas"
              ? "Aún no has enviado propuestas."
              : "No has descartado solicitudes."}</T>
        </div>
      )}

      {lista.map((s) => {
        const t = s.trabajo || {}
        const p = s.mi_propuesta
        return (
          <div key={s.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong><T>{s.folio}</T></strong>
                <RepCliente rep={s.reputacion_cliente} />
                {s.para_mi && <span style={S.tag("#FFF1E6", "#C2560A")}><T>Te eligieron a ti</T></span>}
                {s.modalidad === "privada" && !s.para_mi && <span style={S.tag("#EEF2FB", "#1a3a5c")}><T>Privada · te invitaron</T></span>}
                {s.modalidad === "restringida" && <span style={S.tag("#FFF8E6", "#8A5A00")}><T>Restringida</T></span>}
                {s.tipo === "suministro" && <span style={S.tag("#EEF6F0", "#1E7B3A")}><T>📦 Suministro</T></span>}
                {p?.estado === "elegida" && <span style={S.tag("#E6F4EA", "#1E7B3A")}><T>¡Ganaste!</T></span>}
                {p?.version > 1 && <span style={S.tag("#EAF1FB", "#1F5FBF")}><T>Versión</T> <T>{p.version}</T></span>}
                {p?.contraofertas?.some((c) => c.estado === "pendiente") && <span style={S.tag("#FFF1E6", "#C2560A")}><T>Contraoferta pendiente</T></span>}
                {p?.estado === "descartada" && <span style={S.tag("#F3F1EA", "#6B675C")}><T>No elegida</T></span>}
                <span style={{ color: "#6B675C", fontSize: 12 }}>
                  <T>{s.propuestas_recibidas}</T> <T>{s.propuestas_recibidas === 1 ? "propuesta" : "propuestas"}</T>
                </span>
                {s.estado === "abierta" && <Plazo cierra={s.cierra_en} />}
              </div>
              {[t.ciudad, t.estado_mx].filter(Boolean).length > 0 && (
                <span style={{ color: "#6B675C", fontSize: 13 }}>📍 <T>{[t.ciudad, t.estado_mx].filter(Boolean).join(", ")}</T></span>
              )}
            </div>

            {p?.contraofertas?.length > 0 && <Contraofertas sol={s} alResponder={cargar} />}
            {t.cliente && t.cliente !== "Cliente HETNA" && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#40403A" }}>👤 <T>{t.cliente}</T></p>}
            <AcuerdoNda sol={s} alAceptar={cargar} />
            {t.descripcion_restringida && t.nda_requerido && !t.nda_aceptado ? null : t.descripcion_restringida ? (
              <div style={{ margin: "10px 0", background: "#F3F1EA", borderRadius: 8, padding: "8px 12px", fontSize: 13, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span><T>🔒 El cliente reservó la descripción completa para los talleres que autorice.</T></span>
                <PedirAcceso sol={s} />
              </div>
            ) : (
              <p style={{ whiteSpace: "pre-line", margin: "10px 0", color: "#40403A" }}><T>{t.descripcion}</T></p>
            )}
            {t.presupuesto_confidencial && <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6B675C" }}><T>Presupuesto: confidencial</T></p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 13 }}>
              {CAMPOS.filter(([k]) => t[k]).map(([k, l]) => (
                <span key={k}><span style={{ color: "#6B675C" }}><T>{l}</T>:</span> <strong>{t[k]}</strong></span>
              ))}
              {/^https?:\/\//i.test(String(t.archivo || "")) && (
                <a href={t.archivo} target="_blank" rel="noopener noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}><T>Ver archivos</T></a>
              )}
            </div>

            <ArchivosCliente sol={s} />

            {s.mi_respuesta && (
              <p style={{ marginTop: 10, fontSize: 13, color: "#6B675C" }}>
                <T>Respondiste:</T> <strong style={{ color: "#142033" }}><T>{s.mi_respuesta.texto}</T></strong>
                <T>{s.mi_respuesta.nota ? ` — ${s.mi_respuesta.nota}` : ""}</T>
                {descartada(s) && (
                  <button type="button" style={{ ...S.btn2, border: 0, padding: "0 8px", fontSize: 12, color: "#C2560A" }} onClick={() => deshacer(s)}>
                    <T>Deshacer</T>
                  </button>
                )}
              </p>
            )}

            {p && (
              <p style={{ marginTop: 10, fontSize: 14 }}>
                <T>Tu propuesta:</T> <strong>{pesos(p.precio)}</strong> · <T>{p.dias}</T> <T>días</T> <T>{p.incluye_envio ? "· envío incluido" : ""}</T>
                <T>{p.anticipo_pct && p.anticipo_pct < 100 ? ` · anticipo ${p.anticipo_pct}%` : ""}</T>
              </p>
            )}

            {p?.estado === "descartada" && s.eleccion && (
              <p style={{ marginTop: 8, fontSize: 13, color: "#40403A", background: "#F3F1EA", borderRadius: 8, padding: "8px 12px" }}>
                <T>El cliente eligió un precio entre</T> <strong>{pesos(s.eleccion.desde)}</strong> y <strong>{pesos(s.eleccion.hasta)}</strong> <T>con entrega en</T><T>{" "}</T>
                <strong><T>{s.eleccion.dias}</T> <T>días</T></strong>.<T>{" "}</T>
                <T>{p.precio > s.eleccion.hasta
                  ? "Tu precio quedó arriba."
                  : p.precio < s.eleccion.desde
                    ? "Tu precio quedó abajo: pesó más otra cosa (tiempo, calificación o condiciones)."
                    : "Tu precio estuvo muy cerca."}</T>
              </p>
            )}

            {p?.estado === "elegida" && <BotonExpediente sol={s} />}
            {p?.estado === "elegida" && <Pedido sol={s} alGuardar={cargar} />}
            {p?.estado === "elegida" && <Conversacion sol={s} />}
            {p?.estado === "elegida" && <AcuerdoSafeDeal sol={s} />}
            {p?.estado === "elegida" && <EvaluarCliente sol={s} />}
            {p?.estado === "elegida" && ["entregada", "cerrada"].includes(s.etapa) && (
              <a
                href={`${window.location.pathname.replace(/\/solicitudes.*$/, "")}/promocion?solicitud=${s.id}`}
                style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 600, color: "#C2560A" }}
              >
                <T>📹 Sube un video de este trabajo y lo publicamos en las redes de HETNA con tu nombre</T>
              </a>
            )}

            {s.estado === "abierta" && !descartada(s) && <Preguntas sol={s} alGuardar={cargar} />}

            {s.estado === "abierta" && !descartada(s) && (
              noPuedo === s.id ? (
                <FormNoPuedo sol={s} alGuardar={() => { cargar(); setNoPuedo(null) }} alCancelar={() => setNoPuedo(null)} />
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={p ? S.btn2 : S.btn} onClick={() => { setNoPuedo(null); setAbierta(s.id) }}>
                    <T>{p ? "Cambiar mi propuesta" : "Cotizar"}</T>
                  </button>
                  {!p && (
                    <button type="button" style={{ ...S.btn2, borderColor: "#D9D5C9", color: "#6B675C" }} onClick={() => { setAbierta(null); setNoPuedo(s.id) }}>
                      <T>No puedo / necesito info</T>
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )
      })}

      {solAbierta && (
        <PanelLateral
          titulo={solAbierta.folio || "Solicitud"}
          sub={[solAbierta.trabajo?.servicio, solAbierta.trabajo?.material, [solAbierta.trabajo?.ciudad, solAbierta.trabajo?.estado_mx].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
          alCerrar={() => setAbierta(null)}
        >
          {solAbierta.trabajo?.descripcion && !solAbierta.trabajo?.descripcion_restringida && (
            <p style={{ whiteSpace: "pre-line", margin: "0 0 12px", color: "#40403A", fontSize: 13.5, background: "#F8F7F3", borderRadius: 10, padding: "10px 12px" }}>
              <T>{solAbierta.trabajo.descripcion}</T>
            </p>
          )}
          <FormPropuesta sol={solAbierta} cobroTaller={cobroTaller} alGuardar={() => { cargar(); setAbierta(null) }} />
        </PanelLateral>
      )}
    </div>
  )
}
