import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Container, Heading, Text, Button, IconButton, Input, Textarea, Label, Badge, toast } from "@medusajs/ui"
import { ArrowLeft, Trash, Plus } from "@medusajs/icons"
import type { InferClientOutput } from "@mercurjs/client"

import { client } from "../../../lib/client"

type CourseResponse = InferClientOutput<typeof client.vendor.courses.$id.query>
type Course = CourseResponse["course"]
type Section = NonNullable<Course["sections"]>[number]

const formatearDuracion = (segundos: number | null) => {
  if (!segundos) return null
  const minutos = Math.round(segundos / 60)
  return `${minutos} min`
}

const NuevaLeccionForm = ({ courseId, sectionId }: { courseId: string; sectionId: string }) => {
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [title, setTitle] = useState("")
  const [duration, setDuration] = useState("")
  const [isPreview, setIsPreview] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")

  const crear = useMutation({
    mutationFn: () =>
      client.vendor.courses.$id.sections.$sectionId.lessons.mutate({
        $id: courseId,
        $sectionId: sectionId,
        title,
        duration_seconds: duration ? Math.round(Number(duration) * 60) : undefined,
        is_preview: isPreview,
        video_url: videoUrl.trim() || undefined,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-course", courseId] })
      setAbierto(false)
      setTitle("")
      setDuration("")
      setIsPreview(false)
      setVideoUrl("")
    },
    onError: (err: any) => toast.error("No se pudo crear la lección", { description: err?.message }),
  })

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1 text-ui-fg-interactive text-sm px-4 py-2"
      >
        <Plus /> Agregar lección
      </button>
    )
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-2 border-t">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la lección" />
      <Input
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Enlace del video: YouTube (oculto) o Vimeo"
      />
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          min={0}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duración (minutos)"
          className="w-48"
        />
        <label className="flex items-center gap-1.5 text-sm text-ui-fg-subtle">
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
          Vista previa gratis
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="small" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button size="small" disabled={!title} isLoading={crear.isPending} onClick={() => crear.mutate()}>
          Guardar
        </Button>
      </div>
    </div>
  )
}

const SectionCard = ({ course, section }: { course: Course; section: Section }) => {
  const queryClient = useQueryClient()

  const eliminarSeccion = useMutation({
    mutationFn: () => client.vendor.courses.$id.sections.$sectionId.delete({ $id: course.id, $sectionId: section.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-course", course.id] }),
  })

  const eliminarLeccion = useMutation({
    mutationFn: (lessonId: string) =>
      client.vendor.courses.$id.sections.$sectionId.lessons.$lessonId.delete({
        $id: course.id,
        $sectionId: section.id,
        $lessonId: lessonId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-course", course.id] }),
  })

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-ui-bg-subtle">
        <Text weight="plus" size="small">
          {section.title}
        </Text>
        <IconButton size="small" variant="transparent" onClick={() => eliminarSeccion.mutate()}>
          <Trash />
        </IconButton>
      </div>
      <ul className="divide-y">
        {section.lessons.map((lesson) => (
          <li key={lesson.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Text size="small">{lesson.title}</Text>
              {lesson.is_preview && (
                <Badge size="2xsmall" color="orange">
                  Vista previa
                </Badge>
              )}
              {(lesson as any).video_url ? (
                <a href={(lesson as any).video_url} target="_blank" rel="noreferrer" className="text-xs text-ui-fg-interactive">
                  ▶ video
                </a>
              ) : (
                <Badge size="2xsmall" color="red">
                  Sin video
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Text size="small" className="text-ui-fg-subtle">
                {formatearDuracion(lesson.duration_seconds)}
              </Text>
              <IconButton size="small" variant="transparent" onClick={() => eliminarLeccion.mutate(lesson.id)}>
                <Trash />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <NuevaLeccionForm courseId={course.id} sectionId={section.id} />
    </div>
  )
}

const NuevaSeccionForm = ({ courseId }: { courseId: string }) => {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")

  const crear = useMutation({
    mutationFn: () => client.vendor.courses.$id.sections.mutate({ $id: courseId, title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-course", courseId] })
      setTitle("")
    },
    onError: (err: any) => toast.error("No se pudo crear la sección", { description: err?.message }),
  })

  return (
    <div className="flex gap-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del módulo/sección" />
      <Button disabled={!title} isLoading={crear.isPending} onClick={() => crear.mutate()}>
        Agregar sección
      </Button>
    </div>
  )
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<CourseResponse>({
    queryKey: ["vendor-course", id],
    queryFn: () => client.vendor.courses.$id.query({ $id: id! }),
    enabled: !!id,
  })

  const course = data?.course

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [precio, setPrecio] = useState("")
  const [gratis, setGratis] = useState(false)
  useEffect(() => {
    if (course) {
      setTitle(course.title)
      setDescription(course.description || "")
      const p = Number((course as any).price_amount) || 0
      setGratis(!(p > 0))
      setPrecio(p > 0 ? String(p) : "")
    }
  }, [course?.id])

  const guardar = useMutation({
    mutationFn: () =>
      client.vendor.courses.$id.mutate({
        $id: id!,
        title,
        description,
        price_amount: gratis ? 0 : Number(precio) || 0,
      } as any),
    onSuccess: () => {
      toast.success("Cambios guardados")
      queryClient.invalidateQueries({ queryKey: ["vendor-course", id] })
    },
  })

  const togglePublicar = useMutation({
    mutationFn: () =>
      client.vendor.courses.$id.mutate({
        $id: id!,
        status: course?.status === "published" ? "draft" : "published",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-course", id] })
    },
  })

  if (isLoading || !course) {
    return (
      <Container className="p-6">
        <Text size="small">Cargando...</Text>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link to="/courses">
            <IconButton size="small" variant="transparent">
              <ArrowLeft />
            </IconButton>
          </Link>
          <div>
            <Heading>{course.title}</Heading>
            {course.product?.handle && (
              <Text size="small" className="text-ui-fg-subtle">
                Producto: {course.product.handle}
              </Text>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={course.status === "published" ? "green" : "grey"}>
            {course.status === "published" ? "Publicado" : "Borrador"}
          </Badge>
          <Button
            size="small"
            variant={course.status === "published" ? "secondary" : "primary"}
            isLoading={togglePublicar.isPending}
            onClick={() => togglePublicar.mutate()}
          >
            {course.status === "published" ? "Despublicar" : "Publicar curso"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label size="small">Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Descripción</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="flex flex-col gap-1 max-w-xs">
          <Label size="small">Precio (MXN)</Label>
          <Input
            type="number"
            min={0}
            value={gratis ? "" : precio}
            disabled={gratis}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder={gratis ? "Gratis" : "499"}
          />
          <label className="flex items-center gap-1.5 text-sm text-ui-fg-subtle mt-1">
            <input type="checkbox" checked={gratis} onChange={(e) => setGratis(e.target.checked)} />
            Curso gratis
          </label>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Recibes el 90% de cada venta. Las lecciones de "vista previa" las ve cualquiera; las demás, sólo tus alumnos.
          </Text>
        </div>
        <div>
          <Button
            size="small"
            disabled={!gratis && !(Number(precio) > 0)}
            isLoading={guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">
        <Heading level="h2">Temario</Heading>
        <div className="flex flex-col gap-3">
          {(course.sections || []).map((section) => (
            <SectionCard key={section.id} course={course} section={section} />
          ))}
        </div>
        <NuevaSeccionForm courseId={course.id} />
      </div>
    </Container>
  )
}
