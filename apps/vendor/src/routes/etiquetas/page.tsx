// @ts-nocheck
// "Etiquetas": el taller imprime etiquetas de sus productos en su impresora
// térmica (Zebra, TSC, Xprinter, Brother, Dymo…). Elige productos y cuántas
// de cada uno, la medida de la etiqueta y qué lleva (nombre, presentación,
// precio, SKU, código de barras, QR a su ficha, nombre del taller, texto
// libre). Imprime desde el navegador o descarga ZPL para Zebra.
// Motor: src/lib/etiquetas.ts · Datos: GET /vendor/hetna-etiquetas.
import { T, traducir } from "../../lib/idioma"
import { useEffect, useMemo, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

import { MEDIDAS, etiquetaSVG, etiquetaZPL, pesos } from "../../lib/etiquetas"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
)

export const config: RouteConfig = {
  label: "Etiquetas",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: Icono,
}

const S = {
  page: { maxWidth: 1180, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px", lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 16, alignItems: "start" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 14 },
  h2: { fontSize: 15, fontWeight: 700, margin: "0 0 10px" },
  label: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "6px 0" },
  input: { width: "100%", border: "1px solid #D9D5C9", borderRadius: 8, padding: "7px 9px", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  chip: (on) => ({ background: on ? "#142033" : "#F3F1EA", color: on ? "#fff" : "#40403A", border: 0, borderRadius: 999, padding: "6px 11px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }),
  err: { background: "#FDECEA", color: "#B3261E", borderRadius: 8, padding: "8px 12px", fontSize: 14 },
}

const GUARDADO = "hetna-etiquetas-diseno"
const DISENO_INICIAL = {
  medidaId: "50x30",
  ancho: 50,
  alto: 30,
  acomodo: "clasica",
  letra: 1,
  campos: { nombre: true, variante: true, precio: true, sku: true, barras: true, qr: false, taller: false, texto: "" },
}
const TIENDA = "https://hetnacnc.com/mx/products/"

export default function Etiquetas() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [buscar, setBuscar] = useState("")
  const [cantidades, setCantidades] = useState({}) // offer_id → número
  const [d, setD] = useState(() => {
    try {
      return { ...DISENO_INICIAL, ...JSON.parse(localStorage.getItem(GUARDADO) || "{}") }
    } catch {
      return DISENO_INICIAL
    }
  })

  useEffect(() => {
    fetch("/vendor/hetna-etiquetas", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.message || "No se pudieron cargar tus productos.")
        setDatos(j)
      })
      .catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(GUARDADO, JSON.stringify(d))
    } catch {}
  }, [d])

  const medida = d.medidaId === "otra" ? { id: "otra", nombre: "A la medida", ancho: Math.max(20, Math.min(150, Number(d.ancho) || 50)), alto: Math.max(10, Math.min(200, Number(d.alto) || 30)) } : MEDIDAS.find((m) => m.id === d.medidaId) || MEDIDAS[1]
  const diseno = { medida, campos: d.campos, acomodo: d.acomodo, letra: Number(d.letra) || 1 }
  const campo = (k, v) => setD((x) => ({ ...x, campos: { ...x.campos, [k]: v } }))

  const productos = datos?.productos || []
  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return q ? productos.filter((p) => `${p.titulo} ${p.variante} ${p.sku}`.toLowerCase().includes(q)) : productos
  }, [productos, buscar])
  const elegidos = productos.filter((p) => cantidades[p.offer_id] > 0)
  const total = elegidos.reduce((a, p) => a + cantidades[p.offer_id], 0)
  const aDatos = (p) => ({ titulo: p.titulo, variante: p.variante, precio: p.precio, sku: p.sku, liga: p.handle ? TIENDA + p.handle : "", taller: datos?.taller?.nombre || "" })
  const muestra = elegidos[0] || productos[0]

  const imprimir = () => {
    const etiquetas = elegidos.flatMap((p) => Array.from({ length: cantidades[p.offer_id] }, () => etiquetaSVG(aDatos(p), diseno)))
    const w = window.open("", "_blank")
    if (!w) return setError("Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.")
    w.document.write(`<!doctype html><html><head><title>Etiquetas</title><style>
      @page { size: ${medida.ancho}mm ${medida.alto}mm; margin: 0 }
      html, body { margin: 0; padding: 0 }
      .e { width: ${medida.ancho}mm; height: ${medida.alto}mm; overflow: hidden; page-break-after: always; break-after: page }
      .e svg { display: block }
    </style></head><body>${etiquetas.map((s) => `<div class="e">${s}</div>`).join("")}<script>window.onload = () => { window.focus(); window.print() }<\/script></body></html>`)
    w.document.close()
  }

  const zpl = () => {
    const texto = elegidos.map((p) => etiquetaZPL(aDatos(p), diseno, cantidades[p.offer_id])).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/plain" }))
    a.download = `etiquetas-${medida.ancho}x${medida.alto}.zpl`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}><T>Etiquetas de tus productos</T></h1>
      <p style={S.sub}>
        <T>Imprime etiquetas con nombre, precio, código de barras y QR a tu ficha en tu impresora de etiquetas (Zebra, TSC, Xprinter, Brother, Dymo…). Elige
        la medida de tu rollo, qué datos lleva y cuántas de cada producto. Tu diseño se guarda en este navegador.</T>
      </p>
      {error ? <div style={S.err}><T>{error}</T></div> : null}

      <div style={S.grid}>
        <div>
          <div style={S.card}>
            <h2 style={S.h2}><T>Medida de la etiqueta</T></h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MEDIDAS.map((m) => (
                <button key={m.id} type="button" style={S.chip(d.medidaId === m.id)} onClick={() => setD((x) => ({ ...x, medidaId: m.id }))}>
                  <T>{m.nombre}</T>
                </button>
              ))}
              <button type="button" style={S.chip(d.medidaId === "otra")} onClick={() => setD((x) => ({ ...x, medidaId: "otra" }))}>
                <T>Otra</T>
              </button>
            </div>
            {d.medidaId === "otra" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <label style={{ flex: 1, fontSize: 13 }}>
                  <T>Ancho (mm)</T>
                  <input style={S.input} inputMode="decimal" value={d.ancho} onChange={(e) => setD((x) => ({ ...x, ancho: e.target.value }))} />
                </label>
                <label style={{ flex: 1, fontSize: 13 }}>
                  <T>Alto (mm)</T>
                  <input style={S.input} inputMode="decimal" value={d.alto} onChange={(e) => setD((x) => ({ ...x, alto: e.target.value }))} />
                </label>
              </div>
            ) : null}
          </div>

          <div style={S.card}>
            <h2 style={S.h2}><T>Qué lleva</T></h2>
            {[
              ["nombre", "Nombre del producto"],
              ["variante", "Medida o presentación"],
              ["precio", "Precio"],
              ["barras", "Código de barras (del SKU)"],
              ["sku", "SKU en texto"],
              ["qr", "QR a tu ficha en HETNA"],
              ["taller", "Nombre de tu taller"],
            ].map(([k, t]) => (
              <label key={k} style={S.label}>
                <input type="checkbox" checked={!!d.campos[k]} onChange={(e) => campo(k, e.target.checked)} />
                <T>{t}</T>
              </label>
            ))}
            <label style={{ fontSize: 13, display: "block", marginTop: 8 }}>
              <T>Texto libre (opcional)</T>
              <input style={S.input} maxLength={40} placeholder={traducir("Hecho en México · Garantía 30 días")} value={d.campos.texto} onChange={(e) => campo("texto", e.target.value)} />
            </label>
          </div>

          <div style={S.card}>
            <h2 style={S.h2}><T>Diseño</T></h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                ["clasica", "Clásica"],
                ["qr-izquierda", "QR a la izquierda"],
                ["precio-grande", "Precio grande"],
              ].map(([k, t]) => (
                <button key={k} type="button" style={S.chip(d.acomodo === k)} onClick={() => setD((x) => ({ ...x, acomodo: k, campos: k === "qr-izquierda" ? { ...x.campos, qr: true } : x.campos }))}>
                  <T>{t}</T>
                </button>
              ))}
            </div>
            <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>
              <T>Tamaño de letra</T>
              <input type="range" min={0.7} max={1.4} step={0.05} value={d.letra} onChange={(e) => setD((x) => ({ ...x, letra: e.target.value }))} style={{ width: "100%" }} />
            </label>
          </div>

          <div style={S.card}>
            <h2 style={S.h2}><T>Vista previa</T></h2>
            {muestra ? (
              <div style={{ background: "#F3F1EA", borderRadius: 10, padding: 16, display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 320 }} dangerouslySetInnerHTML={{ __html: etiquetaSVG(aDatos(muestra), diseno, true).replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%"') }} />
              </div>
            ) : (
              <p style={S.sub}><T>Agrega productos para ver la etiqueta.</T></p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={{ ...S.btn, opacity: total ? 1 : 0.5 }} disabled={!total} onClick={imprimir}>
                <T>Imprimir</T> <T>{total ? `${total} etiqueta${total === 1 ? "" : "s"}` : ""}</T>
              </button>
              <button type="button" style={{ ...S.btn2, opacity: total ? 1 : 0.5 }} disabled={!total} onClick={zpl}>
                <T>Descargar ZPL (Zebra)</T>
              </button>
            </div>
            <p style={{ ...S.sub, fontSize: 12.5, margin: "10px 0 0" }}>
              <T>Al imprimir, elige tu impresora de etiquetas, el tamaño de papel</T> <T>{medida.ancho}</T> × <T>{medida.alto}</T> <T>mm y márgenes en «Ninguno». El ZPL se manda a
              una Zebra con Zebra Setup Utilities o arrastrándolo a su página de la impresora.</T>
            </p>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input style={S.input} placeholder={traducir("Buscar por nombre, medida o SKU")} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <button type="button" style={S.btn2} onClick={() => setCantidades((c) => ({ ...c, ...Object.fromEntries(visibles.map((p) => [p.offer_id, c[p.offer_id] || 1])) }))}>
              <T>Todos</T>
            </button>
            <button type="button" style={S.btn2} onClick={() => setCantidades({})}>
              <T>Ninguno</T>
            </button>
          </div>
          {!datos && !error ? <p style={S.sub}><T>Cargando tus productos…</T></p> : null}
          {datos && !productos.length ? <p style={S.sub}><T>Todavía no tienes productos publicados.</T></p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {visibles.map((p) => {
                const n = cantidades[p.offer_id] || 0
                return (
                  <tr key={p.offer_id} style={{ borderTop: "1px solid #F0EDE5" }}>
                    <td style={{ padding: "6px 4px", width: 26 }}>
                      <input type="checkbox" checked={n > 0} onChange={(e) => setCantidades((c) => ({ ...c, [p.offer_id]: e.target.checked ? 1 : 0 }))} />
                    </td>
                    <td style={{ padding: "6px 4px", width: 44 }}>
                      {p.imagen ? <img src={p.imagen} alt="" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 6 }} /> : null}
                    </td>
                    <td style={{ padding: "6px 4px", fontSize: 14 }}>
                      <div style={{ fontWeight: 600 }}><T>{p.titulo}</T></div>
                      <div style={{ color: "#6B675C", fontSize: 12.5 }}>
                        <T>{[p.variante, p.sku && `SKU ${p.sku}`, p.precio != null && pesos(p.precio)].filter(Boolean).join(" · ")}</T>
                      </div>
                    </td>
                    <td style={{ padding: "6px 4px", width: 84 }}>
                      <input
                        style={S.input}
                        inputMode="numeric"
                        aria-label={traducir("Cuántas etiquetas")}
                        value={n || ""}
                        placeholder="0"
                        onChange={(e) => setCantidades((c) => ({ ...c, [p.offer_id]: Math.max(0, Math.min(999, parseInt(e.target.value) || 0)) }))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
