// Catálogo de "Impresión 3D bajo pedido": diseños propios de HETNA hechos con
// el Texturizador y con Modelos 3D (macetas, soportes, organizadores…). De aquí salen (scripts/generar-catalogo-impresion.ts):
// el volumen y las medidas de cada pieza, sus fotos y docs/impresion-bajo-
// pedido/catalogo.json, que el API publica como productos de la tienda
// (packages/api/src/scripts/sembrar-impresion-bajo-pedido.ts).
//
// Para agregar un diseño: súmalo aquí, corre el generador y luego el script
// del API. El handle no se cambia una vez publicado (es la dirección de la ficha).
import { aUrl, type DisenoTexturizador } from "@/lib/generador/texturizador-url"

export type DisenoCatalogo = {
  handle: string
  titulo: string
  /** Para quién y para qué (1 o 2 frases, sin promesas que no podamos cumplir) */
  resumen: string
  /**
   * "pieza" = rodillo o placa del Texturizador; "soporte" = el mango con eje;
   * "modelo" = un modelo paramétrico de Modelos 3D (modelo + valores)
   */
  pieza: "pieza" | "soporte" | "modelo"
  diseno?: Partial<DisenoTexturizador>
  /** sólo "modelo": id en lib/generador/modelos3d.ts y medidas distintas a las de fábrica */
  modelo?: string
  valores?: Record<string, number>
  etiquetas: string[]
}

const RODILLO: Partial<DisenoTexturizador> = { forma: "rodillo", diametro: 40, largo: 120, eje: 12, relieve: 1.2, orilla: 0, espejo: true, acomodo: "intercalado", fuente: "montserrat", espacioX: 5, espacioY: 6 }
const PLACA: Partial<DisenoTexturizador> = { forma: "placa", ancho: 150, alto: 100, radio: 4, grosor: 3, relieve: 1.2, modo: "alto", orilla: 0, espejo: true, acomodo: "intercalado", fuente: "montserrat", espacioX: 5, espacioY: 6 }

// Piezas de Modelos 3D (25 nov 2026): cosas de casa, escritorio y taller
const modelo = (handle: string, titulo: string, resumen: string, m: string, etiquetas: string[], valores?: Record<string, number>): DisenoCatalogo => ({
  handle, titulo, resumen, pieza: "modelo", modelo: m, ...(valores ? { valores } : {}), etiquetas,
})
const MODELOS_IMPRESION: DisenoCatalogo[] = [
  modelo("maceta-con-drenaje-impresa-3d", "Maceta con drenaje y plato", "Maceta de 10 cm con barreno de drenaje y su plato para que no escurra. Para suculentas, cactus y plantas chicas.", "maceta", ["maceta", "suculentas", "drenaje", "plantas"]),
  modelo("maceta-grande-con-drenaje-impresa-3d", "Maceta grande con drenaje y plato", "Maceta de 16 cm con barreno de drenaje y plato, para plantas de interior medianas.", "maceta", ["maceta grande", "plantas de interior", "drenaje"], { arriba: 160, abajo: 120, alto: 140, pared: 2.4, drenaje: 14 }),
  modelo("lapicero-hexagonal-impreso-3d", "Lapicero hexagonal para escritorio", "Lapicero de seis lados para plumas, lápices y brochas.", "porta-lapices", ["lapicero", "escritorio", "organizador"]),
  modelo("soporte-celular-impreso-3d", "Soporte para celular con paso de cable", "Detiene el celular inclinado para videollamadas o recetas; deja pasar el cable para cargarlo.", "soporte-celular", ["soporte celular", "escritorio", "videollamadas"]),
  modelo("soporte-tableta-impreso-3d", "Soporte para tableta con paso de cable", "Detiene la tableta inclinada en el escritorio o la cocina, con paso para el cable.", "soporte-celular", ["soporte tableta", "ipad", "cocina"], { ancho: 180, grosor: 14 }),
  modelo("posavasos-impreso-3d", "Posavasos", "Posavasos para proteger la mesa de vasos y tazas.", "posavasos", ["posavasos", "mesa", "regalo"]),
  modelo("gancho-de-pared-impreso-3d", "Gancho de pared", "Gancho para llaves, bolsas o herramienta; se fija con dos tornillos.", "gancho-pared", ["gancho", "pared", "llaves"]),
  modelo("organizador-fresas-brocas-impreso-3d", "Organizador de fresas y brocas", "Base con barrenos para tener ordenadas las fresas y brocas junto a la máquina.", "organizador-fresas", ["organizador fresas", "brocas", "taller cnc"]),
  modelo("organizador-llaves-allen-impreso-3d", "Organizador de llaves Allen", "Mantiene las llaves Allen por tamaño y a la mano.", "llaves-allen", ["llaves allen", "taller", "organizador"]),
  modelo("contenedor-apilable-impreso-3d", "Contenedor apilable", "Contenedor que se apila para tornillería, piezas chicas o material de oficina.", "contenedor-apilable", ["contenedor", "apilable", "tornillería"]),
  modelo("caja-tapa-presion-impresa-3d", "Caja con tapa a presión", "Caja chica con tapa que cierra a presión, para piezas, joyería o refacciones.", "caja-tapa", ["caja", "tapa a presión", "organizador"]),
  modelo("clip-para-bolsas-impreso-3d", "Clip para bolsas", "Cierra bolsas de café, botanas o croquetas para que no se humedezcan.", "clip-bolsa", ["clip bolsas", "cocina", "despensa"]),
]

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

CATALOGO_IMPRESION.push(...MODELOS_IMPRESION)

/** Liga a la herramienta con el diseño cargado. */
export function urlHerramienta(d: DisenoCatalogo, extra = "") {
  if (d.pieza === "modelo") {
    const q = new URLSearchParams({ modelo: d.modelo || "" })
    for (const [k, v] of Object.entries(d.valores || {})) q.set(k, String(v))
    return `/disenar/modelos-3d?${q.toString()}${extra}`
  }
  return `/disenar/texturizador?${aUrl(d.diseno || {})}${extra}`
}
