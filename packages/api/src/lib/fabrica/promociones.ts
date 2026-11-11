// @ts-nocheck
// Marketing HETNA — promotor automático de la tienda, el blog y las herramientas.
// Cada día hace imagen + video (con voz si RunPod está listo) de:
//   - un producto de la tienda (nuevos primero; no se repite en 45 días)
//   - martes y viernes: un artículo de Aprendizaje CNC (carrusel + video)
//   - lunes y jueves: una herramienta del sitio (calculadora, cotizador,
//     estudio de diseño, laboratorio CAM, ranking, licitaciones)
// Salen como borradores o programadas según Configuración ("Promociones").
// Sólo datos reales: título, descripción y fotos del producto o del artículo.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, nuevoId } from "../licitacion"
import { T_POST, asegurarSocial, crearPublicacion, dentroDeHorario, leerConfig, ligaPara, urlCorta, zonaDe } from "../social-hub"
import { fondoDe, musicaAlAzar, subir, temaDe } from "./index"
import { limpiar, oraciones, palabras } from "./plan-material"
import { cuadroVideo, lamina, tarjeta, carpetaFuentes } from "./render"
import { VOZ, correr, idiomaDe, ligasB2, runpodListo } from "./runpod"
import { corto, ffmpegDisponible, segundosPara } from "./video"
import { vozLocal } from "./voz-local"
import { laminaEstilo, poster } from "./poster"
import { cuatroPalabras, guionista, hfDisponible, horaTranquila, iconoPara, paraVoz, temaPara, videoHF } from "./hyperframes"

export const T_PROMO = "hetna_promo"
const IMG = (f: string) => `${STORE_URL}/img/herramientas/${f}`

