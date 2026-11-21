// Pantalla "Precios calculadora" del dashboard (menú lateral).
// Aquí el dueño ajusta a su gusto los números con que la calculadora de
// hetnacnc.com calcula el precio aproximado: margen, costo por hora de cada
// máquina, preparación, velocidad, operador, gastos fijos y precio de los
// materiales. Los usan /cotizar, "Fabrícalo con un taller", las calculadoras
// de /cotizar/*, el correo del estimado y el asistente de IA
// (packages/api/src/lib/precios-config.ts). Vacío = valor de fábrica.
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Maq = { costoHora?: number; prep?: number; velocidadPct?: number }
type Cfg = {
  maquinas?: Record<string, Maq>
  operadorHora?: number
  fijosHora?: number
  margenPct?: number
  markupMaterialPct?: number
  rangoPct?: number
  preciosMaterial?: Record<string, number>
}
type Datos = {
  guardado: Cfg
  fabrica: Required<Cfg> & { maquinas: Record<string, Required<Maq>> }
  actualizado: string | null
  maquinas: { clave: string; nombre: string }[]
  materiales: { nombre: string; unidad: "hoja" | "kg" }[]
  ejemplos: { nombre: string; precio: number | null }[]
}

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

const S: Record<string, CSSProperties> = {
  pagina: { padding: 24, maxWidth: 1000, fontFamily: "Inter, system-ui, sans-serif", color: "#1B1B18" },
  caja: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 18, marginTop: 16 },
  h2: { fontSize: 16, fontWeight: 700, margin: "0 0 4px" },
  ayuda: { fontSize: 13, color: "#6B675C", margin: "0 0 12px" },
  rejilla: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", minHeight: 38, border: "1px solid #D9D5CB", borderRadius: 8, padding: "0 10px", fontSize: 14, boxSizing: "border-box" },
  th: { textAlign: "left", fontSize: 12, color: "#6B675C", fontWeight: 600, padding: "6px 8px" },
  td: { padding: "4px 8px", fontSize: 14 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  btn2: { background: "#fff", color: "#1B1B18", border: "1px solid #D9D5CB", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
}

const pesos = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }))
// Lo que se escribe se guarda como texto; vacío = valor de fábrica
const txt = (v: unknown) => (v == null ? "" : String(v))

