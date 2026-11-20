// Recursos de la Biblioteca de la Academia: los primeros y los de todo el
// mundo (datos-recursos-mundo.ts). Son ligas con descripción propia y crédito;
// nada se copia.
//
//   ./node_modules/.bin/medusa exec ./src/scripts/sembrar-recursos-academia.ts
//
// - Prueba cada liga desde el servidor antes de agregarla: si no abre (no
//   existe o da 404), no la agrega y la lista al final. SIN_PROBAR=1 se la salta.
// - Idempotente: si la liga ya existe (aunque se haya borrado), no la toca.
// - Oculta (no borra) los que compiten con HETNA y entraron en la primera carga.
// Después se editan, ocultan o borran desde el dashboard › Biblioteca.
import type { ExecArgs } from "@medusajs/framework/types"

import { leerRecurso, servicioRecursos } from "../lib/recursos-academia"
import { RECURSOS_MUNDO } from "./datos-recursos-mundo"

// Entraron en la primera carga pero compiten con lo que ofrece HETNA
// (generador de cajas, CAM en línea, acomodo en hojas, biblioteca de modelos).
const RETIRAR = [
  "https://www.cutlistoptimizer.com/",
  "https://grid.space/kiri/",
  "https://boxes.hackerspace-bamberg.de/",
  "https://www.printables.com/",
]

/** ¿Abre la liga? 401/403/429 cuentan como "existe" (sitios que bloquean robots). */
async function abre(url: string): Promise<{ ok: boolean; motivo: string }> {
  const intento = async (metodo: "HEAD" | "GET") => {
    const r = await fetch(url, {
      method: metodo,
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; HETNA-Biblioteca/1.0)", accept: "text/html,*/*" },
    })
    return r.status
  }
  try {
    let st = await intento("HEAD")
    if (st === 405 || st === 404 || st >= 500) st = await intento("GET") // algunos sitios no aceptan HEAD
    if (st < 400 || [401, 403, 429].includes(st)) return { ok: true, motivo: String(st) }
    return { ok: false, motivo: `HTTP ${st}` }
  } catch (e) {
    return { ok: false, motivo: (e as Error).name === "TimeoutError" ? "no contestó" : "no existe o no abre" }
  }
}

const RECURSOS = [
  {
    titulo: "Planos para armar muebles de melamina",
    url: "https://manuales-faciles.blogspot.com/2020/08/planos-para-armar-muebles-de-melamina.html",
    fuente: "Manuales Fáciles",
    categoria: "muebles-melamina",
    tipo: "planos",
    destacado: true,
    descripcion:
      "Recopilación de planos de clósets, alacenas, libreros, escritorios y cocinas en melamina, con medidas y despiece. Útil para darte una idea antes de mandar a cortar tus tableros.",
  },
  {
    titulo: "R-Luis: electrónica básica, microcontroladores y CNC casera",
    url: "http://r-luis.xbot.es/",
    fuente: "R-Luis (Jujuy, Argentina)",
    categoria: "electronica",
    tipo: "sitio",
    destacado: true,
    descripcion:
      "Sitio clásico en español con tutoriales de electrónica básica y digital, puerto paralelo, microcontroladores PIC, sensores y proyectos de máquinas CNC hechas en casa.",
  },
  {
    titulo: "Inkscape: diseño vectorial gratis",
    url: "https://inkscape.org/es/",
    fuente: "Proyecto Inkscape",
    categoria: "programas",
    tipo: "programa",
    descripcion:
      "Programa libre para dibujar y vectorizar logos y figuras. Exporta SVG y DXF para router, láser o plasma. Windows, Mac y Linux.",
  },
  {
    titulo: "FreeCAD: modelado 3D paramétrico libre",
    url: "https://www.freecad.org/",
    fuente: "Proyecto FreeCAD",
    categoria: "programas",
    tipo: "programa",
    descripcion:
      "Programa de diseño mecánico 3D libre, con planos 2D y módulo CAM para generar trayectorias de router y fresadora.",
  },
  {
    titulo: "LibreCAD: dibujo 2D en DXF",
    url: "https://librecad.org/",
    fuente: "Proyecto LibreCAD",
    categoria: "programas",
    tipo: "programa",
    descripcion: "Programa libre para dibujo técnico 2D que trabaja directo en DXF, el formato que piden casi todos los talleres CNC.",
  },
  {
    titulo: "Universal G-code Sender",
    url: "https://winder.github.io/ugs_website/",
    fuente: "Proyecto UGS",
    categoria: "router-cnc",
    tipo: "programa",
    descripcion:
      "Programa gratis para mandar G-code a routers con GRBL: mover la máquina, poner ceros, ver la trayectoria y correr el trabajo.",
  },
  {
    titulo: "Wiki de GRBL (configuración y comandos)",
    url: "https://github.com/gnea/grbl/wiki",
    fuente: "Proyecto GRBL",
    categoria: "electronica",
    tipo: "guia",
    descripcion:
      "Documentación oficial del firmware GRBL que usan muchos routers y láseres de escritorio: parámetros $, finales de carrera, homing y errores comunes (en inglés).",
  },
]

export default async function sembrarRecursosAcademia({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const svc = servicioRecursos(container)
  let nuevos = 0
  const fallidas: string[] = []
  const probar = process.env.SIN_PROBAR !== "1"
  const todos = [...RECURSOS, ...RECURSOS_MUNDO]
  for (const [i, r] of todos.entries()) {
    const { datos, error } = leerRecurso({ ...r, orden: i, publicado: true })
    if (error || !datos) {
      logger.warn(`[biblioteca] ${r.titulo}: ${error}`)
      continue
    }
    const [existe] = await svc.listLearningResources({ url: datos.url as string }, { take: 1, withDeleted: true })
    if (existe) continue
    if (probar) {
      const p = await abre(datos.url as string)
      if (!p.ok) {
        fallidas.push(`${r.titulo} (${datos.url}): ${p.motivo}`)
        continue
      }
    }
    await svc.createLearningResources(datos as any)
    nuevos++
  }

  let ocultos = 0
  for (const url of RETIRAR) {
    const [r] = await svc.listLearningResources({ url, publicado: true }, { take: 1 })
    if (r) {
      await svc.updateLearningResources({ id: r.id, publicado: false })
      ocultos++
    }
  }

  const total = await svc.listLearningResources({ publicado: true }, { take: 1000, select: ["id"] })
  logger.info(`[biblioteca] ${nuevos} recursos nuevos, ${ocultos} ocultos por competir con HETNA, ${total.length} visibles en total.`)
  if (fallidas.length) {
    logger.warn(`[biblioteca] ${fallidas.length} ligas no se agregaron porque no abrieron:`)
    for (const f of fallidas) logger.warn(`  - ${f}`)
  }
}
