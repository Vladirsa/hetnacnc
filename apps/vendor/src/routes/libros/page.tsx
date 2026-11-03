// Panel del taller > Libros y PDF: publicar un libro, manual o guía en PDF
// para venderlo (o regalarlo) en la Academia HETNA.
//
// 1. La portada se sube a /vendor/uploads (pública, como las fotos).
// 2. El PDF se sube a /vendor/hetna-libros/archivo (bucket privado).
// 3. POST /vendor/hetna-libros crea el producto digital (lib/publicar-libro.ts).
// La entrega al comprador ya la hace la tienda: correo con el enlace y Mis
// descargas.
import { useEffect, useState } from "react"
import { Badge, Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { BookOpen } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

export const config: RouteConfig = {
  label: "Libros y PDF",
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
  ["Cobras el 90%", "HETNA sólo cobra su comisión cuando vendes. Publicar es gratis."],
  ["Entrega automática", "El comprador recibe el enlace por correo y el libro queda en Mis descargas."],
  ["Tu PDF protegido", "El archivo vive en almacenamiento privado; sólo lo baja quien lo compró."],
  ["Gratis también vale", "Un manual gratis te trae alumnos y clientes para tu taller."],
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
            Academia HETNA
          </Text>
          <Heading level="h1" className="mt-1 text-white">
            Vende tus libros, manuales y guías en PDF
          </Heading>
          <Text className="mt-1 max-w-2xl text-white/75">
            ¿Tienes un manual de tu máquina, una guía de parámetros o un libro de diseño? Publícalo aquí y véndelo a talleres y
            alumnos de todo México.
          </Text>
        </div>
        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICIOS.map(([t, d]) => (
            <div key={t} className="rounded-lg border p-3">
              <Text weight="plus" size="small">
                {t}
              </Text>
              <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
                {d}
              </Text>
            </div>
          ))}
        </div>
      </Container>

      <Container className="flex flex-col gap-5 px-6 py-5">
        <Heading level="h2">Publicar un libro o PDF</Heading>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <Label size="small">Portada</Label>
            {portada ? (
              <img src={portada} alt="Portada" className="aspect-[3/4] w-full rounded-md border object-cover" />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-md border border-dashed text-sm text-ui-fg-subtle">
                Sin portada
              </div>
            )}
            <label className="inline-flex">
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={elegirPortada} disabled={!!subiendo} />
              <span className="w-full cursor-pointer rounded-md border px-3 py-1.5 text-center text-sm font-medium hover:bg-ui-bg-subtle">
                {subiendo === "portada" ? "Subiendo…" : portada ? "Cambiar portada" : "Subir portada"}
              </span>
            </label>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Vertical, como la portada de un libro (por ejemplo 900×1200 px).
            </Text>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label size="small">Archivo PDF</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex">
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={elegirPdf} disabled={!!subiendo} />
                  <span className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-ui-bg-subtle">
                    {subiendo === "pdf" ? "Subiendo PDF…" : pdf ? "Cambiar PDF" : "Subir PDF"}
                  </span>
                </label>
                {pdf ? (
                  <Badge color="green" size="small">
                    {pdf.nombre} · {pdf.mb} MB
                  </Badge>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Máximo {maxMb} MB. Se guarda privado: sólo lo baja quien lo compra.
                  </Text>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label size="small">Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Manual de parámetros para láser CO₂" maxLength={140} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Autor (opcional)</Label>
                <Input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Tu nombre o el de tu taller" />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Páginas (opcional)</Label>
                <Input type="number" min={1} value={paginas} onChange={(e) => setPaginas(e.target.value)} placeholder="120" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label size="small">De qué trata</Label>
              <Textarea
                rows={5}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={"Qué va a aprender quien lo lea y para quién es.\n- Un renglón con guion se ve como lista\n- Por ejemplo, el índice"}
              />
            </div>

            <div className="flex max-w-xs flex-col gap-1">
              <Label size="small">Precio (MXN)</Label>
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
                Libro gratis (se descarga con cuenta)
              </label>
            </div>

            {error && (
              <Text size="small" className="text-ui-fg-error">
                {error}
              </Text>
            )}
            <div>
              <Button onClick={publicar} isLoading={publicando} disabled={!!subiendo}>
                Publicar libro
              </Button>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Al publicar confirmas que el contenido es tuyo o tienes permiso para venderlo (ver Términos para vendedores).
            </Text>
          </div>
        </div>
      </Container>

      <Container className="flex flex-col gap-3 px-6 py-5">
        <Heading level="h2">Mis libros</Heading>
        {libros === null ? (
          <Text size="small" className="text-ui-fg-subtle">
            Cargando…
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
                  {l.titulo}
                </Text>
                <div className="flex gap-1">
                  <Badge size="2xsmall" color={l.estado === "published" ? "green" : "grey"}>
                    {l.estado === "published" ? "Publicado" : l.estado}
                  </Badge>
                  {l.gratis && (
                    <Badge size="2xsmall" color="blue">
                      Gratis
                    </Badge>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            Todavía no publicas ningún libro.
          </Text>
        )}
      </Container>
    </div>
  )
}