type TextosHerramienta = { nombre: string; gancho: string; frases: string[]; cta: string; texto: string }
export type Herramienta = TextosHerramienta & { clave: string; ruta: string; imagen: string | null; tema: string; publico: string; en?: TextosHerramienta }
export const HERRAMIENTAS: Herramienta[] = [
  {
    clave: "calculadora", nombre: "Calculadora CNC", ruta: "/mx/calculadora-cnc", imagen: IMG("calculadora-router.jpg"), tema: "router", publico: "talleres",
    gancho: "¿Qué RPM y avance le pongo?", frases: ["Calculadora CNC gratis", "Router, láser, fibra, plasma e impresión 3D", "Revisa la potencia y la flexión de tu fresa"], cta: "Úsala gratis en HETNA",
    texto: "¿Dudas con las RPM, el avance o la potencia? La calculadora CNC de HETNA es gratis: router y fresadora, láser CO₂, fibra, plasma e impresión 3D, con tu máquina guardada.",
  },
  {
    clave: "calculadora_laser", nombre: "Calculadora láser", ruta: "/mx/calculadora-cnc", imagen: IMG("calculadora-laser.jpg"), tema: "laser", publico: "talleres",
    gancho: "Velocidad y potencia de tu láser", frases: ["Del K40 al tubo de 300 W", "Velocidad, potencia, foco y kerf", "Gratis y desde el celular"], cta: "Calcula gratis en HETNA",
    texto: "Velocidad, potencia, foco y kerf para tu láser CO₂, del K40 al tubo de 300 W. Gratis en la calculadora CNC de HETNA.",
  },
  {
    clave: "cotizador", nombre: "HETNA Cotizador", ruta: "/mx/herramientas-cnc", imagen: IMG("cotizador-precio.jpg"), tema: "laser", publico: "talleres",
    gancho: "Cotiza en segundos con tu DXF", frases: ["Lee el largo de corte y las perforaciones", "Tres precios con tus costos", "Lo mandas por WhatsApp y PDF"], cta: "Pruébalo en HETNA",
    texto: "Sube el DXF y la app HETNA Cotizador mide el corte, calcula tres precios con tus costos y se lo manda a tu cliente por WhatsApp y PDF.",
    en: { nombre: "HETNA Quoter", gancho: "Quote in seconds with your DXF", frases: ["It reads the cut length and pierces", "Three prices with your own costs", "Send it by WhatsApp and PDF"], cta: "Try it on HETNA", texto: "Upload a DXF and the HETNA Quoter app measures the cut, calculates three prices with your costs and sends them to your customer by WhatsApp and PDF." }
  },
  {
    clave: "cotizador_whatsapp", nombre: "Cotización por WhatsApp", ruta: "/mx/herramientas-cnc", imagen: IMG("cotizador-whatsapp.jpg"), tema: "taller", publico: "talleres",
    gancho: "Tu cliente pide precio por WhatsApp", frases: ["Respóndele con una cotización en PDF", "Con tu marca y tus tarifas", "Y todo queda en tu historial"], cta: "Conoce el cotizador",
    texto: "Cuando el cliente pide precio por WhatsApp, respóndele con una cotización en PDF con tu marca y tus tarifas. Todo queda guardado en tu historial.",
    en: { nombre: "WhatsApp quotes", gancho: "Customer asks for a price on WhatsApp?", frases: ["Reply with a PDF quote", "With your logo and your rates", "Everything saved in your history"], cta: "See the quoter", texto: "When a customer asks for a price on WhatsApp, reply with a PDF quote with your logo and your rates. Everything stays saved in your history." }
  },
  // --- Campaña del Cotizador (es lo que se cobra): sólo datos reales de cotizador-plan / suscripciones ---
  {
    clave: "cotizador_gratis", nombre: "HETNA Cotizador gratis", ruta: "/mx/herramientas-cnc", imagen: IMG("cotizador-precio.jpg"), tema: "laser", publico: "talleres",
    gancho: "¿Sigues cotizando a mano?", frases: ["Empieza gratis con 5 cotizaciones al mes", "Sube tu DXF y el precio sale solo", "Tu cliente lo recibe por WhatsApp"], cta: "Empieza gratis",
    texto: "¿Sigues cotizando a mano en una hoja? Con HETNA Cotizador subes tu DXF, sale el precio con tus costos y se lo mandas a tu cliente por WhatsApp. Empieza gratis: 5 cotizaciones al mes.",
    en: { nombre: "HETNA Quoter free", gancho: "Still quoting by hand?", frases: ["Start free with 5 quotes a month", "Upload your DXF and get the price", "Your customer gets it on WhatsApp"], cta: "Start free", texto: "Still quoting by hand on a spreadsheet? With the HETNA Quoter you upload your DXF, get the price with your costs and send it to your customer on WhatsApp. Start free: 5 quotes a month." }
  },
  {
    clave: "cotizador_prueba", nombre: "Prueba de 14 días", ruta: "/mx/herramientas-cnc", imagen: IMG("cotizador-whatsapp.jpg"), tema: "taller", publico: "talleres",
    gancho: "Prueba el cotizador 14 días", frases: ["Cotizaciones sin límite durante la prueba", "PDF con tu marca y tus tarifas", "Todo queda en tu historial"], cta: "Pruébalo 14 días",
    texto: "Prueba HETNA Cotizador 14 días: cotiza sin límite, manda PDF con tu marca y tus tarifas y lleva el historial de tus clientes en un solo lugar.",
    en: { nombre: "14-day trial", gancho: "Try the quoter for 14 days", frases: ["Unlimited quotes during the trial", "PDF with your logo and rates", "Your customer history in one place"], cta: "Try it for 14 days", texto: "Try the HETNA Quoter for 14 days: unlimited quotes, PDFs with your logo and rates, and your customer history in one place." }
  },
  {
    clave: "cotizador_factura", nombre: "Cotiza, cobra y factura", ruta: "/mx/herramientas-cnc", imagen: null, tema: "taller", publico: "talleres",
    gancho: "Cotiza, cobra y factura", frases: ["La cotización se vuelve pedido", "Factura electrónica desde el plan Taller", "Sin pasar datos a otro sistema"], cta: "Conoce los planes",
    texto: "En HETNA Cotizador la cotización aceptada se vuelve pedido y, desde el plan Taller, la facturas ahí mismo con factura electrónica. Sin pasar datos de un sistema a otro.",
    en: { nombre: "Quote, get paid, invoice", gancho: "Quote, get paid, invoice", frases: ["An accepted quote becomes an order", "Mexican e-invoicing from the Taller plan", "No retyping into another system"], cta: "See the plans", texto: "In the HETNA Quoter an accepted quote becomes an order and, from the Taller plan, you invoice it right there with Mexican e-invoicing (CFDI). No retyping into another system." }
  },
  {
    clave: "cotizador_seguimiento", nombre: "Seguimiento automático", ruta: "/mx/herramientas-cnc", imagen: null, tema: "taller", publico: "talleres",
    gancho: "¿Mandaste la cotización y nada?", frases: ["El cotizador le da seguimiento por ti", "Recordatorio antes de que venza", "Y gracias con liga para reseña"], cta: "Conoce el plan Pro",
    texto: "¿Mandas cotizaciones y el cliente ya no contesta? Con el Marketing automático de HETNA Cotizador (plan Pro) le das seguimiento, le recuerdas antes de que venza y le pides reseña al entregar.",
    en: { nombre: "Automatic follow-up", gancho: "Sent the quote and heard nothing?", frases: ["The quoter follows up for you", "A reminder before it expires", "And a thank-you with a review link"], cta: "See the Pro plan", texto: "Sending quotes and customers go quiet? With HETNA Quoter automated marketing (Pro plan) you follow up, remind them before the quote expires and ask for a review on delivery." }
  },
  // --- HETNA 3D Studio: de foto, texto o logotipo a STL (imagen a 3D con IA usa créditos; 1 gratis al mes) ---
  {
    clave: "imagen_3d", nombre: "Imagen a 3D con IA", ruta: "/mx/disenar/imagen-a-3d", imagen: null, tema: "impresion3d", publico: "clientes_particulares",
    gancho: "De una foto a un modelo 3D", frases: ["Sube la foto y la IA hace el modelo", "Listo en 3 a 5 minutos", "Descarga el STL para imprimir o maquinar"], cta: "Pruébalo: 1 gratis al mes",
    texto: "Sube la foto de una figura, pieza o producto y la IA de HETNA 3D Studio crea el modelo 3D con textura en 3 a 5 minutos. Descárgalo en STL para impresión 3D o router CNC, o en GLB con color. El primero de cada mes es gratis.",
    en: { nombre: "Image to 3D with AI", gancho: "From a photo to a 3D model", frases: ["Upload a photo and AI builds the model", "Ready in 3 to 5 minutes", "Download the STL to print or machine"], cta: "Try it: 1 free a month", texto: "Upload a photo of a figure, part or product and the AI in HETNA 3D Studio builds a textured 3D model in 3 to 5 minutes. Download it as STL for 3D printing or CNC routing, or as GLB with color. Your first one each month is free." },
  },
  {
    clave: "litofania", nombre: "Litofanías y relieves 3D", ruta: "/mx/disenar/litofania-relieve", imagen: null, tema: "impresion3d", publico: "clientes_particulares",
    gancho: "Tu foto en una litofanía 3D", frases: ["Plana, curva o en cilindro para lámpara", "O relieve para tallar en router", "Descarga el STL gratis"], cta: "Hazla gratis",
    texto: "Convierte gratis una foto en STL: litofanía plana, curva o en cilindro para lámpara lista para imprimir, o relieve 3D para tallar en router CNC. En HETNA 3D Studio.",
    en: { nombre: "Lithophanes and 3D reliefs", gancho: "Turn your photo into a lithophane", frases: ["Flat, curved or a cylinder lamp", "Or a relief to carve on a router", "Download the STL for free"], cta: "Make it free", texto: "Turn a photo into an STL for free: a flat, curved or cylinder lithophane ready to print, or a 3D relief to carve on a CNC router. In HETNA 3D Studio." },
  },
  {
    clave: "svg_stl", nombre: "SVG o DXF a STL", ruta: "/mx/disenar/svg-a-stl", imagen: null, tema: "impresion3d", publico: "clientes_particulares",
    gancho: "Tu logotipo en 3D", frases: ["Sube tu SVG o DXF", "Dale altura y descarga el STL", "Para llaveros, placas y sellos"], cta: "Conviértelo gratis",
    texto: "Sube un SVG o DXF, dale altura y descarga el STL para imprimir en 3D o tallar en relieve. Con placa base para llaveros y placas, y modo espejo para sellos. Gratis en HETNA 3D Studio.",
    en: { nombre: "SVG or DXF to STL", gancho: "Your logo in 3D", frases: ["Upload your SVG or DXF", "Set the height and get the STL", "For keychains, plates and stamps"], cta: "Convert it free", texto: "Upload an SVG or DXF, set the height and download the STL to 3D print or carve in relief. With a base plate for keychains and plates, and mirror mode for stamps. Free in HETNA 3D Studio." },
  },
  {
    clave: "letras_3d", nombre: "Letras 3D en caja", ruta: "/mx/disenar/letras-3d", imagen: null, tema: "laser", publico: "talleres",
    gancho: "Letras 3D para tu anuncio", frases: ["Frente de acrílico y paredes de MDF", "Hojas de corte en DXF o SVG", "Con barreno para el LED"], cta: "Diséñalas gratis",
    texto: "Escribe tu texto, elige la letra y el alto y descarga gratis las hojas de corte en DXF o SVG: frente de acrílico, paredes y fondo de MDF con barreno para el LED. Vista 3D del armado en HETNA 3D Studio.",
    en: { nombre: "3D channel letters", gancho: "3D letters for your sign", frases: ["Acrylic face and MDF sides", "Cut sheets in DXF or SVG", "With a hole for the LED"], cta: "Design them free", texto: "Type your text, pick the font and height, and download free cut sheets in DXF or SVG: acrylic face, MDF sides and back with a hole for the LED. 3D preview in HETNA 3D Studio." },
  },
  {
    clave: "llaveros", nombre: "Llaveros y placas con nombre", ruta: "/mx/disenar/llaveros", imagen: null, tema: "laser", publico: "clientes_particulares",
    gancho: "Llaveros con nombre en minutos", frases: ["Elige la letra y la forma", "DXF para láser o STL en relieve", "Con el agujero de la argolla"], cta: "Hazlos gratis",
    texto: "Haz llaveros, placas de mascota y adornos con nombre: elige la letra y la forma y descarga el DXF o SVG para láser o el STL con las letras en relieve. Gratis en HETNA 3D Studio.",
    en: { nombre: "Name keychains and tags", gancho: "Name keychains in minutes", frases: ["Pick the font and the shape", "DXF for laser or raised-letter STL", "With the key ring hole"], cta: "Make them free", texto: "Make keychains, pet tags and ornaments with names: pick the font and shape and download the DXF or SVG for laser or the STL with raised letters. Free in HETNA 3D Studio." },
  },
  {
    clave: "disenar", nombre: "Estudio de diseño", ruta: "/mx/disenar", imagen: null, tema: "router", publico: "clientes_particulares",
    gancho: "Diseña para CNC gratis", frases: ["De imagen a 3D", "Cajas, vectores y piezas 2D", "Listo para cortar o imprimir"], cta: "Diseña gratis en HETNA",
    texto: "HETNA 3D Studio y 2D Studio: pasa una imagen a 3D, arma cajas, vectoriza y prepara tus piezas para cortar o imprimir. Gratis en el navegador.",
  },
  {
    clave: "cam", nombre: "Laboratorio CAM", ruta: "/mx/laboratorio-cam", imagen: null, tema: "torno", publico: "talleres",
    gancho: "Simula tu G-code antes de cortar", frases: ["Trayectorias de 3 a 5 ejes", "Revisa colisiones y tiempo", "G-code para Mach3, GRBL, LinuxCNC o Fanuc"], cta: "Pruébalo gratis",
    texto: "Simula trayectorias de 3 a 5 ejes, revisa colisiones y tiempo y descarga G-code para Mach3, GRBL, LinuxCNC o Fanuc. Gratis en el Laboratorio CAM de HETNA.",
  },
  {
    clave: "ranking", nombre: "Ranking de talleres", ruta: "/mx/talleres/ranking", imagen: null, tema: "taller", publico: "clientes_empresa",
    gancho: "¿Qué taller CNC es confiable?", frases: ["Ranking con evaluaciones reales", "Por especialidad y estado", "Talleres verificados y certificados"], cta: "Ve el ranking",
    texto: "El ranking de talleres CNC de HETNA se arma con evaluaciones reales de clientes. Filtra por especialidad y estado y encuentra talleres verificados.",
  },
  // --- Publicidad en hetnacnc.com (apps/storefront/src/lib/publicidad): espacios de 30 o 90 días con Mercado Pago ---
  {
    clave: "anunciate", nombre: "Anúnciate en HETNA", ruta: "/mx/anunciate", imagen: null, tema: "taller", publico: "proveedores",
    gancho: "Pon tu taller frente a clientes CNC", frases: ["Carrusel del inicio, banners y foro", "Por 1 o 3 meses", "Pagas con Mercado Pago y listo"], cta: "Elige tu espacio",
    texto: "Anuncia tu taller, tus herramientas o tus servicios en hetnacnc.com: carrusel del inicio, banners, la sección de herramientas, el foro o las categorías. Por 1 o 3 meses (el de 3 meses con 10% menos). Eliges tu espacio, pagas con Mercado Pago y listo.",
  },
  {
    clave: "licitaciones", nombre: "Licitaciones sin comisión", ruta: "/mx/cotizar", imagen: null, tema: "lamina", publico: "clientes_empresa",
    gancho: "Varios talleres cotizan tu pieza", frases: ["Publica tu solicitud gratis", "Compara propuestas", "Sin comisión"], cta: "Pide cotización",
    texto: "Publica tu pieza en HETNA y recibe propuestas de varios talleres CNC. Compara y elige: sin comisión.",
  },
]

