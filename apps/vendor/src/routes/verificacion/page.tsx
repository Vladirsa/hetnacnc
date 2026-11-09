// @ts-nocheck
// Pantalla "Verificación" del panel del taller (/seller > Verificación).
// El taller sube su identificación oficial y fotos de su taller y fachada.
// Un administrador de HETNA las revisa y, si todo está bien, el taller recibe
// la insignia "Taller verificado" en la tienda.
// Los documentos son privados: no se publican y solo los ve el equipo de HETNA.
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Escudo = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

export const config: RouteConfig = {
  label: "Verificación",
  icon: Escudo,
}

const ORDEN = ["identificacion_frente", "identificacion_reverso", "fachada", "taller", "comprobante_domicilio", "constancia_fiscal", "acta_constitutiva"]

const AYUDA = {
  identificacion_frente: "INE, pasaporte o cédula profesional del responsable del taller. Que se lean bien los datos.",
  identificacion_reverso: "La parte de atrás de la misma identificación.",
  fachada: "Foto de la entrada del taller desde la calle, donde se vea el número o el letrero.",
  taller: "Al menos 2 fotos del interior: tus máquinas trabajando, el área de trabajo.",
  comprobante_domicilio: "Recibo de luz, agua o teléfono a nombre del taller o del responsable (no mayor a 3 meses).",
  constancia_fiscal: "Constancia de situación fiscal del SAT (con RFC). Con ella puedes obtener la insignia \"Empresa verificada\".",
  acta_constitutiva: "Si eres persona moral: acta constitutiva o poder del representante legal.",
}

const ESTADO = {
  sin_enviar: { t: "Sin verificar", c: "#6B675C", bg: "#F3F1EA", d: "Sube tus documentos y envíalos a revisión." },
  borrador: { t: "Sin enviar", c: "#6B675C", bg: "#F3F1EA", d: "Cuando tengas todo, presiona “Enviar a revisión”." },
  en_revision: { t: "En revisión", c: "#8A5A00", bg: "#FFF6DB", d: "Recibimos tus documentos. Te respondemos en 1 a 3 días hábiles." },
  verificado: { t: "Taller verificado", c: "#1E7B3A", bg: "#E7F5EC", d: "Tu taller muestra la insignia de verificado en la tienda." },
  rechazado: { t: "Necesita cambios", c: "#B3261E", bg: "#FDECEA", d: "Corrige lo que se indica y vuelve a enviar." },
}

const S = {
  page: { maxWidth: 820, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 20, marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 700, margin: "0 0 4px" },
  hint: { color: "#6B675C", fontSize: 13, margin: "0 0 12px" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-block" },
  thumb: { position: "relative", width: 120, height: 90, borderRadius: 8, border: "1px solid #E7E4DC", background: "#F3F1EA", overflow: "hidden", display: "grid", placeItems: "center", fontSize: 12, color: "#6B675C" },
}

const MAX_MB = 8

async function api(ruta, init = {}) {
  const r = await fetch(`/vendor/hetna-verificacion${ruta}`, { credentials: "include", ...init })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message || `Error ${r.status}`)
  return d
}

