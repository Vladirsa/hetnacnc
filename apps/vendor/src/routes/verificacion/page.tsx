// @ts-nocheck
// Pantalla "Verificación" del panel del taller (/seller > Verificación).
// El taller sube su identificación oficial y fotos de su taller y fachada.
// Un administrador de HETNA las revisa y, si todo está bien, el taller recibe
// la insignia "Taller verificado" en la tienda.
// Los documentos son privados: no se publican y solo los ve el equipo de HETNA.
import { T, traducir } from "../../lib/idioma"
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
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
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
      <T>{archivo.mime === "application/pdf" ? "PDF" : url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "Cargando..."}</T>
      {puedeQuitar && (
        <button type="button" aria-label={traducir("Quitar")} onClick={alQuitar}
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
  if (!info || !info.debe_pagar) return nota ? <p style={{ fontSize: 14, color: "#1E7B3A" }}><T>{nota}</T></p> : null
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
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}><T>Tu plan es Gratis: la verificación cuesta $</T>{info.precio} <T>(una sola vez)</T></p>
      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#40403A" }}>
        <T>Incluye la revisión de tu identidad, de tu empresa y de tus certificaciones. En los planes Taller, Pro e Industrial va incluida.
        Los talleres verificados y certificados aparecen mejor posicionados ante los clientes.</T>
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" style={S.btn} disabled={cargando} onClick={pagar}><T>{cargando ? "Abriendo Mercado Pago..." : `Pagar $${info.precio} con Mercado Pago`}</T></button>
        {nota && <span style={{ fontSize: 13, color: "#B3261E" }}><T>{nota}</T></span>}
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
      <h2 style={S.h2}><T>Certificaciones</T></h2>
      <p style={S.hint}>
        <T>ISO 9001, AS9100, IATF 16949, carta de distribuidor autorizado, certificación de soldadura… HETNA revisa el documento y, al aprobarlo,
        aparece en tu perfil como</T> <b><T>certificación acreditada</T></b><T>. Sube tu posicionamiento, no tu calificación (esa sólo sale de trabajos reales).</T>
      </p>
      {datos.certificaciones.length > 0 && (
        <div style={{ display: "grid", gap: 6, margin: "8px 0 12px" }}>
          {datos.certificaciones.map((c) => {
            const [bg, col, txt] = COLOR[c.estado] || COLOR.pendiente
            return (
              <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
                <b>{c.tipo === "otra" || c.tipo === "distribuidor" ? c.nombre || datos.tipos[c.tipo] : datos.tipos[c.tipo]}</b>
                {c.emisor && <span style={{ color: "#6B675C" }}>· <T>{c.emisor}</T></span>}
                {c.vigencia && <span style={{ color: "#6B675C" }}><T>· vence</T> <T>{c.vigencia}</T></span>}
                <span style={{ background: bg, color: col, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}><T>{txt}</T></span>
                {c.motivo && <span style={{ color: "#B3261E", fontSize: 13 }}><T>{c.motivo}</T></span>}
                <button type="button" style={{ ...S.btn2, padding: "2px 8px", fontSize: 12 }} onClick={() => quitar(c.id)}><T>Quitar</T></button>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={{ fontSize: 13 }}><T>Tipo</T>
          <select style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(datos.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {(f.tipo === "otra" || f.tipo === "distribuidor") && (
          <label style={{ fontSize: 13 }}><T>{f.tipo === "distribuidor" ? "Marca" : "Nombre"}</T>
            <input style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
        )}
        <label style={{ fontSize: 13 }}><T>Organismo que la emitió</T>
          <input style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.emisor} onChange={(e) => setF({ ...f, emisor: e.target.value })} placeholder={traducir("Ej. Bureau Veritas")} />
        </label>
        <label style={{ fontSize: 13 }}><T>Número de certificado</T>
          <input style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
        </label>
        <label style={{ fontSize: 13 }}><T>Vigente hasta</T>
          <input type="date" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} value={f.vigencia} onChange={(e) => setF({ ...f, vigencia: e.target.value })} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <label style={S.btn2}>
          <T>{archivo ? `📎 ${archivo.name}` : "+ Certificado (PDF o foto)"}</T>
          <input type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
        <button type="button" style={S.btn} disabled={enviando} onClick={enviar}><T>{enviando ? "Enviando..." : "Enviar a revisión"}</T></button>
        {nota && <span style={{ fontSize: 13, color: nota.ok ? "#1E7B3A" : "#B3261E" }}><T>{nota.t}</T></span>}
      </div>
    </section>
  )
}

// WhatsApp del taller: lo verifica escribiéndonos (él escribe primero) y así
// recibe por WhatsApp las solicitudes de su zona; además puede mandar por ahí las
// fotos de su taller para esta verificación (packages/api/src/lib/whatsapp.ts).
function WhatsappTaller() {
  const [e, setE] = useState(null)
  const [num, setNum] = useState("")
  const [liga, setLiga] = useState(null)
  const [codigo, setCodigo] = useState("")
  const [nota, setNota] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const pedir = async (cuerpo) => {
    const r = await fetch("/vendor/hetna-whatsapp", { method: cuerpo ? "POST" : "GET", credentials: "include", headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.message || `Error ${r.status}`)
    return d
  }
  const cargar = () => pedir().then(setE).catch(() => setE({ verificado: false }))
  useEffect(() => { cargar() }, [])
  // Mientras espera el mensaje, revisa cada 5 s si ya llegó
  useEffect(() => {
    if (!liga || e?.verificado) return
    const t = setInterval(cargar, 5000)
    return () => clearInterval(t)
  }, [liga, e?.verificado])
  const hacer = async (cuerpo, ok) => {
    setOcupado(true)
    setNota(null)
    try {
      const d = await pedir(cuerpo)
      if (cuerpo.accion === "iniciar") {
        setLiga(d.liga)
        if (d.liga) window.open(d.liga, "_blank", "noopener")
      }
      if (ok) setNota({ ok: true, t: ok })
      cargar()
    } catch (er) {
      setNota({ ok: false, t: er.message })
    } finally {
      setOcupado(false)
    }
  }
  if (!e) return null
  if (e.verificado)
    return (
      <section style={{ ...S.card, borderColor: "#BFE3CB", background: "#F3FBF6" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#1E7B3A" }}><T>✓ WhatsApp verificado: +</T><T>{e.numero}</T></p>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#40403A" }}>
          <T>Te avisamos por ahí de solicitudes de trabajo en tu zona.</T><T>{e.fotos ? ` Recibimos ${e.fotos} foto(s) de tu taller por WhatsApp.` : " Si quieres, mándanos por WhatsApp 3 fotos (frente del taller, tus máquinas y un trabajo terminado) y se agregan aquí."}</T>
          <T>{e.avisos === false ? " (Tienes los avisos en pausa: escribe ALTA al WhatsApp de HETNA para reactivarlos.)" : ""}</T>
        </p>
      </section>
    )
  return (
    <section style={S.card}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}><T>💬 Verifica tu WhatsApp y recibe trabajos ahí</T></p>
      <p style={{ margin: "4px 0 10px", fontSize: 14, color: "#40403A" }}>
        <T>Te avisamos de solicitudes en tu zona por WhatsApp (lo ves antes que el correo). Escribe tu celular y toca el botón: se abre WhatsApp con un mensaje listo para HETNA, sólo dale Enviar.</T>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={num} onChange={(x) => setNum(x.target.value)} placeholder={traducir("Celular a 10 dígitos")} inputMode="tel" style={{ padding: "8px 10px", border: "1px solid #E7E4DC", borderRadius: 8, fontSize: 14 }} />
        <button type="button" style={S.btn} disabled={ocupado || num.replace(/\D/g, "").length < 10} onClick={() => hacer({ accion: "iniciar", numero: num })}><T>Verificar mi WhatsApp</T></button>
      </div>
      {liga && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#40403A" }}>
          <p style={{ margin: 0 }}><T>Se abrió WhatsApp con el mensaje. Dale</T> <b><T>Enviar</T></b> <T>y esta tarjeta se pone en verde sola. ¿No se abrió?</T> <a href={liga} target="_blank" rel="noreferrer"><T>Ábrelo aquí</T></a>.</p>
          <p style={{ margin: "8px 0 4px" }}><T>¿Estás en la computadora? Te mandamos el código a tu WhatsApp y lo escribes aquí:</T></p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={S.btn2} disabled={ocupado} onClick={() => hacer({ accion: "codigo", numero: num }, "Te mandamos el código por WhatsApp.")}><T>Mandarme el código</T></button>
            <input value={codigo} onChange={(x) => setCodigo(x.target.value)} placeholder={traducir("Código de 6 dígitos")} inputMode="numeric" style={{ padding: "8px 10px", border: "1px solid #E7E4DC", borderRadius: 8, fontSize: 14, width: 150 }} />
            <button type="button" style={S.btn2} disabled={ocupado || codigo.length !== 6} onClick={() => hacer({ accion: "confirmar", numero: num, codigo }, "✓ WhatsApp verificado")}><T>Confirmar</T></button>
          </div>
        </div>
      )}
      {nota && <p style={{ margin: "8px 0 0", fontSize: 13, color: nota.ok ? "#1E7B3A" : "#B3261E" }}><T>{nota.t}</T></p>}
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

  if (error) return <div style={S.page}><T>No se pudo cargar:</T> <T>{error}</T><T>. Recarga la página.</T></div>
  if (!datos) return <div style={S.page}><T>Cargando...</T></div>

  const est = ESTADO[datos.estado] || ESTADO.sin_enviar
  const editable = !["en_revision", "verificado"].includes(datos.estado)

  return (
    <div style={S.page}>
      <h1 style={S.h1}><T>Verificación del taller</T></h1>
      <p style={S.sub}>
        <T>Los talleres verificados muestran la insignia</T> <b><T>✓ Taller verificado</T></b> <T>en su página y en sus productos.
        Así los clientes saben que eres un taller real.</T>
      </p>

      <WhatsappTaller />
      <PagoVerificacion />

      <section style={{ ...S.card, background: est.bg, borderColor: est.bg }}>
        <p style={{ margin: 0, fontWeight: 700, color: est.c, fontSize: 16 }}><T>{est.t}</T></p>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#40403A" }}><T>{est.d}</T></p>
        {datos.estado === "rechazado" && datos.motivo && (
          <p style={{ margin: "8px 0 0", fontSize: 14 }}><b><T>Qué corregir:</T></b> <T>{datos.motivo}</T></p>
        )}
      </section>

      {ORDEN.map((tipo) => {
        const t = datos.tipos[tipo]
        const mios = datos.archivos.filter((a) => a.tipo === tipo)
        const lleno = mios.length >= t.max
        return (
          <section key={tipo} style={S.card}>
            <h2 style={S.h2}>
              <T>{t.nombre}</T>
              {t.obligatorio > 0 && <span style={{ color: "#B3261E" }}> *</span>}
              <span style={{ fontWeight: 400, color: "#6B675C", fontSize: 13 }}> (<T>{mios.length}</T>/<T>{t.max}</T>)</span>
            </h2>
            <p style={S.hint}>{AYUDA[tipo]} <T>{t.pdf ? "Foto o PDF." : "Solo fotos."}</T> <T>Máximo</T> {MAX_MB} <T>MB.</T></p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {mios.map((a) => (
                <Miniatura key={a.id} archivo={a} puedeQuitar={editable} alQuitar={() => quitar(a.id)} />
              ))}
              {editable && !lleno && (
                <label style={S.btn2}>
                  <T>{subiendo === tipo ? "Subiendo..." : "+ Subir"}</T>
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
          <T>🔒 Tus documentos son privados. No se publican en la tienda: solo los ve el equipo de HETNA para verificar
          tu taller, según nuestro aviso de privacidad.</T>
        </p>
      </section>

      {editable && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <T>Autorizo a HETNA CNC a usar mi identificación oficial y las fotos de mi taller únicamente para verificar mi
            taller, conforme al</T> <a href="https://hetnacnc.com/mx/aviso-de-privacidad" target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}><T>Aviso de privacidad</T></a><T>.
            Puedo retirar esta autorización y pedir que se borren mis documentos en cualquier momento.</T>
          </span>
        </label>
      )}

      {editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="button" style={{ ...S.btn, opacity: enviando || datos.faltan.length || !autorizo ? 0.6 : 1 }}
            disabled={enviando || datos.faltan.length > 0 || !autorizo} onClick={enviar}>
            <T>{enviando ? "Enviando..." : "Enviar a revisión"}</T>
          </button>
          {datos.faltan.length > 0 && <span style={{ fontSize: 13, color: "#6B675C" }}><T>Falta:</T> <T>{datos.faltan.join(" · ")}</T></span>}
        </div>
      )}
      {msg && <p style={{ fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}><T>{msg.t}</T></p>}

      <Certificaciones />
    </div>
  )
}
