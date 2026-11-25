// @ts-nocheck
// "Ofertar en planos": el taller elige planos de la Biblioteca HETNA que puede
// fabricar, marca los acabados que hace, pone su precio (ve el recomendado por
// HETNA), sus días de entrega y si da envío gratis. El cliente ve las ofertas
// de todos los talleres juntas en la página del producto.
// Backend: packages/api/src/lib/planos-ofertas.ts (/vendor/hetna-planos)
import { useEffect, useMemo, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 21V8l9-5 9 5v13" />
    <path d="M9 21v-6h6v6" />
  </svg>
)

export const config: RouteConfig = {
  label: "Ofertar en planos",
  icon: Icono,
}

const S = {
  page: { maxWidth: 980, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px", lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 14, marginBottom: 10 },
  fila: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  img: { width: 64, height: 80, objectFit: "cover", borderRadius: 8, background: "#F3F1EA" },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "7px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  input: { border: "1px solid #D9D5C9", borderRadius: 8, padding: "8px 10px", fontSize: 14, width: 110, boxSizing: "border-box" },
  buscar: { border: "1px solid #D9D5C9", borderRadius: 8, padding: "9px 12px", fontSize: 14, width: "100%", maxWidth: 360, boxSizing: "border-box" },
  chip: (c, f) => ({ background: f, color: c, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }),
  aviso: (ok) => ({ background: ok ? "#E6F4EA" : "#FDECEA", color: ok ? "#1E7B3A" : "#B3261E", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginTop: 8 }),
}

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : "")
const pesos = (n) => (n == null ? "—" : Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }))

