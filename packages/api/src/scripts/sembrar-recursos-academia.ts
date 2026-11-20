// Recursos de la Biblioteca de la Academia: los primeros y los de todo el
// mundo (datos-recursos-mundo.ts). Son ligas con descripción propia y crédito;
// nada se copia.
//
//   ./node_modules/.bin/medusa exec ./src/scripts/sembrar-recursos-academia.ts
//
// - Prueba cada liga desde el servidor antes de agregarla: si no abre, da 404
//   o redirige a otro sitio, no la agrega y la lista al final. Las que el sitio
//   no deja revisar (403) se agregan y se listan para abrirlas a mano.
//   SIN_PROBAR=1 se salta la prueba.
// - Idempotente: si la liga ya existe (aunque se haya borrado), no la toca.
// - Oculta (no borra) los que compiten con HETNA y entraron en la primera carga,
//   salvo que los hayas vuelto a publicar a mano.
// Después se editan, ocultan o borran desde el dashboard › Biblioteca.
import type { ExecArgs } from "@medusajs/framework/types"

import { esLigaRepetida, leerRecurso, servicioRecursos } from "../lib/recursos-academia"
import { RECURSOS_MUNDO } from "./datos-recursos-mundo"

// Entraron en la primera carga pero compiten con lo que ofrece HETNA
// (generador de cajas, CAM en línea, acomodo en hojas, biblioteca de modelos).
const RETIRAR = [
  "https://www.cutlistoptimizer.com/",
  "https://grid.space/kiri/",
  "https://boxes.hackerspace-bamberg.de/",
  "https://www.printables.com/",
]

type Prueba = { estado: "ok" | "revisar" | "falla"; motivo: string; red?: boolean }
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/**
 * ¿Abre la liga?
 *   ok      2xx/3xx y se queda en el mismo sitio
 *   revisar 401/403/429 (el sitio bloquea robots): se agrega y se lista para revisarla a mano
 *   falla   404/410/5xx, no existe, no contestó, o redirige a OTRO sitio (se mudó)
 * red = true cuando el error es de la conexión del servidor (sin internet, DNS, proxy).
 */
async function probarLiga(url: string): Promise<Prueba> {
  const intento = async (metodo: "HEAD" | "GET") => {
    const r = await fetch(url, {
      method: metodo,
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; HETNA-Biblioteca/1.0)", accept: "text/html,*/*" },
    })
    await r.body?.cancel().catch(() => undefined) // no bajar PDFs completos
    return { st: r.status, final: r.url || url }
  }
  let r: { st: number; final: string }
  try {
    r = await intento("HEAD").catch(() => intento("GET")) // algunos servidores cortan los HEAD
    if (r.st === 405 || r.st === 404 || r.st >= 500) r = await intento("GET")
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } }
    const codigo = err.cause?.code || err.name
    const red = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|CERT|UNABLE_TO|SELF_SIGNED/i.test(String(codigo))
    return { estado: "falla", motivo: err.name === "TimeoutError" ? "no contestó" : `no abre (${codigo})`, red }
  }
  if (host(r.final) && host(r.final) !== host(url)) return { estado: "falla", motivo: `redirige a otro sitio: ${r.final}` }
  if (r.st < 400) return { estado: "ok", motivo: String(r.st) }
  if ([401, 403, 429].includes(r.st)) return { estado: "revisar", motivo: `HTTP ${r.st}: el sitio no deja revisarlo automáticamente` }
  return { estado: "falla", motivo: `HTTP ${r.st}` }
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

/** Corre `fn` sobre la lista con `n` a la vez. */
async function enParalelo<T, R>(lista: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(lista.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, lista.length) }, async () => {
      while (i < lista.length) {
        const k = i++
        res[k] = await fn(lista[k])
      }
    })
  )
  return res
}

export default async function sembrarRecursosAcademia({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const svc = servicioRecursos(container)
  const probar = process.env.SIN_PROBAR !== "1"

  // 1) Ocultar los que compiten, sólo si nadie los ha editado desde la carga
  //    (si los volviste a publicar a mano, se respetan).
  let ocultos = 0
  for (const url of RETIRAR) {
    const [r] = (await svc.listLearningResources({ url, publicado: true }, { take: 1 })) as any[]
    if (r && Math.abs(new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) < 60_000) {
      await svc.updateLearningResources({ id: r.id, publicado: false })
      ocultos++
    }
  }

  // 2) Validar y quitar las que ya existen (aunque se hayan borrado)
  const todos = [...RECURSOS, ...RECURSOS_MUNDO]
  const pendientes: Record<string, unknown>[] = []
  for (const [i, r] of todos.entries()) {
    const { datos, error } = leerRecurso({ ...r, orden: 100 + i, publicado: true })
    if (error || !datos) {
      logger.warn(`[biblioteca] ${r.titulo}: ${error}`)
      continue
    }
    const [existe] = await svc.listLearningResources({ url: datos.url as string }, { take: 1, withDeleted: true })
    if (!existe) pendientes.push(datos)
  }

  // 3) Probar las ligas desde el servidor (6 a la vez)
  const pruebas = probar ? await enParalelo(pendientes, 6, (d) => probarLiga(d.url as string)) : pendientes.map(() => ({ estado: "ok", motivo: "sin probar" }) as Prueba)
  const deRed = pruebas.filter((p) => p.red).length
  if (probar && pendientes.length >= 10 && deRed >= pendientes.length * 0.8) {
    logger.error(
      `[biblioteca] ${deRed} de ${pendientes.length} ligas fallaron por la conexión de ESTE servidor (sin internet, DNS o proxy), no por los sitios. ` +
        "No se agregó nada. Revisa la salida a internet del servidor, o corre con SIN_PROBAR=1 para cargar sin probar."
    )
    return
  }

  // 4) Agregar las que abren
  let nuevos = 0
  const fallidas: string[] = []
  const revisar: string[] = []
  for (const [k, d] of pendientes.entries()) {
    const p = pruebas[k]
    if (p.estado === "falla") {
      fallidas.push(`${d.titulo} (${d.url}): ${p.motivo}`)
      continue
    }
    try {
      await svc.createLearningResources(d as any)
      nuevos++
      if (p.estado === "revisar") revisar.push(`${d.titulo} (${d.url}): ${p.motivo}`)
    } catch (e) {
      if (!esLigaRepetida(e)) logger.warn(`[biblioteca] ${d.titulo}: ${(e as Error).message}`)
    }
  }

  const [, visibles] = await svc.listAndCountLearningResources({ publicado: true }, { take: 1, select: ["id"] })
  logger.info(`[biblioteca] ${nuevos} recursos nuevos, ${ocultos} ocultos por competir con HETNA, ${visibles} visibles en total.`)
  if (revisar.length) {
    logger.warn(`[biblioteca] ${revisar.length} se agregaron pero conviene abrirlas una vez a mano (el sitio no deja revisarlas solo):`)
    for (const f of revisar) logger.warn(`  - ${f}`)
  }
  if (fallidas.length) {
    logger.warn(`[biblioteca] ${fallidas.length} ligas NO se agregaron:`)
    for (const f of fallidas) logger.warn(`  - ${f}`)
  }
}