export default function PreciosCalculadora() {
  const [d, setD] = useState<Datos | null>(null)
  const [f, setF] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState("")
  const [error, setError] = useState("")

  const llenar = (g: Cfg) => {
    const x: Record<string, string> = {
      margenPct: txt(g.margenPct),
      operadorHora: txt(g.operadorHora),
      fijosHora: txt(g.fijosHora),
      markupMaterialPct: txt(g.markupMaterialPct),
      rangoPct: txt(g.rangoPct),
    }
    for (const [k, m] of Object.entries(g.maquinas || {})) {
      x[`maq.${k}.costoHora`] = txt(m.costoHora)
      x[`maq.${k}.prep`] = txt(m.prep)
      x[`maq.${k}.velocidadPct`] = txt(m.velocidadPct)
    }
    for (const [k, v] of Object.entries(g.preciosMaterial || {})) x[`mat.${k}`] = txt(v)
    setF(x)
  }

  const cargar = async () => {
    setError("")
    const r = await fetch("/admin/hetna-precios", { credentials: "include", headers: cabeceras() })
    const j = await r.json().catch(() => null)
    if (!r.ok || !j) return setError("No se pudieron cargar los precios.")
    setD(j)
    llenar(j.guardado || {})
  }
  useEffect(() => {
    cargar()
  }, [])

  const armar = (): Cfg => {
    const n = (v?: string) => (v == null || v.trim() === "" ? undefined : Number(v.replace(",", ".")))
    const cfg: Cfg = {
      margenPct: n(f.margenPct),
      operadorHora: n(f.operadorHora),
      fijosHora: n(f.fijosHora),
      markupMaterialPct: n(f.markupMaterialPct),
      rangoPct: n(f.rangoPct),
      maquinas: {},
      preciosMaterial: {},
    }
    for (const m of d?.maquinas || []) {
      const x = { costoHora: n(f[`maq.${m.clave}.costoHora`]), prep: n(f[`maq.${m.clave}.prep`]), velocidadPct: n(f[`maq.${m.clave}.velocidadPct`]) }
      if (x.costoHora != null || x.prep != null || x.velocidadPct != null) cfg.maquinas![m.clave] = x
    }
    for (const m of d?.materiales || []) {
      const v = n(f[`mat.${m.nombre}`])
      if (v != null) cfg.preciosMaterial![m.nombre] = v
    }
    return cfg
  }

  const guardar = async (cfg: Cfg) => {
    setEstado("guardando")
    setError("")
    const r = await fetch("/admin/hetna-precios", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...cabeceras() },
      body: JSON.stringify(cfg),
    })
    const j = await r.json().catch(() => null)
    setEstado("")
    if (!r.ok || !j) return setError("No se pudo guardar. Intenta de nuevo.")
    setD((x) => (x ? { ...x, guardado: j.guardado, ejemplos: j.ejemplos, actualizado: new Date().toISOString() } : x))
    llenar(j.guardado || {})
    setEstado("guardado")
    setTimeout(() => setEstado(""), 3000)
  }

  if (error && !d) return <div style={S.pagina}>{error}</div>
  if (!d) return <div style={S.pagina}>Cargando…</div>
  const fab = d.fabrica

  const campo = (clave: string, etiqueta: string, porDefecto: number | undefined, unidad = "") => (
    <div>
      <label style={S.label} htmlFor={clave}>
        {etiqueta}
      </label>
      <input
        id={clave}
        style={S.input}
        inputMode="decimal"
        value={f[clave] ?? ""}
        placeholder={`${porDefecto ?? ""}${unidad ? ` ${unidad}` : ""} (fábrica)`}
        onChange={(e) => setF((x) => ({ ...x, [clave]: e.target.value }))}
      />
    </div>
  )

  return (
    <div style={S.pagina}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Precios de la calculadora</h1>
      <p style={{ ...S.ayuda, marginTop: 6 }}>
        Ajusta a tu gusto cómo calcula el precio aproximado la calculadora del sitio. Deja un campo vacío para usar el valor de fábrica (el gris). El precio
        final siempre lo dan los talleres en sus propuestas.
        {d.actualizado ? ` Último cambio: ${new Date(d.actualizado).toLocaleString("es-MX")}.` : ""}
      </p>

      <div style={S.caja}>
        <h2 style={S.h2}>Así quedan algunos precios</h2>
        <p style={S.ayuda}>Con lo que tienes guardado (más IVA). Guarda para ver cómo cambian.</p>
        <div style={S.rejilla}>
          {d.ejemplos.map((e) => (
            <div key={e.nombre} style={{ background: "#F7F6F2", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12.5, color: "#6B675C" }}>{e.nombre}</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{pesos(e.precio)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.caja}>
        <h2 style={S.h2}>General</h2>
        <p style={S.ayuda}>
          Precio = (material + máquina + operador + preparación + gastos fijos) ÷ (1 − margen). El rango es lo que se muestra arriba y abajo del precio.
        </p>
        <div style={S.rejilla}>
          {campo("margenPct", "Margen de utilidad (%)", fab.margenPct, "%")}
          {campo("operadorHora", "Operador ($ por hora)", fab.operadorHora)}
          {campo("fijosHora", "Gastos fijos ($ por hora)", fab.fijosHora)}
          {campo("markupMaterialPct", "Recargo al material (%)", fab.markupMaterialPct, "%")}
          {campo("rangoPct", "Rango mostrado (± %)", fab.rangoPct, "%")}
        </div>
      </div>

      <div style={S.caja}>
        <h2 style={S.h2}>Máquinas</h2>
        <p style={S.ayuda}>
          Costo por hora de la máquina (luz, desgaste, refacciones), minutos de preparación por pedido y velocidad: 100 % es la de referencia, 120 % corta
          20 % más rápido.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={S.th}>Máquina</th>
                <th style={S.th}>$ por hora</th>
                <th style={S.th}>Preparación (min)</th>
                <th style={S.th}>Velocidad (%)</th>
              </tr>
            </thead>
            <tbody>
              {d.maquinas.map((m) => (
                <tr key={m.clave} style={{ borderTop: "1px solid #F1EFE9" }}>
                  <td style={S.td}>{m.nombre}</td>
                  {(["costoHora", "prep", "velocidadPct"] as const).map((k) => (
                    <td key={k} style={S.td}>
                      <input
                        aria-label={`${m.nombre}: ${k}`}
                        style={S.input}
                        inputMode="decimal"
                        value={f[`maq.${m.clave}.${k}`] ?? ""}
                        placeholder={String(fab.maquinas[m.clave]?.[k] ?? "")}
                        onChange={(e) => setF((x) => ({ ...x, [`maq.${m.clave}.${k}`]: e.target.value }))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.caja}>
        <h2 style={S.h2}>Materiales</h2>
        <p style={S.ayuda}>
          Precio por hoja o por kilo. Si lo dejas vacío se usa el precio de mercado que mide el agente de precios (o el de fábrica si aún no hay).
        </p>
        <div style={S.rejilla}>
          {d.materiales.map((m) => (
            <div key={m.nombre}>
              <label style={S.label} htmlFor={`mat-${m.nombre}`}>
                {m.nombre} <span style={{ fontWeight: 400, color: "#6B675C" }}>({m.unidad === "kg" ? "$ por kg" : "$ por hoja"})</span>
              </label>
              <input
                id={`mat-${m.nombre}`}
                style={S.input}
                inputMode="decimal"
                value={f[`mat.${m.nombre}`] ?? ""}
                placeholder={`${fab.preciosMaterial[m.nombre] ?? ""} (fábrica)`}
                onChange={(e) => setF((x) => ({ ...x, [`mat.${m.nombre}`]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" style={S.btn} disabled={estado === "guardando"} onClick={() => guardar(armar())}>
          {estado === "guardando" ? "Guardando…" : "Guardar precios"}
        </button>
        <button
          type="button"
          style={S.btn2}
          onClick={() => {
            if (window.confirm("¿Volver todos los precios a los valores de fábrica?")) guardar({})
          }}
        >
          Volver a valores de fábrica
        </button>
        {estado === "guardado" && <span style={{ color: "#1E7B3A", fontWeight: 600 }}>✓ Guardado. La calculadora ya usa estos precios (en menos de un minuto).</span>}
        {error && <span style={{ color: "#B3261E" }}>{error}</span>}
      </div>
    </div>
  )
}

export const config = {
  label: "Precios calculadora",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
}
