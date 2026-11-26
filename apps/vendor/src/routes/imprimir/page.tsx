// @ts-nocheck
// "Imprime diseños HETNA": el taller con impresora 3D elige qué diseños de
// Impresión 3D bajo pedido vende, en qué materiales, a qué precio, en cuántos
// días y en qué colores. Cada material que activa es una OFERTA suya en la
// tienda. También puede destacarse ($150 por 30 días) para salir primero.
// Backend: packages/api/src/api/vendor/hetna-impresion (lib/impresion-*.ts).
import { useEffect, useMemo, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 9V3h12v6" />
    <rect x="3" y="9" width="18" height="9" rx="2" />
    <path d="M7 18v3h10v-3" />
  </svg>
)

export const config: RouteConfig = {
  label: "Imprime diseños HETNA",
  icon: Icono,
}

const S = {
  page: { maxWidth: 1040, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px", lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 14 },
  dest: { background: "#FFF7EC", border: "1px solid #F2C98F", borderRadius: 12, padding: 16, marginBottom: 18 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  input: { width: "100%", border: "1px solid #D9D5C9", borderRadius: 8, padding: "7px 9px", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  th: { textAlign: "left", fontSize: 12, color: "#6B675C", fontWeight: 600, padding: "6px 6px" },
  td: { padding: "6px 6px", verticalAlign: "middle", fontSize: 14 },
  ok: { background: "#E6F4EA", color: "#1E7B3A", borderRadius: 8, padding: "8px 12px", fontSize: 14, margin: "8px 0" },
  err: { background: "#FDECEA", color: "#B3261E", borderRadius: 8, padding: "8px 12px", fontSize: 14, margin: "8px 0" },
}

const pesos = (n) => (n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }))
const fecha = (iso) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })

