// @ts-nocheck
// Aviso "Completa tus datos" del Inicio del taller (pedido de Vlado, 23 nov 2026).
//
// Los filtros de la tienda (/mx/categories: estado del taller, tipo de taller,
// material) y las páginas "Talleres CNC en <estado>" sólo pueden mostrar lo que
// el taller llenó. En producción ningún producto tenía material y había
// talleres sin estado ni máquinas, así que los filtros salían vacíos.
// Este aviso dice exactamente qué falta y lleva a llenarlo:
//   - Perfil público: estado y ciudad, máquinas (no aplica a proveedores),
//     materiales que trabaja y si emite factura.
//   - Cada producto: foto, material, medida, tipo de producto y tiempo de
//     entrega (los dos últimos sólo en productos físicos; los servicios no
//     piden material ni medida).
// Datos: GET /vendor/sellers/me y GET /vendor/hetna-ficha (los mismos que usan
// Perfil público y Ficha del producto). Si todo está completo, no se muestra.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

const texto = (v) => (typeof v === "string" ? v.trim() : "")

/** Lo que le falta a un producto (de GET /vendor/hetna-ficha). */
export function faltantesProducto(p) {
  const f = p.ficha || {}
  const falta = []
  if (!p.foto) falta.push("foto")
  if (p.servicio) return falta
  if (!texto(f.material)) falta.push("material")
  if (!texto(f.medida_principal) && !texto(f.medidas)) falta.push("medida")
  if (!p.digital) {
    if (!texto(f.tipo_producto)) falta.push("tipo de producto")
    if (!texto(f.entrega) && !texto(f.tiempo_produccion)) falta.push("tiempo de entrega")
  }
  return falta
}

/** Lo que le falta al perfil público (metadata.perfil del vendedor). */
export function faltantesPerfil(perfil) {
  const p = perfil || {}
  const falta = []
  if (!texto(p.estado) || !texto(p.ciudad)) falta.push("estado y ciudad")
  if (p.tipo_cuenta !== "proveedor" && !(Array.isArray(p.maquinas) && p.maquinas.length)) falta.push("máquinas")
  if (!(Array.isArray(p.materiales) && p.materiales.length)) falta.push("materiales que trabajas")
  if (!["si", "no"].includes(p.factura)) falta.push("si emites factura")
  return falta
}

const lista = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`)

export function AvisoDatosFaltantes() {
  const [datos, setDatos] = useState(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([
      fetch("/vendor/sellers/me?fields=id,metadata", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/vendor/hetna-ficha", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([yo, ficha]) => {
        if (!vivo || !yo?.seller) return
        const productos = (ficha?.productos || []).filter((p) => p.estado !== "rejected")
        setDatos({
          perfil: faltantesPerfil(yo.seller.metadata?.perfil),
          productos: productos.map((p) => ({ ...p, falta: faltantesProducto(p) })),
        })
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  if (!datos) return null
  const conFaltas = datos.productos.filter((p) => p.falta.length)
  if (!datos.perfil.length && !conFaltas.length) return null

  // Avance: cada dato que pide el aviso cuenta igual
  const total = 4 + datos.productos.reduce((n, p) => n + (p.servicio ? 1 : p.digital ? 3 : 5), 0)
  const faltan = datos.perfil.length + conFaltas.reduce((n, p) => n + p.falta.length, 0)
  const pct = Math.max(0, Math.min(100, Math.round(((total - faltan) / total) * 100)))

  // Cuántos productos les falta cada dato (lo más común primero)
  const porDato = {}
  for (const p of conFaltas) for (const d of p.falta) porDato[d] = (porDato[d] || 0) + 1
  const resumen = Object.entries(porDato).sort((a, b) => b[1] - a[1])

  return (
    <section
      data-testid="aviso-datos-faltantes"
      style={{ background: "#fff", border: "1px solid #F2C98F", borderRadius: 12, padding: "16px 18px", margin: "0 0 12px" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <p style={{ margin: 0, fontWeight: 800, color: "#142033", fontSize: 15 }}>Completa tus datos para salir en los filtros y en Google</p>
          <p style={{ margin: "2px 0 0", color: "#55544D", fontSize: 13 }}>
            Los clientes buscan por estado, tipo de taller y material. Lo que no llenes, no aparece.
          </p>
        </div>
        <div style={{ flex: "0 0 180px" }} aria-label={`Datos completos: ${pct}%`}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#55544D", marginBottom: 4 }}>
            <span>Completo</span>
            <b style={{ color: "#142033" }}>{pct}%</b>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "#F3EDE3", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#D9600B,#C2560A)" }} />
          </div>
        </div>
      </div>

      <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 8 }}>
        {datos.perfil.length > 0 && (
          <li style={fila}>
            <span style={{ fontSize: 14, color: "#1E2329" }}>
              <b>Tu perfil:</b> falta {lista(datos.perfil)}.
            </span>
            <Link to="/perfil-taller" style={boton}>
              Completar perfil
            </Link>
          </li>
        )}
        {resumen.length > 0 && (
          <li style={fila}>
            <span style={{ fontSize: 14, color: "#1E2329" }}>
              <b>Tus productos:</b>{" "}
              {resumen.map(([dato, n], i) => (
                <span key={dato}>
                  {i ? " · " : ""}
                  {n} sin {dato}
                </span>
              ))}
              .
            </span>
            <button type="button" onClick={() => setAbierto((a) => !a)} style={{ ...boton, border: "1px solid #142033", background: "#fff", color: "#142033", cursor: "pointer" }}>
              {abierto ? "Ocultar lista" : `Ver ${conFaltas.length === 1 ? "el producto" : `los ${conFaltas.length} productos`}`}
            </button>
          </li>
        )}
      </ul>

      {abierto && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
          {conFaltas.map((p) => (
            <li key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 10, background: "#FAF8F3" }}>
              {p.foto ? (
                <img src={p.foto} alt="" width={36} height={36} style={{ borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }} />
              ) : (
                <span style={{ width: 36, height: 36, borderRadius: 6, background: "#EDE8DD", flex: "0 0 auto" }} />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#142033", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</span>
                <span style={{ fontSize: 12.5, color: "#B34D07" }}>Falta: {p.falta.join(", ")}</span>
              </span>
              <Link to={`/ficha?abrir=${encodeURIComponent(p.id)}`} style={{ ...boton, padding: "6px 12px", fontSize: 13 }}>
                Completar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const fila = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#FFF8F0" }
const boton = {
  background: "#C2560A",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  padding: "8px 14px",
  borderRadius: 9,
  textDecoration: "none",
  border: 0,
  whiteSpace: "nowrap",
}
