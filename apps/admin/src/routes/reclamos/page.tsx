// Pantalla "Reclamos" del dashboard: compras de la tienda con un problema
// reportado por el cliente ("Tengo un problema"). Se ve la evidencia de los
// dos, si el taller respondió a tiempo, y se decide: liberar al taller,
// reembolso total o parcial, y quién paga la guía de regreso.
// El reembolso al cliente se hace a mano en Mercado Pago o PayPal; aquí se
// mueve el saldo del taller (y se le descuenta si ya se le pagó) y se avisa a
// los dos por correo. Ver packages/api/src/lib/reclamos-pedido.ts.
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Evidencia = { id: string; autor: "cliente" | "taller"; mime: string; tamano: number; creado: string }
type Reclamo = {
  id: string
  folio: string
  order_id: string
  display_id: number | null
  motivo: string
  motivo_nombre: string
  detalle: string
  estado: "abierto" | "respondido" | "resuelto"
  estado_nombre: string
  creado: string
  horas_desde_entrega: number | null
  responder_antes: string | null
  respuesta_taller: string | null
  respondido_en: string | null
  taller_no_respondio: boolean
  decision: string | null
  decision_nombre: string | null
  monto_reembolso: number | null
  guia_paga: string | null
  decision_nota: string | null
  evidencias: Evidencia[]
  taller: string
  cliente_email: string | null
  productos: string[]
  saldo: { estado: string; moneda: string; neto: number; cobrado: number } | null
  saldo_estado_previo: string | null
  guia_sugerida: "taller" | "cliente"
}

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
const dinero = (n: number, m = "mxn") =>
  `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m.toUpperCase()}`
const fecha = (d: string | null) =>
  d ? new Date(d).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "24px 16px 80px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 12 },
  meta: { color: "#6B675C", fontSize: 13, margin: "2px 0 0" },
  caja: { background: "#F7F6F2", borderRadius: 10, padding: 12, marginTop: 10 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  input: { border: "1px solid #C9C5BA", borderRadius: 8, padding: "7px 10px", fontSize: 13 },
  tab: { border: "1px solid #C9C5BA", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#142033" },
}
const COLOR: Record<string, { c: string; bg: string }> = {
  abierto: { c: "#8A5A00", bg: "#FFF6DB" },
  respondido: { c: "#1F4E8C", bg: "#E8F0FB" },
  resuelto: { c: "#1E7B3A", bg: "#E7F5EC" },
}

// Archivo privado: se baja con la sesión y se muestra como blob
function Archivo({ reclamoId, e }: { reclamoId: string; e: Evidencia }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    let creado: string | null = null
    fetch(`/admin/hetna-reclamos-compras/${reclamoId}/archivos/${e.id}`, { credentials: "include", headers: cabeceras() })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (!vivo) return
        creado = URL.createObjectURL(b)
        setUrl(creado)
      })
      .catch(() => undefined)
    return () => {
      vivo = false
      if (creado) URL.revokeObjectURL(creado)
    }
  }, [reclamoId, e.id])
  if (!url) return <div style={{ width: 130, height: 110, borderRadius: 8, background: "#EFECE4" }} />
  return e.mime.startsWith("video/") ? (
    <video src={url} controls style={{ width: 200, height: 120, borderRadius: 8, background: "#000" }} />
  ) : (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Evidencia" style={{ width: 130, height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid #E7E4DC" }} />
    </a>
  )
}

function Galeria({ r, autor }: { r: Reclamo; autor: "cliente" | "taller" }) {
  const lista = r.evidencias.filter((e) => e.autor === autor)
  if (!lista.length) return <p style={S.meta}>Sin fotos ni video.</p>
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {lista.map((e) => (
        <Archivo key={e.id} reclamoId={r.id} e={e} />
      ))}
    </div>
  )
}

