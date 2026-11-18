// Leer un mueble desde una imagen (foto, boceto o plano) con Claude y llevarlo
// a las medidas del constructor de muebles de ensamble (storefront:
// lib/generador/ensamble.ts, OpcionesExhibidor).
//
// La IA no dibuja piezas: sólo decide si la imagen es un mueble que el
// constructor sabe hacer y llena sus medidas. El constructor valida y acota
// cada número antes de generar nada, así que una lectura rara nunca produce
// piezas imposibles.

import Anthropic from "@anthropic-ai/sdk"

export const MODELO_MUEBLES = "claude-opus-5-5"
export const MEDIOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
export type MedioImagen = (typeof MEDIOS_IMAGEN)[number]

// Lo que regresa la IA. null = no se ve en la imagen (el constructor deja su medida de inicio).
export type LecturaMueble = {
  tipo: "exhibidor" | "otro"
  ancho: number | null
  fondoGabinete: number | null
  fondoRepisas: number | null
  altoGabinete: number | null // 0 = sin gabinete
  repisas: number | null
  espacioSobreGabinete: number | null
  separacion: number | null
  sobreUltima: number | null
  divisores: "ninguno" | "abajo" | "arriba" | "ambos" | null
  numDivisores: number | null
  altoDivisor: number | null
  barrote: number | null
  confianza: "alta" | "media" | "baja"
  notas: string
}

const numeroONulo = { anyOf: [{ type: "number" }, { type: "null" }] }
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "tipo", "ancho", "fondoGabinete", "fondoRepisas", "altoGabinete", "repisas", "espacioSobreGabinete", "separacion",
    "sobreUltima", "divisores", "numDivisores", "altoDivisor", "barrote", "confianza", "notas",
  ],
  properties: {
    tipo: { type: "string", enum: ["exhibidor", "otro"] },
    ancho: numeroONulo,
    fondoGabinete: numeroONulo,
    fondoRepisas: numeroONulo,
    altoGabinete: numeroONulo,
    repisas: numeroONulo,
    espacioSobreGabinete: numeroONulo,
    separacion: numeroONulo,
    sobreUltima: numeroONulo,
    divisores: { anyOf: [{ type: "string", enum: ["ninguno", "abajo", "arriba", "ambos"] }, { type: "null" }] },
    numDivisores: numeroONulo,
    altoDivisor: numeroONulo,
    barrote: numeroONulo,
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    notas: { type: "string" },
  },
} as const

const INSTRUCCIONES = `Eres un ingeniero de muebles para router CNC. Recibes una imagen (foto, boceto o plano acotado) y debes llenar las medidas de UN modelo de mueble que la plataforma sabe fabricar:

Modelo "exhibidor": mueble de ensamble sin tornillos (ranura y espiga, en triplay o MDF) con dos laterales, un gabinete cerrado abajo opcional (tapa, piso, frente y respaldo) y repisas arriba con espigas que atraviesan los laterales. Puede llevar divisores ranurados parados sobre la repisa de abajo, la de arriba o ambas, y un barrote redondo debajo de la última repisa.

Campos (todo en milímetros; si el plano está en cm o en pulgadas, conviértelo):
- ancho: ancho total del mueble, incluyendo lo que sobresalen las repisas.
- fondoGabinete: profundidad del gabinete de abajo (la parte más profunda).
- fondoRepisas: profundidad de las repisas de arriba.
- altoGabinete: alto del gabinete de abajo; 0 si no tiene gabinete.
- repisas: cuántas repisas hay arriba del gabinete (sin contar la tapa del gabinete).
- espacioSobreGabinete: distancia de la tapa del gabinete a la primera repisa (o del piso a la primera repisa si no hay gabinete).
- separacion: distancia entre repisas.
- sobreUltima: cuánto suben los laterales por encima de la última repisa.
- divisores: dónde hay divisores ("ninguno", "abajo", "arriba" o "ambos").
- numDivisores: divisores por repisa.  altoDivisor: alto de cada divisor.
- barrote: diámetro del barrote; 0 si no tiene.

Reglas:
- Usa las cotas del plano cuando existan. Si no hay cotas, estima con proporciones y con objetos de referencia (una puerta mide unos 2100 mm, una mesa 750 mm) y pon confianza "baja" o "media".
- Si una medida no se puede saber, devuelve null: la plataforma deja su valor de inicio.
- Si la imagen NO es un mueble de este tipo (una silla, una mesa, una cama, un closet con puertas, o no es un mueble), devuelve tipo "otro", todas las medidas en null, y en notas explica qué es y qué tipo de mueble habría que agregar.
- notas: una o dos frases en español de México para el cliente, sin tecnicismos: qué medidas leíste del plano y cuáles estimaste.
- Ignora logotipos, marcas de agua y texto de publicidad.`

