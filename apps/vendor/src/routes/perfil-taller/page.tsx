// @ts-nocheck
import { useEffect, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Building = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
  </svg>
)

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

// Lo que el taller ofrece además de maquinar: aparece como "todo incluido"
// en la lista de talleres cerca del cliente.
const OFRECE = [
  ["diseno", "Diseño: ajusto o hago el archivo del cliente"],
  ["entrega_local", "Entrega local: en mi taller o a domicilio en mi zona"],
  ["envio", "Envío por paquetería a todo México"],
]

// Procesos con tarifa para el estimado rápido de "Fabrícamelo" (mismo nombre
// que en SERVICIOS). El cliente ve "~$X" junto al taller antes de pedir.
const PROCESOS_TARIFA = ["Corte láser", "Corte CNC", "Corte plasma"]
const TARIFA_VACIA = { m2: "", metro: "", minimo: "" }

const ESTADOS = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
]

const S = {
  page: { maxWidth: 820, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 26, fontWeight: 800, margin: 0, color: "#142033", letterSpacing: "-0.02em" },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px" },
  card: { background: "rgba(255,255,255,0.78)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", backdropFilter: "blur(14px) saturate(1.2)", border: "1px solid rgba(20,32,51,0.06)", boxShadow: "0 8px 24px -12px rgba(20,32,51,0.18)", borderRadius: 16, padding: 20, marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 800, margin: "0 0 12px", color: "#142033" },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", height: 40, border: "1px solid #D9D5C9", borderRadius: 10, padding: "0 10px", fontSize: 14, boxSizing: "border-box", background: "#fff" },
  area: { width: "100%", minHeight: 96, border: "1px solid #D9D5C9", borderRadius: 10, padding: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  hint: { color: "#6B675C", fontSize: 12, marginTop: 4 },
  btn: { background: "linear-gradient(180deg,#D9600B,#C2560A)", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px -8px rgba(217,96,11,0.7)" },
  btn2: { background: "transparent", color: "#C2560A", border: "1px solid rgba(217,96,11,0.5)", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
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

const MAX_MB = 5
const subir = async (archivo) => {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error("Usa JPG, PNG o WEBP.")
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`La imagen pesa más de ${MAX_MB} MB.`)
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/vendor/uploads", { method: "POST", credentials: "include", body: fd })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || "No se pudo subir la imagen.")
  return d.files[0].url
}

function CampoImagen({ titulo, ayuda, valor, alCambiar, ancho = 160, alto = 160 }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState("")
  return (
    <div>
      <label style={S.label}>{titulo}</label>
      <div style={{ width: ancho, height: alto, maxWidth: "100%", borderRadius: 10, border: "1px dashed #D9D5C9", background: valor ? `center/cover no-repeat url(${valor})` : "#F3F1EA", display: "grid", placeItems: "center", color: "#6B675C", fontSize: 12 }}>
        {!valor && "Sin imagen"}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ ...S.btn2, display: "inline-block" }}>
          {subiendo ? "Subiendo..." : valor ? "Cambiar" : "Subir imagen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={subiendo}
            onChange={async (e) => {
              const a = e.target.files?.[0]
              e.target.value = ""
              if (!a) return
              setError(""); setSubiendo(true)
              try { alCambiar(await subir(a)) } catch (err) { setError(err.message) } finally { setSubiendo(false) }
            }} />
        </label>
        {valor && <button type="button" style={S.btn2} onClick={() => alCambiar("")}>Quitar</button>}
      </div>
      <p style={S.hint}>{ayuda}</p>
      {error && <p style={{ ...S.hint, color: "#B3261E" }}>{error}</p>}
    </div>
  )
}

// Tipos de máquina (mismos valores que apps/storefront/src/lib/hetna/talleres.ts)
const TIPOS_MAQUINA = [
  ["router", "Router CNC"],
  ["laser_co2", "Láser CO2"],
  ["laser_fibra", "Láser de fibra"],
  ["plasma", "Plasma CNC"],
  ["fresadora", "Fresadora / centro de maquinado"],
  ["torno", "Torno CNC"],
  ["impresora_3d", "Impresora 3D"],
  ["waterjet", "Chorro de agua"],
  ["dobladora", "Dobladora / plegadora"],
  ["otra", "Otra"],
]
const CONTROLADORES = ["Mach3", "Mach4", "DSP (RichAuto)", "Ruida", "Syntec", "GRBL", "LinuxCNC", "Weihong / NcStudio", "Fanuc", "Haas", "Siemens", "Heidenhain", "Otro"]

export default function PerfilTallerPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [metaBase, setMetaBase] = useState({})
  const [nombre, setNombre] = useState("")
  const [handle, setHandle] = useState("")
  const [logo, setLogo] = useState("")
  const [banner, setBanner] = useState("")
  const [galeria, setGaleria] = useState([])
  const [subiendoGal, setSubiendoGal] = useState(false)
  const [f, setF] = useState({
    lema: "", ciudad: "", estado: "", cp: "", ofrece: [], entrega: "", anos: "",
    servicios: [], materiales: [], otrosMateriales: "", capacidades: "", maquinas: [],
    tarifas: {}, tipo_cuenta: "taller", marcas: "",
  })

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const alternar = (k, v) =>
    setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }))

  useEffect(() => {
    fetch("/vendor/sellers/me?fields=id,name,handle,metadata,logo,banner", { credentials: "include" })
      .then((r) => r.json())
      .then(({ seller }) => {
        const meta = parseMeta(seller?.metadata)
        const p = meta.perfil || {}
        setNombre(seller?.name || "")
        setHandle(seller?.handle || "")
        setLogo(seller?.logo || "")
        setBanner(seller?.banner || "")
        setGaleria(Array.isArray(p.galeria) ? p.galeria : [])
        setMetaBase(meta)
        const mats = Array.isArray(p.materiales) ? p.materiales : []
        setF({
          lema: p.lema || "",
          ciudad: p.ciudad || "",
          estado: p.estado || "",
          cp: p.cp || "",
          ofrece: Array.isArray(p.ofrece) ? p.ofrece : [],
          entrega: p.entrega || "",
          anos: p.anos ?? "",
          servicios: Array.isArray(p.servicios) ? p.servicios : [],
          // Licitaciones 3.0: taller (fabrica), proveedor (vende productos) o ambos
          tipo_cuenta: ["taller", "proveedor", "ambos"].includes(p.tipo_cuenta) ? p.tipo_cuenta : "taller",
          marcas: (Array.isArray(p.marcas) ? p.marcas : []).join(", "),
          materiales: mats.filter((m) => MATERIALES.includes(m)),
          otrosMateriales: mats.filter((m) => !MATERIALES.includes(m)).join(", "),
          capacidades: (Array.isArray(p.capacidades) ? p.capacidades : []).join("\n"),
          // Las máquinas de antes sólo traían el área en texto ("1500 x 3000 mm")
          maquinas: (Array.isArray(p.maquinas) ? p.maquinas : []).map((m) => {
            // Sólo si parecen milímetros (en metros o cm se deja para que lo capture)
            const a0 = String(m.area || "").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i)
            const a = a0 && Number(a0[1]) >= 50 && Number(a0[2]) >= 50 && !/\b(m|cm)\b/i.test(String(m.area)) ? a0 : null
            return { ...m, x: m.x ?? (a ? Math.round(Number(a[1])) : ""), y: m.y ?? (a ? Math.round(Number(a[2])) : ""), z: m.z ?? "" }
          }),
          tarifas: Object.fromEntries(
            PROCESOS_TARIFA.map((k) => {
              const t = (p.tarifas && p.tarifas[k]) || {}
              return [k, { m2: t.m2 ? String(t.m2) : "", metro: t.metro ? String(t.metro) : "", minimo: t.minimo ? String(t.minimo) : "" }]
            })
          ),
        })
      })
      .catch(() => setMsg({ ok: false, t: "No se pudo cargar tu perfil. Recarga la página." }))
      .finally(() => setCargando(false))
  }, [])

  const guardar = async () => {
    setGuardando(true)
    setMsg(null)
    const otros = f.otrosMateriales.split(",").map((x) => x.trim()).filter(Boolean)
    const perfil = {
      ...(metaBase.perfil || {}),
      lema: f.lema.trim(),
      ciudad: f.ciudad.trim(),
      estado: f.estado,
      cp: /^\d{5}$/.test(f.cp.trim()) ? f.cp.trim() : "",
      ofrece: f.ofrece,
      lat: undefined,
      lng: undefined,
      entrega: f.entrega.trim(),
      anos: f.anos === "" ? undefined : Number(f.anos),
      whatsapp: undefined,
      servicios: f.servicios,
      tipo_cuenta: f.tipo_cuenta,
      marcas: f.marcas.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20),
      materiales: [...f.materiales, ...otros],
      capacidades: lineas(f.capacidades),
      // Con X e Y se arma el área en texto (la usan las páginas que ya existían)
      maquinas: f.maquinas
        .filter((m) => (m.nombre || "").trim() || m.tipo)
        .map((m) => {
          const n = (v) => (Number(v) > 0 ? Math.round(Number(v)) : undefined)
          const x = n(m.x), y = n(m.y), z = n(m.z)
          const nombre = (m.nombre || "").trim() || (TIPOS_MAQUINA.find(([v]) => v === m.tipo)?.[1] ?? "Máquina")
          return {
            tipo: m.tipo || undefined,
            nombre,
            marca: (m.marca || "").trim() || undefined,
            x, y, z,
            area: x && y ? `${x} x ${y} mm` : (m.area || "").trim() || undefined,
            potencia: (m.potencia || "").trim() || undefined,
            controlador: (m.controlador || "").trim() || undefined,
            detalle: (m.detalle || "").trim() || undefined,
          }
        }),
      galeria,
      tarifas: Object.fromEntries(
        PROCESOS_TARIFA.flatMap((k) => {
          const t = f.tarifas[k] || TARIFA_VACIA
          const n = (v) => Math.max(0, Number(String(v).replace(/[^\d.]/g, "")) || 0)
          const m2 = n(t.m2), metro = n(t.metro), minimo = n(t.minimo)
          return m2 > 0 || metro > 0 ? [[k, { m2, metro: metro || undefined, minimo }]] : []
        })
      ),
    }
    try {
      const r = await fetch("/vendor/sellers/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: logo || null, banner: banner || null, metadata: { ...metaBase, perfil } }),
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

      <VistaPrevia nombre={nombre} handle={handle} logo={logo} banner={banner} f={f} galeria={galeria} />

      <section style={S.card}>
        <h2 style={S.h2}>Imagen de tu taller</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <CampoImagen titulo="Logo" ayuda="Cuadrado, mínimo 400 x 400 px." valor={logo} alCambiar={setLogo} />
          <CampoImagen titulo="Portada (banner)" ayuda="Horizontal, ideal 1600 x 400 px. Muestra tu taller o tus trabajos." valor={banner} alCambiar={setBanner} ancho={420} alto={110} />
        </div>
        <label style={{ ...S.label, marginTop: 16 }}>Galería de trabajos ({galeria.length}/12)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {galeria.map((u) => (
            <div key={u} style={{ position: "relative", width: 96, height: 96, borderRadius: 8, background: `center/cover no-repeat url(${u})` }}>
              <button type="button" aria-label="Quitar foto" onClick={() => setGaleria(galeria.filter((x) => x !== u))}
                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, border: 0, background: "rgba(0,0,0,.65)", color: "#fff", cursor: "pointer" }}>×</button>
            </div>
          ))}
          {galeria.length < 12 && (
            <label style={{ width: 96, height: 96, borderRadius: 8, border: "1px dashed #D9D5C9", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 12, color: "#6B675C", textAlign: "center" }}>
              {subiendoGal ? "Subiendo..." : "+ Agregar fotos"}
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={subiendoGal}
                onChange={async (e) => {
                  const archivos = Array.from(e.target.files || []).slice(0, 12 - galeria.length)
                  e.target.value = ""
                  if (!archivos.length) return
                  setSubiendoGal(true)
                  const nuevas = []
                  for (const a of archivos) {
                    try { nuevas.push(await subir(a)) } catch (err) { setMsg({ ok: false, t: err.message }) }
                  }
                  setGaleria((g) => [...g, ...nuevas].slice(0, 12))
                  setSubiendoGal(false)
                }} />
            </label>
          )}
        </div>
        <p style={S.hint}>Fotos de piezas terminadas, tu taller y tus máquinas. No pongas teléfonos ni datos de contacto en las imágenes. Recuerda guardar.</p>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Ubicación</h2>
        <div style={S.grid}>
          <div>
            <label style={S.label}>Municipio o ciudad</label>
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
            <label style={S.label}>Código postal del taller</label>
            <input style={S.input} value={f.cp} onChange={(e) => set("cp", e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="5 dígitos" inputMode="numeric" />
            <p style={{ ...S.hint, marginTop: 6 }}>No se publica. Sirve para que los clientes de tu zona te vean primero como "taller cerca de ti".</p>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={S.label}>¿Qué más ofreces? (sale como "todo incluido" al cliente)</label>
          {OFRECE.map(([v, t]) => (
            <label key={v} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, marginTop: 6 }}>
              <input type="checkbox" checked={f.ofrece.includes(v)} onChange={() => alternar("ofrece", v)} />
              {t}
            </label>
          ))}
        </div>
        <p style={{ ...S.hint, marginTop: 12 }}>
          En el mapa público solo se muestra cuántos talleres hay por estado y municipio. Tu dirección y teléfono no se publican:
          los clientes te contactan por HETNA.
        </p>
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
        <h2 style={S.h2}>Tipo de cuenta</h2>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6B675C" }}>
          Taller: fabricas piezas y recibes licitaciones. Proveedor: vendes productos e insumos (materiales, herramientas, máquinas) y recibirás licitaciones de suministro. Ambos: las dos cosas.
        </p>
        <div style={S.chips}>
          {[["taller", "🏭 Taller"], ["proveedor", "📦 Proveedor"], ["ambos", "🏭📦 Ambos"]].map(([v, l]) => (
            <button type="button" key={v} style={chip(f.tipo_cuenta === v)} onClick={() => set("tipo_cuenta", v)}>{l}</button>
          ))}
        </div>
        {f.tipo_cuenta !== "taller" && (
          <>
            <label style={{ ...S.label, marginTop: 12 }}>Marcas que distribuyes (separadas por coma)</label>
            <input style={S.input} value={f.marcas} onChange={(e) => set("marcas", e.target.value)} placeholder="Ej. Onsrud, Amana Tool, Ruida" />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B675C" }}>
              Para mostrar "Distribuidor autorizado" pide la verificación con la carta de la marca en Verificación.
            </p>
          </>
        )}
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
        <p style={S.hint}>
          Con el tipo y el área de trabajo, los clientes te encuentran en el directorio y te llegan las solicitudes que sí puedes hacer.
        </p>
        {f.maquinas.map((m, i) => {
          const cambiar = (k, v) => set("maquinas", f.maquinas.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
          return (
            <div key={i} style={{ border: "1px solid #E7E4DC", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ ...S.grid, alignItems: "end" }}>
                <div>
                  <label style={S.label}>Tipo</label>
                  <select style={S.input} value={m.tipo || ""} onChange={(e) => cambiar("tipo", e.target.value)}>
                    <option value="">Elige el tipo</option>
                    {TIPOS_MAQUINA.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Nombre o modelo</label>
                  <input style={S.input} value={m.nombre || ""} onChange={(e) => cambiar("nombre", e.target.value)} placeholder="Router CNC 1530" />
                </div>
                <div>
                  <label style={S.label}>Marca</label>
                  <input style={S.input} value={m.marca || ""} onChange={(e) => cambiar("marca", e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              <div style={{ ...S.grid, alignItems: "end", marginTop: 8 }}>
                <div>
                  <label style={S.label}>Área X (mm)</label>
                  <input style={S.input} inputMode="numeric" value={m.x ?? ""} onChange={(e) => cambiar("x", e.target.value.replace(/[^\d]/g, ""))} placeholder="1500" />
                </div>
                <div>
                  <label style={S.label}>Área Y (mm)</label>
                  <input style={S.input} inputMode="numeric" value={m.y ?? ""} onChange={(e) => cambiar("y", e.target.value.replace(/[^\d]/g, ""))} placeholder="3000" />
                </div>
                <div>
                  <label style={S.label}>Altura Z (mm)</label>
                  <input style={S.input} inputMode="numeric" value={m.z ?? ""} onChange={(e) => cambiar("z", e.target.value.replace(/[^\d]/g, ""))} placeholder="Opcional" />
                </div>
                <div>
                  <label style={S.label}>Potencia</label>
                  <input style={S.input} value={m.potencia || ""} onChange={(e) => cambiar("potencia", e.target.value)} placeholder="Spindle 3 kW, tubo 100 W…" />
                </div>
                <div>
                  <label style={S.label}>Controlador</label>
                  <input style={S.input} list="controladores-cnc" value={m.controlador || ""} onChange={(e) => cambiar("controlador", e.target.value)} placeholder="Mach3, DSP, Ruida…" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "end", marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Detalle</label>
                  <input style={S.input} value={m.detalle || ""} onChange={(e) => cambiar("detalle", e.target.value)} placeholder="4° eje, cambiador de herramienta, mesa de vacío…" />
                </div>
                <button type="button" style={S.btn2} onClick={() => set("maquinas", f.maquinas.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            </div>
          )
        })}
        <datalist id="controladores-cnc">
          {CONTROLADORES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button type="button" style={S.btn2} onClick={() => set("maquinas", [...f.maquinas, { tipo: "", nombre: "", marca: "", x: "", y: "", z: "", potencia: "", controlador: "", detalle: "" }])}>+ Agregar máquina</button>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Tarifas para estimado rápido</h2>
        <p style={{ ...S.hint, marginTop: 0, marginBottom: 12 }}>
          Cuando un cliente diseña una pieza en HETNA y pide "Fabrícamelo", ve junto a tu taller un precio estimado calculado con estas
          tarifas y las medidas de su archivo. Es orientativo: el precio formal lo pones tú en la propuesta. Deja en blanco los procesos que no haces.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#6B675C", textAlign: "left" }}>
                <th style={{ padding: "4px 8px 4px 0", fontWeight: 600 }}>Proceso</th>
                <th style={{ padding: "4px 8px", fontWeight: 600 }}>$ por m² de material</th>
                <th style={{ padding: "4px 8px", fontWeight: 600 }}>$ por metro de corte (opcional)</th>
                <th style={{ padding: "4px 8px", fontWeight: 600 }}>Pedido mínimo $</th>
              </tr>
            </thead>
            <tbody>
              {PROCESOS_TARIFA.map((k) => {
                const t = f.tarifas[k] || TARIFA_VACIA
                const pon = (campo) => (e) => setF((x) => ({ ...x, tarifas: { ...x.tarifas, [k]: { ...(x.tarifas[k] || TARIFA_VACIA), [campo]: e.target.value } } }))
                return (
                  <tr key={k}>
                    <td style={{ padding: "4px 8px 4px 0", fontWeight: 600, whiteSpace: "nowrap" }}>{k}</td>
                    <td style={{ padding: 4 }}><input style={S.input} inputMode="decimal" placeholder="Ej. 650" value={t.m2} onChange={pon("m2")} /></td>
                    <td style={{ padding: 4 }}><input style={S.input} inputMode="decimal" placeholder="Ej. 12" value={t.metro} onChange={pon("metro")} /></td>
                    <td style={{ padding: 4 }}><input style={S.input} inputMode="decimal" placeholder="Ej. 150" value={t.minimo} onChange={pon("minimo")} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={S.hint}>
          Estimado = (área de la pieza × $/m²) + (metros de corte × $/m), por la cantidad; nunca menor al pedido mínimo. Incluye material si lo pones tú.
        </p>
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

// Vista previa de cómo te ven los clientes y qué tan completo está tu perfil
// (rediseño nov 2026). Se actualiza mientras llenas el formulario.
function VistaPrevia({ nombre, handle, logo, banner, f, galeria }) {
  const pasos = [
    ["Logo", !!logo],
    ["Portada", !!banner],
    ["Lema", !!(f.lema || "").trim()],
    ["Ubicación", !!(f.ciudad && f.estado)],
    ["Servicios", (f.servicios || []).length > 0],
    ["Materiales", (f.materiales || []).length > 0],
    ["Máquinas", (f.maquinas || []).length > 0],
    ["Galería", (galeria || []).length >= 3],
  ]
  const hechos = pasos.filter(([, ok]) => ok).length
  const pct = Math.round((hechos / pasos.length) * 100)
  const faltan = pasos.filter(([, ok]) => !ok).map(([n]) => n)
  return (
    <section style={{ ...S.card, padding: 0, overflow: "hidden" }}>
      <div style={{ height: 120, background: banner ? `center/cover no-repeat url(${banner})` : "linear-gradient(120deg,#142033,#22334F 60%,#C2560A)" }} />
      <div style={{ padding: "0 20px 18px", marginTop: -34, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: logo ? `center/cover no-repeat url(${logo})` : "#C2560A", border: "3px solid #fff", boxShadow: "0 6px 16px -8px rgba(20,32,51,0.4)", display: "grid", placeItems: "center", color: "#fff", fontSize: 28, fontWeight: 800 }}>
          {!logo && (nombre || "T").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200, paddingTop: 40, paddingBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#142033" }}>{nombre || "Tu taller"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#55544D" }}>
            {f.lema || "Escribe un lema corto que diga qué haces mejor"}
            {f.ciudad ? ` · 📍 ${[f.ciudad, f.estado].filter(Boolean).join(", ")}` : ""}
          </p>
        </div>
        {handle && (
          <a href={`https://hetnacnc.com/mx/talleres/${handle}`} target="_blank" rel="noreferrer" style={{ ...S.btn2, textDecoration: "none", marginBottom: 4 }}>
            Ver mi página ↗
          </a>
        )}
      </div>
      {(f.servicios || []).length > 0 && (
        <div style={{ padding: "0 20px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {f.servicios.slice(0, 8).map((x) => (
            <span key={x} style={{ background: "#F3F1EA", color: "#40403A", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{x}</span>
          ))}
        </div>
      )}
      <div style={{ borderTop: "1px solid rgba(20,32,51,0.06)", padding: "12px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#142033" }}>
          <span>Tu perfil está {pct}% completo</span>
          <span style={{ color: pct === 100 ? "#1E7B3A" : "#C2560A" }}>{hechos} de {pasos.length}</span>
        </div>
        <div style={{ height: 8, background: "#EFECE4", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#1E7B3A" : "linear-gradient(90deg,#D9600B,#C2560A)" }} />
        </div>
        {faltan.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B675C" }}>Te falta: {faltan.join(", ")}. Los perfiles completos reciben más solicitudes.</p>}
      </div>
    </section>
  )
}
