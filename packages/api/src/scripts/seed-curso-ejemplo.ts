// Crea un curso real de muestra en la Academia HETNA CNC, con secciones y
// lecciones, para que la sección "Cursos de la Academia" tenga contenido
// visible mientras se suben los cursos reales de instructores.
//
// Uso: desde packages/api, con la base de datos accesible:
//   ./node_modules/.bin/medusa exec ./src/scripts/seed-curso-ejemplo.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import { createProductsWorkflow } from "@mercurjs/core/workflows"

import { createCourseWorkflow } from "../workflows/create-course"
import CourseModuleService from "../modules/course/service"
import { COURSE_MODULE } from "../modules/course"

const HANDLE = "curso-gcode-desde-cero"
const SLUG = "gcode-desde-cero"

export default async function seedCursoEjemplo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const courseModuleService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const sellerService = container.resolve(MercurModules.SELLER) as any

  const existingCourses = await courseModuleService.listCourses({ slug: SLUG })
  if (existingCourses.length > 0) {
    logger.info(`El curso "${SLUG}" ya existe (${existingCourses[0].id}), no se crea de nuevo.`)
    return
  }

  const [seller] = await sellerService.listSellers({}, { take: 1 })
  if (!seller) {
    logger.error("No hay ningun seller en la plataforma. Crea uno primero (puede ser tu propia cuenta de HETNA CNC).")
    return
  }

  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      created_by: "seed-script",
      products: [
        {
          title: "G-code desde cero: fundamentos para router, láser y plasma",
          handle: HANDLE,
          status: "published" as any,
          seller_ids: [seller.id],
          variants: [
            {
              title: "Acceso completo",
              prices: [{ currency_code: "mxn", amount: 499 }],
            } as any,
          ],
        } as any,
      ],
    },
  })
  const product = products[0]
  logger.info(`Producto del curso creado: ${product.id} (${product.handle})`)

  const course = await createCourseWorkflow(container).run({
    input: {
      title: "G-code desde cero: fundamentos para router, láser y plasma",
      slug: SLUG,
      description:
        "Aprende a leer, escribir y depurar G-code desde cero: coordenadas, comandos M/G, velocidades de avance y los errores más comunes en Mach3 y GRBL.",
      level: "principiante",
      language: "es",
      seller_id: seller.id,
      product_id: product.id,
    },
  })
  await courseModuleService.updateCourses({
    id: course.result.id,
    status: "published",
    published_at: new Date(),
  } as any)
  logger.info(`Curso creado: ${course.result.id}`)

  const introduccion = await courseModuleService.createCourseSections({
    title: "Introducción al G-code",
    position: 1,
    course_id: course.result.id,
  } as any)

  await courseModuleService.createLessons([
    {
      title: "¿Qué es el G-code y por qué importa?",
      description: "Conceptos básicos: ejes, sistema de coordenadas y cómo tu máquina interpreta el código.",
      position: 1,
      duration_seconds: 360,
      is_preview: true,
      section_id: introduccion.id,
    },
    {
      title: "Comandos G0 y G1: movimientos rápidos y de corte",
      description: "La diferencia entre moverte y cortar, y cómo controlar la velocidad de avance (feed rate).",
      position: 2,
      duration_seconds: 480,
      is_preview: true,
      section_id: introduccion.id,
    },
    {
      title: "Comandos M: husillo, refrigerante y pausas",
      description: "M3/M5 para el husillo, M8/M9 para refrigerante, y cuándo usar pausas controladas.",
      position: 3,
      duration_seconds: 420,
      is_preview: false,
      section_id: introduccion.id,
    },
  ] as any)

  const errores = await courseModuleService.createCourseSections({
    title: "Diagnóstico de errores comunes",
    position: 2,
    course_id: course.result.id,
  } as any)

  await courseModuleService.createLessons([
    {
      title: "Errores típicos en Mach3",
      description: "Soft limits, hard limits y cómo leer los mensajes de error más comunes.",
      position: 1,
      duration_seconds: 540,
      is_preview: false,
      section_id: errores.id,
    },
    {
      title: "Errores típicos en GRBL",
      description: "Códigos de error de GRBL explicados uno por uno, con ejemplos reales.",
      position: 2,
      duration_seconds: 600,
      is_preview: false,
      section_id: errores.id,
    },
  ] as any)

  logger.info("✔ Curso de ejemplo publicado con 2 secciones y 5 lecciones.")
}
