// Catálogo de "Impresión 3D bajo pedido": diseños propios de HETNA hechos con
// el Texturizador y con los Cortadores de galletas. De aquí salen (scripts/generar-catalogo-impresion.ts):
// el volumen y las medidas de cada pieza, sus fotos y docs/impresion-bajo-
// pedido/catalogo.json, que el API publica como productos de la tienda
// (packages/api/src/scripts/sembrar-impresion-bajo-pedido.ts).
//
// Para agregar un diseño: súmalo aquí, corre el generador y luego el script
// del API. El handle no se cambia una vez publicado (es la dirección de la ficha).
import type { FormaClasica } from "@/lib/generador/cortadores"
import type { IconoTextura } from "@/lib/generador/texturizador"
import { aUrl, type DisenoTexturizador } from "@/lib/generador/texturizador-url"

/** Un cortador de galletas del catálogo (lib/generador/cortadores.ts) */
export type CortadorCatalogo = {
  forma: { tipo: "icono"; icono: IconoTextura } | { tipo: "clasica"; forma: FormaClasica }
  tamano: number
  sello?: { tipo: "texto"; texto: string; fuente: string } | { tipo: "icono"; icono: IconoTextura }
}

export type DisenoCatalogo = {
  handle: string
  titulo: string
  /** Para quién y para qué (1 o 2 frases, sin promesas que no podamos cumplir) */
  resumen: string
  /** "pieza" = el rodillo o la placa; "soporte" = el mango con eje para cambiar rodillos; "cortador" = cortador de galletas */
  pieza: "pieza" | "soporte" | "cortador"
  diseno: Partial<DisenoTexturizador>
  cortador?: CortadorCatalogo
  etiquetas: string[]
}

const RODILLO: Partial<DisenoTexturizador> = { forma: "rodillo", diametro: 40, largo: 120, eje: 12, relieve: 1.2, orilla: 0, espejo: true, acomodo: "intercalado", fuente: "montserrat", espacioX: 5, espacioY: 6 }
const PLACA: Partial<DisenoTexturizador> = { forma: "placa", ancho: 150, alto: 100, radio: 4, grosor: 3, relieve: 1.2, modo: "alto", orilla: 0, espejo: true, acomodo: "intercalado", fuente: "montserrat", espacioX: 5, espacioY: 6 }

