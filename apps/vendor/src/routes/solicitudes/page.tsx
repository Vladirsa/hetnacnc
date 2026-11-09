// @ts-nocheck
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
  icon: Icono,
}

const S = {
  page: { maxWidth: 900, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 18, marginBottom: 14 },
  tag: (bg, color) => ({ background: bg, color, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }),
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", height: 38, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 10px", fontSize: 14, boxSizing: "border-box", background: "#fff" },
  area: { width: "100%", minHeight: 70, border: "1px solid #D9D5C9", borderRadius: 8, padding: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  tab: (on) => ({ background: on ? "#142033" : "#F3F1EA", color: on ? "#fff" : "#40403A", border: 0, borderRadius: 999, padding: "6px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }),
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
          {enviando ? "Enviando..." : "🔑 Pedir acceso al cliente"}
        </button>
      )}
      {estado === "pendiente" && <span style={{ color: "#8A5A00", fontSize: 12 }}>⏳ Pediste acceso: esperando al cliente</span>}
      {estado === "rechazado" && <span style={{ color: "#6B675C", fontSize: 12 }}>El cliente no autorizó el acceso. Cotiza con lo visible o hazle una pregunta.</span>}
      {error && <span style={{ color: "#B3261E", fontSize: 12 }}>{error}</span>}
    </span>
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
          <span>📎 {archivos.length} {archivos.length === 1 ? "archivo del cliente" : "archivos del cliente"}: {archivos.map((a) => a.nombre).join(", ")}</span>
          <button type="button" style={{ ...S.btn2, padding: "4px 10px", fontSize: 12 }} disabled={cargando} onClick={pedir}>
            {cargando ? "Preparando..." : "Descargar"}
          </button>
          {error && <span style={{ color: "#B3261E" }}>{error}</span>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {ligas.map((a, i) =>
            a.url ? (
              <span key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
                  ⬇ {a.nombre} <span style={{ color: "#6B675C", fontWeight: 400 }}>({pesoLegible(a.tamano)})</span>
                </a>
                {/\.(dxf|svg|stl|obj)$/i.test(a.nombre) && (
                  <a
                    href={`${SITIO}/mx/visor?u=${encodeURIComponent(a.url)}&n=${encodeURIComponent(a.nombre)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1a3a5c", fontWeight: 600, fontSize: 12 }}
                  >
                    👁 Ver la pieza
                  </a>
                )}
              </span>
            ) : a.bloqueado ? (
              <span key={i} style={{ color: "#6B675C" }}>🔒 {a.nombre}: el cliente lo comparte sólo con talleres autorizados</span>
            ) : (
              <span key={i} style={{ color: "#B3261E" }}>{a.nombre}: no disponible, intenta más tarde</span>
            )
          )}
          {ligas.some((a) => a.bloqueado) && <PedirAcceso sol={sol} />}
          <span style={{ color: "#6B675C", fontSize: 12 }}>Las ligas duran una hora.</span>
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
          <button key={v} type="button" style={S.tab(motivo === v)} onClick={() => setMotivo(v)}>{l}</button>
        ))}
      </div>
      {motivo && (
        <>
          <label style={{ ...S.label, marginTop: 10 }}>
            {motivo === "mas_info" ? "¿Qué necesitas saber? (HETNA se lo pregunta al cliente)" : "Nota para HETNA (opcional)"}
          </label>
          <textarea style={S.area} value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder={motivo === "mas_info" ? "Ej. ¿Qué espesor de lámina? ¿El archivo trae cotas?" : "Ej. Tengo la máquina ocupada hasta el día 15."} />
        </>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" style={{ ...S.btn, background: "#142033", opacity: !motivo || enviando ? 0.6 : 1 }} disabled={!motivo || enviando} onClick={enviar}>
          {enviando ? "Guardando..." : motivo === "mas_info" ? "Pedir información" : "Guardar respuesta"}
        </button>
        <button type="button" style={{ ...S.btn2, border: 0 }} onClick={alCancelar}>Cancelar</button>
        {msg && <span style={{ fontSize: 14, color: "#B3261E" }}>{msg}</span>}
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
      <b style={{ fontSize: 14 }}>💬 Conversación con el cliente</b>
      <p style={{ fontSize: 12, color: "#6B675C", margin: "4px 0 0" }}>Mientras el cliente no comparta su contacto o no firmen el acuerdo, correos, teléfonos y ligas se ocultan.</p>
      <div style={{ maxHeight: 260, overflowY: "auto", background: "#FAF9F6", borderRadius: 8, padding: 8, marginTop: 8, display: "grid", gap: 6 }}>
        {lista.length === 0 && <span style={{ fontSize: 13, color: "#8A867B" }}>Sin mensajes todavía. Confirma con el cliente los detalles del trabajo.</span>}
        {lista.map((m) => (
          <div key={m.id} style={{ justifySelf: m.mio ? "end" : "start", maxWidth: "85%", background: m.mio ? "#142033" : "#fff", color: m.mio ? "#fff" : "#142033", border: m.mio ? 0 : "1px solid #E7E4DC", borderRadius: 12, padding: "6px 10px", fontSize: 13 }}>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.texto}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{fechaCorta(m.fecha)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <textarea style={{ ...S.area, minHeight: 44 }} value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu mensaje…" />
        <button type="button" style={S.btn} onClick={enviar} disabled={!texto.trim()}>Enviar</button>
      </div>
      {error && <p style={{ color: "#B3261E", fontSize: 13 }}>{error}</p>}
    </div>
  )
}

function AcuerdoSafeDeal({ sol }) {
  const [a, setA] = useState(null)
  const [cond, setCond] = useState({})
  const [editando, setEditando] = useState(false)
  const [nota, setNota] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [firma, setFirma] = useState({ nombre: "", representacion: "", codigo: "", acepto: false })
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
          <b>{i + 1}. {ap.titulo}</b>
          <textarea style={S.area} value={cond[ap.clave] || ""} maxLength={3000} onChange={(e) => setCond({ ...cond, [ap.clave]: e.target.value })} />
        </label>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={S.btn} disabled={ocupado} onClick={async () => { if (await hacer({ accion: "guardar", condiciones: cond }, "Guardado. El cliente debe revisar y aprobar.")) setEditando(false) }}>{k ? "Guardar cambios" : "Proponer al cliente"}</button>
        <button type="button" style={S.btn2} onClick={() => { setEditando(false); setCond(k?.condiciones || a.sugerencia || {}) }}>Cancelar</button>
      </div>
    </div>
  )
  return (
    <div style={{ marginTop: 12, border: "1px solid #E7E4DC", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ fontSize: 14 }}>🤝 Acuerdo HETNA SafeDeal</b>
        <span style={S.tag("#F3F1EA", "#6B675C")}>Opcional</span>
        {firmado && <span style={S.tag("#E6F4EA", "#1E7B3A")}>Firmado por ambos</span>}
      </div>
      {!firmado && (
        <p style={{ fontSize: 13, background: "#FFF8EE", border: "1px solid #F2C98F", borderRadius: 8, padding: "8px 10px", margin: "8px 0 0" }}>
          <b>⚠️ Recomendado para el bienestar de los dos.</b> Deja por escrito qué entregas, cuándo, a qué precio y cómo te pagan. Te protege de cambios de alcance y pagos atrasados, y al cliente le da certeza sobre calidad y confidencialidad.
        </p>
      )}
      {a.leyenda && <p style={{ fontSize: 12, color: "#C2560A", fontWeight: 600, margin: "6px 0 0" }}>{a.leyenda}</p>}
      {a.contactos_liberados && a.contacto_otro && (
        <p style={{ fontSize: 13, background: "#EEF6F0", borderRadius: 8, padding: "8px 10px" }}>
          <b>Contacto del cliente:</b> {[a.contacto_otro.nombre, a.contacto_otro.empresa, a.contacto_otro.email, a.contacto_otro.telefono && `Tel. ${a.contacto_otro.telefono}`, a.contacto_otro.whatsapp && `WhatsApp ${a.contacto_otro.whatsapp}`].filter(Boolean).join(" · ")}
        </p>
      )}
      {!k && !editando && <button type="button" style={{ ...S.btn, marginTop: 8 }} onClick={() => setEditando(true)}>Preparar el acuerdo</button>}
      {((!k && editando) || (k?.estado === "borrador" && editando)) && campos()}
      {k?.estado === "borrador" && !editando && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <p style={{ margin: 0 }}>Versión {k.version} · Cliente: {k.aprobo_cliente ? "✓ aprobó" : "pendiente"} · Taller: {k.aprobo_taller ? "✓ aprobó" : "pendiente"}</p>
          <div style={{ background: "#FAF9F6", borderRadius: 8, padding: 8, marginTop: 6 }}>
            {a.apartados.map((ap, i) => (
              <div key={ap.clave} style={{ marginBottom: 6 }}><b>{i + 1}. {ap.titulo}</b><div style={{ whiteSpace: "pre-wrap", color: "#40403A" }}>{k.condiciones?.[ap.clave] || "—"}</div></div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {!k.yo_aprobe && <button type="button" style={S.btn} disabled={ocupado} onClick={() => hacer({ accion: "aprobar", huella: k.huella }, "Aprobaste las condiciones.")}>✓ Apruebo estas condiciones</button>}
            <button type="button" style={S.btn2} onClick={() => setEditando(true)}>Proponer cambios</button>
          </div>
        </div>
      )}
      {k?.estado === "listo" && (
        <div style={{ marginTop: 8, fontSize: 13, display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}>Ambos aprobaron la versión {k.version}. <a href="#" style={{ color: "#C2560A" }} onClick={(e) => { e.preventDefault(); bajar("contrato") }}>Descarga y revisa el PDF</a>.</p>
          <span style={{ fontSize: 11, color: "#8A867B", wordBreak: "break-all" }}>SHA-256: {k.sha256}</span>
          {!k.yo_firme ? (
            <div style={S.grid}>
              <input style={S.input} placeholder="Tu nombre completo" value={firma.nombre} onChange={(e) => setFirma({ ...firma, nombre: e.target.value })} />
              <input style={S.input} placeholder="Taller o empresa que representas" value={firma.representacion} onChange={(e) => setFirma({ ...firma, representacion: e.target.value })} />
              <label style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={firma.acepto} onChange={(e) => setFirma({ ...firma, acepto: e.target.checked })} /> Leí el contrato (versión {k.version}) y acepto firmarlo electrónicamente.</label>
              {!enviado ? (
                <button type="button" style={S.btn} disabled={ocupado || !firma.acepto || firma.nombre.trim().length < 5} onClick={async () => { const d = await hacer({ accion: "codigo" }); if (d) setEnviado(d.correo || "tu correo") }}>Enviarme el código</button>
              ) : (
                <>
                  <input style={S.input} inputMode="numeric" maxLength={6} placeholder={`Código enviado a ${enviado}`} value={firma.codigo} onChange={(e) => setFirma({ ...firma, codigo: e.target.value.replace(/\D/g, "") })} />
                  <button type="button" style={S.btn} disabled={ocupado || firma.codigo.length !== 6} onClick={() => hacer({ accion: "firmar", ...firma, sha256: k.sha256 }, "¡Firmaste!")}>Firmar contrato</button>
                </>
              )}
            </div>
          ) : (
            <b style={{ color: "#1E7B3A" }}>✓ Ya firmaste. Falta la firma del cliente.</b>
          )}
          <button type="button" style={{ ...S.btn2, justifySelf: "start" }} disabled={ocupado} onClick={() => hacer({ accion: "guardar", condiciones: k.condiciones }, "Versión nueva creada: haz tus cambios.")}>Cambiar condiciones (versión nueva)</button>
        </div>
      )}
      {firmado && (
        <div style={{ marginTop: 8, fontSize: 13, display: "grid", gap: 6 }}>
          <span>Firmado el {fechaCorta(k.firmado_en)} por {k.firmas.map((f) => f.nombre).join(" y ")}. Nadie puede modificar esta versión.</span>
          <span style={{ fontSize: 11, color: "#8A867B", wordBreak: "break-all" }}>SHA-256: {k.sha256}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={S.btn} onClick={() => bajar("contrato", k.version)}>Descargar contrato</button>
            <button type="button" style={S.btn2} onClick={() => bajar("constancia", k.version)}>Constancia de firmas</button>
            <button type="button" style={S.btn2} disabled={ocupado} onClick={() => hacer({ accion: "guardar", condiciones: k.condiciones }, "Versión nueva creada.")}>Modificar (versión nueva)</button>
          </div>
        </div>
      )}
      {nota && <p style={{ fontSize: 13, color: nota.ok ? "#1E7B3A" : "#B3261E" }}>{nota.t}</p>}
    </div>
  )
}


// Licitaciones 3.0 — Fase 4: Trust & Ranking. El taller evalúa al cliente
// (7 indicadores) y ve, ya publicada, la evaluación que el cliente le dio.
function RepCliente({ rep }) {
  if (!rep) return null
  if (!rep.evaluaciones) return <span style={S.tag("#F3F1EA", "#6B675C")} title="Todavía no tiene evaluaciones de otros talleres">Cliente nuevo</span>
  const buena = rep.promedio >= 4
  return (
    <span style={S.tag(buena ? "#E6F4EA" : "#FFF8EE", buena ? "#1E7B3A" : "#8A5A00")} title={rep.suficiente ? "Evaluado por talleres en trabajos pagados" : "Historial todavía insuficiente"}>
      Cliente ★ {rep.promedio} · {rep.evaluaciones} {rep.evaluaciones === 1 ? "trabajo" : "trabajos"}{!rep.suficiente ? " (poco historial)" : ""}
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
      <b style={{ fontSize: 14 }}>⭐ Evaluación mutua</b>
      {!d.puede_evaluar && !d.dada && <p style={{ margin: "4px 0 0", color: "#6B675C" }}>Cuando entregues y el cliente haya pagado, podrás evaluarlo. Su reputación ayuda a otros talleres a elegir con quién trabajar.</p>}
      {d.puede_evaluar && (!d.dada || editando) && (
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <span style={{ color: "#6B675C" }}>Evalúa al cliente. Se publica cuando los dos evalúen (o en {d.dias_publicacion} días); antes nadie ve la evaluación del otro.</span>
          {d.indicadores.map((i) => (
            <div key={i.clave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{i.nombre}</span>
              <span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${i.nombre} ${n} de 5`} onClick={() => setNotas({ ...notas, [i.clave]: n })} style={{ background: "none", border: 0, fontSize: 20, cursor: "pointer", color: n <= (notas[i.clave] || 0) ? "#C2560A" : "#D9D5C9", padding: "0 1px" }}>★</button>
                ))}
              </span>
            </div>
          ))}
          <textarea style={S.area} maxLength={1000} placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          <button type="button" style={{ ...S.btn, justifySelf: "start" }} disabled={!completo} onClick={() => post({ accion: "evaluar", ...notas, comentario }, "Evaluación guardada.")}>Enviar evaluación</button>
        </div>
      )}
      {d.dada && !editando && (
        <p style={{ margin: "6px 0 0" }}>
          Evaluaste al cliente: <b>{Number(d.dada.promedio).toFixed(1)} / 5</b>{d.dada.retenida ? " (en revisión de HETNA)" : d.dada.publicada ? " · publicada" : " · se publica cuando el cliente evalúe"}{" "}
          {!d.dada.publicada && <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => setEditando(true)}>Cambiar</button>}
        </p>
      )}
      {d.recibida_pendiente && <p style={{ margin: "6px 0 0", color: "#6B675C" }}>El cliente ya te evaluó. La verás cuando tú lo evalúes (o en {d.dias_publicacion} días).</p>}
      {r && (
        <div style={{ background: "#FAF9F6", borderRadius: 8, padding: 8, marginTop: 8 }}>
          <b>El cliente te evaluó: {Number(r.promedio).toFixed(1)} / 5</b>
          {r.comentario && <div style={{ marginTop: 4 }}>“{r.comentario}”</div>}
          {r.respuesta && <div style={{ marginTop: 4, color: "#40403A" }}>Tu respuesta: {r.respuesta}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => setModo("responder")}>Responder</button>
            <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12, color: "#B3261E", borderColor: "#B3261E" }} onClick={() => setModo("reclamar")}>Pedir revisión</button>
          </div>
          {modo && (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <textarea style={{ ...S.area, minHeight: 44 }} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={modo === "reclamar" ? "¿Por qué no es correcta?" : "Respuesta pública"} />
              <button type="button" style={S.btn} onClick={() => post({ accion: modo, texto }, modo === "reclamar" ? "Reclamación enviada a HETNA." : "Respuesta publicada.")}>Enviar</button>
            </div>
          )}
        </div>
      )}
      {nota && <p style={{ color: nota.ok ? "#1E7B3A" : "#B3261E", margin: "6px 0 0" }}>{nota.t}</p>}
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
        Esperando el pago del cliente. No empieces a fabricar hasta que te avisemos que pagó.
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
        <span style={S.tag("#E6F4EA", "#1E7B3A")}>{sol.etapa_nombre || "En producción"}</span>
        {sol.envio?.guia && <span style={{ fontSize: 13 }}>Guía {sol.envio.paqueteria} <strong>{sol.envio.guia}</strong></span>}
        {sol.etapa === "entregada" && <span style={{ fontSize: 13, color: "#6B675C" }}>Esperando que el cliente confirme que lo recibió.</span>}
      </div>
      {sol.cobro && (
        <p style={{ fontSize: 13, color: "#40403A", margin: "8px 0 0" }}>
          {sol.cobro.modo === "taller"
            ? `Cobro directo a tu cuenta · pagado ${pesos(pagado)} de ${pesos(precio)}${falta > 0 ? ` · falta ${pesos(falta)}: el cliente lo paga desde su liga; avísale con un avance cuando esté listo.` : " · liquidado."}`
            : `Cobra HETNA · pagado ${pesos(pagado)}. Te transferimos el pago completo al confirmar la entrega.`}
        </p>
      )}
      {!modo && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" style={S.btn2} onClick={() => setModo("avance")}>Contar un avance al cliente</button>
          {!yaEntregada && (
            <button type="button" style={S.btn} onClick={() => setModo("entregada")}>Marcar como entregado / enviado</button>
          )}
        </div>
      )}
      {modo && (
        <div style={{ marginTop: 10 }}>
          {modo === "entregada" && (
            <div style={S.grid}>
              <div>
                <label style={S.label}>Paquetería</label>
                <input style={S.input} value={f.paqueteria} onChange={(e) => set("paqueteria", e.target.value)} placeholder="Estafeta, DHL, entrega en persona…" />
              </div>
              <div>
                <label style={S.label}>Número de guía</label>
                <input style={S.input} value={f.guia} onChange={(e) => set("guia", e.target.value)} />
              </div>
            </div>
          )}
          <label style={{ ...S.label, marginTop: 10 }}>{modo === "avance" ? "¿Qué avance le cuentas?" : "Nota para el cliente (opcional)"}</label>
          <textarea style={S.area} value={f.nota} onChange={(e) => set("nota", e.target.value)}
            placeholder={modo === "avance" ? "Ej. Ya cortamos las piezas; mañana pintamos." : "Ej. Va en 2 cajas."} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" style={{ ...S.btn, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={enviar}>
              {enviando ? "Enviando..." : modo === "avance" ? "Enviar avance" : "Confirmar entrega"}
            </button>
            <button type="button" style={{ ...S.btn2, border: 0 }} onClick={() => setModo(null)}>Cancelar</button>
            {msg && <span style={{ fontSize: 14, color: "#B3261E" }}>{msg}</span>}
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
              <div><span style={{ color: "#6B675C" }}>{q.mia ? "Tú preguntaste:" : "Otro taller preguntó:"}</span> {q.pregunta}</div>
              <div style={{ color: q.respuesta ? "#1E7B3A" : "#9B978C" }}>
                <strong>Cliente:</strong> {q.respuesta || "todavía no contesta"}
              </div>
            </div>
          ))}
        </div>
      )}
      {puede && !abierto && (
        <button type="button" style={{ ...S.btn2, border: 0, padding: "6px 0", color: "#C2560A" }} onClick={() => setAbierto(true)}>
          ¿Te falta un dato? Pregúntale al cliente
        </button>
      )}
      {abierto && (
        <div style={{ marginTop: 6 }}>
          <textarea style={S.area} maxLength={600} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. ¿Qué espesor de acrílico? ¿Las piezas llevan barreno?" />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <button type="button" style={{ ...S.btn, background: "#142033", opacity: enviando || texto.trim().length < 8 ? 0.6 : 1 }} disabled={enviando || texto.trim().length < 8} onClick={enviar}>
              {enviando ? "Enviando..." : "Enviar pregunta"}
            </button>
            <button type="button" style={{ ...S.btn2, border: 0 }} onClick={() => setAbierto(false)}>Cancelar</button>
            <span style={{ color: "#6B675C", fontSize: 12 }}>La respuesta la verán todos los talleres. Hasta 3 preguntas.</span>
          </div>
        </div>
      )}
      {msg && <div style={{ marginTop: 6, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</div>}
    </div>
  )
}

