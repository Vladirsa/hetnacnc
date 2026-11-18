// Respuesta rápida a publicaciones de grupos de Facebook ("¿alguien que
// fabrique esta pieza?"). Desde el panel de administración se pega el texto o la
// captura de la publicación; la IA saca pieza, medidas, material y proceso, y
// aquí se arman:
//   - la liga a /cotizar con la pieza ya capturada (flujo "Fabrícamelo") y con
//     utm_source=facebook_grupo para medir lo que llega de los grupos;
//   - el comentario para quien publicó;
//   - el mensaje para los talleres que comentan ofreciendo hacerla.
// Todo se copia y se pega A MANO: no se publica nada en Facebook desde aquí
// (sus reglas prohíben automatizarlo y los mensajes en frío van sólo manuales).
import Anthropic from "@anthropic-ai/sdk"

import { IA_MODELO_WHATSAPP, modeloIA } from "./ia-modelo"
import { STORE_URL } from "./licitacion"
import { iaSocial } from "./social-hub"

export type PiezaGrupo = {
  pieza: string
  medidas: string
  material: string
  proceso: string
  cantidad: string
  ciudad: string
  /** false si parece publicación para juntar interacciones y no un cliente real */
  cliente_real: boolean
  nota: string
}

const vacia = (): PiezaGrupo => ({ pieza: "", medidas: "", material: "", proceso: "", cantidad: "", ciudad: "", cliente_real: true, nota: "" })

const limpio = (v: unknown, max = 160) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)

