// Panel del taller > Piezas para imprimir: los Diseños listos de HETNA
// (piezas de las herramientas del Estudio) que el taller puede ofrecer
// imprimir, en los colores y calidades que maneje, a su precio y con sus días.
// En la ficha sale "Tu taller te lo imprime en $Y" junto a las demás ofertas.
//   GET/POST /vendor/hetna-disenos-listos
import { useEffect, useState } from "react"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { Swatch } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

export const config: RouteConfig = {
  label: "Piezas para imprimir",
  icon: Swatch,
  rank: 7,
}

type Variante = { id: string; color: string; calidad: string; mi_oferta: { id: string; precio: number | null; dias: number | null; activa: boolean } | null }
type Diseno = {
  product_id: string
  handle: string
  nombre: string
  thumbnail: string | null
  material: string | null
  medidas: string | null
  gramos: number | null
  recomendado: Record<string, number | null>
  variantes: Variante[]
}
type Edicion = { marcadas: Set<string>; precio: Record<string, string>; dias: string }

const pesos = (n: number | null | undefined) => (n == null ? "—" : `$${Number(n).toLocaleString("es-MX")}`)
const caja: React.CSSProperties = { border: "1px solid var(--border-base, #e5e5e5)", borderRadius: 10, padding: 14 }
const campo: React.CSSProperties = { padding: "6px 8px", border: "1px solid var(--border-base, #e5e5e5)", borderRadius: 8, fontSize: 14, width: 96, background: "var(--bg-base, #fff)", color: "inherit" }

function inicial(d: Diseno): Edicion {
  const activas = d.variantes.filter((v) => v.mi_oferta?.activa)
  const precio: Record<string, string> = {}
  for (const v of activas) if (v.mi_oferta?.precio != null && !precio[v.calidad]) precio[v.calidad] = String(v.mi_oferta.precio)
  return { marcadas: new Set(activas.map((v) => v.id)), precio, dias: String(activas[0]?.mi_oferta?.dias || 3) }
}