async function api(ruta = "", init = {}) {
  const r = await fetch(`/vendor/hetna-impresion${ruta}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message || "No se pudo completar.")
  return j
}

// Lo que el taller escribe en cada fila, antes de guardar
const filaDe = (m) => ({
  activa: !!m.oferta,
  precio: m.oferta?.precio ?? m.recomendado ?? "",
  dias: m.oferta?.dias ?? 3,
  colores: (m.oferta?.colores || []).join(", "),
})

function Diseno({ d, alGuardar }) {
  const [filas, setFilas] = useState(() => Object.fromEntries(d.materiales.map((m) => [m.variant_id, filaDe(m)])))
  const [estado, setEstado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const cambiar = (id, k, v) => setFilas((f) => ({ ...f, [id]: { ...f[id], [k]: v } }))
  const cambios = d.materiales.filter((m) => {
    const a = filaDe(m), b = filas[m.variant_id]
    return a.activa !== b.activa || (b.activa && (String(a.precio) !== String(b.precio) || String(a.dias) !== String(b.dias) || a.colores !== b.colores))
  })

  const guardar = async () => {
    setGuardando(true)
    setEstado(null)
    try {
      const ofertas = cambios.map((m) => {
        const f = filas[m.variant_id]
        return { variant_id: m.variant_id, activa: f.activa, precio: f.precio, dias: f.dias, colores: f.colores }
      })
      await api("", { method: "POST", body: JSON.stringify({ ofertas }) })
      setEstado({ ok: "Listo: tus precios ya están en la tienda." })
      alGuardar()
    } catch (e) {
      setEstado({ err: e.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {d.imagen ? <img src={d.imagen} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, background: "#F3F1EA" }} /> : null}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{d.titulo}</div>
          {d.medidas_mm ? <div style={{ color: "#6B675C", fontSize: 13 }}>Pieza de {d.medidas_mm.map((x) => Math.round(x)).join(" × ")} mm</div> : null}
          <a href={`https://hetnacnc.com/mx/products/${d.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#C2560A" }}>
            Ver la ficha en la tienda
          </a>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={S.th}>Lo imprimo</th>
              <th style={S.th}>Material</th>
              <th style={S.th}>Gramos</th>
              <th style={S.th}>Recomendado</th>
              <th style={S.th}>Tu precio final</th>
              <th style={S.th}>Días hábiles</th>
              <th style={S.th}>Colores (separa con coma)</th>
            </tr>
          </thead>
          <tbody>
            {d.materiales.map((m) => {
              const f = filas[m.variant_id]
              return (
                <tr key={m.variant_id} style={{ borderTop: "1px solid #F0EDE5", opacity: f.activa ? 1 : 0.65 }}>
                  <td style={S.td}>
                    <input type="checkbox" checked={f.activa} onChange={(e) => cambiar(m.variant_id, "activa", e.target.checked)} />
                  </td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{m.material}</td>
                  <td style={S.td}>{m.gramos ? `${m.gramos} g` : "—"}</td>
                  <td style={S.td}>{pesos(m.recomendado)}</td>
                  <td style={{ ...S.td, width: 120 }}>
                    <input style={S.input} inputMode="decimal" disabled={!f.activa} value={f.precio} onChange={(e) => cambiar(m.variant_id, "precio", e.target.value)} />
                  </td>
                  <td style={{ ...S.td, width: 90 }}>
                    <input style={S.input} inputMode="numeric" disabled={!f.activa} value={f.dias} onChange={(e) => cambiar(m.variant_id, "dias", e.target.value)} />
                  </td>
                  <td style={S.td}>
                    <input style={S.input} disabled={!f.activa} placeholder={m.dos_colores ? "Al menos 2: Negro, Blanco, Rojo" : "Negro, Blanco"} value={f.colores} onChange={(e) => cambiar(m.variant_id, "colores", e.target.value)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {estado?.ok ? <div style={S.ok}>{estado.ok}</div> : null}
      {estado?.err ? <div style={S.err}>{estado.err}</div> : null}
      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ ...S.btn, opacity: cambios.length && !guardando ? 1 : 0.5 }} disabled={!cambios.length || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {cambios.length ? <span style={{ fontSize: 13, color: "#6B675C" }}>{cambios.length} cambio(s) sin guardar</span> : null}
      </div>
    </div>
  )
}

export default function ImprimirDisenos() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState(null)
  const [pagando, setPagando] = useState(false)

  const cargar = () =>
    api()
      .then(setDatos)
      .catch((e) => setError(e.message))

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const pagoId = q.get("payment_id") || q.get("collection_id")
    if (pagoId) {
      api("/destacado", { method: "POST", body: JSON.stringify({ payment_id: pagoId }) })
        .then((r) => setAviso(r.ok ? { ok: `¡Listo! Eres taller destacado hasta el ${fecha(r.hasta)}.` } : { err: r.motivo || "El pago todavía no se aprueba." }))
        .catch((e) => setAviso({ err: e.message }))
        .finally(() => {
          window.history.replaceState(null, "", window.location.pathname)
          cargar()
        })
    } else {
      if (q.get("pago") === "error") setAviso({ err: "El pago no se completó. Puedes intentarlo de nuevo." })
      cargar()
    }
  }, [])

  const destacar = async () => {
    setPagando(true)
    try {
      const r = await api("/destacado", { method: "POST", body: "{}" })
      if (r.url) window.location.href = r.url
    } catch (e) {
      setAviso({ err: e.message })
      setPagando(false)
    }
  }

  const activas = useMemo(() => (datos?.disenos || []).reduce((n, d) => n + d.materiales.filter((m) => m.oferta).length, 0), [datos])

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Imprime diseños HETNA</h1>
      <p style={S.sub}>
        Diseños listos para imprimir en 3D que ya están en la tienda. Elige cuáles imprimes, en qué material, a qué precio, en cuántos días y en qué
        colores. Cada material que actives es una oferta tuya: el cliente compara talleres y te compra a ti. El precio recomendado sale del volumen real
        de la pieza; tú pones el tuyo. Es el precio final que paga el cliente (con IVA), sin el envío.
      </p>
      <p style={S.sub}>
        <b>¿Tienes impresora multicolor (AMS, MMU)?</b> Las piezas de dos partes (llaveros, letras, texturizadores…) tienen los materiales
        "· 2 colores": pon ahí tu precio y al menos dos colores. El cliente elige el color de cada parte y lo ves en la página del pedido.
      </p>

      {aviso?.ok ? <div style={S.ok}>{aviso.ok}</div> : null}
      {aviso?.err ? <div style={S.err}>{aviso.err}</div> : null}

      {datos ? (
        <div style={S.dest}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>⭐ Sal primero: taller destacado</div>
          <p style={{ ...S.sub, margin: "6px 0 10px" }}>
            Por {pesos(datos.destacado.precio)} cada {datos.destacado.dias} días sales primero, con la insignia <b>Destacado</b>, en todas las fichas de
            impresión bajo pedido donde tengas oferta. Pago único con Mercado Pago; no se renueva solo.
          </p>
          {datos.destacado.hasta ? (
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              Eres destacado hasta el <b>{fecha(datos.destacado.hasta)}</b>. Si pagas otra vez, se suman {datos.destacado.dias} días.
            </div>
          ) : null}
          <button style={{ ...S.btn, opacity: pagando ? 0.6 : 1 }} disabled={pagando} onClick={destacar}>
            {pagando ? "Abriendo Mercado Pago…" : datos.destacado.hasta ? `Sumar ${datos.destacado.dias} días` : `Destacarme por ${pesos(datos.destacado.precio)}`}
          </button>
          {!activas ? <div style={{ fontSize: 13, color: "#8A5A00", marginTop: 8 }}>Primero activa al menos un material abajo: el destacado sólo se ve donde tienes oferta.</div> : null}
        </div>
      ) : null}

      {error ? <div style={S.err}>{error}</div> : null}
      {!datos && !error ? <p style={S.sub}>Cargando…</p> : null}
      {datos && !datos.disenos.length ? <p style={S.sub}>Todavía no hay diseños publicados. Pronto habrá.</p> : null}
      {(datos?.disenos || []).map((d) => (
        <Diseno key={d.id} d={d} alGuardar={cargar} />
      ))}
    </div>
  )
}
