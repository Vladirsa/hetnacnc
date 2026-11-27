// @ts-nocheck
// Pantalla "Reclamos" del panel del taller (/seller > Reclamos).
// Los problemas que reportaron sus clientes en compras de la tienda: el taller
// responde con su versión y su evidencia dentro del plazo (3 días hábiles).
// Si no responde, el caso se resuelve a favor del cliente. HETNA decide.
// Ver packages/api/src/lib/reclamos-pedido.ts.
import { T, traducir } from "../../lib/idioma"
import { useCallback, useEffect, useRef, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Escudo = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
)

export const config: RouteConfig = {
  label: "Reclamos",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: Escudo,
}

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  card: { background: "rgba(255,255,255,0.78)", border: "1px solid rgba(20,32,51,0.06)", boxShadow: "0 8px 24px -12px rgba(20,32,51,0.18)", borderRadius: 16, padding: 18, marginBottom: 14 },
  meta: { color: "#6B675C", fontSize: 13, margin: "2px 0 0" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  caja: { background: "#F7F6F2", borderRadius: 10, padding: 12, marginTop: 10 },
}
const COLOR = {
  abierto: { c: "#8A5A00", bg: "#FFF6DB" },
  respondido: { c: "#1F4E8C", bg: "#E8F0FB" },
  resuelto: { c: "#1E7B3A", bg: "#E7F5EC" },
}
const fecha = (d) => (d ? new Date(d).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) : "—")

