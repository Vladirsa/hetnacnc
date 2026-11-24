// Avance del alumno en los ejercicios del Simulador CNC y su constancia.
//
// Cobro (opcional, apagado por omisión): si SIMULADOR_CURSO_SLUG tiene el slug
// de un curso publicado de la Academia, sólo los primeros SIMULADOR_GRATIS
// ejercicios (2 por omisión) se califican sin estar inscrito en ese curso.
// Sin la variable, todos se califican gratis con una cuenta.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { SIMULADOR_MODULE } from "../../modules/simulador"
import { accesoCurso } from "../cursos"
import { calificar, ejercicioPublico } from "./calificar"
import { EJERCICIOS, ejercicioPorId } from "./ejercicios"

const svc = (c: MedusaContainer) => c.resolve(SIMULADOR_MODULE) as any
const cursoCobro = () => (process.env.SIMULADOR_CURSO_SLUG || "").trim()
const gratis = () => Math.max(0, Number(process.env.SIMULADOR_GRATIS ?? 2) || 0)

async function inscrito(c: MedusaContainer, customerId: string | null) {
  const slug = cursoCobro()
  if (!slug) return true
  if (!customerId) return false
  return !!(await accesoCurso(c, slug, customerId).catch(() => null))?.inscrito
}

async function resultados(c: MedusaContainer, customerId: string) {
  return (await svc(c).listSimResultados({ customer_id: customerId }, { take: 500 })) as any[]
}

export class ErrorSim extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export async function listaParaAlumno(c: MedusaContainer, customerId: string | null) {
  const filas = customerId ? await resultados(c, customerId) : []
  const pagado = await inscrito(c, customerId)
  return {
    cobro: cursoCobro() ? { curso: cursoCobro(), gratis: gratis(), inscrito: pagado } : null,
    ejercicios: EJERCICIOS.map((e, i) => {
      const r = filas.find((f) => f.ejercicio_id === e.id)
      return {
        ...ejercicioPublico(e),
        abierto: pagado || i < gratis(),
        resultado: r ? { mejor: r.mejor_calificacion, intentos: r.intentos, aprobado: !!r.aprobado_en, version: r.version } : null,
      }
    }),
  }
}

export async function calificarYGuardar(c: MedusaContainer, customerId: string, ejercicioId: string, codigo: string) {
  const e = ejercicioPorId(ejercicioId)
  if (!e) throw new ErrorSim("Ese ejercicio no existe.", 404)
  const indice = EJERCICIOS.indexOf(e)
  if (indice >= gratis() && !(await inscrito(c, customerId))) {
    throw new ErrorSim("Este ejercicio es parte del curso del simulador. Inscríbete para calificarlo.", 402)
  }
  const r = calificar(e, codigo)
  const s = svc(c)
  const [previa] = await s.listSimResultados({ customer_id: customerId, ejercicio_id: e.id }, { take: 1 })
  const datos = {
    customer_id: customerId,
    ejercicio_id: e.id,
    version: e.version,
    mejor_calificacion: Math.max(previa?.mejor_calificacion || 0, r.calificacion),
    intentos: (previa?.intentos || 0) + 1,
    aprobado_en: previa?.aprobado_en || (r.aprobado ? new Date() : null),
  }
  if (previa) await s.updateSimResultados({ id: previa.id, ...datos })
  else await s.createSimResultados(datos)
  return { ...r, mejor: datos.mejor_calificacion, intentos: datos.intentos }
}

/** Constancia: sólo si aprobó todos los ejercicios. */
export async function constancia(c: MedusaContainer, customerId: string) {
  const filas = await resultados(c, customerId)
  const aprobados = EJERCICIOS.map((e) => filas.find((f) => f.ejercicio_id === e.id && f.aprobado_en))
  if (aprobados.some((a) => !a)) return null
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "customer", fields: ["id", "first_name", "last_name", "email"], filters: { id: customerId } })
  const cl = (data[0] || {}) as any
  const alumno = [cl.first_name, cl.last_name].filter(Boolean).join(" ").trim() || String(cl.email || "").split("@")[0]
  const fecha = aprobados.map((a) => new Date(a!.aprobado_en).getTime()).reduce((x, y) => Math.max(x, y), 0)
  const promedio = Math.round(aprobados.reduce((acc, a) => acc + Number(a!.mejor_calificacion || 0), 0) / aprobados.length)
  return {
    folio: `SIM-${String(customerId).slice(-8).toUpperCase()}`,
    alumno,
    fecha: new Date(fecha).toISOString(),
    promedio,
    ejercicios: EJERCICIOS.map((e) => ({ titulo: e.titulo, maquina: e.maquina })),
  }
}
