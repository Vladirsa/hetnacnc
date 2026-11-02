// Enlaces internos según el tema de un texto (título + resumen de un artículo
// del blog, por ejemplo): llevan al lector de lo que está leyendo a la
// categoría, herramienta o curso que le sirve. Bueno para el comprador y para
// Google (enlazado interno entre blog, tienda y herramientas).
type Regla = { patron: RegExp; texto: string; href: string }

const REGLAS: Regla[] = [
  { patron: /fresa|broca|cortador|end ?mill|filo/i, texto: "Fresas y brocas para router CNC", href: "/categories/fresas-y-brocas" },
  { patron: /velocidad|avance|rpm|feed|chip ?load|quemad/i, texto: "Calculadora de velocidades y avances", href: "/calculadora-cnc" },
  { patron: /router|mdf|madera|triplay|fresad/i, texto: "Routers CNC: guía para elegir", href: "/categories/routers-cnc" },
  { patron: /l[aá]ser|grabad|co2|fibra/i, texto: "Láser CNC: CO2, diodo o fibra", href: "/categories/laser-cnc" },
  { patron: /plasma|l[aá]mina|acero|placa/i, texto: "Plasma CNC: guía para elegir", href: "/categories/plasma-cnc" },
  { patron: /vector|imagen|foto|png|jpg|pdf a dxf|trazar/i, texto: "Vectorizador: de imagen a archivo de corte", href: "/disenar/vectorizador" },
  { patron: /dxf|svg|stl|archivo|dise[ñn]o|plantilla/i, texto: "Archivos listos para CNC", href: "/categories/archivos-para-cnc" },
  { patron: /g-?code|cam|postprocesador|fusion|trayectoria/i, texto: "Laboratorio CAM: G-code para tu máquina", href: "/laboratorio-cam" },
  { patron: /caja|ensamble|junta|finger/i, texto: "Generador de cajas para corte", href: "/disenar/cajas" },
  { patron: /aprend|curso|principiante|empezar|tutorial/i, texto: "Cursos en la Academia CNC", href: "/servicios/aprendizaje-cnc" },
]

/** Hasta `max` enlaces que tienen que ver con el texto, sin repetir. */
export function enlacesPorTema(texto: string, max = 4) {
  const out: { texto: string; href: string }[] = []
  for (const r of REGLAS) {
    if (out.length >= max) break
    if (r.patron.test(texto) && !out.some((o) => o.href === r.href)) out.push({ texto: r.texto, href: r.href })
  }
  return out
}
