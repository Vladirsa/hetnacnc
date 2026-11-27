import { T, traducir } from "../../lib/idioma"
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
  // Nombre traducido con src/i18n/{es,en}.json (llave = texto en español)
  translationNs: "translation",
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
  const [gratis, setGratis] = useState(false)

  const crear = useMutation({
    mutationFn: () =>
      client.vendor.courses.mutate({
        title,
        slug,
        description: description || undefined,
        level,
        price_amount: gratis ? 0 : Number(price),
      }),
    onSuccess: () => {
      toast.success("Curso creado", {
        description: "Agrega secciones y lecciones con el enlace de YouTube (oculto) o Vimeo y luego publícalo.",
      })
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
          <T>Nuevo curso</T>
        </Button>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-4 border-b">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label size="small"><T>Título</T></Label>
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
            placeholder={traducir("G-code desde cero")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small"><T>Slug</T></Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={traducir("gcode-desde-cero")} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label size="small"><T>Descripción</T></Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label size="small"><T>Nivel</T></Label>
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="principiante"><T>Principiante</T></Select.Item>
              <Select.Item value="intermedio"><T>Intermedio</T></Select.Item>
              <Select.Item value="avanzado"><T>Avanzado</T></Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small"><T>Precio (MXN)</T></Label>
          <Input
            type="number"
            min={0}
            value={gratis ? "" : price}
            disabled={gratis}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={gratis ? "Gratis" : "499"}
          />
          <label className="flex items-center gap-1.5 text-sm text-ui-fg-subtle mt-1">
            <input type="checkbox" checked={gratis} onChange={(e) => setGratis(e.target.checked)} />
            <T>Curso gratis (ganas alumnos y clientes para tu taller)</T>
          </label>
          <Text size="xsmall" className="text-ui-fg-subtle">
            <T>Si lo cobras, cada venta llega a "Mi saldo" al momento, menos la comisión de HETNA (ver Términos para vendedores).</T>
          </Text>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="small" onClick={() => setAbierto(false)}>
          <T>Cancelar</T>
        </Button>
        <Button
          size="small"
          disabled={!title || !slug || (!gratis && !(Number(price) > 0)) || crear.isPending}
          isLoading={crear.isPending}
          onClick={() => crear.mutate()}
        >
          <T>Crear curso</T>
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
          <Heading><T>Cursos</T></Heading>
          <Text size="small" className="text-ui-fg-subtle">
            <T>Sube tus cursos de video para la Academia HETNA CNC.</T>
          </Text>
        </div>
      </div>

      <NuevoCursoForm />

      <div className="px-6 py-4">
        {isLoading && <Text size="small"><T>Cargando...</T></Text>}
        {!isLoading && (data?.courses.length ?? 0) === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            <T>Todavía no tienes cursos. Crea el primero arriba.</T>
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
                <Text weight="plus"><T>{course.title}</T></Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {NIVEL_ETIQUETA[course.level] || course.level}
                </Text>
              </div>
              <Badge color={course.status === "published" ? "green" : "grey"}>
                <T>{course.status === "published" ? "Publicado" : "Borrador"}</T>
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </Container>
  )
}
