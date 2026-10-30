// @ts-nocheck
// Pantalla "Facturas" del panel del taller (/seller > Facturas).
// Los clientes que pidieron factura (CFDI) de sus pedidos. El taller la timbra
// con su propio sistema de facturación y aquí sube el PDF y el XML; el cliente
// los descarga desde su cuenta. Si no se puede emitir (datos que no cuadran con
// el SAT), se rechaza con el motivo y el cliente corrige y vuelve a pedirla.
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Hoja = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </svg>
)

export const config: RouteConfig = {
  label: "Facturas",
  icon: Hoja,
}

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 12 },
  meta: { color: "#6B675C", fontSize: 13, margin: "2px 0 0" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #C9C5BA", borderRadius: 8, padding: "7px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  dato: { display: "grid", gridTemplateColumns: "150px 1fr", gap: 6, fontSize: 13, padding: "3px 0" },
  error: { color: "#B3261E", fontSize: 13, margin: "8px 0 0" },
}

const ESTADO = {
  solicitada: { t: "Por emitir", c: "#8A5A00", bg: "#FFF6DB" },
  emitida: { t: "Emitida", c: "#1E7B3A", bg: "#E7F5EC" },
  rechazada: { t: "Rechazada", c: "#6B675C", bg: "#F3F1EA" },
}

