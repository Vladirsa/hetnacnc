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
  ["acabado", "Acabado"], ["fecha", "Para cuándo"], ["frecuencia", "Frecuencia"], ["presupuesto", "Presupuesto"], ["acepta_envio", "Acepta envío"],
]

const pesos = (n) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MOTIVOS = [
  ["sin_capacidad", "No tengo capacidad ahora"],
  ["no_material", "No trabajo ese material"],
  ["no_servicio", "No hago ese proceso"],
  ["mas_info", "Necesito más información"],
]

const pesoLegible = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil((b || 0) / 1024)} KB`)

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
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "#C2560A", fontWeight: 600 }}>
                ⬇ {a.nombre} <span style={{ color: "#6B675C", fontWeight: 400 }}>({pesoLegible(a.tamano)})</span>
              </a>
            ) : (
              <span key={i} style={{ color: "#B3261E" }}>{a.nombre}: no disponible, intenta más tarde</span>
            )
          )}
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

  const cargar = () =>
    // ocultas=1: también las que el taller marcó como "no puedo"; se separan aquí.
    fetch("/vendor/hetna-solicitudes?ocultas=1", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setDatos(d.solicitudes || [])
        setCupo(d.cupo || null)
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
              </p>
            )}

            {p?.estado === "elegida" && <Pedido sol={s} alGuardar={cargar} />}

            {s.estado === "abierta" && !descartada(s) && (
              abierta === s.id ? (
                <FormPropuesta sol={s} alGuardar={() => { cargar(); setAbierta(null) }} />
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
