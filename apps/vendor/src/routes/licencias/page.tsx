// @ts-nocheck
// Panel del taller › Licencias de mis diseños (backend: /vendor/hetna-licencias,
// lib/licencias.ts). El vendedor elige qué puede hacer el comprador con cada
// diseño digital: personal, comercial limitada (con número de piezas) o
// comercial ampliada. La ficha del diseño lo muestra antes de pagar y la
// tienda permite filtrar por licencia.
import { T } from "../../lib/idioma"
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 15l2 2 4-4" />
  </svg>
)

export const config: RouteConfig = {
  label: "Licencias",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: Icono,
}

const OPCIONES = [
  { valor: "personal", nombre: "Personal", texto: "Para fabricar piezas para uso propio. No permite vender las piezas." },
  { valor: "comercial_limitada", nombre: "Comercial limitada", texto: "Permite vender las piezas fabricadas, hasta el número de piezas que pongas." },
  { valor: "comercial_ampliada", nombre: "Comercial ampliada", texto: "Producción comercial sin límite de piezas, también uso industrial." },
]

const S = {
  page: { maxWidth: 900, margin: "0 auto", padding: "24px 16px 60px", fontFamily: "inherit" },
  h1: { fontSize: 26, fontWeight: 800, margin: 0, color: "#142033" },
  sub: { color: "#6B675C", fontSize: 14, margin: "6px 0 16px", lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  select: { height: 38, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 8px", fontSize: 14 },
  input: { width: 110, height: 38, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 8px", fontSize: 14 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
}

function Fila({ d, alGuardar }) {
  const [licencia, setLicencia] = useState(d.licencia)
  const [piezas, setPiezas] = useState(d.piezas || 100)
  const [estado, setEstado] = useState("")
  const cambio = licencia !== d.licencia || (licencia === "comercial_limitada" && Number(piezas) !== d.piezas)

  const guardar = async () => {
    setEstado("Guardando…")
    try {
      const r = await fetch("/vendor/hetna-licencias", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: d.id, licencia, piezas: Number(piezas) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.message || "No se pudo guardar.")
      setEstado("Guardado")
      alGuardar(d.id, j)
    } catch (e) {
      setEstado(e.message)
    }
  }

  return (
    <div style={S.card}>
      {d.foto ? <img src={d.foto} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} /> : null}
      <div style={{ flex: 1, minWidth: 180 }}>
        <strong style={{ fontSize: 14 }}><T>{d.titulo}</T></strong>
        <div style={{ fontSize: 12, color: "#6B675C" }}><T>{OPCIONES.find((o) => o.valor === licencia)?.texto}</T></div>
      </div>
      <select style={S.select} value={licencia} onChange={(e) => setLicencia(e.target.value)} aria-label={`Licencia de ${d.titulo}`}>
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nombre}
          </option>
        ))}
      </select>
      {licencia === "comercial_limitada" && (
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <T>Hasta</T>
          <input type="number" min={1} max={1000000} style={S.input} value={piezas} onChange={(e) => setPiezas(e.target.value)} />
          <T>piezas</T>
        </label>
      )}
      <button type="button" style={{ ...S.btn, opacity: cambio ? 1 : 0.5 }} disabled={!cambio} onClick={guardar}>
        <T>Guardar</T>
      </button>
      {estado && <span style={{ fontSize: 12, color: estado === "Guardado" ? "#17633A" : "#6B675C" }}><T>{estado}</T></span>}
    </div>
  )
}

export default function Licencias() {
  const [disenos, setDisenos] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/vendor/hetna-licencias", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.message || "No se pudieron cargar tus diseños.")
        return j
      })
      .then((j) => setDisenos(j.disenos || []))
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div style={S.page}>
      <h1 style={S.h1}><T>Licencias de mis diseños</T></h1>
      <p style={S.sub}>
        <T>Elige qué puede hacer el comprador con cada archivo. La licencia sale en la ficha del diseño antes de pagar, y los
        clientes pueden filtrar la tienda por licencia. Si no eliges ninguna, el diseño se vende con la licencia personal.
        Con ninguna licencia se permite revender ni compartir el archivo.</T><T>{" "}</T>
        <a href="https://hetnacnc.com/mx/licencias-disenos" target="_blank" rel="noreferrer" style={{ color: "#B34D07", fontWeight: 600 }}>
          <T>Ver las tres licencias</T>
        </a>
      </p>
      {error && <p style={{ color: "#B91C1C" }}><T>{error}</T></p>}
      {!disenos && !error && <p style={S.sub}><T>Cargando…</T></p>}
      {disenos && !disenos.length && <p style={S.sub}><T>Todavía no tienes diseños digitales publicados.</T></p>}
      <div style={{ display: "grid", gap: 8 }}>
        {(disenos || []).map((d) => (
          <Fila
            key={d.id}
            d={d}
            alGuardar={(id, j) => setDisenos((l) => l.map((x) => (x.id === id ? { ...x, licencia: j.licencia, piezas: j.piezas } : x)))}
          />
        ))}
      </div>
    </div>
  )
}
