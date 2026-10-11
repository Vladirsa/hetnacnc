import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Container, Heading, Text, Button, Input, Textarea, Label, Select, Badge, toast } from "@medusajs/ui"
import { AcademicCap } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import type { InferClientOutput } from "@mercurjs/client"

import { client } from "../../lib/client"

export const config: RouteConfig = {
  label: "Cursos",
  icon: AcademicCap,
  rank: 20,
}

type CoursesList = InferClientOutput<typeof client.vendor.courses.query>
type Course = CoursesList["courses"][number]

const NIVEL_ETIQUETA: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
}

const NuevoCursoForm = () => {
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [level, setLevel] = useState<"principiante" | "intermedio" | "avanzado">("principiante")
  const [price, setPrice] = useState("")

  const crear = useMutation({
    mutationFn: () =>
      client.vendor.courses.mutate({
        title,
        slug,
        description: description || undefined,
        level,
        price_amount: Number(price),
      }),
    onSuccess: () => {
      toast.success("Curso creado", { description: "Ya puedes agregar secciones y lecciones." })
      queryClient.invalidateQueries({ queryKey: ["vendor-courses"] })
      setAbierto(false)
      setTitle("")
      setSlug("")
      setDescription("")
      setPrice("")
    },
    onError: (err: any) => {
      toast.error("No se pudo crear el curso", { description: err?.message })
    },
  })

  if (!abierto) {
    return (
      <div className="px-6 py-4">
        <Button size="small" onClick={() => setAbierto(true)}>
          Nuevo curso
        </Button>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-4 border-b">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label size="small">Título</Label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (!slug) {
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[̀-ͯ]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "")
                )
              }
            }}
            placeholder="G-code desde cero"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="gcode-desde-cero" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label size="small">Descripción</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label size="small">Nivel</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="principiante">Principiante</Select.Item>
              <Select.Item value="intermedio">Intermedio</Select.Item>
              <Select.Item value="avanzado">Avanzado</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Precio (MXN)</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="499" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="small" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          size="small"
          disabled={!title || !slug || !price || crear.isPending}
          isLoading={crear.isPending}
          onClick={() => crear.mutate()}
        >
          Crear curso
        </Button>
      </div>
    </div>
  )
}

export default function CoursesPage() {
  const { data, isLoading } = useQuery<CoursesList>({
    queryKey: ["vendor-courses"],
    queryFn: () => client.vendor.courses.query(),
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Cursos</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Sube tus cursos de video para la Academia HETNA CNC.
          </Text>
        </div>
      </div>

      <NuevoCursoForm />

      <div className="px-6 py-4">
        {isLoading && <Text size="small">Cargando...</Text>}
        {!isLoading && (data?.courses.length ?? 0) === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Todavía no tienes cursos. Crea el primero arriba.
          </Text>
        )}
        <div className="flex flex-col gap-2">
          {data?.courses.map((course: Course) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-ui-bg-subtle-hover"
            >
              <div>
                <Text weight="plus">{course.title}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {NIVEL_ETIQUETA[course.level] || course.level}
                </Text>
              </div>
              <Badge color={course.status === "published" ? "green" : "grey"}>
                {course.status === "published" ? "Publicado" : "Borrador"}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </Container>
  )
}