export const CATALOGO_IMPRESION: DisenoCatalogo[] = [
  {
    handle: "rodillo-texturizador-corazones-impreso-3d",
    titulo: "Rodillo texturizador de corazones y flores",
    resumen: "Para arcilla polimérica, plastilina, jabón o fondant: deja un patrón de corazones y flores que da la vuelta sin costura.",
    pieza: "pieza",
    diseno: { ...RODILLO, palabras: [], iconos: ["corazon", "flor"], tamano: 10 },
    etiquetas: ["rodillo texturizador", "arcilla polimérica", "fondant", "corazones"],
  },
  {
    handle: "rodillo-texturizador-lunas-estrellas-impreso-3d",
    titulo: "Rodillo texturizador de lunas y estrellas",
    resumen: "Patrón de lunas, estrellas y puntos para aretes de arcilla, jabones y galletas.",
    pieza: "pieza",
    diseno: { ...RODILLO, palabras: [], iconos: ["luna", "estrella", "circulo"], tamano: 9 },
    etiquetas: ["rodillo texturizador", "arcilla polimérica", "estrellas", "lunas"],
  },
  {
    handle: "rodillo-texturizador-huellitas-impreso-3d",
    titulo: "Rodillo texturizador de huellitas",
    resumen: "Huellitas y corazones para productos de mascotas, galletas para perro o piezas de arcilla.",
    pieza: "pieza",
    diseno: { ...RODILLO, palabras: [], iconos: ["huella", "corazon"], tamano: 10 },
    etiquetas: ["rodillo texturizador", "mascotas", "huellitas", "galletas"],
  },
  {
    handle: "rodillo-texturizador-copos-navidad-impreso-3d",
    titulo: "Rodillo texturizador navideño de copos y estrellas",
    resumen: "Copos de nieve y estrellas para galletas, fondant y adornos de temporada.",
    pieza: "pieza",
    diseno: { ...RODILLO, palabras: [], iconos: ["copo", "estrella"], tamano: 10 },
    etiquetas: ["rodillo texturizador", "navidad", "copos de nieve", "fondant"],
  },
  {
    handle: "rodillo-texturizador-rombos-impreso-3d",
    titulo: "Rodillo texturizador geométrico de rombos",
    resumen: "Patrón geométrico de rombos en cuadrícula para arcilla, cerámica y cuero.",
    pieza: "pieza",
    diseno: { ...RODILLO, palabras: [], iconos: ["rombo"], tamano: 8, acomodo: "cuadricula", espacioX: 4, espacioY: 4 },
    etiquetas: ["rodillo texturizador", "geométrico", "rombos", "cerámica"],
  },
  {
    handle: "rodillo-texturizador-hecho-a-mano-impreso-3d",
    titulo: "Rodillo texturizador «Hecho a mano»",
    resumen: "Marca tus jabones, velas y piezas de arcilla con la leyenda «Hecho a mano» y flores.",
    pieza: "pieza",
    diseno: { ...RODILLO, palabras: ["HECHO A MANO"], iconos: ["flor"], tamano: 9 },
    etiquetas: ["rodillo texturizador", "hecho a mano", "jabón artesanal", "velas"],
  },
  {
    handle: "rodillo-texturizador-te-amo-impreso-3d",
    titulo: "Rodillo texturizador «Te amo» con corazones",
    resumen: "Para galletas, fondant y regalos de San Valentín o aniversario.",
    pieza: "pieza",
    diseno: { ...RODILLO, palabras: ["TE AMO"], iconos: ["corazon"], tamano: 8 },
    etiquetas: ["rodillo texturizador", "san valentín", "te amo", "galletas"],
  },
  {
    handle: "placa-texturizadora-galletas-impresa-3d",
    titulo: "Placa texturizadora para galletas: corazones, flores y estrellas",
    resumen: "Placa de 12 × 12 cm para presionar sobre fondant, galletas o arcilla.",
    pieza: "pieza",
    diseno: { ...PLACA, ancho: 120, alto: 120, palabras: [], iconos: ["corazon", "flor", "estrella"], tamano: 12 },
    etiquetas: ["placa texturizadora", "galletas", "fondant", "sello"],
  },
  {
    handle: "placa-texturizadora-hecho-a-mano-impresa-3d",
    titulo: "Placa texturizadora «Hecho a mano»",
    resumen: "Placa de 15 × 10 cm para marcar jabones, arcilla o cuero con «Hecho a mano».",
    pieza: "pieza",
    diseno: { ...PLACA, palabras: ["HECHO A MANO"], iconos: ["flor"], tamano: 8 },
    etiquetas: ["placa texturizadora", "hecho a mano", "jabón artesanal", "cuero"],
  },
  // ── Cortadores de galletas ──
  ...(
    [
      ["corazon", "icono", "corazon", 70, "Cortador de galletas de corazón con sello «Te amo»", "Corazón de 7 cm con sello «Te amo» para San Valentín, aniversarios y bodas.", { tipo: "texto", texto: "Te amo", fuente: "pacifico" }],
      ["estrella", "icono", "estrella", 70, "Cortador de galletas de estrella", "Estrella de 7 cm para Navidad, fiestas infantiles y decoración con glaseado.", undefined],
      ["nube", "clasica", "nube", 75, "Cortador de galletas de nube", "Nube de 7.5 cm para baby shower, fiestas infantiles y galletas decoradas.", undefined],
      ["pino", "clasica", "arbol", 80, "Cortador de galletas de pino navideño", "Pino de 8 cm para galletas de Navidad.", undefined],
      ["casita", "clasica", "casa", 70, "Cortador de galletas de casita", "Casita de 7 cm: galletas de jengibre, inauguraciones y Navidad.", undefined],
      ["flor", "icono", "flor", 65, "Cortador de galletas de flor", "Flor de cinco pétalos de 6.5 cm para primavera, bodas y Día de las Madres.", undefined],
      ["huellita", "icono", "huella", 60, "Cortador de galletas de huellita", "Huellita de 6 cm para galletas de mascotas y fiestas temáticas.", undefined],
      ["copo-nieve", "icono", "copo", 70, "Cortador de galletas de copo de nieve", "Copo de nieve de 7 cm para galletas de invierno y Navidad.", undefined],
      ["redondo-estrella", "clasica", "redondo", 65, "Cortador de galletas redondo con sello de estrella", "Galleta redonda de 6.5 cm con una estrella marcada al centro.", { tipo: "icono", icono: "estrella" }],
    ] as [string, "icono" | "clasica", string, number, string, string, CortadorCatalogo["sello"]][]
  ).map(([id, tipo, valor, tamano, titulo, resumen, sello]): DisenoCatalogo => ({
    handle: `cortador-galletas-${id}-impreso-3d`,
    titulo,
    resumen,
    pieza: "cortador",
    diseno: {},
    cortador: {
      forma: tipo === "icono" ? { tipo: "icono", icono: valor as IconoTextura } : { tipo: "clasica", forma: valor as FormaClasica },
      tamano,
      ...(sello ? { sello } : {}),
    },
    etiquetas: ["cortador de galletas", "galletas decoradas", "repostería", id.replace(/-/g, " ")],
  })),
  {
    handle: "soporte-rodillo-texturizador-impreso-3d",
    titulo: "Soporte con eje para rodillos texturizadores (cambia sólo el rodillo)",
    resumen:
      "Mango con eje y seguro en C: pones el rodillo, lo aseguras y ruedas. Sirve para todos los rodillos de este catálogo (hueco de 12 mm, 120 mm de largo).",
    pieza: "soporte",
    diseno: { ...RODILLO, palabras: [], iconos: ["corazon", "flor"], tamano: 10 },
    etiquetas: ["soporte rodillo", "mango", "rodillo texturizador", "accesorio"],
  },
]

/** Liga a la herramienta con el diseño cargado. */
export function urlHerramienta(d: DisenoCatalogo, extra = ""): string {
  if (d.pieza === "cortador" && d.cortador) {
    const q = new URLSearchParams()
    const f = d.cortador.forma
    if (f.tipo === "icono") q.set("icono", f.icono)
    else q.set("forma", f.forma)
    q.set("tamano", String(d.cortador.tamano))
    const s = d.cortador.sello
    if (s?.tipo === "texto") {
      q.set("sello", s.texto)
      q.set("fuente", s.fuente)
    } else if (s?.tipo === "icono") q.set("selloIcono", s.icono)
    return `/disenar/cortadores-galletas?${q.toString()}${extra}`
  }
  return `/disenar/texturizador?${aUrl(d.diseno)}${extra}`
}