function TarjetaDiseno({ d, colores, calidades, recargar }: { d: Diseno; colores: string[]; calidades: string[]; recargar: () => void }) {
  const [e, setE] = useState<Edicion>(() => inicial(d))
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState("")
  const variante = (color: string, calidad: string) => d.variantes.find((v) => v.color === color && v.calidad === calidad)
  const alternar = (id: string) =>
    setE((x) => {
      const m = new Set(x.marcadas)
      m.has(id) ? m.delete(id) : m.add(id)
      return { ...x, marcadas: m }
    })
  const ofrecidas = d.variantes.filter((v) => v.mi_oferta?.activa).length

  const guardar = async () => {
    setMsg("")
    const ofertas = d.variantes
      .filter((v) => e.marcadas.has(v.id))
      .map((v) => ({ variant_id: v.id, precio: Number((e.precio[v.calidad] || "").replace(",", ".")), dias: Number(e.dias) }))
    if (ofertas.some((o) => !(o.precio > 0))) return setMsg("Pon el precio de cada calidad que marcaste.")
    const quitar = d.variantes.filter((v) => v.mi_oferta?.activa && !e.marcadas.has(v.id)).map((v) => v.id)
    setGuardando(true)
    try {
      const r = await fetch("/vendor/hetna-disenos-listos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: d.product_id, ofertas, quitar }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok || b.ok === false) {
        setMsg(b.message || "No se pudo guardar.")
        if (b.ok === false) recargar() // lo que sí quedó
        return
      }
      setMsg(`Listo: ${b.creadas + b.actualizadas} combinación(es) ofrecida(s)${b.quitadas ? `, ${b.quitadas} quitada(s)` : ""}.`)
      recargar()
    } catch {
      setMsg("No se pudo guardar. Revisa tu conexión.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={caja} className="flex flex-col gap-3">
      <div className="flex gap-3">
        {d.thumbnail ? <img src={d.thumbnail} alt="" width={84} height={84} style={{ borderRadius: 8, objectFit: "cover", background: "#F7F5EF" }} /> : null}
        <div className="min-w-0 flex-1">
          <Text weight="plus">{d.nombre}</Text>
          <Text size="small" className="text-ui-fg-subtle">
            {[d.material, d.medidas, d.gramos ? `unos ${d.gramos} g` : null].filter(Boolean).join(" · ")}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Precio recomendado de HETNA: {calidades.map((c) => `${c} ${pesos(d.recomendado[c])}`).join(" · ")} (final, con IVA)
          </Text>
          {ofrecidas > 0 && <Text size="small" style={{ color: "#16794F" }}>Ya la ofreces en {ofrecidas} combinación(es).</Text>}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Color</th>
              {calidades.map((c) => (
                <th key={c} style={{ padding: "4px 8px" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colores.map((color) => (
              <tr key={color}>
                <td style={{ padding: "4px 8px" }}>{color}</td>
                {calidades.map((c) => {
                  const v = variante(color, c)
                  return (
                    <td key={c} style={{ padding: "4px 8px", textAlign: "center" }}>
                      {v ? <input type="checkbox" checked={e.marcadas.has(v.id)} onChange={() => alternar(v.id)} aria-label={`${color} ${c}`} /> : "—"}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td style={{ padding: "6px 8px" }}>Tu precio</td>
              {calidades.map((c) => (
                <td key={c} style={{ padding: "6px 8px" }}>
                  <input
                    style={campo}
                    inputMode="decimal"
                    placeholder={d.recomendado[c] ? String(d.recomendado[c]) : "$"}
                    value={e.precio[c] || ""}
                    onChange={(ev) => setE((x) => ({ ...x, precio: { ...x.precio, [c]: ev.target.value } }))}
                    aria-label={`Precio ${c}`}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Días de impresión
          <input style={{ ...campo, width: 64 }} inputMode="numeric" value={e.dias} onChange={(ev) => setE((x) => ({ ...x, dias: ev.target.value }))} />
        </label>
        <Button size="small" onClick={guardar} isLoading={guardando}>
          Guardar
        </Button>
        {msg && <Text size="small">{msg}</Text>}
      </div>
    </div>
  )
}

export default function PiezasImprimir() {
  const [datos, setDatos] = useState<{ disenos: Diseno[]; colores: string[]; calidades: string[]; destacado?: { hasta: string | null; planes: { dias: number; precio: number }[] } } | null>(null)
  const [pagando, setPagando] = useState(0)
  const [msgDestacado, setMsgDestacado] = useState("")
  const destacar = async (dias: number) => {
    setMsgDestacado("")
    setPagando(dias)
    try {
      const r = await fetch("/vendor/hetna-disenos-listos/destacar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dias }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok || !b.url) return setMsgDestacado(b.message || "No se pudo crear el pago.")
      window.location.href = b.url
    } catch {
      setMsgDestacado("No se pudo crear el pago. Revisa tu conexión.")
    } finally {
      setPagando(0)
    }
  }
  const [error, setError] = useState("")
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    fetch("/vendor/hetna-disenos-listos", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDatos)
      .catch(() => setError("No se pudieron cargar las piezas."))
  }, [vuelta])

  return (
    <Container className="flex flex-col gap-4">
      <div>
        <Heading>Piezas para imprimir</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Piezas listas de HETNA que puedes ofrecer imprimir. Marca los colores y calidades que manejas y pon tu precio final (con IVA): en la ficha de cada pieza los clientes ven
          "tu taller te lo imprime en $…" junto a las demás ofertas, y el pedido te llega a ti. Los días de impresión se suman al envío.
        </Text>
      </div>
      {datos?.destacado && (
        <div style={{ ...caja, borderColor: "#F2C98F", background: "rgba(194, 86, 10, 0.06)" }} className="flex flex-col gap-2">
          <Text weight="plus">⭐ Destaca tu taller en todas tus piezas</Text>
          <Text size="small" className="text-ui-fg-subtle">
            Tu taller sale primero, con la etiqueta "Destacado", en "Quién te lo imprime" de cada pieza que ofreces. Si compras antes de que termine, los días se suman.
          </Text>
          {datos.destacado.hasta ? (
            <Text size="small" style={{ color: "#16794F" }}>Destacado hasta el {new Date(datos.destacado.hasta).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}.</Text>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {datos.destacado.planes.map((p) => (
              <Button key={p.dias} size="small" variant="secondary" onClick={() => destacar(p.dias)} isLoading={pagando === p.dias}>
                {p.dias} días · {pesos(p.precio)}
              </Button>
            ))}
          </div>
          {msgDestacado && <Text size="small" style={{ color: "#B3261E" }}>{msgDestacado}</Text>}
        </div>
      )}
      {error && <Text style={{ color: "#B3261E" }}>{error}</Text>}
      {!datos && !error && <Text size="small">Cargando…</Text>}
      {datos && !datos.disenos.length && <Text size="small">Todavía no hay piezas publicadas.</Text>}
      {datos?.disenos.map((d) => (
        <TarjetaDiseno key={`${d.product_id}-${vuelta}`} d={d} colores={datos.colores} calidades={datos.calidades} recargar={() => setVuelta((v) => v + 1)} />
      ))}
    </Container>
  )
}