// Vista previa privada: se pide con la sesión del taller y se muestra como blob
function Miniatura({ archivo, puedeQuitar, alQuitar }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (archivo.mime === "application/pdf") return
    let vivo = true
    let creado = null
    fetch(`/vendor/hetna-verificacion/archivos/${archivo.id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b || !vivo) return
        creado = URL.createObjectURL(b)
        setUrl(creado)
      })
      .catch(() => {})
    return () => {
      vivo = false
      if (creado) URL.revokeObjectURL(creado)
    }
  }, [archivo.id])
  return (
    <div style={S.thumb}>
      {archivo.mime === "application/pdf" ? "PDF" : url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "Cargando..."}
      {puedeQuitar && (
        <button type="button" aria-label="Quitar" onClick={alQuitar}
          style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, border: 0, background: "rgba(0,0,0,.65)", color: "#fff", cursor: "pointer" }}>×</button>
      )}
    </div>
  )
}

// Fase 3: pago único de la verificación para el plan Gratis ($299). En los
// planes Taller, Pro e Industrial va incluida.
function PagoVerificacion({ alPagar }) {
  const [info, setInfo] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [nota, setNota] = useState("")
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    const pagoId = qs.get("payment_id") || qs.get("collection_id")
    const cargar = () => fetch("/vendor/hetna-verificacion/pago", { credentials: "include" }).then((r) => r.json()).then(setInfo).catch(() => setInfo(null))
    if (pagoId) {
      fetch("/vendor/hetna-verificacion/pago", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_id: pagoId }) })
        .then((r) => r.json())
        .then((d) => { setNota(d.ok ? "¡Pago recibido! Ya puedes enviar tus documentos y certificaciones." : d.motivo || ""); if (d.ok) alPagar?.() })
        .finally(cargar)
    } else cargar()
  }, [])
  if (!info || !info.debe_pagar) return nota ? <p style={{ fontSize: 14, color: "#1E7B3A" }}>{nota}</p> : null
  const pagar = async () => {
    setCargando(true)
    setNota("")
    try {
      const r = await fetch("/vendor/hetna-verificacion/pago", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      if (d.url) window.location.href = d.url
    } catch (e) {
      setNota(e.message)
    } finally {
      setCargando(false)
    }
  }
  return (
    <section style={{ ...S.card, background: "#FFF8EE", borderColor: "#F2C98F" }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Tu plan es Gratis: la verificación cuesta ${info.precio} (una sola vez)</p>
      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#40403A" }}>
        Incluye la revisión de tu identidad, de tu empresa y de tus certificaciones. En los planes Taller, Pro e Industrial va incluida.
        Los talleres verificados y certificados aparecen mejor posicionados ante los clientes.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" style={S.btn} disabled={cargando} onClick={pagar}>{cargando ? "Abriendo Mercado Pago..." : `Pagar $${info.precio} con Mercado Pago`}</button>
        {nota && <span style={{ fontSize: 13, color: "#B3261E" }}>{nota}</span>}
      </div>
    </section>
  )
}

// Fase 3: certificaciones acreditadas (ISO, AS9100, distribuidor autorizado…),
// separadas de la verificación y de la reputación.
function Certificaciones() {
  const [datos, setDatos] = useState(null)
  const [f, setF] = useState({ tipo: "iso9001", nombre: "", emisor: "", numero: "", vigencia: "" })
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [nota, setNota] = useState(null)
  const cargar = () => fetch("/vendor/hetna-certificaciones", { credentials: "include" }).then((r) => r.json()).then(setDatos).catch(() => setDatos({ tipos: {}, certificaciones: [] }))
  useEffect(() => { cargar() }, [])
  if (!datos) return null
  const enviar = async () => {
    if (!archivo) return setNota({ ok: false, t: "Sube el certificado (PDF o foto)." })
    setEnviando(true)
    setNota(null)
    try {
      const fd = new FormData()
      Object.entries(f).forEach(([k, v]) => fd.append(k, v))
      fd.append("archivo", archivo)
      const r = await fetch("/vendor/hetna-certificaciones", { method: "POST", credentials: "include", body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || String(r.status))
      setNota({ ok: true, t: "Enviada a revisión. Te avisamos cuando HETNA la apruebe." })
      setArchivo(null)
      setF({ tipo: "iso9001", nombre: "", emisor: "", numero: "", vigencia: "" })
      cargar()
    } catch (e) {
      setNota({ ok: false, t: e.message })
    } finally {
      setEnviando(false)
    }
  }
  const quitar = async (id) => {
    await fetch(`/vendor/hetna-certificaciones/${id}`, { method: "DELETE", credentials: "include" })
    cargar()
  }
  const COLOR = { pendiente: ["#FFF8EE", "#8A5A00", "En revisión"], aprobada: ["#E6F4EA", "#1E7B3A", "Aprobada"], rechazada: ["#FDECEA", "#B3261E", "No aprobada"] }
  return (
    <section style={S.card}>
      <h2 style={S.h2}>Certificaciones</h2>
      <p style={S.hint}>
        ISO 9001, AS9100, IATF 16949, carta de distribuidor autorizado, certificación de soldadura… HETNA revisa el documento y, al aprobarlo,
        aparece en tu perfil como <b>certificación acreditada</b>. Sube tu posicionamiento, no tu calificación (esa sólo sale de trabajos reales).
      </p>
      {datos.certificaciones.length > 0 && (
        <div style={{ display: "grid", gap: 6, margin: "8px 0 12px" }}>
          {datos.certificaciones.map((c) => {
            const [bg, col, txt] = COLOR[c.estado] || COLOR.pendiente
            return (
              <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
                <b>{c.tipo === "otra" || c.tipo === "distribuidor" ? c.nombre || datos.tipos[c.tipo] : datos.tipos[c.tipo]}</b>
                {c.emisor && <span style={{ color: "#6B675C" }}>· {c.emisor}</span>}
                {c.vigencia && <span style={{ color: "#6B675C" }}>· vence {c.vigencia}</span>}
                <span style={{ background: bg, color: col, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{txt}</span>
                {c.motivo && <span style={{ color: "#B3261E", fontSize: 13 }}>{c.motivo}</span>}
                <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => quitar(c.id)}>Quitar</button>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={{ fontSize: 13 }}>Tipo
          <select style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(datos.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {(f.tipo === "otra" || f.tipo === "distribuidor") && (
          <label style={{ fontSize: 13 }}>{f.tipo === "distribuidor" ? "Marca" : "Nombre"}
            <input style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
        )}
        <label style={{ fontSize: 13 }}>Organismo que la emitió
          <input style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.emisor} onChange={(e) => setF({ ...f, emisor: e.target.value })} placeholder="Ej. Bureau Veritas" />
        </label>
        <label style={{ fontSize: 13 }}>Número de certificado
          <input style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
        </label>
        <label style={{ fontSize: 13 }}>Vigente hasta
          <input type="date" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.vigencia} onChange={(e) => setF({ ...f, vigencia: e.target.value })} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <label style={S.btn2}>
          {archivo ? `📎 ${archivo.name}` : "+ Certificado (PDF o foto)"}
          <input type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
        <button type="button" style={S.btn} disabled={enviando} onClick={enviar}>{enviando ? "Enviando..." : "Enviar a revisión"}</button>
        {nota && <span style={{ fontSize: 13, color: nota.ok ? "#1E7B3A" : "#B3261E" }}>{nota.t}</span>}
      </div>
    </section>
  )
}

export default function VerificacionPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState(null)
  const [subiendo, setSubiendo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [autorizo, setAutorizo] = useState(false)

  useEffect(() => {
    api("").then(setDatos).catch((e) => setError(e.message))
  }, [])

  const subir = async (tipo, archivos) => {
    setMsg(null)
    setSubiendo(tipo)
    try {
      for (const a of archivos) {
        if (a.size > MAX_MB * 1024 * 1024) throw new Error(`"${a.name}" pesa más de ${MAX_MB} MB.`)
        const fd = new FormData()
        fd.append("tipo", tipo)
        fd.append("archivo", a)
        setDatos(await api("/archivos", { method: "POST", body: fd }))
      }
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setSubiendo("")
    }
  }

  const quitar = async (id) => {
    setMsg(null)
    try {
      setDatos(await api(`/archivos/${id}`, { method: "DELETE" }))
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    }
  }

  const enviar = async () => {
    setMsg(null)
    setEnviando(true)
    try {
      setDatos(await api("/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentimiento: true }),
      }))
      setMsg({ ok: true, t: "¡Listo! Enviamos tus documentos a revisión." })
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setEnviando(false)
    }
  }

  if (error) return <div style={S.page}>No se pudo cargar: {error}. Recarga la página.</div>
  if (!datos) return <div style={S.page}>Cargando...</div>

  const est = ESTADO[datos.estado] || ESTADO.sin_enviar
  const editable = !["en_revision", "verificado"].includes(datos.estado)

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Verificación del taller</h1>
      <p style={S.sub}>
        Los talleres verificados muestran la insignia <b>✓ Taller verificado</b> en su página y en sus productos.
        Así los clientes saben que eres un taller real.
      </p>

      <PagoVerificacion />

      <section style={{ ...S.card, background: est.bg, borderColor: est.bg }}>
        <p style={{ margin: 0, fontWeight: 700, color: est.c, fontSize: 16 }}>{est.t}</p>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#40403A" }}>{est.d}</p>
        {datos.estado === "rechazado" && datos.motivo && (
          <p style={{ margin: "8px 0 0", fontSize: 14 }}><b>Qué corregir:</b> {datos.motivo}</p>
        )}
      </section>

      {ORDEN.map((tipo) => {
        const t = datos.tipos[tipo]
        const mios = datos.archivos.filter((a) => a.tipo === tipo)
        const lleno = mios.length >= t.max
        return (
          <section key={tipo} style={S.card}>
            <h2 style={S.h2}>
              {t.nombre}
              {t.obligatorio > 0 && <span style={{ color: "#B3261E" }}> *</span>}
              <span style={{ fontWeight: 400, color: "#6B675C", fontSize: 13 }}> ({mios.length}/{t.max})</span>
            </h2>
            <p style={S.hint}>{AYUDA[tipo]} {t.pdf ? "Foto o PDF." : "Solo fotos."} Máximo {MAX_MB} MB.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {mios.map((a) => (
                <Miniatura key={a.id} archivo={a} puedeQuitar={editable} alQuitar={() => quitar(a.id)} />
              ))}
              {editable && !lleno && (
                <label style={S.btn2}>
                  {subiendo === tipo ? "Subiendo..." : "+ Subir"}
                  <input type="file" multiple={t.max > 1} disabled={!!subiendo} style={{ display: "none" }}
                    accept={t.pdf ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"}
                    onChange={(e) => {
                      const lista = Array.from(e.target.files || []).slice(0, t.max - mios.length)
                      e.target.value = ""
                      if (lista.length) subir(tipo, lista)
                    }} />
                </label>
              )}
            </div>
          </section>
        )
      })}

      <section style={S.card}>
        <p style={{ margin: 0, fontSize: 13, color: "#40403A" }}>
          🔒 Tus documentos son privados. No se publican en la tienda: solo los ve el equipo de HETNA para verificar
          tu taller, según nuestro aviso de privacidad.
        </p>
      </section>

      {editable && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Autorizo a HETNA CNC a usar mi identificación oficial y las fotos de mi taller únicamente para verificar mi
            taller, conforme al <a href="https://hetnacnc.com/mx/aviso-de-privacidad" target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>Aviso de privacidad</a>.
            Puedo retirar esta autorización y pedir que se borren mis documentos en cualquier momento.
          </span>
        </label>
      )}

      {editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="button" style={{ ...S.btn, opacity: enviando || datos.faltan.length || !autorizo ? 0.6 : 1 }}
            disabled={enviando || datos.faltan.length > 0 || !autorizo} onClick={enviar}>
            {enviando ? "Enviando..." : "Enviar a revisión"}
          </button>
          {datos.faltan.length > 0 && <span style={{ fontSize: 13, color: "#6B675C" }}>Falta: {datos.faltan.join(" · ")}</span>}
        </div>
      )}
      {msg && <p style={{ fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</p>}

      <Certificaciones />
    </div>
  )
}
