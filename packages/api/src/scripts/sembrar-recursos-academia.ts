// Primeros recursos de la Biblioteca de la Academia, para que la sección no
// arranque vacía. Son ligas con descripción propia y crédito; nada se copia.
//
//   ./node_modules/.bin/medusa exec ./src/scripts/sembrar-recursos-academia.ts
//
// Idempotente: si la liga ya existe (aunque se haya borrado), no la toca.
// Después se editan o borran desde el dashboard › Biblioteca.
import type { ExecArgs } from "@medusajs/framework/types"

import { leerRecurso, servicioRecursos } from "../lib/recursos-academia"

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
    titulo: "CutList Optimizer: acomoda tus cortes en la hoja",
    url: "https://www.cutlistoptimizer.com/",
    fuente: "cutlistoptimizer.com",
    categoria: "muebles-melamina",
    tipo: "programa",
    descripcion:
      "Calculadora en línea para acomodar piezas rectangulares en tableros de melamina o MDF y ver cuánto material se desperdicia. Gratis en el navegador.",
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
  {
    titulo: "Kiri:Moto: CAM gratis en el navegador",
    url: "https://grid.space/kiri/",
    fuente: "Grid.Space",
    categoria: "diseno-cam",
    tipo: "programa",
    descripcion: "Genera G-code para router CNC, láser e impresión 3D sin instalar nada. Bueno para empezar y para trabajos sencillos.",
  },
  {
    titulo: "Boxes.py: generador de cajas para láser",
    url: "https://boxes.hackerspace-bamberg.de/",
    fuente: "Hackerspace Bamberg",
    categoria: "corte-laser",
    tipo: "programa",
    descripcion:
      "Cientos de diseños de cajas, organizadores y repisas con ensamble de dedos: pones medidas y grosor del material y te da el archivo para cortar.",
  },
  {
    titulo: "Printables: modelos 3D gratis",
    url: "https://www.printables.com/",
    fuente: "Prusa Research",
    categoria: "impresion-3d",
    tipo: "sitio",
    descripcion: "Biblioteca enorme de modelos para imprimir en 3D, con fotos de quienes ya los imprimieron y la licencia de cada uno.",
  },
]

export default async function sembrarRecursosAcademia({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const svc = servicioRecursos(container)
  let nuevos = 0
  for (const [i, r] of RECURSOS.entries()) {
    const { datos, error } = leerRecurso({ ...r, orden: i, publicado: true })
    if (error || !datos) {
      logger.warn(`[biblioteca] ${r.titulo}: ${error}`)
      continue
    }
    const [existe] = await svc.listLearningResources({ url: datos.url as string }, { take: 1, withDeleted: true })
    if (existe) {
      logger.info(`[biblioteca] ya existe: ${r.titulo}`)
      continue
    }
    await svc.createLearningResources(datos as any)
    nuevos++
  }
  logger.info(`[biblioteca] ${nuevos} recursos nuevos.`)
}