const pesos = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`)

function Copiar({ texto }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1200) })}
      style={{ border: 0, background: "none", color: "#C2560A", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0, marginLeft: 6 }}
    >
      {ok ? "✓ copiado" : "copiar"}
    </button>
  )
}

function Solicitud({ f, alCambiar }) {
  const [pdf, setPdf] = useState(null)
  const [xml, setXml] = useState(null)
  const [rechazo, setRechazo] = useState("")
  const [modo, setModo] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState("")
  const est = ESTADO[f.estado] || ESTADO.solicitada
  const fi = f.fiscal || {}

  const subir = async () => {
    setError("")
    setTrabajando(true)
    try {
      const fd = new FormData()
      fd.append("pdf", pdf)
      fd.append("xml", xml)
      const r = await fetch(`/vendor/hetna-facturas/${f.id}`, { method: "POST", credentials: "include", body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo subir la factura.")
      await alCambiar()
    } catch (e) {
      setError(e.message)
    } finally {
      setTrabajando(false)
    }
  }
  const rechazar = async () => {
    setError("")
    setTrabajando(true)
    try {
      const r = await fetch(`/vendor/hetna-facturas/${f.id}/rechazar`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nota: rechazo }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo rechazar.")
      await alCambiar()
    } catch (e) {
      setError(e.message)
    } finally {
      setTrabajando(false)
    }
  }
  const abrir = async (tipo) => {
    const r = await fetch(`/vendor/hetna-facturas/${f.id}/archivo?tipo=${tipo}`, { credentials: "include" })
    const d = await r.json().catch(() => ({}))
    if (d.url) window.open(d.url, "_blank", "noopener")
    else setError(d.message || "No se pudo abrir.")
  }

  return (
    <section style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
            Pedido #{f.display_id} <span style={{ fontWeight: 400, color: "#6B675C", fontSize: 13 }}>· {pesos(f.total)} · {new Date(f.created_at).toLocaleDateString("es-MX")}</span>
          </p>
          {f.nota && <p style={S.meta}>Motivo: {f.nota}</p>}
        </div>
        <span style={{ background: est.bg, color: est.c, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, height: "fit-content" }}>{est.t}</span>
      </div>

      <div style={{ background: "#F7F5F0", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <div style={S.dato}><span style={{ color: "#6B675C" }}>RFC</span><span><b>{fi.rfc}</b><Copiar texto={fi.rfc} /></span></div>
        <div style={S.dato}><span style={{ color: "#6B675C" }}>Razón social</span><span>{fi.razon_social}<Copiar texto={fi.razon_social} /></span></div>
        <div style={S.dato}><span style={{ color: "#6B675C" }}>Régimen fiscal</span><span>{fi.regimen} · {fi.regimen_nombre}</span></div>
        <div style={S.dato}><span style={{ color: "#6B675C" }}>C.P. fiscal</span><span>{fi.cp}<Copiar texto={fi.cp} /></span></div>
        <div style={S.dato}><span style={{ color: "#6B675C" }}>Uso del CFDI</span><span>{fi.uso_cfdi} · {fi.uso_nombre}</span></div>
      </div>

      {f.estado === "emitida" ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" style={S.btn2} onClick={() => abrir("pdf")}>Ver PDF</button>
          <button type="button" style={S.btn2} onClick={() => abrir("xml")}>Ver XML</button>
        </div>
      ) : f.estado === "solicitada" ? (
        <>
          {modo === "" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={S.btn} onClick={() => setModo("subir")}>Subir factura</button>
              <button type="button" style={S.btn2} onClick={() => setModo("rechazar")}>No puedo emitirla</button>
            </div>
          )}
          {modo === "subir" && (
            <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13 }}>
              <label>PDF de la factura <input type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} style={{ marginLeft: 8 }} /></label>
              <label>XML del CFDI <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => setXml(e.target.files?.[0] || null)} style={{ marginLeft: 8 }} /></label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={{ ...S.btn, opacity: pdf && xml ? 1 : 0.5 }} disabled={!pdf || !xml || trabajando} onClick={subir}>
                  {trabajando ? "Subiendo…" : "Enviar al cliente"}
                </button>
                <button type="button" style={S.btn2} onClick={() => setModo("")}>Cancelar</button>
              </div>
            </div>
          )}
          {modo === "rechazar" && (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <input value={rechazo} onChange={(e) => setRechazo(e.target.value)} maxLength={300} placeholder="Motivo (ej. el RFC no coincide con la razón social en el SAT)"
                style={{ border: "1px solid #C9C5BA", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={S.btn} disabled={rechazo.trim().length < 5 || trabajando} onClick={rechazar}>Avisar al cliente</button>
                <button type="button" style={S.btn2} onClick={() => setModo("")}>Cancelar</button>
              </div>
            </div>
          )}
        </>
      ) : null}
      {error && <p style={S.error}>{error}</p>}
    </section>
  )
}

export default function FacturasPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [ver, setVer] = useState("solicitada")

  const cargar = () =>
    fetch("/vendor/hetna-facturas", { credentials: "include" })
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.message || `Error ${r.status}`)))))
      .then((d) => {
        setDatos(d.facturas || [])
        setError("")
      })
      .catch((e) => setError(e.message))

  useEffect(() => {
    cargar()
  }, [])

  if (error) return <div style={S.page}>No se pudo cargar: {error}. Recarga la página.</div>
  if (!datos) return <div style={S.page}>Cargando…</div>
  const visibles = ver ? datos.filter((f) => f.estado === ver) : datos
  const porEmitir = datos.filter((f) => f.estado === "solicitada").length

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Facturas</h1>
      <p style={{ color: "#6B675C", fontSize: 14, margin: "4px 0 20px", lineHeight: 1.5 }}>
        Clientes que pidieron factura (CFDI) de sus compras. Timbra la factura con tu sistema de facturación usando estos datos y sube aquí el
        PDF y el XML: el cliente los descarga desde su cuenta. Revisamos que el XML sea un CFDI a nombre del RFC del cliente.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["solicitada", `Por emitir (${porEmitir})`], ["emitida", "Emitidas"], ["", "Todas"]].map(([v, t]) => (
          <button key={v} type="button" style={ver === v ? S.btn : S.btn2} onClick={() => setVer(v)}>{t}</button>
        ))}
      </div>
      {!visibles.length && <section style={S.card}>{ver === "solicitada" ? "No tienes facturas por emitir. 🎉" : "Todavía no hay facturas aquí."}</section>}
      {visibles.map((f) => (
        <Solicitud key={f.id} f={f} alCambiar={cargar} />
      ))}
    </div>
  )
}