function FormPropuesta({ sol, alGuardar, cobroTaller }) {
  const p = sol.mi_propuesta
  const [f, setF] = useState({
    precio: p?.precio ?? "", dias: p?.dias ?? "", vigencia_dias: p?.vigencia_dias ?? 15,
    incluye_envio: p?.incluye_envio ?? false, condiciones: p?.condiciones ?? "",
    anticipo_pct: p?.anticipo_pct ?? 50,
    // Licitaciones 3.0 (Fase 2): propuesta formal
    moneda: p?.moneda ?? "MXN", materiales: p?.materiales ?? "", operaciones: p?.operaciones ?? "",
    fecha_entrega: p?.fecha_entrega ?? "", condiciones_pago: p?.condiciones_pago ?? "", garantia: p?.garantia ?? "",
    observaciones: p?.observaciones ?? "",
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
      <div style={S.grid}>
        <div>
          <label style={S.label}>Precio total ({f.moneda}, con IVA)</label>
          <input style={S.input} inputMode="decimal" value={f.precio} onChange={(e) => set("precio", e.target.value)} placeholder="3500" />
        </div>
        <div>
          <label style={S.label}>Moneda</label>
          <select style={S.input} value={f.moneda} onChange={(e) => set("moneda", e.target.value)}>
            <option value="MXN">Pesos (MXN)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        <div>
          <label style={S.label}>Días de entrega</label>
          <input style={S.input} type="number" min="1" value={f.dias} onChange={(e) => set("dias", e.target.value)} placeholder="5" />
        </div>
        <div>
          <label style={S.label}>Fecha estimada de entrega</label>
          <input style={S.input} type="date" value={f.fecha_entrega} onChange={(e) => set("fecha_entrega", e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Vigencia (días)</label>
          <input style={S.input} type="number" min="1" value={f.vigencia_dias} onChange={(e) => set("vigencia_dias", e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Anticipo para empezar</label>
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
            El precio incluye envío
          </label>
        </div>
      </div>
      <p style={{ color: "#6B675C", fontSize: 12, margin: "6px 0 0" }}>
        {directo
          ? `Si ganas, el cliente te paga directo a tu ${cobroTaller.mercadopago ? "Mercado Pago" : "PayPal"}. HETNA no cobra comisión.`
          : `Sin Mercado Pago ni PayPal conectados, el cliente paga el 100% a HETNA y te lo transferimos completo al confirmar la entrega. Conéctalos en la app para pedir anticipo y cobrar directo.`}
      </p>
      <p style={{ margin: "14px 0 4px", fontSize: 13, fontWeight: 700, color: "#142033" }}>
        Propuesta formal <span style={{ fontWeight: 400, color: "#6B675C" }}>— mientras más completa, más confianza le da al cliente</span>
      </p>
      <div style={S.grid}>
        <div>
          <label style={S.label}>Materiales que usarás</label>
          <textarea style={S.area} value={f.materiales} onChange={(e) => set("materiales", e.target.value)} placeholder="Ej. Acero A36 cal. 14, pintura electrostática negra" />
        </div>
        <div>
          <label style={S.label}>Operaciones / procesos</label>
          <textarea style={S.area} value={f.operaciones} onChange={(e) => set("operaciones", e.target.value)} placeholder="Ej. Corte plasma, doblez, soldadura MIG, pintura" />
        </div>
        <div>
          <label style={S.label}>Condiciones de pago</label>
          <textarea style={S.area} value={f.condiciones_pago} onChange={(e) => set("condiciones_pago", e.target.value)} placeholder="Ej. 50% para empezar y 50% contra entrega; factura CFDI" />
        </div>
        <div>
          <label style={S.label}>Garantía</label>
          <textarea style={S.area} value={f.garantia} onChange={(e) => set("garantia", e.target.value)} placeholder="Ej. Reposición sin costo por defecto de fabricación en 30 días" />
        </div>
      </div>
      <label style={{ ...S.label, marginTop: 10 }}>Observaciones técnicas</label>
      <textarea style={S.area} value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} placeholder="Ej. Tolerancia ±0.2 mm; recomendamos radio de 1 mm en esquinas" />
      <label style={{ ...S.label, marginTop: 10 }}>Condiciones (material incluido, acabado, tolerancias…)</label>
      <textarea style={S.area} value={f.condiciones} onChange={(e) => set("condiciones", e.target.value)} placeholder="Ej. Incluye material MDF 6 mm y lijado." />
      <div style={{ marginTop: 10, fontSize: 13 }}>
        <strong>Archivos adjuntos</strong> <span style={{ color: "#6B675C" }}>(tu cotización en PDF, planos o fotos de trabajos parecidos; máx. 5)</span>
        {!p && <div style={{ color: "#6B675C", marginTop: 4 }}>Primero envía tu propuesta; después podrás adjuntar archivos.</div>}
        {p && (
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {adjuntos.map((a) => (
              <span key={a.clave} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                📎 {a.nombre}
                <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => quitar(a.clave)}>Quitar</button>
              </span>
            ))}
            {adjuntos.length < 5 && (
              <label style={{ ...S.btn2, padding: "4px 10px", fontSize: 12, display: "inline-block", width: "fit-content", cursor: "pointer" }}>
                {subiendo ? "Subiendo..." : "+ Adjuntar archivo"}
                <input type="file" hidden disabled={subiendo} accept=".pdf,.dxf,.dwg,.step,.stp,.stl,.svg,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.doc,.docx" onChange={(e) => { subir(e.target.files?.[0]); e.target.value = "" }} />
              </label>
            )}
          </div>
        )}
      </div>
      <p style={{ color: "#6B675C", fontSize: 12, margin: "4px 0 10px" }}>
        No escribas teléfonos, correos ni ligas: se ocultan automáticamente. Todo el trato va por HETNA.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={{ ...S.btn, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={enviar}>
          {enviando ? "Enviando..." : p ? "Actualizar propuesta" : "Enviar propuesta"}
        </button>
        {msg && <span style={{ fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</span>}
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
            {sinLimite
              ? `Plan ${cupo.nombre}: propuestas sin límite`
              : agotado
                ? `Plan ${cupo.nombre}: ya usaste tus ${cupo.limite} propuesta${cupo.limite === 1 ? "" : "s"} de este mes`
                : `Plan ${cupo.nombre}: te ${cupo.quedan === 1 ? "queda" : "quedan"} ${cupo.quedan} de ${cupo.limite} propuesta${cupo.limite === 1 ? "" : "s"} este mes`}
          </div>
          <div style={{ fontSize: 13, color: "#6B675C", marginTop: 2 }}>
            {sinLimite
              ? "Cotiza todas las solicitudes que quieras."
              : "El cupo se renueva el día 1. Corregir una propuesta ya enviada y las solicitudes que te mandan directo a ti no cuentan."}
          </div>
          {!sinLimite && (
            <div style={{ height: 6, background: "#E7E4DC", borderRadius: 3, marginTop: 8, overflow: "hidden", maxWidth: 320 }}>
              <div style={{ width: `${Math.min(100, (cupo.usadas / cupo.limite) * 100)}%`, height: "100%", background: color }} />
            </div>
          )}
        </div>
        {!sinLimite && (
          <div style={{ fontSize: 13, color: "#3D3A33", flex: "1 1 220px" }}>
            {cupo.plan === "gratis" ? "Con el plan Taller mandas 5 al mes y con Pro, sin límite." : "Con el plan Pro mandas propuestas sin límite."}{" "}
            Cámbialo en la app HETNA CNC para talleres, en <b>Mi plan</b>.
          </div>
        )}
      </div>
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

  const cargar = () =>
    // ocultas=1: también las que el taller marcó como "no puedo"; se separan aquí.
    fetch("/vendor/hetna-solicitudes?ocultas=1", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setDatos(d.solicitudes || [])
        setCupo(d.cupo || null)
        setCobroTaller(d.cobro_taller || null)
      })
      .catch((e) => setError("No se pudieron cargar las solicitudes (" + e + ")."))

  useEffect(() => {
    cargar()
  }, [])

  if (error) return <div style={S.page}>{error}</div>
  if (!datos) return <div style={S.page}>Cargando...</div>

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

  const deshacer = async (s) => {
    await fetch(`/vendor/hetna-solicitudes/${s.id}/respuesta`, { method: "DELETE", credentials: "include" }).catch(() => {})
    cargar()
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Solicitudes de fabricación</h1>
      <p style={S.sub}>
        Clientes que buscan taller. Manda tu precio y tiempo; el cliente compara y elige. Los talleres con membresía aparecen primero.
      </p>

      {cupo && <Cupo cupo={cupo} />}

      {cobroTaller && (
        <div style={{ ...S.card, padding: "10px 14px", fontSize: 13, background: cobroTaller.mercadopago || cobroTaller.paypal ? "#F0F7F1" : "#FFFAEB" }}>
          {cobroTaller.mercadopago || cobroTaller.paypal ? (
            <>
              ✓ Cobras directo a tu {[cobroTaller.mercadopago && "Mercado Pago", cobroTaller.paypal && "PayPal"].filter(Boolean).join(" y ")}. Puedes pedir anticipo.
              <strong>Sin comisión de HETNA</strong>: el pago es completo para ti.
            </>
          ) : (
            <>
              Conecta tu <strong>Mercado Pago o PayPal</strong> en la app HETNA CNC para talleres (Configuración → Cobros en línea) y cobra directo,
              con anticipo. Mientras, el cliente paga a HETNA y te transferimos el pago completo al entregar. <strong>Sin comisión.</strong>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" style={S.tab(vista === "nuevas")} onClick={() => setVista("nuevas")}>Por cotizar ({nuevas.length})</button>
        <button type="button" style={S.tab(vista === "enviadas")} onClick={() => setVista("enviadas")}>Mis propuestas ({enviadas.length})</button>
        {descartadas.length > 0 && (
          <button type="button" style={S.tab(vista === "descartadas")} onClick={() => setVista("descartadas")}>No puedo ({descartadas.length})</button>
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
          {vista === "nuevas"
            ? "Por ahora no hay solicitudes nuevas. Te avisamos por correo cuando llegue una."
            : vista === "enviadas"
              ? "Aún no has enviado propuestas."
              : "No has descartado solicitudes."}
        </div>
      )}

      {lista.map((s) => {
        const t = s.trabajo || {}
        const p = s.mi_propuesta
        return (
          <div key={s.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{s.folio}</strong>
                <RepCliente rep={s.reputacion_cliente} />
                {s.para_mi && <span style={S.tag("#FFF1E6", "#C2560A")}>Te eligieron a ti</span>}
                {s.modalidad === "privada" && !s.para_mi && <span style={S.tag("#EEF2FB", "#1a3a5c")}>Privada · te invitaron</span>}
                {s.modalidad === "restringida" && <span style={S.tag("#FFF8E6", "#8A5A00")}>Restringida</span>}
                {s.tipo === "suministro" && <span style={S.tag("#EEF6F0", "#1E7B3A")}>📦 Suministro</span>}
                {p?.estado === "elegida" && <span style={S.tag("#E6F4EA", "#1E7B3A")}>¡Ganaste!</span>}
                {p?.estado === "descartada" && <span style={S.tag("#F3F1EA", "#6B675C")}>No elegida</span>}
                <span style={{ color: "#6B675C", fontSize: 12 }}>
                  {s.propuestas_recibidas} {s.propuestas_recibidas === 1 ? "propuesta" : "propuestas"}
                  {s.cierra_en && s.estado === "abierta" ? ` · cierra ${new Date(s.cierra_en).toLocaleDateString("es-MX")}` : ""}
                </span>
              </div>
              {[t.ciudad, t.estado_mx].filter(Boolean).length > 0 && (
                <span style={{ color: "#6B675C", fontSize: 13 }}>📍 {[t.ciudad, t.estado_mx].filter(Boolean).join(", ")}</span>
              )}
            </div>

            {t.cliente && t.cliente !== "Cliente HETNA" && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#40403A" }}>👤 {t.cliente}</p>}
            {t.descripcion_restringida ? (
              <div style={{ margin: "10px 0", background: "#F3F1EA", borderRadius: 8, padding: "8px 12px", fontSize: 13, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span>🔒 El cliente reservó la descripción completa para los talleres que autorice.</span>
                <PedirAcceso sol={s} />
              </div>
            ) : (
              <p style={{ whiteSpace: "pre-line", margin: "10px 0", color: "#40403A" }}>{t.descripcion}</p>
            )}
            {t.presupuesto_confidencial && <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6B675C" }}>Presupuesto: confidencial</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 13 }}>
              {CAMPOS.filter(([k]) => t[k]).map(([k, l]) => (
                <span key={k}><span style={{ color: "#6B675C" }}>{l}:</span> <strong>{t[k]}</strong></span>
              ))}
              {t.archivo && (
                <a href={t.archivo} target="_blank" rel="noopener noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>Ver archivos</a>
              )}
            </div>

            <ArchivosCliente sol={s} />

            {s.mi_respuesta && (
              <p style={{ marginTop: 10, fontSize: 13, color: "#6B675C" }}>
                Respondiste: <strong style={{ color: "#142033" }}>{s.mi_respuesta.texto}</strong>
                {s.mi_respuesta.nota ? ` — ${s.mi_respuesta.nota}` : ""}
                {descartada(s) && (
                  <button type="button" style={{ ...S.btn2, border: 0, padding: "0 8px", fontSize: 12, color: "#C2560A" }} onClick={() => deshacer(s)}>
                    Deshacer
                  </button>
                )}
              </p>
            )}

            {p && (
              <p style={{ marginTop: 10, fontSize: 14 }}>
                Tu propuesta: <strong>{pesos(p.precio)}</strong> · {p.dias} días {p.incluye_envio ? "· envío incluido" : ""}
                {p.anticipo_pct && p.anticipo_pct < 100 ? ` · anticipo ${p.anticipo_pct}%` : ""}
              </p>
            )}

            {p?.estado === "descartada" && s.eleccion && (
              <p style={{ marginTop: 8, fontSize: 13, color: "#40403A", background: "#F3F1EA", borderRadius: 8, padding: "8px 12px" }}>
                El cliente eligió un precio entre <strong>{pesos(s.eleccion.desde)}</strong> y <strong>{pesos(s.eleccion.hasta)}</strong> con entrega en{" "}
                <strong>{s.eleccion.dias} días</strong>.{" "}
                {p.precio > s.eleccion.hasta
                  ? "Tu precio quedó arriba."
                  : p.precio < s.eleccion.desde
                    ? "Tu precio quedó abajo: pesó más otra cosa (tiempo, calificación o condiciones)."
                    : "Tu precio estuvo muy cerca."}
              </p>
            )}

            {p?.estado === "elegida" && <Pedido sol={s} alGuardar={cargar} />}
            {p?.estado === "elegida" && <Conversacion sol={s} />}
            {p?.estado === "elegida" && <AcuerdoSafeDeal sol={s} />}
            {p?.estado === "elegida" && <EvaluarCliente sol={s} />}

            {s.estado === "abierta" && !descartada(s) && <Preguntas sol={s} alGuardar={cargar} />}

            {s.estado === "abierta" && !descartada(s) && (
              abierta === s.id ? (
                <FormPropuesta sol={s} cobroTaller={cobroTaller} alGuardar={() => { cargar(); setAbierta(null) }} />
              ) : noPuedo === s.id ? (
                <FormNoPuedo sol={s} alGuardar={() => { cargar(); setNoPuedo(null) }} alCancelar={() => setNoPuedo(null)} />
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={S.btn2} onClick={() => { setNoPuedo(null); setAbierta(s.id) }}>
                    {p ? "Cambiar mi propuesta" : "Cotizar"}
                  </button>
                  {!p && (
                    <button type="button" style={{ ...S.btn2, borderColor: "#D9D5C9", color: "#6B675C" }} onClick={() => { setAbierta(null); setNoPuedo(s.id) }}>
                      No puedo / necesito info
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
