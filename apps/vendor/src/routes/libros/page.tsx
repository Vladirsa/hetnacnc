// Panel del taller > Libros y PDF: publicar un libro, manual o guía en PDF
// para venderlo (o regalarlo) en la Academia HETNA.
//
// 1. La portada se sube a /vendor/uploads (pública, como las fotos).
// 2. El PDF se sube a /vendor/hetna-libros/archivo (bucket privado).
// 3. POST /vendor/hetna-libros crea el producto digital (lib/publicar-libro.ts).
// La entrega al comprador ya la hace la tienda: correo con el enlace y Mis
// descargas.
import { T, traducir } from "../../lib/idioma"
import { useEffect, useState } from "react"
import { Badge, Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { BookOpen } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

export const config: RouteConfig = {
  label: "Libros y PDF",
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
  icon: BookOpen,
  rank: 21,
}

type Libro = { id: string; titulo: string; handle: string; portada?: string | null; estado: string; gratis: boolean }

const TIENDA = "https://hetnacnc.com/mx/products/"

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

const subirPdf = async (archivo: File, maxMb: number): Promise<{ storage_key: string; mb: number }> => {
  if (archivo.type && archivo.type !== "application/pdf") throw new Error("El archivo debe ser PDF.")
  if (archivo.size > maxMb * 1024 * 1024) throw new Error(`El PDF pesa más de ${maxMb} MB. Comprímelo o divídelo en partes.`)
  const fd = new FormData()
  fd.append("pdf", archivo)
  const r = await fetch("/vendor/hetna-libros/archivo", { method: "POST", credentials: "include", body: fd })
  const d = await r.json().catch(() => ({}))
  if (r.status === 413) throw new Error("El PDF es demasiado grande para el servidor. Comprímelo e intenta de nuevo.")
  if (!r.ok || !d.storage_key) throw new Error(d.message || "No se pudo subir el PDF.")
  return d
}

const BENEFICIOS = [
  ["Llega a todo México", "Tu libro aparece en la Academia HETNA, frente a talleres, operadores y alumnos que buscan aprender CNC."],
  ["Ganas al momento", "Cada compra llega a tu saldo en cuanto se confirma el pago. Vendes aunque estés trabajando."],
  ["Te promocionamos", "Lo anunciamos en la tienda, en el boletín y en Facebook e Instagram de HETNA."],
  ["Gana clientes", "Quien aprende con tu libro te conoce: muchos terminan pidiéndote trabajos o comprando en tu tienda."],
  ["Entrega automática", "El comprador recibe el enlace por correo y el libro queda en Mis descargas. Tú no haces nada."],
  ["Tu PDF protegido", "El archivo vive en almacenamiento privado; sólo lo baja quien lo compró."],
]

export default function LibrosPage() {
  const [libros, setLibros] = useState<Libro[] | null>(null)
  const [maxMb, setMaxMb] = useState(50)
  const [titulo, setTitulo] = useState("")
  const [autor, setAutor] = useState("")
  const [paginas, setPaginas] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [precio, setPrecio] = useState("")
  const [gratis, setGratis] = useState(false)
  const [portada, setPortada] = useState("")
  const [pdf, setPdf] = useState<{ storage_key: string; nombre: string; mb: number } | null>(null)
  const [subiendo, setSubiendo] = useState<"" | "portada" | "pdf">("")
  const [publicando, setPublicando] = useState(false)
  const [error, setError] = useState("")

  const cargar = () =>
    fetch("/vendor/hetna-libros", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setLibros(d.libros || [])
        if (d.max_mb) setMaxMb(d.max_mb)
      })
      .catch(() => setLibros([]))

  useEffect(() => {
    cargar()
  }, [])

  const elegirPortada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = e.target.files?.[0]
    e.target.value = ""
    if (!a) return
    setSubiendo("portada")
    setError("")
    try {
      setPortada(await subirPortada(a))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubiendo("")
    }
  }

  const elegirPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = e.target.files?.[0]
    e.target.value = ""
    if (!a) return
    setSubiendo("pdf")
    setError("")
    try {
      const r = await subirPdf(a, maxMb)
      setPdf({ storage_key: r.storage_key, nombre: a.name, mb: r.mb })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubiendo("")
    }
  }

  const publicar = async () => {
    setError("")
    if (titulo.trim().length < 4) return setError("Escribe el título del libro.")
    if (!portada) return setError("Sube la portada.")
    if (!pdf) return setError("Sube el PDF.")
    const p = gratis ? 0 : Number(precio)
    if (!gratis && (!Number.isFinite(p) || p < 20)) return setError("Pon un precio de al menos $20 MXN, o márcalo como gratis.")
    setPublicando(true)
    try {
      const r = await fetch("/vendor/hetna-libros", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          autor,
          paginas: paginas || null,
          descripcion,
          precio: p,
          portada_url: portada,
          archivo_storage_key: pdf.storage_key,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo publicar.")
      toast.success("¡Libro publicado!", { description: "Ya aparece en la Academia HETNA." })
      setTitulo("")
      setAutor("")
      setPaginas("")
      setDescripcion("")
      setPrecio("")
      setGratis(false)
      setPortada("")
      setPdf(null)
      cargar()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-0 overflow-hidden">
        <div className="bg-[#142033] px-6 py-6 text-white">
          <Text size="xsmall" className="font-semibold uppercase tracking-wide text-[#FFC53D]">
            <T>Academia HETNA</T>
          </Text>
          <Heading level="h1" className="mt-1 text-white">
            <T>Vende tus libros, manuales y guías en PDF</T>
          </Heading>
          <Text className="mt-1 max-w-2xl text-white/75">
            <T>¿Tienes un manual de tu máquina, una guía de parámetros o un libro de diseño? Publícalo aquí y véndelo a talleres y
            alumnos de todo México.</T>
          </Text>
        </div>
        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map(([t, d]) => (
            <div key={t} className="rounded-lg border p-3">
              <Text weight="plus" size="small">
                <T>{t}</T>
              </Text>
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                <T>{d}</T>
              </Text>
            </div>
          ))}
        </div>
      </Container>

      <Container className="flex flex-col gap-5 px-6 py-5">
        <Heading level="h2"><T>Publicar un libro o PDF</T></Heading>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <Label size="small"><T>Portada</T></Label>
            {portada ? (
              <img src={portada} alt={traducir("Portada")} className="aspect-[3/4] w-full rounded-md border object-cover" />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-md border border-dashed text-sm text-ui-fg-subtle">
                <T>Sin portada</T>
              </div>
            )}
            <label className="inline-flex">
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={elegirPortada} disabled={!!subiendo} />
              <span className="w-full cursor-pointer rounded-md border px-3 py-1.5 text-center text-sm font-medium hover:bg-ui-bg-subtle">
                <T>{subiendo === "portada" ? "Subiendo…" : portada ? "Cambiar portada" : "Subir portada"}</T>
              </span>
            </label>
            <Text size="xsmall" className="text-ui-fg-subtle">
              <T>Vertical, como la portada de un libro (por ejemplo 900×1200 px).</T>
            </Text>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label size="small"><T>Archivo PDF</T></Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex">
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={elegirPdf} disabled={!!subiendo} />
                  <span className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-ui-bg-subtle">
                    <T>{subiendo === "pdf" ? "Subiendo PDF…" : pdf ? "Cambiar PDF" : "Subir PDF"}</T>
                  </span>
                </label>
                {pdf ? (
                  <Badge color="green" size="small">
                    <T>{pdf.nombre}</T> · <T>{pdf.mb}</T> <T>MB</T>
                  </Badge>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    <T>Máximo</T> <T>{maxMb}</T> <T>MB. Se guarda privado: sólo lo baja quien lo compra.</T>
                  </Text>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label size="small"><T>Título</T></Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={traducir("Manual de parámetros para láser CO₂")} maxLength={140} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small"><T>Autor (opcional)</T></Label>
                <Input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder={traducir("Tu nombre o el de tu taller")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small"><T>Páginas (opcional)</T></Label>
                <Input type="number" min={1} value={paginas} onChange={(e) => setPaginas(e.target.value)} placeholder="120" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label size="small"><T>De qué trata</T></Label>
              <Textarea
                rows={5}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={"Qué va a aprender quien lo lea y para quién es.\n- Un renglón con guion se ve como lista\n- Por ejemplo, el índice"}
              />
            </div>

            <div className="flex max-w-xs flex-col gap-1">
              <Label size="small"><T>Precio (MXN)</T></Label>
              <Input
                type="number"
                min={20}
                value={gratis ? "" : precio}
                disabled={gratis}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder={gratis ? "Gratis" : "199"}
              />
              <label className="mt-1 flex items-center gap-1.5 text-sm text-ui-fg-subtle">
                <input type="checkbox" checked={gratis} onChange={(e) => setGratis(e.target.checked)} />
                <T>Libro gratis (se descarga con cuenta)</T>
              </label>
            </div>

            {error && (
              <Text size="small" className="text-ui-fg-error">
                <T>{error}</T>
              </Text>
            )}
            <div>
              <Button onClick={publicar} isLoading={publicando} disabled={!!subiendo}>
                <T>Publicar libro</T>
              </Button>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              <T>Al publicar confirmas que el contenido es tuyo o tienes permiso para venderlo (ver Términos para vendedores).</T>
            </Text>
          </div>
        </div>
      </Container>

      <Container className="flex flex-col gap-3 px-6 py-5">
        <Heading level="h2"><T>Mis libros</T></Heading>
        {libros === null ? (
          <Text size="small" className="text-ui-fg-subtle">
            <T>Cargando…</T>
          </Text>
        ) : libros.length ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {libros.map((l) => (
              <a key={l.id} href={`${TIENDA}${l.handle}`} target="_blank" rel="noreferrer" className="flex flex-col gap-1.5 rounded-lg border p-2 hover:bg-ui-bg-subtle">
                {l.portada ? (
                  <img src={l.portada} alt="" className="aspect-[3/4] w-full rounded object-cover" />
                ) : (
                  <div className="aspect-[3/4] w-full rounded bg-ui-bg-subtle" />
                )}
                <Text size="small" weight="plus" className="line-clamp-2">
                  <T>{l.titulo}</T>
                </Text>
                <div className="flex gap-1">
                  <Badge size="2xsmall" color={l.estado === "published" ? "green" : "grey"}>
                    <T>{l.estado === "published" ? "Publicado" : l.estado}</T>
                  </Badge>
                  {l.gratis && (
                    <Badge size="2xsmall" color="blue">
                      <T>Gratis</T>
                    </Badge>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            <T>Todavía no publicas ningún libro.</T>
          </Text>
        )}
      </Container>
    </div>
  )
}
