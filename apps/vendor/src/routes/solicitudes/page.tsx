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
  ["servicio", "Servicio"], ["material", "Material"], ["cantidad", "Cantidad"], ["medidas", "Medidas"],
  ["fecha", "Para cuándo"], ["frecuencia", "Frecuencia"], ["presupuesto", "Presupuesto"], ["acepta_envio", "Acepta envío"],
]

const pesos = (n) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function FormPropuesta({ sol, alGuardar }) {
  const p = sol.mi_propuesta
  const [f, setF] = useState({
    precio: p?.precio ?? "", dias: p?.dias ?? "", vigencia_dias: p?.vigencia_dias ?? 15,
    incluye_envio: p?.incluye_envio ?? false, condiciones: p?.condiciones ?? "",
  })
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
        body: JSON.stringify(f),
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
          <label style={S.label}>Precio total (MXN, con IVA)</label>
          <input style={S.input} inputMode="decimal" value={f.precio} onChange={(e) => set("precio", e.target.value)} placeholder="3500" />
        </div>
        <div>
          <label style={S.label}>Días de entrega</label>
          <input style={S.input} type="number" min="1" value={f.dias} onChange={(e) => set("dias", e.target.value)} placeholder="5" />
        </div>
        <div>
          <label style={S.label}>Vigencia (días)</label>
          <input style={S.input} type="number" min="1" value={f.vigencia_dias} onChange={(e) => set("vigencia_dias", e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "end" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={f.incluye_envio} onChange={(e) => set("incluye_envio", e.target.checked)} />
            El precio incluye envío
          </label>
        </div>
      </div>
      <label style={{ ...S.label, marginTop: 10 }}>Condiciones (anticipo, material incluido, acabado…)</label>
      <textarea style={S.area} value={f.condiciones} onChange={(e) => set("condiciones", e.target.value)} placeholder="Ej. 50% de anticipo. Incluye material MDF 6 mm y lijado." />
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

export default function SolicitudesPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [vista, setVista] = useState("nuevas")
  const [abierta, setAbierta] = useState(null)

  const cargar = () =>
    fetch("/vendor/hetna-solicitudes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setDatos(d.solicitudes || []))
      .catch((e) => setError("No se pudieron cargar las solicitudes (" + e + ")."))

  useEffect(() => {
    cargar()
  }, [])

  if (error) return <div style={S.page}>{error}</div>
  if (!datos) return <div style={S.page}>Cargando...</div>

  const nuevas = datos.filter((s) => s.estado === "abierta" && !s.mi_propuesta)
  const enviadas = datos.filter((s) => s.mi_propuesta)
  const lista = vista === "nuevas" ? nuevas : enviadas

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Solicitudes de fabricación</h1>
      <p style={S.sub}>
        Clientes que buscan taller. Manda tu precio y tiempo; el cliente compara y elige. Los talleres con membresía aparecen primero.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" style={S.tab(vista === "nuevas")} onClick={() => setVista("nuevas")}>Por cotizar ({nuevas.length})</button>
        <button type="button" style={S.tab(vista === "enviadas")} onClick={() => setVista("enviadas")}>Mis propuestas ({enviadas.length})</button>
      </div>

      {!lista.length && (
        <div style={{ ...S.card, textAlign: "center", color: "#6B675C" }}>
          {vista === "nuevas" ? "Por ahora no hay solicitudes nuevas. Te avisamos por correo cuando llegue una." : "Aún no has enviado propuestas."}
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
                {s.para_mi && <span style={S.tag("#FFF1E6", "#C2560A")}>Te eligieron a ti</span>}
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

            <p style={{ whiteSpace: "pre-line", margin: "10px 0", color: "#40403A" }}>{t.descripcion}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 13 }}>
              {CAMPOS.filter(([k]) => t[k]).map(([k, l]) => (
                <span key={k}><span style={{ color: "#6B675C" }}>{l}:</span> <strong>{t[k]}</strong></span>
              ))}
              {t.archivo && (
                <a href={t.archivo} target="_blank" rel="noopener noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>Ver archivos</a>
              )}
            </div>

            {p && (
              <p style={{ marginTop: 10, fontSize: 14 }}>
                Tu propuesta: <strong>{pesos(p.precio)}</strong> · {p.dias} días {p.incluye_envio ? "· envío incluido" : ""}
              </p>
            )}

            {s.estado === "abierta" && (
              abierta === s.id ? (
                <FormPropuesta sol={s} alGuardar={() => { cargar(); setAbierta(null) }} />
              ) : (
                <button type="button" style={{ ...S.btn2, marginTop: 10 }} onClick={() => setAbierta(s.id)}>
                  {p ? "Cambiar mi propuesta" : "Cotizar"}
                </button>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
