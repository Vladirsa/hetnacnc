// Panel del taller > Blog: los instructores escriben artículos de innovación
// o conocimiento para el blog de HETNA. HETNA los revisa antes de publicarlos
// y cada artículo aprobado baja la comisión de sus cursos
// (packages/api/src/lib/comision-autores.ts).
//   GET    /vendor/hetna-blog        mis artículos + mi comisión
//   POST   /vendor/hetna-blog        mandar uno nuevo a revisión
//   POST   /vendor/hetna-blog/:id    editar (vuelve a revisión)
//   DELETE /vendor/hetna-blog/:id    borrar
import { useEffect, useState } from "react"
import { Badge, Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { DocumentText } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

export const config: RouteConfig = {
  label: "Blog",
  icon: DocumentText,
  rank: 22,
}

type Articulo = {
  id: string
  slug: string
  title: string
  excerpt: string
  categoria: string | null
  cover_image_url: string | null
  texto_original: string | null
  estado: "pendiente" | "rechazado" | "publicado" | "oculto"
  motivo_revision: string | null
  published_at: string | null
  created_at: string
}
type Comision = {
  base: number | null
  actual: number | null
  articulos: number
  dias: number
  escalones: { articulos: number; pct: number }[]
  siguiente: { articulos: number; pct: number } | null
  vence: string | null
}
type Reglas = { min_letras: number; max_letras: number; max_pendientes: number }

const BLOG = "https://hetnacnc.com/mx/foro-cnc/blog/"
const SECCIONES: [string, string][] = [
  ["", "General"],
  ["router-cnc", "Router CNC"],
  ["corte-laser", "Corte láser"],
  ["plasma", "Plasma CNC"],
  ["torno-fresadora", "Torno y fresadora CNC"],
  ["impresion-3d", "Impresión 3D"],
  ["diseno-cam", "Diseño y CAM"],
  ["controladores-electronica", "Controladores y electrónica"],
  ["materiales-herramientas", "Materiales y herramientas"],
  ["precios-negocio", "Precios y negocio"],
  ["muestra-tu-trabajo", "Muestra tu trabajo"],
]
const ESTADO: Record<Articulo["estado"], { texto: string; color: "orange" | "red" | "green" | "grey" }> = {
  pendiente: { texto: "En revisión", color: "orange" },
  rechazado: { texto: "Necesita cambios", color: "red" },
  publicado: { texto: "Publicado", color: "green" },
  oculto: { texto: "Oculto", color: "grey" },
}
const AYUDA = `## Así se pone un subtítulo
Deja una línea vacía entre párrafos. **Negritas** con dos asteriscos.

- Una lista con guiones
- Un elemento por línea

[Texto de una liga](https://...)
![Descripción de una foto](https://...)`

const subirPortada = async (archivo: File): Promise<string> => {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error("Usa una imagen JPG, PNG o WEBP.")
  if (archivo.size > 8 * 1024 * 1024) throw new Error("La imagen pesa más de 8 MB.")
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/vendor/uploads", { method: "POST", credentials: "include", body: fd })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || "No se pudo subir la portada.")
  return d.files[0].url
}

const vacio = { id: "", titulo: "", resumen: "", texto: "", categoria: "", portada: "" }

export default function BlogTallerPage() {
  const [articulos, setArticulos] = useState<Articulo[] | null>(null)
  const [comision, setComision] = useState<Comision | null>(null)
  const [reglas, setReglas] = useState<Reglas>({ min_letras: 1500, max_letras: 40000, max_pendientes: 3 })
  const [f, setF] = useState(vacio)
  const [abierto, setAbierto] = useState(false)
  const [ayuda, setAyuda] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")

  const cargar = () =>
    fetch("/vendor/hetna-blog", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setArticulos(d.articulos || [])
        setComision(d.comision || null)
        if (d.reglas) setReglas(d.reglas)
      })
      .catch(() => setArticulos([]))
  useEffect(() => {
    cargar()
  }, [])

  const nuevo = () => {
    setF(vacio)
    setError("")
    setAbierto(true)
  }
  const editar = (a: Articulo) => {
    setF({ id: a.id, titulo: a.title, resumen: a.excerpt, texto: a.texto_original || "", categoria: a.categoria || "", portada: a.cover_image_url || "" })
    setError("")
    setAbierto(true)
  }

  const elegirPortada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = e.target.files?.[0]
    e.target.value = ""
    if (!a) return
    setOcupado(true)
    try {
      const url = await subirPortada(a)
      setF((x) => ({ ...x, portada: url }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const enviar = async () => {
    setError("")
    if (f.texto.trim().length < reglas.min_letras) return setError(`Escribe al menos ${reglas.min_letras} letras (llevas ${f.texto.trim().length}).`)
    if (f.id && !window.confirm("Al guardar los cambios el artículo vuelve a revisión y deja de verse hasta que lo aprobemos. ¿Seguir?")) return
    setOcupado(true)
    try {
      const r = await fetch(`/vendor/hetna-blog${f.id ? `/${f.id}` : ""}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titulo: f.titulo, resumen: f.resumen, texto: f.texto, categoria: f.categoria, portada_url: f.portada }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo guardar.")
      toast.success("Listo: lo revisamos y te avisamos por correo.")
      setAbierto(false)
      cargar()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const borrar = async (a: Articulo) => {
    if (!window.confirm(`¿Borrar "${a.title}"? Si estaba publicado deja de contar para tu comisión.`)) return
    const r = await fetch(`/vendor/hetna-blog/${a.id}`, { method: "DELETE", credentials: "include" })
    if (r.ok) {
      toast.success("Artículo borrado.")
      cargar()
    } else toast.error("No se pudo borrar.")
  }

  const c = comision
  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-3 p-6">
        <Heading level="h1">Escribe en el blog y paga menos comisión por tus cursos</Heading>
        <Text className="text-ui-fg-subtle">
          Comparte lo que sabes: innovaciones, técnicas, casos de tu taller, cómo elegir una fresa o configurar una máquina. Cada
          artículo que aprobamos se publica en el blog de HETNA con tu nombre, te trae alumnos y baja la comisión de tus cursos.
        </Text>
        {c && c.base != null && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ui-border-base p-3">
              <Text size="small" className="text-ui-fg-subtle">Tu comisión por curso vendido hoy</Text>
              <Text className="text-2xl font-semibold">{c.actual}%</Text>
              {c.actual != null && c.actual < c.base && <Text size="small" className="text-ui-fg-subtle">La normal es {c.base}%</Text>}
            </div>
            <div className="rounded-lg border border-ui-border-base p-3">
              <Text size="small" className="text-ui-fg-subtle">Artículos que cuentan (últimos {c.dias} días)</Text>
              <Text className="text-2xl font-semibold">{c.articulos}</Text>
              {c.vence && <Text size="small" className="text-ui-fg-subtle">El más viejo deja de contar el {new Date(c.vence).toLocaleDateString("es-MX")}</Text>}
            </div>
            <div className="rounded-lg border border-ui-border-base p-3">
              <Text size="small" className="text-ui-fg-subtle">Así baja</Text>
              {c.escalones.filter((e) => c.base != null && e.pct < c.base).map((e) => (
                <Text key={e.articulos} size="small">
                  {e.articulos} {e.articulos === 1 ? "artículo" : "artículos o más"}: <strong>{e.pct}%</strong>
                </Text>
              ))}
              {c.siguiente && (
                <Text size="small" className="text-ui-fg-interactive">
                  Te falta{c.siguiente.articulos - c.articulos === 1 ? "" : "n"} {c.siguiente.articulos - c.articulos} para pagar {c.siguiente.pct}%
                </Text>
              )}
            </div>
          </div>
        )}
        <Text size="small" className="text-ui-fg-subtle">
          Cuenta cada artículo aprobado durante {c?.dias ?? 90} días desde que lo aprobamos. Aplica a ventas nuevas de tus cursos; los
          libros y tus demás productos siguen igual. Tienen que ser tuyos (no copiados) y útiles, no un anuncio: los anuncios y el
          contenido copiado se rechazan.
        </Text>
        {!abierto && (
          <div>
            <Button onClick={nuevo}>Escribir un artículo</Button>
          </div>
        )}
      </Container>

      {abierto && (
        <Container className="flex flex-col gap-3 p-6">
          <Heading level="h2">{f.id ? "Editar artículo" : "Artículo nuevo"}</Heading>
          <div className="flex flex-col gap-1">
            <Label>Título *</Label>
            <Input value={f.titulo} maxLength={160} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Cómo fresar aluminio en router CNC sin romper fresas" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>Tema</Label>
              <select className="rounded-md border border-ui-border-base bg-ui-bg-field px-2 py-1.5 text-sm" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
                {SECCIONES.map(([v, t]) => (
                  <option key={v} value={v}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Portada (opcional)</Label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirPortada} disabled={ocupado} className="text-sm" />
                {f.portada && <img src={f.portada} alt="" className="h-10 w-16 rounded object-cover" />}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Resumen (opcional, sale en la lista y en Google)</Label>
            <Input value={f.resumen} maxLength={300} onChange={(e) => setF({ ...f, resumen: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label>Artículo *</Label>
              <button type="button" className="text-xs text-ui-fg-interactive" onClick={() => setAyuda(!ayuda)}>
                {ayuda ? "Ocultar ayuda" : "¿Cómo doy formato?"}
              </button>
            </div>
            {ayuda && <pre className="whitespace-pre-wrap rounded-md bg-ui-bg-subtle p-3 text-xs">{AYUDA}</pre>}
            <Textarea rows={18} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} placeholder="Escribe aquí. Deja una línea vacía entre párrafos." />
            <Text size="small" className={f.texto.trim().length < reglas.min_letras ? "text-ui-fg-subtle" : "text-ui-fg-interactive"}>
              {f.texto.trim().length} letras · mínimo {reglas.min_letras}
            </Text>
          </div>
          {error && <Text className="text-ui-fg-error">{error}</Text>}
          <div className="flex gap-2">
            <Button onClick={enviar} isLoading={ocupado}>{f.id ? "Guardar y mandar a revisión" : "Mandar a revisión"}</Button>
            <Button variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        </Container>
      )}

      <Container className="flex flex-col gap-2 p-6">
        <Heading level="h2">Mis artículos</Heading>
        {articulos === null ? (
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        ) : articulos.length === 0 ? (
          <Text className="text-ui-fg-subtle">Todavía no escribes ninguno. El primero ya baja tu comisión.</Text>
        ) : (
          articulos.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ui-border-base py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Text className="font-medium">{a.title}</Text>
                  <Badge color={ESTADO[a.estado].color} size="2xsmall">{ESTADO[a.estado].texto}</Badge>
                </div>
                {a.estado === "rechazado" && a.motivo_revision && (
                  <Text size="small" className="text-ui-fg-error">Qué corregir: {a.motivo_revision}</Text>
                )}
              </div>
              <div className="flex gap-2">
                {a.estado === "publicado" && (
                  <a href={BLOG + a.slug} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="small">Ver</Button>
                  </a>
                )}
                <Button variant="secondary" size="small" onClick={() => editar(a)}>Editar</Button>
                <Button variant="danger" size="small" onClick={() => void borrar(a)}>Borrar</Button>
              </div>
            </div>
          ))
        )}
      </Container>
    </div>
  )
}