function Editor({ plano, limites, alGuardar }) {
  const [dias, setDias] = useState(plano.dias ?? 7)
  const [envio, setEnvio] = useState(plano.envio_gratis)
  const [vars, setVars] = useState(() =>
    plano.variantes.map((v) => ({ ...v, activa: !!v.oferta, precio: v.oferta?.precio ?? v.recomendado ?? "" }))
  )
  const [estado, setEstado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    setEstado(null)
    try {
      const r = await fetch("/vendor/hetna-planos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: plano.product_id,
          dias: Number(dias),
          envio_gratis: envio,
          variantes: vars.map((v) => ({ variant_id: v.variant_id, precio: v.activa ? Number(v.precio) : null })),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo guardar.")
      setEstado({ ok: true, texto: "Listo: tu oferta quedó guardada." })
      alGuardar()
    } catch (e) {
      setEstado({ ok: false, texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #EEE", paddingTop: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#6B675C", fontSize: 12 }}>
            <th style={{ padding: "4px 6px" }}>Lo hago</th>
            <th>Acabado</th>
            <th>Recomendado HETNA (con IVA)</th>
            <th>Tu precio</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vars.map((v, i) => {
            const dif = v.recomendado && v.precio ? Math.round(((Number(v.precio) - v.recomendado) / v.recomendado) * 100) : null
            const cambiar = (c) => setVars(vars.map((x, j) => (j === i ? { ...x, ...c } : x)))
            return (
              <tr key={v.variant_id} style={{ borderTop: "1px solid #F1EFE8" }}>
                <td style={{ padding: "6px" }}>
                  <input type="checkbox" checked={v.activa} onChange={(e) => cambiar({ activa: e.target.checked })} />
                </td>
                <td>{v.titulo}</td>
                <td style={{ color: "#6B675C" }}>{pesos(v.recomendado)}</td>
                <td>
                  <input type="number" min={limites.precio.min} step={10} disabled={!v.activa} value={v.precio} onChange={(e) => cambiar({ precio: e.target.value })} style={S.input} />
                </td>
                <td style={{ fontSize: 12, color: dif == null ? "#6B675C" : dif > 0 ? "#8A5A00" : "#1E7B3A" }}>
                  {v.activa && dif != null ? (dif === 0 ? "igual al recomendado" : `${dif > 0 ? "+" : ""}${dif} %`) : ""}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ ...S.fila, marginTop: 12 }}>
        <label style={{ fontSize: 14 }}>
          Días hábiles para entregar{" "}
          <input type="number" min={limites.dias.min} max={limites.dias.max} value={dias} onChange={(e) => setDias(e.target.value)} style={{ ...S.input, width: 70 }} />
        </label>
        <label style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={envio} onChange={(e) => setEnvio(e.target.checked)} />
          Ofrezco envío gratis por paquetería (yo pago la guía)
        </label>
        <button type="button" style={S.btn} disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar oferta"}
        </button>
      </div>
      {estado ? <div style={S.aviso(estado.ok)}>{estado.texto}</div> : null}
    </div>
  )
}

export default function OfertarPlanos() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [abierto, setAbierto] = useState(null)
  const [q, setQ] = useState("")
  const [soloMias, setSoloMias] = useState(false)

  const [aviso, setAviso] = useState(null)
  const [pagando, setPagando] = useState(false)

  const pedir = (ruta = "", init = {}) =>
    fetch(`/vendor/hetna-planos${ruta}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init }).then((r) =>
      r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.message || "Error"))))
    )

  const cargar = () =>
    pedir()
      .then(setDatos)
      .catch((e) => setError(e.message))

  useEffect(() => {
    // Regreso de Mercado Pago del pago del destacado
    const q = new URLSearchParams(window.location.search)
    const pagoId = q.get("payment_id") || q.get("collection_id")
    if (pagoId) {
      pedir("/destacado", { method: "POST", body: JSON.stringify({ payment_id: pagoId }) })
        .then((r) => setAviso(r.ok ? { ok: true, texto: `¡Listo! Eres taller destacado en planos hasta el ${fecha(r.hasta)}.` } : { ok: false, texto: r.motivo || "El pago todavía no se aprueba." }))
        .catch((e) => setAviso({ ok: false, texto: e.message }))
        .finally(() => {
          window.history.replaceState(null, "", window.location.pathname)
          cargar()
        })
    } else {
      if (q.get("pago") === "error") setAviso({ ok: false, texto: "El pago no se completó. Puedes intentarlo de nuevo." })
      cargar()
    }
  }, [])

  const destacar = async () => {
    setPagando(true)
    try {
      const r = await pedir("/destacado", { method: "POST", body: "{}" })
      if (r.url) window.location.href = r.url
    } catch (e) {
      setAviso({ ok: false, texto: e.message })
      setPagando(false)
    }
  }

  const ofertasActivas = (datos?.planos || []).reduce((n, p) => n + p.variantes.filter((v) => v.oferta).length, 0)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (datos?.planos || []).filter((p) => (!t || p.titulo.toLowerCase().includes(t)) && (!soloMias || p.variantes.some((v) => v.oferta)))
  }, [datos, q, soloMias])

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Ofertar en planos</h1>
      <p style={S.sub}>
        Fabrica muebles de la Biblioteca de planos HETNA y véndelos en la tienda. Marca los acabados que haces y pon tu precio: te enseñamos el precio recomendado por HETNA (kit de piezas cortadas en CNC y lijadas, sin herrajes ni armado). El cliente ve las ofertas de todos los talleres juntas, con tu precio, tus días de entrega y si das envío gratis. Tu precio es el precio final que paga el cliente (con IVA), sin el envío.
      </p>
      {aviso ? <div style={S.aviso(aviso.ok)}>{aviso.texto}</div> : null}
      {error ? <div style={S.aviso(false)}>{error}</div> : null}
      {datos?.destacado ? (
        <div style={{ ...S.card, background: "#FFF8F1", borderColor: "#FFD3B0" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>⭐ Sal primero: taller destacado en planos</div>
          <p style={{ ...S.sub, margin: "4px 0 10px" }}>
            Por {pesos(datos.destacado.precio)} cada {datos.destacado.dias} días sales primero, con la insignia <b>Destacado</b>, en todos los planos donde tienes oferta.
          </p>
          {datos.destacado.hasta ? (
            <p style={{ fontSize: 14, margin: "0 0 10px" }}>
              Eres destacado hasta el <b>{fecha(datos.destacado.hasta)}</b>. Si pagas otra vez, se suman {datos.destacado.dias} días.
            </p>
          ) : null}
          <button type="button" style={S.btn} disabled={pagando} onClick={destacar}>
            {pagando ? "Abriendo Mercado Pago…" : datos.destacado.hasta ? `Sumar ${datos.destacado.dias} días` : `Destacarme por ${pesos(datos.destacado.precio)}`}
          </button>
          {!ofertasActivas ? <div style={{ fontSize: 13, color: "#8A5A00", marginTop: 8 }}>Primero pon tu oferta en al menos un plano: el destacado sólo se ve donde ofertas.</div> : null}
        </div>
      ) : null}
      {!datos && !error ? <p style={S.sub}>Cargando planos…</p> : null}
      {datos && !datos.planos.length ? <p style={S.sub}>Todavía no hay planos en la tienda. Pronto los verás aquí.</p> : null}
      {datos?.planos.length ? (
        <div style={{ ...S.fila, marginBottom: 12 }}>
          <input placeholder="Buscar plano…" value={q} onChange={(e) => setQ(e.target.value)} style={S.buscar} />
          <label style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} /> Sólo donde ya oferto
          </label>
        </div>
      ) : null}
      {lista.map((p) => {
        const mias = p.variantes.filter((v) => v.oferta)
        return (
          <div key={p.product_id} style={S.card}>
            <div style={S.fila}>
              {p.thumbnail ? <img src={p.thumbnail} alt="" style={S.img} /> : <div style={S.img} />}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.titulo}</div>
                <div style={{ fontSize: 13, color: "#6B675C", marginTop: 2 }}>
                  Recomendado desde {pesos(Math.min(...p.variantes.map((v) => v.recomendado || Infinity)))}
                  {p.slug ? (
                    <>
                      {" · "}
                      <a href={`https://hetnacnc.com/mx/planos/${p.slug}`} target="_blank" rel="noreferrer" style={{ color: "#C2560A" }}>ver plano</a>
                    </>
                  ) : null}
                </div>
                <div style={{ ...S.fila, gap: 6, marginTop: 6 }}>
                  {mias.length ? <span style={S.chip("#1E7B3A", "#E6F4EA")}>Ofertas {mias.length} {mias.length === 1 ? "acabado" : "acabados"}</span> : null}
                  {p.envio_gratis ? <span style={S.chip("#142033", "#EEF1F6")}>Envío gratis</span> : null}
                  {!p.publicado ? <span style={S.chip("#8A5A00", "#FFF8EE")}>Aún no visible en la tienda</span> : null}
                </div>
              </div>
              <button type="button" style={S.btn2} onClick={() => setAbierto(abierto === p.product_id ? null : p.product_id)}>
                {abierto === p.product_id ? "Cerrar" : mias.length ? "Editar oferta" : "Ofertar"}
              </button>
            </div>
            {abierto === p.product_id ? <Editor plano={p} limites={datos.limites} alGuardar={cargar} /> : null}
          </div>
        )
      })}
    </div>
  )
}
