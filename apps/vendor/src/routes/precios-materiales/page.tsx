// Panel del taller > Precios de materiales: base de datos que llena el agente
// «Monitor de precios» (packages/api/src/lib/materiales-precios.ts) con precios
// públicos de tiendas y distribuidores de México, lunes y jueves.
// El taller sólo elige el material y ve: precio típico (mediana), rango,
// promedio, cambio, precio por m² o por gramo, la gráfica de cómo se ha movido
// y las tiendas. Abajo calcula el costo de material de una pieza o pedido.
//   GET /vendor/hetna-materiales
import { T, traducir } from "../../lib/idioma"
import { useEffect, useMemo, useState } from "react"
import { Container, Heading, Text } from "@medusajs/ui"
import { ChartBar } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

export const config: RouteConfig = {
  label: "Precios de materiales",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: ChartBar,
  rank: 6,
}

type Material = {
  clave: string
  nombre: string
  categoria: string
  unidad: "hoja" | "kg" | "litro"
  ancho_m?: number
  largo_m?: number
  area_m2: number | null
  fecha: string | null
  mediana: number | null
  minimo: number | null
  maximo: number | null
  tiendas: number
  promedio: number | null
  cambio_pct: number | null
  precio_m2: number | null
  precio_gramo: number | null
  serie: { fecha: string; mediana: number }[]
  fuentes: { tienda: string; precio: number; url: string }[]
}