let listo = false
export async function asegurarPromo(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_PROMO))) {
    await knex.schema.createTable(T_PROMO, (t: any) => {
      t.text("id").primary()
      t.text("tipo").notNullable() // producto | blog | herramienta
      t.text("ref").notNullable()
      t.jsonb("posts")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
      t.index(["tipo", "ref"])
    })
  }
  listo = true
}

/** Voz de RunPod para una lista de frases (null si no hay RunPod o falla: el video sale sin voz). */
export async function vozPara(nombre: string, frases: string[], mercado: string, logger?: any) {
  const respaldo = () => vozLocal(frases, idiomaDe(mercado), logger)
  if (!runpodListo()) return respaldo()
  try {
    const idioma = idiomaDe(mercado)
    const out = await correr({ tarea: "voz", voz: VOZ(idioma, "hombre"), idioma, lotes: [{ frases, clave: `fabrica/promo/${nombre}-voz.wav` }] }, { logger, topeMin: 15 })
    const l = out.lotes?.[0]
    return l ? { ...l, url: (await ligasB2([l.clave], 7200))[0] } : respaldo()
  } catch (e) {
    logger?.warn?.(`[promo] voz de RunPod: ${(e as Error).message}; uso la voz local`)
    return respaldo()
  }
}

export async function cuandoPromo(knex: any, horas: number, mercado = "mx") {
  return cuando(knex, horas, mercado)
}