let cliente: Anthropic | null = null
export const hayIaMuebles = () => !!process.env.ANTHROPIC_API_KEY

export class ErrorLectura extends Error {
  constructor(
    mensaje: string,
    readonly reembolsar: boolean,
  ) {
    super(mensaje)
  }
}

export async function leerMuebleDeImagen(datosBase64: string, medio: MedioImagen): Promise<LecturaMueble> {
  cliente ??= new Anthropic()
  let respuesta: Anthropic.Beta.BetaMessage
  try {
    respuesta = await cliente.beta.messages.create({
      model: MODELO_MUEBLES,
      max_tokens: 16000,
      // si el modelo declina por política, el servidor reintenta con otro modelo en la misma llamada
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA as unknown as Record<string, unknown> } },
      system: INSTRUCCIONES,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: medio, data: datosBase64 } },
            { type: "text", text: "Lee este mueble y llena las medidas del modelo exhibidor." },
          ],
        },
      ],
    })
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) throw new ErrorLectura("La imagen no se pudo leer. Prueba con otra foto (JPG o PNG, menos de 5 MB).", true)
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorLectura("La IA no está configurada en el servidor.", true)
    if (e instanceof Anthropic.RateLimitError) throw new ErrorLectura("La IA está ocupada. Intenta de nuevo en un minuto.", true)
    if (e instanceof Anthropic.APIError) throw new ErrorLectura("La IA no respondió. Intenta de nuevo.", true)
    throw new ErrorLectura("No se pudo conectar con la IA. Intenta de nuevo.", true)
  }
  if (respuesta.stop_reason === "refusal") throw new ErrorLectura("La IA no pudo leer esta imagen. Prueba con otra.", true)
  if (respuesta.stop_reason === "max_tokens") throw new ErrorLectura("La lectura quedó incompleta. Intenta de nuevo.", true)
  const texto = respuesta.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")
  let datos: LecturaMueble
  try {
    datos = JSON.parse(texto) as LecturaMueble
  } catch {
    throw new ErrorLectura("La lectura llegó dañada. Intenta de nuevo.", true)
  }
  return normalizarLectura(datos)
}

// Ningún número sale de rango ni con tipo raro (el constructor vuelve a acotar)
export function normalizarLectura(d: Partial<LecturaMueble>): LecturaMueble {
  const n = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : null)
  return {
    tipo: d.tipo === "exhibidor" ? "exhibidor" : "otro",
    ancho: n(d.ancho, 300, 2400),
    fondoGabinete: n(d.fondoGabinete, 150, 900),
    fondoRepisas: n(d.fondoRepisas, 100, 900),
    altoGabinete: n(d.altoGabinete, 0, 1200),
    repisas: n(d.repisas, 1, 8),
    espacioSobreGabinete: n(d.espacioSobreGabinete, 60, 1200),
    separacion: n(d.separacion, 80, 1200),
    sobreUltima: n(d.sobreUltima, 40, 600),
    divisores: d.divisores && ["ninguno", "abajo", "arriba", "ambos"].includes(d.divisores) ? d.divisores : null,
    numDivisores: n(d.numDivisores, 1, 12),
    altoDivisor: n(d.altoDivisor, 60, 1000),
    barrote: n(d.barrote, 0, 50),
    confianza: d.confianza === "alta" || d.confianza === "media" ? d.confianza : "baja",
    notas: typeof d.notas === "string" ? d.notas.slice(0, 600) : "",
  }
}
