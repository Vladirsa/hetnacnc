// @ts-nocheck
import { useEffect, useState } from "react"
import { Building } from "lucide-react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

export const config: RouteConfig = {
  label: "Perfil público",
  icon: Building,
}

const SERVICIOS = [
  "Corte CNC",
  "Corte láser",
  "Corte plasma",
  "Grabado",
  "Fresado de madera",
  "Fresado de metal",
  "Maquinado",
  "Impresión 3D",
  "Diseño CAD/CAM",
  "Pintura y acabados",
  "Instalación de máquinas",
  "Reparación y mantenimiento",
]

const MATERIALES = [
  "MDF",
  "Madera",
  "Triplay",
  "Acrílico",
  "Aluminio",
  "Acero",
  "Acero inoxidable",
  "Latón",
  "Cobre",
  "PVC",
  "Foami",
  "Vidrio",
]

const ESTADOS = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
]

const S = {
  page: { maxWidth: 820, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px" },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 20, marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 700, margin: "0 0 12px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", height: 38, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 10px", fontSize: 14, boxSizing: "border-box", background: "#fff" },
  area: { width: "100%", minHeight: 96, border: "1px solid #D9D5C9", borderRadius: 8, padding: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  hint: { color: "#6B675C", fontSize: 12, marginTop: 4 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
}

const chip = (on) => ({
  border: "1px solid " + (on ? "#C2560A" : "#D9D5C9"),
  background: on ? "#C2560A" : "#fff",
  color: on ? "#fff" : "#142033",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 13,
  cursor: "pointer",
})

const parseMeta = (m) => {
  if (typeof m === "string") {
    try { return JSON.parse(m) || {} } catch { return {} }
  }
  return m && typeof m === "object" ? m : {}
}

const lineas = (t) => t.split("\n").map((x) => x.trim()).filter(Boolean)

export default function PerfilTallerPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [metaBase, setMetaBase] = useState({})
  const [nombre, setNombre] = useState("")
  const [f, setF] = useState({
    lema: "", ciudad: "", estado: "", lat: "", lng: "", entrega: "", anos: "", whatsapp: "",
    servicios: [], materiales: [], otrosMateriales: "", capacidades: "", maquinas: [],
  })

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const alternar = (k, v) =>
    setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }))

  useEffect(() => {
    fetch("/vendor/sellers/me?fields=id,name,metadata", { credentials: "include" })
      .then((r) => r.json())
      .then(({ seller }) => {
        const meta = parseMeta(seller?.metadata)
        const p = meta.perfil || {}
        setNombre(seller?.name || "")
        setMetaBase(meta)
        const mats = Array.isArray(p.materiales) ? p.materiales : []
        setF({
          lema: p.lema || "",
          ciudad: p.ciudad || "",
          estado: p.estado || "",
          lat: p.lat ?? "",
          lng: p.lng ?? "",
          entrega: p.entrega || "",
          anos: p.anos ?? "",
          whatsapp: p.whatsapp || "",
          servicios: Array.isArray(p.servicios) ? p.servicios : [],
          materiales: mats.filter((m) => MATERIALES.includes(m)),
          otrosMateriales: mats.filter((m) => !MATERIALES.includes(m)).join(", "),
          capacidades: (Array.isArray(p.capacidades) ? p.capacidades : []).join("\n"),
          maquinas: Array.isArray(p.maquinas) ? p.maquinas : [],
        })
      })
      .catch(() => setMsg({ ok: false, t: "No se pudo cargar tu perfil. Recarga la página." }))
      .finally(() => setCargando(false))
  }, [])

  const ubicar = async () => {
    if (!f.ciudad || !f.estado) {
      setMsg({ ok: false, t: "Escribe ciudad y estado primero." })
      return
    }
    setMsg({ ok: true, t: "Buscando ubicación..." })
    try {
      const q = encodeURIComponent(`${f.ciudad}, ${f.estado}, México`)
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=${q}`)
      const d = await r.json()
      if (!d[0]) throw new Error("sin resultado")
      setF((p) => ({ ...p, lat: Number(parseFloat(d[0].lat).toFixed(5)), lng: Number(parseFloat(d[0].lon).toFixed(5)) }))
      setMsg({ ok: true, t: "Ubicación encontrada. Recuerda guardar los cambios." })
    } catch {
      setMsg({ ok: false, t: "No encontramos esa ubicación. Revisa ciudad y estado." })
    }
  }

  const guardar = async () => {
    setGuardando(true)
    setMsg(null)
    const wa = String(f.whatsapp || "").replace(/\D/g, "")
    const otros = f.otrosMateriales.split(",").map((x) => x.trim()).filter(Boolean)
    const perfil = {
      ...(metaBase.perfil || {}),
      lema: f.lema.trim(),
      ciudad: f.ciudad.trim(),
      estado: f.estado,
      lat: f.lat === "" ? undefined : Number(f.lat),
      lng: f.lng === "" ? undefined : Number(f.lng),
      entrega: f.entrega.trim(),
      anos: f.anos === "" ? undefined : Number(f.anos),
      whatsapp: wa ? (wa.length === 10 ? "52" + wa : wa) : "",
      servicios: f.servicios,
      materiales: [...f.materiales, ...otros],
      capacidades: lineas(f.capacidades),
      maquinas: f.maquinas.filter((m) => (m.nombre || "").trim()),
    }
    try {
      const r = await fetch("/vendor/sellers/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { ...metaBase, perfil } }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setMetaBase({ ...metaBase, perfil })
      setMsg({ ok: true, t: "Perfil guardado. Se verá en tu página pública en unos minutos." })
    } catch (e) {
      setMsg({ ok: false, t: "No se pudo guardar (" + e.message + "). Intenta de nuevo." })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div style={S.page}>Cargando...</div>

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Perfil público del taller</h1>
      <p style={S.sub}>
        Esto es lo que ven los clientes en tu página de taller{nombre ? ` (${nombre})` : ""} y en el mapa de HETNA.
      </p>

      <section style={S.card}>
        <h2 style={S.h2}>Ubicación y contacto</h2>
        <div style={S.grid}>
          <div>
            <label style={S.label}>Ciudad</label>
            <input style={S.input} value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Ej. Apizaco" />
          </div>
          <div>
            <label style={S.label}>Estado</label>
            <select style={S.input} value={f.estado} onChange={(e) => set("estado", e.target.value)}>
              <option value="">Selecciona</option>
              {ESTADOS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>WhatsApp (10 dígitos)</label>
            <input style={S.input} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="2411234567" inputMode="numeric" />
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={S.btn2} onClick={ubicar}>Ubicar en el mapa</button>
          <span style={S.hint}>
            {f.lat !== "" && f.lng !== "" ? `Coordenadas: ${f.lat}, ${f.lng}` : "Aún sin ubicación en el mapa"}
          </span>
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Presentación</h2>
        <label style={S.label}>Frase corta</label>
        <input style={S.input} value={f.lema} onChange={(e) => set("lema", e.target.value)} placeholder="Ej. Corte y grabado CNC con entrega rápida" maxLength={120} />
        <div style={{ ...S.grid, marginTop: 12 }}>
          <div>
            <label style={S.label}>Tiempo de entrega típico</label>
            <input style={S.input} value={f.entrega} onChange={(e) => set("entrega", e.target.value)} placeholder="Ej. 3 a 7 días" />
          </div>
          <div>
            <label style={S.label}>Años de experiencia</label>
            <input style={S.input} type="number" min="0" value={f.anos} onChange={(e) => set("anos", e.target.value)} />
          </div>
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Servicios que ofreces</h2>
        <div style={S.chips}>
          {SERVICIOS.map((x) => (
            <button type="button" key={x} style={chip(f.servicios.includes(x))} onClick={() => alternar("servicios", x)}>{x}</button>
          ))}
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Capacidades</h2>
        <textarea style={S.area} value={f.capacidades} onChange={(e) => set("capacidades", e.target.value)} placeholder={"Una por línea. Ej.\nCorte de MDF hasta 30 mm\nProducción por lotes"} />
        <p style={S.hint}>Escribe una capacidad por línea.</p>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Máquinas</h2>
        {f.maquinas.map((m, i) => (
          <div key={i} style={{ ...S.grid, marginBottom: 10, alignItems: "end" }}>
            <div>
              <label style={S.label}>Máquina</label>
              <input style={S.input} value={m.nombre || ""} onChange={(e) => set("maquinas", f.maquinas.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} placeholder="Router CNC 1530" />
            </div>
            <div>
              <label style={S.label}>Área de trabajo</label>
              <input style={S.input} value={m.area || ""} onChange={(e) => set("maquinas", f.maquinas.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} placeholder="1500 x 3000 mm" />
            </div>
            <div>
              <label style={S.label}>Detalle</label>
              <input style={S.input} value={m.detalle || ""} onChange={(e) => set("maquinas", f.maquinas.map((x, j) => (j === i ? { ...x, detalle: e.target.value } : x)))} placeholder="Spindle 3 kW" />
            </div>
            <div>
              <button type="button" style={S.btn2} onClick={() => set("maquinas", f.maquinas.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          </div>
        ))}
        <button type="button" style={S.btn2} onClick={() => set("maquinas", [...f.maquinas, { nombre: "", area: "", detalle: "" }])}>+ Agregar máquina</button>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Materiales que trabajas</h2>
        <div style={S.chips}>
          {MATERIALES.map((x) => (
            <button type="button" key={x} style={chip(f.materiales.includes(x))} onClick={() => alternar("materiales", x)}>{x}</button>
          ))}
        </div>
        <label style={{ ...S.label, marginTop: 12 }}>Otros materiales (separados por coma)</label>
        <input style={S.input} value={f.otrosMateriales} onChange={(e) => set("otrosMateriales", e.target.value)} placeholder="Corcho, hule" />
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button type="button" style={{ ...S.btn, opacity: guardando ? 0.6 : 1 }} disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando..." : "Guardar perfil"}
        </button>
        {msg && <span style={{ fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</span>}
      </div>
    </div>
  )
}
