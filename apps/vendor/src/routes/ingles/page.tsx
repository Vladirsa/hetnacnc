// @ts-nocheck
// Panel del taller > Productos en inglés: el texto que ven los clientes de
// Estados Unidos en hetnacnc.com/us. Si el taller no escribe nada, HETNA lo
// traduce solo con IA; aquí lo puede revisar, corregir o traducir de nuevo.
//   GET  /vendor/hetna-ingles               -> productos con su español y su inglés
//   POST /vendor/hetna-ingles/:id           -> guarda el inglés
//   POST /vendor/hetna-ingles/:id/traducir  -> propuesta de la IA (no guarda)
// Ver packages/api/src/lib/productos-ingles.ts.
import { useEffect, useMemo, useState } from "react"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Icono = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9z" />
  </svg>
)

export const config: RouteConfig = {
  label: "Productos en inglés",
  icon: Icono,
}

const TIENDA_US = "https://hetnacnc.com/us/products/"

const S = {
  page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0, color: "#142033" },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 16px", lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #E7E4DC", borderRadius: 12, padding: 16, marginBottom: 12 },
  label: { display: "block", fontSize: 13, fontWeight: 600, margin: "12px 0 4px", color: "#142033" },
  ref: { fontSize: 12, color: "#6B675C", margin: "0 0 4px", lineHeight: 1.4 },
  input: { width: "100%", height: 38, border: "1px solid #D9D5C9", borderRadius: 8, padding: "0 10px", fontSize: 14, boxSizing: "border-box", background: "#fff" },
  area: { width: "100%", minHeight: 160, border: "1px solid #D9D5C9", borderRadius: 8, padding: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 },
  btn: { background: "#C2560A", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btn2: { background: "#fff", color: "#142033", border: "1px solid #142033", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  filtro: (activo) => ({
    background: activo ? "#142033" : "#fff",
    color: activo ? "#fff" : "#142033",
    border: "1px solid #142033",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  }),
}

const ESTADO = {
  lista: { t: "En inglés", c: "#1E7B3A", f: "#E6F4EA" },
  vieja: { t: "Revisar: cambiaste el español", c: "#8A5A00", f: "#FFF4D6" },
  falta: { t: "Falta inglés", c: "#B3261E", f: "#FCE8E6" },
}

// La descripción se guarda en HTML sencillo; aquí se edita como texto:
// párrafos separados por una línea en blanco, "• " para listas y **negritas**.
function htmlATexto(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h3|h4)>/gi, "\n\n")
    .replace(/<(h3|h4)>/gi, "## ")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(ul|ol)>/gi, "\n")
    .replace(/<\/?(strong|b)>/gi, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const negritas = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

function textoAHtml(texto) {
  const bloques = String(texto || "").replace(/\r\n?/g, "\n").trim().split(/\n{2,}/)
  return bloques
    .map((b) => {
      const lineas = b.split("\n").map((l) => l.trim()).filter(Boolean)
      if (!lineas.length) return ""
      if (lineas.length === 1 && lineas[0].startsWith("## ")) return `<h3>${negritas(lineas[0].slice(3))}</h3>`
      if (lineas.every((l) => /^[•\-*]\s/.test(l))) return `<ul>${lineas.map((l) => `<li>${negritas(l.replace(/^[•\-*]\s+/, ""))}</li>`).join("")}</ul>`
      // Un título "## " seguido de una lista sin línea en blanco
      if (lineas[0].startsWith("## ") && lineas.slice(1).every((l) => /^[•\-*]\s/.test(l)))
        return `<h3>${negritas(lineas[0].slice(3))}</h3><ul>${lineas.slice(1).map((l) => `<li>${negritas(l.replace(/^[•\-*]\s+/, ""))}</li>`).join("")}</ul>`
      return `<p>${lineas.map(negritas).join("<br>")}</p>`
    })
    .join("")
}

const recorta = (s, n = 220) => {
  const t = htmlATexto(s).replace(/\s+/g, " ")
  return t.length > n ? t.slice(0, n) + "…" : t
}

function Editor({ producto, ia, limites, alGuardar }) {
  const desdeEn = (en) => ({
    en_title: en.en_title || "",
    en_subtitle: en.en_subtitle || "",
    en_description: htmlATexto(en.en_description || ""),
    en_seo_title: en.en_seo_title || "",
    en_meta_description: en.en_meta_description || "",
  })
  const [f, setF] = useState(() => desdeEn(producto.en))
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [traduciendo, setTraduciendo] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const es = producto.es

  const traducir = async () => {
    setMsg(null)
    setTraduciendo(true)
    try {
      const r = await fetch(`/vendor/hetna-ingles/${producto.id}/traducir`, { method: "POST", credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo traducir.")
      setF(desdeEn(d.en || {}))
      setMsg({ ok: true, t: "Listo. Revísalo y toca «Guardar» para publicarlo." })
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setTraduciendo(false)
    }
  }

  const guardar = async () => {
    setMsg(null)
    setGuardando(true)
    try {
      const r = await fetch(`/vendor/hetna-ingles/${producto.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, en_description: textoAHtml(f.en_description) }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo guardar.")
      setF(desdeEn(d.en || {}))
      alGuardar(d)
      setMsg({ ok: true, t: "Guardado. Se verá en la tienda en inglés en unos minutos." })
    } catch (e) {
      setMsg({ ok: false, t: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const campo = (k, titulo, ref, max) => (
    <div>
      <label style={S.label}>{titulo}</label>
      {ref ? <p style={S.ref}>Español: {ref}</p> : null}
      <input style={S.input} maxLength={max} value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  )

  return (
    <div style={{ borderTop: "1px solid #EFECE4", marginTop: 12, paddingTop: 4 }}>
      {campo("en_title", "Nombre en inglés", es.title, limites?.en_title || 200)}
      {es.subtitle ? campo("en_subtitle", "Subtítulo en inglés", es.subtitle, limites?.en_subtitle || 300) : null}
      <label style={S.label}>Descripción en inglés</label>
      {es.description ? <p style={S.ref}>Español: {recorta(es.description)}</p> : null}
      <textarea style={S.area} value={f.en_description} onChange={(e) => set("en_description", e.target.value)} />
      <p style={S.ref}>Deja una línea en blanco entre párrafos. Para una lista empieza cada renglón con «• ». Para negritas: **así**.</p>
      {es.seo_title ? campo("en_seo_title", "Título para Google (inglés)", es.seo_title, limites?.en_seo_title || 90) : null}
      {es.meta_description ? campo("en_meta_description", "Descripción para Google (inglés)", es.meta_description, limites?.en_meta_description || 200) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
        <button type="button" style={{ ...S.btn, opacity: guardando ? 0.6 : 1 }} disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {ia && (
          <button type="button" style={{ ...S.btn2, opacity: traduciendo ? 0.6 : 1 }} disabled={traduciendo} onClick={traducir}>
            {traduciendo ? "Traduciendo…" : "Traducir automático"}
          </button>
        )}
        <a href={TIENDA_US + producto.handle} target="_blank" rel="noreferrer" style={{ color: "#C2560A", fontWeight: 600, fontSize: 13 }}>
          Ver en la tienda en inglés ↗
        </a>
      </div>
      {msg && <p style={{ margin: "10px 0 0", fontSize: 14, color: msg.ok ? "#1E7B3A" : "#B3261E" }}>{msg.t}</p>}
    </div>
  )
}

export default function ProductosInglesPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState("todos")
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    fetch("/vendor/hetna-ingles", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.message || "")))))
      .then(setDatos)
      .catch((e) => setError(e.message || "No se pudieron cargar tus productos. Recarga la página."))
  }, [])

  const productos = datos?.productos || []
  const cuenta = useMemo(() => {
    const c = { lista: 0, vieja: 0, falta: 0 }
    for (const p of productos) c[p.traduccion]++
    return c
  }, [productos])
  const lista = productos.filter((p) => filtro === "todos" || p.traduccion === filtro)

  const alGuardar = (id) => (d) =>
    setDatos((x) => ({ ...x, productos: x.productos.map((p) => (p.id === id ? { ...p, en: d.en, traduccion: d.traduccion, auto: false } : p)) }))

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Productos en inglés</h1>
      <p style={S.sub}>
        Tus productos también se venden a clientes de Estados Unidos en <strong>hetnacnc.com/us</strong>. Si no escribes nada, HETNA los traduce
        solo cuando los publicas o los cambias. Aquí puedes revisar esa traducción, corregirla o escribirla tú. Lo que guardes aquí manda: la
        traducción automática ya no lo cambia.
      </p>

      {error && <div style={{ ...S.card, color: "#B3261E" }}>{error}</div>}
      {!datos && !error && <p style={S.sub}>Cargando…</p>}

      {datos && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button type="button" style={S.filtro(filtro === "todos")} onClick={() => setFiltro("todos")}>
              Todos ({productos.length})
            </button>
            <button type="button" style={S.filtro(filtro === "falta")} onClick={() => setFiltro("falta")}>
              Falta inglés ({cuenta.falta})
            </button>
            <button type="button" style={S.filtro(filtro === "vieja")} onClick={() => setFiltro("vieja")}>
              Por revisar ({cuenta.vieja})
            </button>
            <button type="button" style={S.filtro(filtro === "lista")} onClick={() => setFiltro("lista")}>
              En inglés ({cuenta.lista})
            </button>
          </div>

          {productos.length === 0 && (
            <div style={S.card}>
              <p style={{ margin: 0, fontWeight: 700 }}>Todavía no tienes productos.</p>
              <p style={S.sub}>Cuando publiques uno, aquí podrás revisar cómo se ve en inglés.</p>
            </div>
          )}
          {productos.length > 0 && lista.length === 0 && <p style={S.sub}>No hay productos en esta lista.</p>}

          {lista.map((p) => {
            const e = ESTADO[p.traduccion] || ESTADO.falta
            const abiertoAqui = abierto === p.id
            return (
              <div key={p.id} style={S.card}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {p.foto ? (
                    <img src={p.foto} alt="" width={56} height={56} style={{ borderRadius: 8, objectFit: "cover", flex: "0 0 56px", background: "#F3F1EA" }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: "#F3F1EA", flex: "0 0 56px" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#142033", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.es.title}</p>
                    <p style={{ ...S.ref, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.en.en_title ? `EN: ${p.en.en_title}` : "Sin nombre en inglés"}
                      {p.auto && p.en.en_title ? " · traducido automático" : ""}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: e.c, background: e.f, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>{e.t}</span>
                  <button type="button" style={S.btn2} onClick={() => setAbierto(abiertoAqui ? null : p.id)}>
                    {abiertoAqui ? "Cerrar" : "Editar"}
                  </button>
                </div>
                {abiertoAqui && <Editor producto={p} ia={datos.ia} limites={datos.limites} alGuardar={alGuardar(p.id)} />}
              </div>
            )
          })}
          <p style={{ ...S.ref, marginTop: 14 }}>Sin teléfonos, correos ni redes: los clientes te contactan y te pagan dentro de HETNA.</p>
        </>
      )}
    </div>
  )
}