/** Corto 9:16 con fotos propias (producto, portada o captura) y voz si se puede. */
async function videoCon(scope: any, nombre: string, d: { gancho: string; frases: string[]; cierre: string; fotos: (string | null)[]; tema: string; liga: string; mercado: string }, logger?: any) {
  if (!ffmpegDisponible()) return null
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const frases = d.frases.slice(0, 3)
  const voz: any = await vozPara(nombre, [d.gancho, ...frases, d.cierre], d.mercado, logger)
  const foto = async (k: number) => d.fotos[k % Math.max(1, d.fotos.length)] || (await fondoDe(knex, d.tema))
  const dur = (k: number, porOmision: number) => (voz?.duraciones?.[k] ? Math.max(1.2, voz.duraciones[k] + 0.15) : porOmision)
  const escenas = [{ png: await cuadroVideo({ tipo: "gancho", texto: d.gancho, tema: d.tema, foto_url: await foto(0), semilla: 1 }), segundos: dur(0, 2.4) }]
  for (const [k, f] of frases.entries()) escenas.push({ png: await cuadroVideo({ tipo: "frase", texto: f, tema: d.tema, foto_url: await foto(k + 1), semilla: k + 2, sinTexto: true }), segundos: dur(k + 1, segundosPara(f)), subtitulo: f })
  escenas.push({ png: await cuadroVideo({ tipo: "cierre", texto: d.cierre, tema: d.tema, liga: d.liga }), segundos: dur(frases.length + 1, 2.6) })
  const v = await corto(escenas, { fuentes: carpetaFuentes(), musica: await musicaAlAzar(knex), voz: voz?.url || null })
  return subir(scope, `${nombre}.mp4`, "video/mp4", v.buf)
}