export function normalizar(d: Partial<PiezaGrupo> | null | undefined): PiezaGrupo {
  const b = vacia()
  if (!d) return b
  return {
    pieza: limpio(d.pieza, 120),
    medidas: limpio(d.medidas, 200),
    material: limpio(d.material, 80),
    proceso: limpio(d.proceso, 100),
    cantidad: limpio(d.cantidad, 60),
    ciudad: limpio(d.ciudad, 60),
    cliente_real: d.cliente_real !== false,
    nota: limpio(d.nota, 300),
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)

/** Liga a /cotizar con la pieza ya capturada. */
export function ligaCotizar(d: PiezaGrupo): string {
  const q = new URLSearchParams()
  q.set("desde", "facebook")
  q.set("pieza", d.pieza || "Pieza a la medida")
  if (d.medidas) q.set("medidas", d.cantidad ? `${d.medidas}. Cantidad: ${d.cantidad}` : d.medidas)
  else if (d.cantidad) q.set("medidas", `Cantidad: ${d.cantidad}`)
  if (d.material) q.set("material", d.material)
  if (d.proceso) q.set("proceso", d.proceso)
  q.set("utm_source", "facebook_grupo")
  q.set("utm_medium", "comentario")
  q.set("utm_campaign", slug(d.ciudad) || "sin-ciudad")
  return `${STORE_URL}/mx/cotizar?${q.toString()}`
}

const zona = (ciudad: string) => (ciudad ? `de ${ciudad} y alrededores` : "de tu zona")

/** Comentario para quien publicó la pieza. */
export function comentarioCliente(d: PiezaGrupo, liga: string): string {
  const datos = [d.medidas, d.material].filter(Boolean).join(", ")
  return (
    `Te la pueden fabricar varios talleres ${zona(d.ciudad)}. ` +
    (datos ? `Ya la dejé capturada con tus datos (${datos}): ` : "Ya la dejé capturada: ") +
    "sólo pones tu nombre y correo y te llegan propuestas para comparar. Pagas protegido dentro de la plataforma y el taller te factura 👇\n" +
    liga
  )
}

/** Mensaje por Messenger para un taller que comentó ofreciendo hacerla. */
export function mensajeTaller(d: PiezaGrupo): string {
  const lugar = d.ciudad ? ` de ${d.ciudad}` : ""
  return (
    `Hola, vi que ofreciste fabricar ${d.pieza ? `el ${d.pieza.toLowerCase()}` : "la pieza"} en el grupo${lugar}. ` +
    "Soy Vladimir, de HETNA CNC: una plataforma mexicana donde los clientes publican piezas así (con medidas y archivo) y les llegan sólo a los talleres de su zona. " +
    "Registrarte y publicar es gratis; sólo pagas 6% cuando vendes, y cobras protegido con Mercado Pago. " +
    "Los primeros 30 talleres verificados quedan como Taller fundador, con 6 meses del plan Pro gratis. " +
    `¿Te interesa? ${STORE_URL}/mx/talleres/unete?utm_source=facebook_grupo&utm_medium=messenger`
  )
}

export function armarRespuesta(d: PiezaGrupo) {
  const liga = ligaCotizar(d)
  return { datos: d, liga, comentario: comentarioCliente(d, liga), mensaje_taller: mensajeTaller(d) }
}

const ESQUEMA = {
  type: "object",
  properties: {
    pieza: { type: "string", description: "Nombre corto y claro de la pieza, en español (ej. 'Soporte con oreja soldada')." },
    medidas: { type: "string", description: "Medidas en mm tal como vienen (largo x ancho x espesor, barrenos, radios). Vacío si no hay." },
    material: { type: "string", description: "Material y calibre/espesor si se menciona (ej. 'Acero A-36'). Vacío si no hay." },
    proceso: { type: "string", description: "Proceso CNC más probable: corte láser, corte plasma, router, torno, fresadora, impresión 3D, doblez, soldadura (puede ser combinación)." },
    cantidad: { type: "string", description: "Cantidad de piezas si se menciona. Vacío si no." },
    ciudad: { type: "string", description: "Ciudad o zona de México (por el nombre del grupo o el texto). Vacío si no se sabe." },
    cliente_real: { type: "boolean", description: "false si parece publicación para juntar interacciones (imagen genérica de IA, sin datos concretos, cientos de comentarios) y no una persona que de verdad necesita la pieza." },
    nota: { type: "string", description: "Una línea para el equipo: dudas o datos que faltan para cotizar." },
  },
  required: ["pieza", "medidas", "material", "proceso", "cantidad", "ciudad", "cliente_real", "nota"],
  additionalProperties: false,
}

let ia: Anthropic | null = null

/** Saca los datos de la pieza del texto y/o la captura de la publicación. */
export async function extraerPieza(entrada: { texto?: string; imagen?: { tipo: string; datos: string } | null; ciudad?: string }): Promise<PiezaGrupo> {
  const texto = String(entrada.texto || "").slice(0, 4000)
  if (!iaSocial()) return normalizar({ pieza: texto.slice(0, 80), ciudad: entrada.ciudad, nota: "Sin IA en el servidor: revisa los datos a mano." })
  ia ??= new Anthropic()
  const contenido: any[] = []
  if (entrada.imagen?.datos) {
    contenido.push({ type: "image", source: { type: "base64", media_type: entrada.imagen.tipo, data: entrada.imagen.datos } })
  }
  contenido.push({
    type: "text",
    text:
      "Publicación de un grupo de Facebook donde alguien busca quién le fabrique una pieza. Saca los datos para pedir la cotización a talleres CNC en México." +
      (entrada.ciudad ? `\nEl grupo es de: ${entrada.ciudad}.` : "") +
      (texto ? `\n\nTexto de la publicación:\n${texto}` : "\n\n(Sólo hay imagen.)"),
  })
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO_WHATSAPP()),
    max_tokens: 1000,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{ role: "user", content: contenido }],
  } as any)
  if ((resp as any).stop_reason === "refusal") return normalizar({ ciudad: entrada.ciudad, nota: "La IA no pudo leer la publicación: llena los datos a mano." })
  const r = JSON.parse((resp as any).content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
  const d = normalizar(r)
  if (!d.ciudad && entrada.ciudad) d.ciudad = limpio(entrada.ciudad, 60)
  return d
}

/** Valida una imagen en data URL (PNG/JPEG/WebP/GIF, máx. ~5 MB). */
export function leerImagen(dataUrl: unknown): { tipo: string; datos: string } | null {
  const m = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  if (m[2].length > 7_000_000) return null
  return { tipo: m[1], datos: m[2] }
}
