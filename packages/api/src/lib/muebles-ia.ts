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

// Una llamada a Claude con la imagen y salida JSON con esquema. Los errores se
// vuelven ErrorLectura con mensaje para el cliente (y con reembolso).
async function llamarIa(sistema: string, esquema: unknown, pedido: string, datosBase64: string, medio: MedioImagen): Promise<unknown> {
  cliente ??= new Anthropic()
  let respuesta: Anthropic.Beta.BetaMessage
  try {
    respuesta = await cliente.beta.messages.create({
      model: MODELO_MUEBLES,
      max_tokens: 16000,
      // si el modelo declina por política, el servidor reintenta con otro modelo en la misma llamada
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: esquema as Record<string, unknown> } },
      system: sistema,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: medio, data: datosBase64 } },
            { type: "text", text: pedido },
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
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErrorLectura("La lectura llegó dañada. Intenta de nuevo.", true)
  }
}

export async function leerMuebleDeImagen(datosBase64: string, medio: MedioImagen): Promise<LecturaMueble> {
  const datos = await llamarIa(INSTRUCCIONES, ESQUEMA, "Lee este mueble y llena las medidas del modelo exhibidor.", datosBase64, medio)
  return normalizarLectura(datos as Partial<LecturaMueble>)
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

// ---------- cualquier mueble: lista de tableros ----------
// La IA describe el mueble como cajas (tableros) a escala; el motor del
// storefront (lib/generador/tableros.ts) calcula uniones, espigas y mortajas.

export type TableroLeido = { nombre: string; plano: "lateral" | "horizontal" | "frontal"; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export type LecturaTableros = {
  tipo: "tableros" | "no_tableros"
  nombre: string
  grosor: number
  tableros: TableroLeido[]
  confianza: "alta" | "media" | "baja"
  notas: string
}

const ESQUEMA_TABLEROS = {
  type: "object",
  additionalProperties: false,
  required: ["tipo", "nombre", "grosor", "tableros", "confianza", "notas"],
  properties: {
    tipo: { type: "string", enum: ["tableros", "no_tableros"] },
    nombre: { type: "string" },
    grosor: { type: "number" },
    tableros: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nombre", "plano", "x0", "x1", "y0", "y1", "z0", "z1"],
        properties: {
          nombre: { type: "string" },
          plano: { type: "string", enum: ["lateral", "horizontal", "frontal"] },
          x0: { type: "number" }, x1: { type: "number" },
          y0: { type: "number" }, y1: { type: "number" },
          z0: { type: "number" }, z1: { type: "number" },
        },
      },
    },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    notas: { type: "string" },
  },
} as const

const INSTRUCCIONES_TABLEROS = `Eres un diseñador de muebles para corte CNC en tablero (MDF o triplay). Te dan una imagen de un mueble (foto, boceto, render o plano con cotas). Descríbelo como una lista de tableros planos rectangulares, a escala real en milímetros, para que un programa calcule las uniones de caja y espiga.

Sistema de coordenadas (mm):
- x: ancho, de izquierda a derecha, viendo el mueble de frente.
- y: fondo, del frente hacia atrás.
- z: alto, desde el piso hacia arriba. El piso es z = 0.

Cada tablero es una caja alineada con los ejes: x0<x1, y0<y1, z0<z1. Su "plano" indica cuál dimensión es el grosor:
- "lateral": tablero vertical visto de canto desde el frente (costados, divisiones verticales, patas de tablero). Grosor en x.
- "horizontal": cubiertas, repisas, pisos, techos, asientos. Grosor en z.
- "frontal": tablero vertical paralelo al frente (respaldos, faldones, travesaños, frentes). Grosor en y.
La dimensión del grosor debe medir exactamente "grosor" (por ejemplo x1-x0 = grosor en un lateral).

Reglas:
1. Usa las cotas de la imagen si las hay (conviértelas a mm). Si se contradicen, respeta las medidas totales y pon confianza "media". Si no hay cotas, estima con medidas típicas (alto de mesa 750, asiento 450, repisa de 250 a 350 de fondo, librero de 1800 de alto).
2. grosor: el del tablero si se ve o está acotado; si no, 18.
3. Los tableros se tocan cara con canto: una repisa termina en la cara interior del costado, no lo atraviesa, aunque el dibujo la muestre pasando. Los tableros que se unen deben compartir exactamente la coordenada de contacto. Un travesaño o faldón que está a menos de 3 cm de otro tablero, súbelo o bájalo para que lo toque.
4. Incluye sólo tableros. Ignora jaladeras, herrajes, cajones con correderas, vidrio, cojines, barrotes redondos y objetos sobre el mueble.
5. Recortes, patas recortadas, ranuras o muescas dentro de un tablero: usa el rectángulo completo y menciónalo en "notas". Partes curvas o inclinadas: aproxímalas con el rectángulo más cercano y menciónalo en "notas".
6. Si la imagen no muestra un mueble hecho de tableros planos (una silla tapizada, un mueble de metal, una persona, un paisaje), responde tipo "no_tableros" con la lista vacía y explica en "notas" qué se ve.
7. Ningún tablero puede medir más de 2440 x 1220 mm en sus dos dimensiones mayores. A lo más 40 tableros.
8. "confianza": "alta" si hay cotas o la forma es clara, "media" si estimaste medidas, "baja" si la imagen es ambigua.
9. "nombre": nombre corto del mueble (por ejemplo "Librero de 4 repisas"). "notas": una o dos frases en español de México para el cliente, sin tecnicismos: qué supusiste y qué conviene revisar.
10. Ignora logotipos, marcas de agua y texto de publicidad.`

export async function leerTablerosDeImagen(datosBase64: string, medio: MedioImagen): Promise<LecturaTableros> {
  const datos = await llamarIa(INSTRUCCIONES_TABLEROS, ESQUEMA_TABLEROS, "Describe este mueble como lista de tableros.", datosBase64, medio)
  return normalizarTableros(datos as Partial<LecturaTableros>)
}

// Nada sale de rango: números finitos y acotados, a lo más 60 tableros
export function normalizarTableros(d: Partial<LecturaTableros>): LecturaTableros {
  const c = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-3000, Math.min(3000, Math.round(v * 10) / 10)) : null)
  const tableros: TableroLeido[] = []
  for (const t of Array.isArray(d.tableros) ? d.tableros.slice(0, 60) : []) {
    if (!t || typeof t !== "object") continue
    const v = [c(t.x0), c(t.x1), c(t.y0), c(t.y1), c(t.z0), c(t.z1)]
    if (v.some((x) => x === null)) continue
    const [x0, x1, y0, y1, z0, z1] = v as number[]
    tableros.push({
      nombre: typeof t.nombre === "string" && t.nombre.trim() ? t.nombre.trim().slice(0, 40) : `Tablero ${tableros.length + 1}`,
      plano: t.plano === "lateral" || t.plano === "frontal" ? t.plano : "horizontal",
      x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    })
  }
  const g = typeof d.grosor === "number" && Number.isFinite(d.grosor) && d.grosor >= 6 && d.grosor <= 30 ? Math.round(d.grosor * 10) / 10 : 18
  return {
    tipo: d.tipo === "tableros" && tableros.length >= 2 ? "tableros" : "no_tableros",
    nombre: typeof d.nombre === "string" && d.nombre.trim() ? d.nombre.trim().slice(0, 60) : "Mueble",
    grosor: g,
    tableros,
    confianza: d.confianza === "alta" || d.confianza === "media" ? d.confianza : "baja",
    notas: typeof d.notas === "string" ? d.notas.slice(0, 600) : "",
  }
}