/**
 * Video animado (estilo «¿Máquina parada?») de una promo: gancho, la captura de
 * la herramienta o la foto (si hay), las frases y el cierre. null si los videos
 * animados están apagados o falla (entonces sale el de FFmpeg).
 */
async function videoAnimado(scope: any, nombre: string, d: { gancho: string; frases: string[]; cierre: string; fotos: (string | null)[]; liga: string; titulo: string; mercado?: string }, logger?: any) {
  const idioma = d.mercado === "us" ? "en" : "es"
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const cfg = await leerConfig(knex)
  // Sólo de madrugada (2-6 am): de día no se le quita procesador a la tienda
  if (!cfg.video_animado || !hfDisponible() || !horaTranquila()) return null
  const foto = d.fotos.find((u) => /^https?:\/\//.test(String(u || "")))
  const usados: string[] = []
  const ic = (t: string) => {
    const x = iconoPara(t, undefined, usados)
    usados.push(x)
    return x
  }
  const cierre = { texto: d.cierre, narracion: idioma === "en" ? `${d.cierre} at hetnacnc.com` : `${d.cierre} en hetnacnc.com` }
  // El guionista (IA) escribe las escenas con textos naturales de máx. 4 palabras; sin IA, se arman con las frases
  let bloques: any[] | null = await guionista({ texto: [d.titulo, d.gancho, ...d.frases].join(". "), publico: "talleres", cierre, idioma }, logger)
  if (!bloques) {
    bloques = [{ tipo: "gancho", texto: cuatroPalabras(d.gancho), narracion: d.gancho, icono: ic(`${d.titulo} ${d.gancho}`) }]
    for (const f of d.frases.slice(0, 3)) bloques.push({ tipo: "accion", texto: cuatroPalabras(f), narracion: f, icono: ic(f) })
    bloques.push({ tipo: "cierre", ...cierre })
  }
  // La captura real de la herramienta (o la foto) va después del gancho
  if (foto) bloques.splice(1, 0, { tipo: "producto", texto: cuatroPalabras(d.titulo), narracion: `${d.titulo}.`, foto })
  const voz: any = await vozPara(nombre, bloques.map((b) => paraVoz(b.narracion, idioma)), d.mercado || "mx", logger)
  const v = await videoHF(bloques, {
    duraciones: voz?.duraciones?.length === bloques.length ? voz.duraciones : bloques.map((b) => segundosPara(b.narracion, 1.8, 4.5)),
    voz: voz?.url || null, musica: await musicaAlAzar(knex), liga: d.liga, tema: temaPara(nombre), idioma, logger,
  })
  return v ? subir(scope, `${nombre}.mp4`, "video/mp4", v.buf) : null
}

async function cuando(knex: any, horas: number, mercado = "mx") {
  const cfg = await leerConfig(knex)
  return { estado: cfg.automatico.promociones ? "programada" : "borrador", fecha: dentroDeHorario(new Date(Date.now() + horas * 3600_000), cfg.horario, zonaDe(mercado)) }
}

/** Arma imagen + video de un tema y deja dos publicaciones. */
async function publicarPar(scope: any, d: { tipo: string; ref: string; titulo: string; texto: string; url: string; tema: string; cinta: string; cta: string; producto_url?: string | null; fotos: (string | null)[]; gancho: string; frases: string[]; carrusel?: { titulo: string; puntos: string[]; portada?: string | null }; mercado?: string }, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const mercado = d.mercado || "mx"
  const en = mercado === "us"
  const c1 = await cuando(knex, 2, mercado)
  const posts: string[] = []
  // 1) Imagen (tarjeta) o carrusel
  const p1 = await crearPublicacion(knex, { origen: "manual", fuente: "promo", titulo: `Promo · ${d.titulo}`, texto_base: d.texto, url: d.url, redes: d.carrusel ? ["instagram", "facebook", "linkedin"] : ["facebook", "instagram", "telegram"], estado: c1.estado, programada_para: c1.fecha, mercado }, logger)
  const liga1 = urlCorta(await ligaPara(knex, p1, "facebook", d.url))
  let medios: any[]
  if (d.carrusel) {
    const cfgLam = await leerConfig(knex)
    const est = { activo: cfgLam.imagen_nueva !== false, tema: temaPara(p1), icono: iconoPara(`${d.titulo} ${d.gancho}`), cinta: d.cinta, liga: liga1, logger }
    const total = d.carrusel.puntos.length + 2
    const urls = [await subir(scope, `promo-${p1}-1.png`, "image/png", await laminaEstilo({ num: 1, total, titulo: d.carrusel.titulo, portada: true, tema: d.tema, foto_url: d.carrusel.portada || (await fondoDe(knex, d.tema)) }, est))]
    for (const [k, pt] of d.carrusel.puntos.entries()) urls.push(await subir(scope, `promo-${p1}-${k + 2}.png`, "image/png", await laminaEstilo({ num: k + 2, total, titulo: pt, tema: d.tema }, est)))
    urls.push(await subir(scope, `promo-${p1}-${total}.png`, "image/png", await laminaEstilo({ num: total, total, titulo: d.cta, cierre: { cta: d.cta, liga_texto: en ? "link in bio" : "liga en el perfil" }, tema: d.tema, foto_url: await fondoDe(knex, d.tema) }, est)))
    medios = urls.map((url) => ({ url, tipo: "imagen" }))
  } else {
    // Estilo nuevo (fondos de tema, como los videos); si no se puede, la tarjeta de siempre
    const cfgImg = await leerConfig(knex)
    const png =
      (cfgImg.imagen_nueva !== false &&
        (await poster({ tema: temaPara(p1), cinta: d.cinta, titulo: palabras(d.titulo, 10), foto: d.producto_url || d.fotos.find((u) => u) || null, icono: iconoPara(`${d.titulo} ${d.gancho}`), cta: d.cta, liga: liga1 }, logger))) ||
      (await tarjeta({ tema: d.tema, foto_url: d.producto_url ? await fondoDe(knex, d.tema) : d.fotos[0] || (await fondoDe(knex, d.tema)), producto_url: d.producto_url || null, cinta: { texto: d.cinta, tono: d.tipo === "producto" ? "verde" : "naranja" }, titulo: palabras(d.titulo, 10), cta: d.cta, liga: liga1 }))
    medios = [{ url: await subir(scope, `promo-${p1}.png`, "image/png", png), tipo: "imagen" }]
  }
  await knex(T_POST).where({ id: p1 }).update({ medios: JSON.stringify(medios) })
  posts.push(p1)
  // 2) Video vertical (Reels, TikTok, Shorts) al día siguiente
  if (ffmpegDisponible()) {
    const c2 = await cuando(knex, 26, mercado)
    const p2 = await crearPublicacion(knex, { origen: "manual", fuente: "promo", titulo: `Promo video · ${d.titulo}`, texto_base: d.texto, url: d.url, redes: ["instagram", "instagram_historia", "facebook", "tiktok", "youtube"], estado: c2.estado, programada_para: c2.fecha, mercado }, logger)
    const liga2 = urlCorta(await ligaPara(knex, p2, "instagram", d.url))
    const v =
      (await videoAnimado(scope, `promo-${p2}`, { gancho: d.gancho, frases: d.frases, cierre: d.cta, fotos: d.fotos, liga: liga2, titulo: d.titulo, mercado }, logger).catch(() => null)) ||
      (await videoCon(scope, `promo-${p2}`, { gancho: d.gancho, frases: d.frases, cierre: d.cta, fotos: d.fotos, tema: d.tema, liga: liga2, mercado }, logger))
    if (v) await knex(T_POST).where({ id: p2 }).update({ medios: JSON.stringify([{ url: v, tipo: "video" }]) })
    posts.push(p2)
  }
  await knex(T_PROMO).insert({ id: nuevoId("promo"), tipo: d.tipo, ref: d.ref, posts: JSON.stringify(posts) })
  return posts
}

const yaPromovidos = (knex: any, tipo: string, dias: number) => knex(T_PROMO).where({ tipo }).where("created_at", ">=", knex.raw(`now() - (? || ' days')::interval`, [String(dias)])).select("ref")

export async function promoProducto(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromo(knex)
  const p = await knex("product").whereNull("deleted_at").where({ status: "published" }).whereNotNull("thumbnail").whereNotIn("id", yaPromovidos(knex, "producto", 45)).orderBy("created_at", "desc").first("id", "title", "handle", "thumbnail", "description")
  if (!p) return null
  const imgs = await knex("image").where({ product_id: p.id }).whereNull("deleted_at").orderBy("rank").limit(4).pluck("url").catch(() => [])
  const fotos = [...new Set([p.thumbnail, ...imgs])].filter((u) => /^https:\/\//.test(String(u)))
  const desc = limpiar(String(p.description || "").replace(/<[^>]+>/g, " "))
  const ors = oraciones(desc)
  return publicarPar(scope, {
    tipo: "producto", ref: p.id, titulo: p.title, url: `${STORE_URL}/mx/products/${p.handle}`, tema: temaDe(`${p.title} ${desc}`),
    texto: `${p.title}${ors[0] ? `\n\n${ors.slice(0, 2).join(" ")}` : ""}\n\nVelo en la tienda HETNA: {{liga}}`,
    cinta: "En la tienda HETNA", cta: "Cómpralo en HETNA", producto_url: fotos[0] || null, fotos,
    gancho: palabras(p.title, 8), frases: ors.length ? ors.slice(0, 3).map((o) => palabras(o, 10)) : ["Disponible en la tienda HETNA"],
  }, logger)
}

export async function promoBlog(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromo(knex)
  const a = await knex("learning_article").whereNull("deleted_at").whereNotNull("published_at").where("published_at", "<=", knex.fn.now()).whereNotIn("id", yaPromovidos(knex, "blog", 120)).orderBy("published_at", "desc").first("id", "slug", "title", "excerpt", "content_html", "cover_image_url")
  if (!a) return null
  const html = String(a.content_html || "")
  const subtitulos = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => limpiar(m[1].replace(/<[^>]+>/g, " "))).filter(Boolean)
  const ors = oraciones(`${a.excerpt || ""} ${html.replace(/<[^>]+>/g, " ")}`)
  const puntos = (subtitulos.length >= 3 ? subtitulos : ors).slice(0, 4).map((x) => palabras(x, 12))
  const portada = /^https:\/\//.test(String(a.cover_image_url || "")) ? a.cover_image_url : null
  return publicarPar(scope, {
    tipo: "blog", ref: a.id, titulo: a.title, url: `${STORE_URL}/mx/aprendizaje-cnc/${a.slug}`, tema: temaDe(`${a.title} ${a.excerpt}`),
    texto: `${a.title}\n\n${limpiar(a.excerpt || ors[0] || "")}\n\nLéelo completo en Aprendizaje CNC: {{liga}}`,
    cinta: "Aprendizaje CNC", cta: "Lee la guía completa", fotos: [portada], gancho: palabras(a.title, 8), frases: ors.slice(0, 3).map((o) => palabras(o, 10)),
    carrusel: { titulo: palabras(a.title, 10), puntos, portada },
  }, logger)
}

/** Herramientas del Cotizador (lo que se monetiza): salen 4 de cada 7 días. */
export const DEL_COTIZADOR = ["cotizador", "cotizador_whatsapp", "cotizador_gratis", "cotizador_prueba", "cotizador_factura", "cotizador_seguimiento"]

/** HETNA 3D Studio (imagen a 3D con IA se cobra con créditos). */
export const DEL_3D = ["imagen_3d", "litofania", "svg_stl", "letras_3d", "llaveros", "disenar"]

/**
 * Qué herramienta sale cada día (0 = domingo):
 *   México: Cotizador lunes, miércoles y viernes; 3D Studio martes, jueves y domingo; las demás el sábado.
 *   EE.UU. (en inglés): Cotizador el martes y 3D Studio el sábado.
 */
export const grupoDelDia = (dia: number): "cotizador" | "3d" | "otras" => ([1, 3, 5].includes(dia) ? "cotizador" : [2, 4, 0].includes(dia) ? "3d" : "otras")
export const grupoUsDelDia = (dia: number): "cotizador" | "3d" | null => (dia === 2 ? "cotizador" : dia === 6 ? "3d" : null)
/** Compatibilidad: ¿hoy toca Cotizador en México? */
export const tocaCotizador = (dia: number) => grupoDelDia(dia) === "cotizador"

export async function promoHerramienta(scope: any, logger?: any, clave?: string, o: { soloCotizador?: boolean; sinCotizador?: boolean; grupo?: "cotizador" | "3d" | "otras"; mercado?: "mx" | "us" } = {}) {
  const us = o.mercado === "us"
  const grupo = o.grupo || (o.soloCotizador ? "cotizador" : undefined)
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromo(knex)
  let h = clave ? HERRAMIENTAS.find((x) => x.clave === clave) : null
  if (!h) {
    // La que tiene más tiempo sin promoverse
    const ult = await knex(T_PROMO).where({ tipo: "herramienta" }).groupBy("ref").select("ref").max({ en: "created_at" })
    const fecha = Object.fromEntries(ult.map((u: any) => [u.ref, new Date(u.en).getTime()]))
    const ref = (c: string) => (us ? `${c}:us` : c)
    const lista = HERRAMIENTAS.filter((x) =>
      (!us || x.en) &&
      (grupo === "cotizador" ? DEL_COTIZADOR.includes(x.clave) : grupo === "3d" ? DEL_3D.includes(x.clave) : grupo === "otras" ? !DEL_COTIZADOR.includes(x.clave) && !DEL_3D.includes(x.clave) : o.sinCotizador ? !DEL_COTIZADOR.includes(x.clave) : true),
    )
    h = [...lista].sort((a, b) => (fecha[ref(a.clave)] || 0) - (fecha[ref(b.clave)] || 0))[0]
  }
  if (!h) return null
  if (us && !h.en) return null
  const t = us ? { ...h, ...h.en! } : h
  // Precio real de los planes (de cotizador-suscripciones) sólo en el texto, nunca inventado
  let planes = ""
  if (DEL_COTIZADOR.includes(h.clave)) {
    try {
      const { PLANES_COTIZADOR } = await import("../cotizador-suscripciones")
      const precio = us ? PLANES_COTIZADOR.taller?.precioUsd : PLANES_COTIZADOR.taller?.precio
      if (precio)
        planes = us
          ? `\n\nFree plan: 5 quotes a month. Paid plans from ${"$"}${precio} USD a month.`
          : `\n\nPlan gratis: 5 cotizaciones al mes. Planes de pago desde ${"$"}${Number(precio).toLocaleString("es-MX")} MXN al mes.`
    } catch {}
  }
  return publicarPar(scope, {
    tipo: "herramienta", ref: us ? `${h.clave}:us` : h.clave, titulo: t.nombre, url: `${STORE_URL}${us ? h.ruta.replace(/^\/mx/, "/us") : h.ruta}`, tema: h.tema, texto: `${t.texto}${planes}\n\n${t.cta}: {{liga}}`, mercado: us ? "us" : "mx",
    cinta: t.nombre, cta: t.cta, producto_url: h.imagen, fotos: h.imagen ? [h.imagen] : [], gancho: t.gancho, frases: t.frases,
  }, logger)
}

/** Job diario: producto todos los días; blog martes y viernes; herramienta lunes y jueves. */
export async function promocionesDelDia(scope: any, logger?: any) {
  const dia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getDay()
  const hechos: string[] = []
  const intenta = async (nombre: string, fn: () => Promise<any>) => {
    try {
      if (await fn()) hechos.push(nombre)
    } catch (e) {
      logger?.warn?.(`[promo] ${nombre}: ${(e as Error).message}`)
    }
  }
  await intenta("producto", () => promoProducto(scope, logger))
  if (dia === 2 || dia === 5) await intenta("blog", () => promoBlog(scope, logger))
  // Herramientas y Cotizador: todos los días en el job de madrugada (jobs/promo-herramientas.ts)
  // Plantillas de dos lados (lib/fabrica/oportunidades): radar para talleres y talleres listos para clientes
  const op = await import("./oportunidades")
  if (dia === 3 || dia === 6) await intenta("radar por estado", () => op.radarEstado(scope, logger))
  if (dia === 0 || dia === 2) await intenta("talleres listos", () => op.talleresListos(scope, logger))
  if (hechos.length) logger?.info?.(`[promo] hechas: ${hechos.join(", ")}`)
  return hechos
}
