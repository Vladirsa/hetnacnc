// Precio APROXIMADO de una pieza a la medida en el WhatsApp (decidido por Vlado
// el 14 nov 2026). El agente sólo junta los datos (servicio, material, medidas,
// cantidad); el número lo calcula el mismo estimador de la página
// (lib/estimador-cnc.ts) y el texto con el precio lo arma este código, así la IA
// nunca escribe ni inventa una cifra.
import { STORE_URL } from "./licitacion"
import { MATERIALES, SERVICIOS, type TipoMaquina, estimar, materialesPara, pesos, piezaAMano } from "./estimador-cnc"

export type PedidoEstimado = {
  pedir: boolean
  servicio: string
  material: string
  largo_mm: number
  ancho_mm: number
  alto_mm: number
  cantidad: number
  complejidad: string
}

export const SERVICIOS_ESTIMADO = SERVICIOS.map((s) => s.clave) as TipoMaquina[]

/** Para el prompt: qué servicios y materiales (nombres exactos) se pueden estimar. */
export function catalogoEstimado(): string {
  return SERVICIOS.map((s) => `${s.clave} (${s.nombre}): ${materialesPara(s.clave).map((m) => m.nombre).join(", ")}`).join("\n")
}

const sinAcentos = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export type ResultadoEstimado =
  | { ok: true; texto: string; resumen: string; min: number; max: number }
  | { ok: false; texto: string }

const LIGA = `${STORE_URL}/mx/cotizar?utm_source=whatsapp&utm_medium=agente&utm_campaign=estimado`

export function calcularEstimado(p: PedidoEstimado): ResultadoEstimado {
  const servicio = SERVICIOS.find((s) => s.clave === p.servicio)
  const permitidos = servicio ? materialesPara(servicio.clave) : []
  const material = permitidos.find((m) => sinAcentos(m.nombre) === sinAcentos(p.material))
  const largo = Number(p.largo_mm) || 0
  const ancho = Number(p.ancho_mm) || 0
  const alto = Number(p.alto_mm) || 0
  const cantidad = Math.round(Number(p.cantidad) || 0)
  const pedirPlano = `Para darte un precio con esos datos necesito que lo revise un taller: publica tu solicitud gratis con foto, plano o medidas y te llegan propuestas reales: ${LIGA}`

  if (!servicio || !material) return { ok: false, texto: pedirPlano }
  if (largo <= 0 || ancho <= 0 || cantidad <= 0 || largo > 3000 || ancho > 3000 || cantidad > 10000) return { ok: false, texto: pedirPlano }
  const es3D = servicio.clave === "impresora_3d" || servicio.clave === "router_3d"
  if (servicio.clave === "impresora_3d" && alto <= 0) return { ok: false, texto: pedirPlano }

  const complejidad = (["sencillo", "normal", "calado"].includes(p.complejidad) ? p.complejidad : "normal") as "sencillo" | "normal" | "calado"
  const pieza = piezaAMano(largo, ancho, alto, complejidad, es3D)
  const e = estimar({ servicio: servicio.clave, pieza, material, cantidad })
  if (!e.ok) return { ok: false, texto: `${e.motivo} ${pedirPlano}` }

  const medidas = `${Math.round(largo)}×${Math.round(ancho)}${alto ? `×${Math.round(alto)}` : ""} mm`
  const piezas = cantidad === 1 ? "1 pieza" : `${cantidad.toLocaleString("es-MX")} piezas`
  const porPieza = cantidad > 1 ? ` (unos ${pesos(e.precioPieza)} por pieza)` : ""
  const texto =
    `Para ${piezas} de ${medidas} en ${material.nombre} con ${servicio.nombre.toLowerCase()}, el precio aproximado es de ${pesos(e.min)} a ${pesos(e.max)} por todo el pedido${porPieza}, sin envío. ` +
    `Es una referencia de HETNA: el precio final te lo dan los talleres y cambia según tu diseño y acabado. ` +
    `Publica tu solicitud gratis y te llegan propuestas reales con pago protegido: ${LIGA}`
  return { ok: true, texto, resumen: `${piezas} ${medidas} ${material.nombre} ${servicio.nombre}: ${pesos(e.min)}–${pesos(e.max)}`, min: e.min, max: e.max }
}

export const ESQUEMA_ESTIMADO = {
  type: "object",
  additionalProperties: false,
  required: ["pedir", "servicio", "material", "largo_mm", "ancho_mm", "alto_mm", "cantidad", "complejidad"],
  properties: {
    pedir: { type: "boolean" },
    servicio: { type: "string", enum: [...SERVICIOS_ESTIMADO, "ninguno"] },
    material: { type: "string" },
    largo_mm: { type: "number" },
    ancho_mm: { type: "number" },
    alto_mm: { type: "number" },
    cantidad: { type: "integer" },
    complejidad: { type: "string", enum: ["sencillo", "normal", "calado"] },
  },
}

export const REGLAS_ESTIMADO =
  "Precio aproximado de piezas a la medida (estimado):\n" +
  "- Si el cliente pregunta cuánto cuesta una pieza a la medida y YA tienes: servicio, material con grosor, largo y ancho (y alto si es impresión 3D o relieve) y cantidad, pon estimado.pedir = true con esos datos. Convierte cm o pulgadas a mm. Elige servicio y material SÓLO de la lista de abajo, con el nombre exacto; si el grosor no está, usa el más cercano.\n" +
  "- complejidad: sencillo = figura simple (rectángulo, círculo, letra gruesa); normal = figura con algunos detalles; calado = mucho detalle o letras finas.\n" +
  "- Cuando pidas estimado, NO escribas ningún precio ni número de dinero en respuesta: el sistema pone el precio. En respuesta escribe sólo UNA frase corta para seguir (p. ej. preguntar su ciudad u ofrecer ayuda para publicar la solicitud), o déjala vacía.\n" +
  "- Si falta un dato, pon pedir = false y pregunta SÓLO ese dato (uno por mensaje). Si es maquinado de precisión (torno, fresadora, tolerancias), piezas 3D complejas o no sabes qué servicio es, pon pedir = false y pide foto o plano para que lo coticen los talleres.\n" +
  "- Si no pides estimado: pedir = false, servicio = ninguno, material vacío y números en 0.\n" +
  "Servicios y materiales que se pueden estimar:\n"

export { MATERIALES }