// Archivo privado: se baja con la sesión y se muestra como blob
function Archivo({ reclamoId, e }) {
  const [url, setUrl] = useState("")
  useEffect(() => {
    let creado = ""
    fetch(`/vendor/hetna-reclamos/${reclamoId}/archivos/${e.id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        creado = URL.createObjectURL(b)
        setUrl(creado)
      })
      .catch(() => setUrl(""))
    return () => creado && URL.revokeObjectURL(creado)
  }, [reclamoId, e.id])
  if (!url) return <div style={{ width: 112, height: 112, borderRadius: 8, background: "#EFECE4" }} />
  return e.mime.startsWith("video/") ? (
    <video src={url} controls style={{ width: 180, height: 112, borderRadius: 8, background: "#000" }} />
  ) : (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={traducir("Evidencia")} style={{ width: 112, height: 112, objectFit: "cover", borderRadius: 8, border: "1px solid #E7E4DC" }} />
    </a>
  )
}

function Galeria({ reclamoId, lista }) {
  if (!lista.length) return null
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {lista.map((e) => (
        <Archivo key={e.id} reclamoId={reclamoId} e={e} />
      ))}
    </div>
  )
}

function Responder({ r, maxMb, maxArchivos, alResponder }) {
  const [texto, setTexto] = useState("")
  const [archivos, setArchivos] = useState([])
  const [subiendo, setSubiendo] = useState("")
  const [msg, setMsg] = useState("")
  const [enviando, setEnviando] = useState(false)
  const input = useRef(null)

  async function subir(lista) {
    if (!lista?.length) return
    setMsg("")
    for (const f of Array.from(lista)) {
      if (archivos.length >= maxArchivos) break
      if (f.size > maxMb * 1024 * 1024) {
        setMsg(`«${f.name}» pesa más de ${maxMb} MB.`)
        continue
      }
      setSubiendo(f.name)
      const fd = new FormData()
      fd.append("archivo", f)
      try {
        const res = await fetch(`/vendor/hetna-reclamos/${r.id}/evidencia`, { method: "POST", credentials: "include", body: fd })
        const d = await res.json().catch(() => ({}))
        if (res.ok && d.id) setArchivos((a) => [...a, { id: d.id, nombre: f.name }])
        else setMsg(d.message || `No se pudo subir «${f.name}».`)
      } catch {
        setMsg(`No se pudo subir «${f.name}».`)
      }
    }
    setSubiendo("")
    if (input.current) input.current.value = ""
  }

  async function enviar() {
    if (texto.trim().length < 15) return setMsg("Escribe tu versión de lo que pasó (al menos una frase completa).")
    setEnviando(true)
    setMsg("")
    try {
      const res = await fetch(`/vendor/hetna-reclamos/${r.id}/responder`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuesta: texto, evidencias: archivos.map((a) => a.id) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || "No se pudo enviar.")
      alResponder()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ ...S.caja, background: "#fff", border: "1px solid #E7E4DC" }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#142033" }}><T>Tu respuesta</T></p>
      <p style={S.meta}>
        <T>Cuenta tu versión y sube tu evidencia: fotos del producto antes de enviarlo, del empaque, la guía, el comprobante de entrega. Sin correos, teléfonos ni
        redes: todo se resuelve dentro de HETNA.</T>
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        maxLength={3000}
        style={{ width: "100%", marginTop: 8, border: "1px solid #C9C5BA", borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "inherit" }}
      />
      <div style={{ marginTop: 8 }}>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          onChange={(e) => subir(e.target.files)}
          disabled={!!subiendo || enviando}
        />
        <p style={S.meta}><T>Fotos o videos · hasta</T> <T>{maxArchivos}</T><T>, máx.</T> <T>{maxMb}</T> <T>MB cada uno.</T></p>
        {subiendo && <p style={S.meta}><T>Subiendo «</T><T>{subiendo}</T>»…</p>}
        {archivos.length > 0 && <p style={S.meta}><T>Listos:</T> <T>{archivos.map((a) => a.nombre).join(", ")}</T></p>}
      </div>
      {msg && <p style={{ color: "#B3261E", fontSize: 13, margin: "8px 0 0" }}><T>{msg}</T></p>}
      <button type="button" onClick={enviar} disabled={enviando || !!subiendo} style={{ ...S.btn, marginTop: 10, opacity: enviando ? 0.6 : 1 }}>
        <T>{enviando ? "Enviando…" : "Enviar mi respuesta"}</T>
      </button>
    </div>
  )
}

export default function ReclamosPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const cargar = useCallback(() => {
    fetch("/vendor/hetna-reclamos", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setDatos)
      .catch(() => setError("No se pudieron cargar tus reclamos. Recarga la página."))
  }, [])
  useEffect(cargar, [cargar])

  if (error) return <div style={S.page}><p style={{ color: "#B3261E" }}><T>{error}</T></p></div>
  if (!datos) return <div style={S.page}><p style={S.meta}><T>Cargando…</T></p></div>

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px", color: "#142033", letterSpacing: "-0.02em" }}><T>Reclamos</T></h1>
      <p style={S.meta}>
        <T>Cuando un cliente reporta un problema, el pago de ese pedido se congela. Tienes</T> <T>{datos.dias_respuesta}</T> <T>días hábiles para responder con tu evidencia; si
        no respondes, el caso se resuelve a favor del cliente. HETNA revisa a los dos y decide: liberarte el pago, reembolso parcial o total. Si el reembolso
        procede por tu causa, se descuenta de tu saldo, igual que la guía de regreso.</T>
      </p>

      {datos.reclamos.length === 0 ? (
        <div style={{ ...S.card, marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}><T>No tienes reclamos. ¡Bien hecho!</T></p>
          <p style={S.meta}><T>Empaca bien y toma fotos de cada pedido antes de enviarlo: son tu mejor evidencia si algún día hay un reclamo.</T></p>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {datos.reclamos.map((r) => {
            const delCliente = r.evidencias.filter((e) => e.autor === "cliente")
            const tuyas = r.evidencias.filter((e) => e.autor === "taller")
            return (
              <div key={r.id} style={S.card}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <p style={{ margin: 0, fontWeight: 800, color: "#142033" }}>
                    <T>{r.folio}</T> <T>· Pedido #</T><T>{r.display_id ?? "—"}</T> · <T>{r.motivo_nombre}</T>
                  </p>
                  <span style={{ background: COLOR[r.estado]?.bg, color: COLOR[r.estado]?.c, borderRadius: 999, padding: "3px 10px", fontWeight: 700, fontSize: 12 }}>
                    <T>{r.estado === "abierto" ? "Esperando tu respuesta" : r.estado_nombre}</T>
                  </span>
                </div>
                {r.productos?.length > 0 && <p style={S.meta}><T>{r.productos.join(" · ")}</T></p>}
                <p style={S.meta}><T>Reportado el</T> {fecha(r.creado)}<T>{r.horas_desde_entrega != null ? ` (${r.horas_desde_entrega} h después de la entrega)` : ""}</T></p>

                <div style={S.caja}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#142033" }}><T>Lo que dice el cliente</T></p>
                  <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", fontSize: 14, color: "#40403A" }}><T>{r.detalle}</T></p>
                  <Galeria reclamoId={r.id} lista={delCliente} />
                </div>

                {r.respuesta_taller ? (
                  <div style={S.caja}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#142033" }}><T>Tu respuesta</T></p>
                    <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", fontSize: 14, color: "#40403A" }}><T>{r.respuesta_taller}</T></p>
                    <Galeria reclamoId={r.id} lista={tuyas} />
                  </div>
                ) : r.estado !== "resuelto" ? (
                  <>
                    <p style={{ ...S.meta, marginTop: 10, color: r.taller_no_respondio ? "#B3261E" : "#8A5A00", fontWeight: 600 }}>
                      <T>{r.taller_no_respondio
                        ? "Se acabó tu plazo para responder. Todavía puedes mandar tu versión, pero el caso puede resolverse a favor del cliente."
                        : `Responde antes del ${fecha(r.responder_antes)}.`}</T>
                    </p>
                    <Responder r={r} maxMb={datos.max_mb} maxArchivos={datos.max_evidencias} alResponder={cargar} />
                  </>
                ) : null}

                {r.estado === "resuelto" && (
                  <div style={{ ...S.caja, background: "#F3FAF5", border: "1px solid #CFE8D7" }}>
                    <p style={{ margin: 0, fontWeight: 800, color: "#1E7B3A" }}><T>Decisión de HETNA:</T> <T>{r.decision_nombre}</T></p>
                    {r.decision_nota && <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", fontSize: 14, color: "#40403A" }}><T>{r.decision_nota}</T></p>}
                    <p style={S.meta}><T>Los descuentos, si los hay, aparecen en Mi saldo.</T></p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