const pesos = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d })}`
const caja: React.CSSProperties = { border: "1px solid var(--border-base, #e5e5e5)", borderRadius: 10, padding: 14 }
const campo: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border-base, #e5e5e5)", borderRadius: 8, fontSize: 14, background: "var(--bg-base, #fff)", color: "inherit" }

function Grafica({ serie }: { serie: Material["serie"] }) {
  if (serie.length < 2) return <Text size="small" className="text-ui-fg-subtle"><T>La gráfica aparece desde la segunda medición.</T></Text>
  const w = 520
  const h = 120
  const vals = serie.map((p) => p.mediana)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const x = (i: number) => 10 + (i * (w - 20)) / (serie.length - 1)
  const y = (v: number) => (max === min ? h / 2 : 10 + ((max - v) * (h - 30)) / (max - min))
  const linea = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.mediana).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: w, height: "auto" }} role="img" aria-label={traducir("Precio en el tiempo")}>
      <path d={linea} fill="none" stroke="#C2560A" strokeWidth={2.5} />
      {serie.map((p, i) => (
        <circle key={p.fecha} cx={x(i)} cy={y(p.mediana)} r={3} fill="#C2560A">
          <title>
            {p.fecha}: {pesos(p.mediana)}
          </title>
        </circle>
      ))}
      <text x={10} y={h - 4} fontSize={11} fill="#6b6a63">
        {serie[0].fecha}
      </text>
      <text x={w - 10} y={h - 4} fontSize={11} fill="#6b6a63" textAnchor="end">
        {serie[serie.length - 1].fecha}
      </text>
    </svg>
  )
}

export default function PreciosMaterialesPage() {
  const [lista, setLista] = useState<Material[] | null>(null)
  const [error, setError] = useState("")
  const [clave, setClave] = useState("")
  const [largo, setLargo] = useState("60")
  const [ancho, setAncho] = useState("40")
  const [cantidad, setCantidad] = useState("1")
  const [gramos, setGramos] = useState("100")
  const [merma, setMerma] = useState("15")

  useEffect(() => {
    fetch("/vendor/hetna-materiales", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los precios.")
        const d = await r.json()
        setLista(d.materiales || [])
        const primero = (d.materiales || []).find((m: Material) => m.mediana)
        if (primero) setClave(primero.clave)
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  const categorias = useMemo(() => {
    const g = new Map<string, Material[]>()
    for (const m of lista || []) g.set(m.categoria, [...(g.get(m.categoria) || []), m])
    return [...g.entries()]
  }, [lista])
  const m = (lista || []).find((x) => x.clave === clave)
  const factor = 1 + (Number(merma) || 0) / 100
  const costoHoja = m?.precio_m2 ? ((Number(largo) * Number(ancho)) / 10000) * m.precio_m2 * (Number(cantidad) || 0) * factor : null
  const hojas = m?.area_m2 ? Math.ceil(((Number(largo) * Number(ancho)) / 10000) * (Number(cantidad) || 0) * factor / m.area_m2 * 100) / 100 : null
  const costo3d = m?.precio_gramo ? m.precio_gramo * (Number(gramos) || 0) * (Number(cantidad) || 0) * factor : null

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading><T>Precios de materiales</T></Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          <T>Precios públicos de tiendas y distribuidores de México que nuestro agente revisa lunes y jueves. Elige el material para ver cuánto cuesta y
          calcular el material de tu pedido.</T>
        </Text>
      </div>
      <div className="px-6 py-4">
        {error && <Text className="text-ui-fg-error"><T>{error}</T></Text>}
        {!lista && !error && <Text><T>Cargando…</T></Text>}
        {lista && (
          <select value={clave} onChange={(e) => setClave(e.target.value)} style={{ ...campo, minWidth: 320 }} aria-label={traducir("Material")}>
            {categorias.map(([cat, ms]) => (
              <optgroup key={cat} label={cat}>
                {ms.map((x) => (
                  <option key={x.clave} value={x.clave}>
                    {x.nombre}
                    {x.mediana ? ` · ${pesos(x.mediana)}` : " · sin precio todavía"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {m && (
        <div className="px-6 py-4" style={{ display: "grid", gap: 14 }}>
          {!m.mediana ? (
            <Text><T>Todavía no hay precio de este material: el agente lo busca en su próxima revisión.</T></Text>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div style={caja}>
                  <Text size="small" className="text-ui-fg-subtle">
                    <T>Precio típico por</T> <T>{m.unidad === "hoja" ? "hoja" : m.unidad === "kg" ? "kg" : "litro"}</T>
                  </Text>
                  <p style={{ fontSize: 26, fontWeight: 800, margin: "2px 0" }}>{pesos(m.mediana)}</p>
                  <Text size="small" className="text-ui-fg-subtle">
                    <T>{m.cambio_pct == null ? "primera medición" : m.cambio_pct === 0 ? "sin cambio" : `${m.cambio_pct > 0 ? "▲" : "▼"} ${Math.abs(m.cambio_pct)}% vs. la anterior`}</T>
                  </Text>
                </div>
                <div style={caja}>
                  <Text size="small" className="text-ui-fg-subtle"><T>Rango en tiendas</T></Text>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: "6px 0" }}>
                    {pesos(m.minimo)} a {pesos(m.maximo)}
                  </p>
                  <Text size="small" className="text-ui-fg-subtle"><T>{m.tiendas}</T> <T>tienda(s)</T></Text>
                </div>
                <div style={caja}>
                  <Text size="small" className="text-ui-fg-subtle"><T>{m.precio_m2 ? "Por m²" : m.precio_gramo ? "Por gramo" : "Promedio"}</T></Text>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: "6px 0" }}>
                    {m.precio_m2 ? pesos(m.precio_m2, 2) : m.precio_gramo ? pesos(m.precio_gramo, 3) : pesos(m.promedio)}
                  </p>
                  <Text size="small" className="text-ui-fg-subtle">
                    <T>{m.area_m2 ? `hoja de ${m.ancho_m} × ${m.largo_m} m` : `promedio reciente ${pesos(m.promedio)}`}</T>
                  </Text>
                </div>
                <div style={caja}>
                  <Text size="small" className="text-ui-fg-subtle"><T>Última revisión</T></Text>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: "6px 0" }}><T>{m.fecha}</T></p>
                  <Text size="small" className="text-ui-fg-subtle"><T>promedio reciente</T> {pesos(m.promedio)}</Text>
                </div>
              </div>

              <div style={caja}>
                <Text weight="plus"><T>Cómo se ha movido el precio</T></Text>
                <div style={{ marginTop: 8 }}>
                  <Grafica serie={m.serie} />
                </div>
              </div>

              <div style={caja}>
                <Text weight="plus"><T>Calcula el material de tu pedido</T></Text>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, alignItems: "end" }}>
                  {m.unidad === "hoja" ? (
                    <>
                      <label style={{ fontSize: 13 }}>
                        <T>Largo (cm)</T>
                        <br />
                        <input style={{ ...campo, width: 100 }} inputMode="decimal" value={largo} onChange={(e) => setLargo(e.target.value)} />
                      </label>
                      <label style={{ fontSize: 13 }}>
                        <T>Ancho (cm)</T>
                        <br />
                        <input style={{ ...campo, width: 100 }} inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} />
                      </label>
                    </>
                  ) : (
                    <label style={{ fontSize: 13 }}>
                      <T>Gramos por pieza</T>
                      <br />
                      <input style={{ ...campo, width: 120 }} inputMode="decimal" value={gramos} onChange={(e) => setGramos(e.target.value)} />
                    </label>
                  )}
                  <label style={{ fontSize: 13 }}>
                    <T>Piezas</T>
                    <br />
                    <input style={{ ...campo, width: 90 }} inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 13 }}>
                    <T>Merma (%)</T>
                    <br />
                    <input style={{ ...campo, width: 90 }} inputMode="numeric" value={merma} onChange={(e) => setMerma(e.target.value)} />
                  </label>
                </div>
                <p style={{ margin: "12px 0 0", fontSize: 16 }}>
                  <T>Costo aproximado de material:</T> <b>{pesos(m.unidad === "hoja" ? costoHoja : costo3d, 2)}</b>
                  {m.unidad === "hoja" && hojas != null && <span style={{ color: "#6b6a63" }}> · ≈ <T>{hojas}</T> <T>hoja(s)</T></span>}
                </p>
                <Text size="small" className="text-ui-fg-subtle"><T>Con el precio típico de mercado; tu proveedor puede darte otro precio por volumen.</T></Text>
              </div>

              {m.fuentes.length > 0 && (
                <div style={caja}>
                  <Text weight="plus"><T>Dónde se encontró</T></Text>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                    {m.fuentes
                      .slice()
                      .sort((a, b) => a.precio - b.precio)
                      .map((f) => (
                        <li key={f.url}>
                          <a href={f.url} target="_blank" rel="noreferrer nofollow">
                            <T>{f.tienda}</T>
                          </a>
                          : {pesos(f.precio)}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Container>
  )
}