function Decidir({ r, alDecidir }: { r: Reclamo; alDecidir: () => void }) {
  // Si el taller no respondió a tiempo, la política dice: a favor del cliente
  const [decision, setDecision] = useState(r.taller_no_respondio ? "reembolso_total" : "")
  const [monto, setMonto] = useState("")
  const [guiaPaga, setGuiaPaga] = useState<"taller" | "cliente">(r.guia_sugerida)
  const [costoGuia, setCostoGuia] = useState("")
  const [nota, setNota] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const m = r.saldo?.moneda || "mxn"

  async function enviar() {
    if (!decision) return setMsg({ ok: false, t: "Elige la decisión." })
    if (decision === "reembolso_parcial" && !(Number(monto) > 0)) return setMsg({ ok: false, t: "Escribe el monto del reembolso parcial." })
    if (nota.trim().length < 10) return setMsg({ ok: false, t: "Escribe la explicación que verán el cliente y el taller." })
    setEnviando(true)
    setMsg(null)
    try {
      const res = await fetch(`/admin/hetna-reclamos-compras/${r.id}/decidir`, {
        method: "POST",
        credentials: "include",
        headers: { ...cabeceras(), "content-type": "application/json" },
        body: JSON.stringify({ decision, monto: Number(monto) || 0, guia_paga: guiaPaga, costo_guia: Number(costoGuia) || 0, nota }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || "No se pudo guardar.")
      setMsg({
        ok: true,
        t: `Listo. ${d.reembolso > 0 ? `Haz el reembolso de ${dinero(d.reembolso, m)} en Mercado Pago o PayPal. ` : ""}${
          d.descontado_taller > 0 ? `Se le descontó ${dinero(d.descontado_taller, m)} al taller.` : ""
        }`,
      })
      setTimeout(alDecidir, 2500)
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    } finally {
      setEnviando(false)
    }
  }

  const opcion = (v: string, t: string) => (
    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
      <input type="radio" name={`d-${r.id}`} checked={decision === v} onChange={() => setDecision(v)} /> {t}
    </label>
  )
  return (
    <div style={{ ...S.caja, background: "#fff", border: "1px solid #E7E4DC" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 800, color: "#142033" }}>Decisión de HETNA</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {opcion("liberar", "Liberar pago al taller")}
        {opcion("reembolso_total", "Reembolso total al cliente")}
        {opcion("reembolso_parcial", "Reembolso parcial")}
      </div>
      {decision === "reembolso_parcial" && (
        <div style={{ marginTop: 8 }}>
          <input style={S.input} inputMode="decimal" placeholder={`Monto (máx. ${r.saldo ? dinero(r.saldo.cobrado, m) : "—"})`} value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
      )}
      {decision && decision !== "liberar" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Guía de regreso la paga:</span>
          <select style={S.input} value={guiaPaga} onChange={(e) => setGuiaPaga(e.target.value as "taller" | "cliente")}>
            <option value="taller">El taller (la culpa fue suya)</option>
            <option value="cliente">El cliente (se arrepintió)</option>
          </select>
          {guiaPaga === "taller" && (
            <input style={{ ...S.input, width: 170 }} inputMode="decimal" placeholder="Costo de la guía (opcional)" value={costoGuia} onChange={(e) => setCostoGuia(e.target.value)} />
          )}
        </div>
      )}
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={3}
        placeholder="Explicación que verán el cliente y el taller"
        style={{ width: "100%", marginTop: 10, border: "1px solid #C9C5BA", borderRadius: 8, padding: 8, fontSize: 14, fontFamily: "inherit" }}
      />
      {msg && <p style={{ margin: "8px 0 0", fontSize: 13, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</p>}
      <button type="button" onClick={enviar} disabled={enviando} style={{ ...S.btn, marginTop: 10, opacity: enviando ? 0.6 : 1 }}>
        {enviando ? "Guardando…" : "Guardar decisión y avisar"}
      </button>
      <p style={S.meta}>
        Si el taller ya cobró este pedido, lo que se reembolse (y la guía, si la paga él) se le descuenta de sus siguientes ventas.
      </p>
    </div>
  )
}

export default function ReclamosPage() {
  const [filtro, setFiltro] = useState<"pendientes" | "resuelto">("pendientes")
  const [lista, setLista] = useState<Reclamo[] | null>(null)
  const [error, setError] = useState("")
  const cargar = useCallback(() => {
    setLista(null)
    fetch(`/admin/hetna-reclamos-compras${filtro === "resuelto" ? "?estado=resuelto" : ""}`, { credentials: "include", headers: cabeceras() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setLista(d.reclamos || []))
      .catch(() => setError("No se pudieron cargar los reclamos."))
  }, [filtro])
  useEffect(cargar, [cargar])

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: "#142033" }}>Reclamos de compras</h1>
      <p style={S.meta}>
        El pago al taller queda congelado mientras el reclamo está abierto. El taller tiene 3 días hábiles para responder; si no responde, se resuelve a
        favor del cliente. Revisa la evidencia de los dos y decide con justicia.
      </p>
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        {(["pendientes", "resuelto"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFiltro(f)} style={{ ...S.tab, ...(filtro === f ? { background: "#142033", color: "#fff", borderColor: "#142033" } : {}) }}>
            {f === "pendientes" ? "Por resolver" : "Resueltos"}
          </button>
        ))}
      </div>
      {error && <p style={{ color: "#B3261E" }}>{error}</p>}
      {!lista && !error && <p style={S.meta}>Cargando…</p>}
      {lista && lista.length === 0 && (
        <div style={S.card}>
          <p style={{ margin: 0, fontWeight: 600 }}>{filtro === "pendientes" ? "No hay reclamos por resolver." : "Todavía no hay reclamos resueltos."}</p>
        </div>
      )}
      {lista?.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <p style={{ margin: 0, fontWeight: 800, color: "#142033" }}>
              {r.folio} · Pedido #{r.display_id ?? "—"} · {r.motivo_nombre}
            </p>
            <span style={{ background: COLOR[r.estado]?.bg, color: COLOR[r.estado]?.c, borderRadius: 999, padding: "3px 10px", fontWeight: 700, fontSize: 12 }}>
              {r.estado_nombre}
            </span>
          </div>
          <p style={S.meta}>
            Taller: <strong>{r.taller}</strong> · Cliente: {r.cliente_email || "—"} · Reportado {fecha(r.creado)}
            {r.horas_desde_entrega != null ? ` · ${r.horas_desde_entrega} h después de la entrega` : " · sin entrega registrada"}
            {r.horas_desde_entrega != null && r.horas_desde_entrega > 48 && ["danado", "incompleto", "distinto"].includes(r.motivo) ? " (fuera de las 48 h)" : ""}
          </p>
          {r.productos.length > 0 && <p style={S.meta}>{r.productos.join(" · ")}</p>}
          {r.saldo && (
            <p style={S.meta}>
              Cobrado al cliente: {dinero(r.saldo.cobrado, r.saldo.moneda)} · Le toca al taller: {dinero(r.saldo.neto, r.saldo.moneda)} · Saldo hoy:{" "}
              {r.saldo.estado} (al abrir: {r.saldo_estado_previo || "—"})
            </p>
          )}

          <div style={S.caja}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Cliente</p>
            <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", fontSize: 14 }}>{r.detalle}</p>
            <Galeria r={r} autor="cliente" />
          </div>
          <div style={S.caja}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
              Taller{" "}
              {r.respuesta_taller ? (
                <span style={{ fontWeight: 400, color: "#6B675C" }}>· respondió {fecha(r.respondido_en)}</span>
              ) : r.taller_no_respondio ? (
                <span style={{ color: "#B3261E" }}>· NO respondió a tiempo (venció {fecha(r.responder_antes)})</span>
              ) : (
                <span style={{ fontWeight: 400, color: "#6B675C" }}>· tiene hasta {fecha(r.responder_antes)}</span>
              )}
            </p>
            {r.respuesta_taller ? (
              <>
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", fontSize: 14 }}>{r.respuesta_taller}</p>
                <Galeria r={r} autor="taller" />
              </>
            ) : null}
          </div>

          {r.estado === "resuelto" ? (
            <div style={{ ...S.caja, background: "#F3FAF5", border: "1px solid #CFE8D7" }}>
              <p style={{ margin: 0, fontWeight: 800, color: "#1E7B3A" }}>
                {r.decision_nombre}
                {r.monto_reembolso ? ` · ${dinero(r.monto_reembolso, r.saldo?.moneda)}` : ""}
                {r.guia_paga && r.decision !== "liberar" ? ` · guía: ${r.guia_paga}` : ""}
              </p>
              {r.decision_nota && <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", fontSize: 14 }}>{r.decision_nota}</p>}
            </div>
          ) : (
            <Decidir r={r} alDecidir={cargar} />
          )}
        </div>
      ))}
    </div>
  )
}

export const config = {
  label: "Reclamos de compras",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
}
