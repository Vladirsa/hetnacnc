// Catálogo de "Impresión 3D bajo pedido": diseños propios de HETNA hechos con
// el Texturizador, con los Cortadores de galletas y con Modelos 3D (macetas,
// soportes, organizadores…). De aquí salen (scripts/generar-catalogo-impresion.ts):
// el volumen y las medidas de cada pieza, sus fotos y docs/impresion-bajo-
// pedido/catalogo.json, que el API publica como productos de la tienda
// (packages/api/src/scripts/sembrar-impresion-bajo-pedido.ts).
//
// Para agregar un diseño: súmalo aquí, corre el generador y luego el script
// del API. El handle no se cambia una vez publicado (es la dirección de la ficha).
import type { FormaClasica } from "@/lib/generador/cortadores"
import type { EstiloImpresion } from "@/lib/generador/letras3dImpresion"
import type { FormaLlavero } from "@/lib/generador/llaveros"
import type { IconoTextura } from "@/lib/generador/texturizador"
import { aUrl, type DisenoTexturizador } from "@/lib/generador/texturizador-url"

/** Un cortador de galletas del catálogo (lib/generador/cortadores.ts) */
export type CortadorCatalogo = {
  forma: { tipo: "icono"; icono: IconoTextura } | { tipo: "clasica"; forma: FormaClasica }
  tamano: number
  sello?: { tipo: "texto"; texto: string; fuente: string } | { tipo: "icono"; icono: IconoTextura }
}

/** Un llavero o placa del catálogo (lib/generador/llaveros.ts); se personaliza con el nombre del cliente */
export type LlaveroCatalogo = {
  texto: string
  forma: FormaLlavero
  fuente: string
  alto: number
  icono?: IconoTextura
  /** % del alto para el segundo renglón */
  escala?: number
  /** letras que puede escribir el cliente (el precio de la ficha alcanza para éstas) */
  maxTexto: number
}

/** Letras 3D para impresora (lib/generador/letras3dImpresion.ts); se personalizan con el texto del cliente */
export type LetrasCatalogo = {
  texto: string
  estilo: EstiloImpresion
  fuente: string
  alto: number
  profundidad: number
  /** letras que puede escribir el cliente (el precio de la ficha alcanza para éstas) */
  maxTexto: number
}

/** Mapa topográfico impreso (lib/generador/mapaTopo.ts): un lugar fijo; las alturas se guardan en docs/impresion-bajo-pedido/alturas */
export type MapaCatalogo = { lugar: string; lat: number; lon: number; km: number; ancho: number; capas: number }

export type DisenoCatalogo = {
  handle: string
  titulo: string
  /** Para quién y para qué (1 o 2 frases, sin promesas que no podamos cumplir) */
  resumen: string
  /**
   * "pieza" = rodillo o placa del Texturizador; "soporte" = el mango con eje;
   * "cortador" = cortador de galletas; "modelo" = un modelo paramétrico de
   * Modelos 3D (modelo + valores); "llavero" = llavero o placa con nombre;
   * "letras" = letras 3D para impresora; "mapa" = mapa topográfico por capas
   */
  pieza: "pieza" | "soporte" | "cortador" | "modelo" | "llavero" | "letras" | "mapa"
  /** rodillos, placas y soporte */
  diseno?: Partial<DisenoTexturizador>
  cortador?: CortadorCatalogo
  /** sólo "modelo": id en lib/generador/modelos3d.ts y medidas distintas a las de fábrica */
  modelo?: string
  valores?: Record<string, number>
  llavero?: LlaveroCatalogo
  letras?: LetrasCatalogo
  mapa?: MapaCatalogo
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
  // 27 nov 2026: electrónica, Gridfinity, piezas mecánicas, carpintería y eventos
  modelo("carcasa-raspberry-pi-impresa-3d", "Carcasa para Raspberry Pi 4 o 5", "Caja con tapa a presión y postes en los barrenos de la Raspberry Pi 4 o 5, ventana para los puertos USB y de red, y ventilación en la tapa.", "caja-electronica-tapa", ["carcasa raspberry pi", "caja raspberry", "electrónica", "gabinete"]),
  modelo("caja-proyecto-electronico-impresa-3d", "Caja para proyecto electrónico con tapa", "Caja de 10 × 6 cm por dentro con tapa a presión, postes para atornillar tu tarjeta y ventana para el conector. Si tu tarjeta mide otra cosa, ajústala en Modelos a tu medida.", "caja-electronica-tapa", ["caja electrónica", "gabinete", "proyecto arduino", "esp32"], { largo: 100, ancho: 60, altoInt: 25, origenX: 5, origenY: 5, sepX: 90, sepY: 50, ventana: 1, posVentana: 50, anchoVentana: 20, altoVentana: 12 }),
  modelo("base-gridfinity-4x3-impresa-3d", "Base Gridfinity de 4 × 3 casillas", "La rejilla de 168 × 126 mm donde se encajan las cajas Gridfinity, para cajón, mesa de trabajo o repisa.", "gridfinity-base", ["gridfinity", "organizador modular", "cajón", "taller"]),
  modelo("caja-gridfinity-2x1-impresa-3d", "Caja Gridfinity de 2 × 1 con divisiones", "Cajita Gridfinity de 2 casillas con 2 divisiones, para tornillería, puntas o piezas chicas. Encaja en cualquier base Gridfinity.", "gridfinity-caja", ["gridfinity", "caja organizadora", "tornillería"], { x: 2, y: 1, alto: 6, divisiones: 2 }),
  modelo("porta-brocas-gridfinity-impreso-3d", "Porta fresas y brocas Gridfinity", "Bloque Gridfinity de 2 casillas con barrenos para zancos de 1/4\", junto a la máquina y encajado en la base.", "gridfinity-porta-brocas", ["gridfinity", "porta fresas", "brocas", "taller cnc"]),
  modelo("polea-gt2-20-dientes-impresa-3d", "Polea GT2 de 20 dientes para eje de 5 mm", "Polea para banda GT2 de 6 mm con pestañas y cubo con opresor, para motores NEMA 17, impresoras 3D y ejes de CNC. Perfil aproximado: prueba con tu banda.", "polea-gt2", ["polea gt2", "20 dientes", "nema 17", "impresora 3d"]),
  modelo("acoplador-ejes-5-8-mm-impreso-3d", "Acoplador de ejes de 5 a 8 mm", "Une el eje de 5 mm de un motor con un husillo de 8 mm, con opresores de cada lado.", "acoplador-ejes", ["acoplador", "coupler", "husillo 8 mm", "motor nema"]),
  modelo("plantilla-bisagra-cazoleta-impresa-3d", "Plantilla para bisagra de cazoleta de 35 mm", "Guía con tope para barrenar la copa de 35 mm y los dos tornillos de la bisagra en puertas de cocina y closet, siempre a la misma distancia del canto.", "plantilla-bisagra-cazoleta", ["plantilla bisagra", "cazoleta 35 mm", "carpintería", "cocina"]),
  modelo("guia-jaladeras-128-mm-impresa-3d", "Guía para barrenar jaladeras de 128 mm", "Plantilla con tope para barrenar jaladeras de 128 mm entre centros en cajones y puertas, con marca para centrarla.", "guia-jaladeras", ["guía jaladeras", "tiradores", "carpintería", "cajones"]),
  modelo("escuadra-armado-90-impresa-3d", "Escuadra de armado a 90°", "Escuadra para armar cajones y muebles a escuadra, con ventanas para las prensas y alivio en la esquina para el pegamento.", "escuadra-sujecion", ["escuadra 90 grados", "armado de muebles", "carpintería", "prensas"]),
  modelo("base-trofeo-acrilico-impresa-3d", "Base para trofeo de acrílico", "Base escalonada con ranura inclinada para una placa de acrílico de 3 mm. La placa con tu logo y texto se pide aparte en corte láser.", "base-trofeo", ["trofeo", "reconocimiento", "evento", "empresa"]),
  modelo("medalla-con-hueco-logo-impresa-3d", "Medalla con hueco para logo", "Medalla de 6 cm con orilla en relieve, hueco al frente para tu logo (disco de acrílico o calcomanía) y ojal para listón de 22 mm. Para torneos, carreras y escuelas.", "medalla", ["medalla", "torneo", "carrera", "escuela"]),
]

// Llaveros y placas con nombre (25 nov 2026): se compran con el nombre que
// escribe el cliente al agregarlo al carrito (metadata.personalizable)
const llavero = (handle: string, titulo: string, resumen: string, l: LlaveroCatalogo, etiquetas: string[]): DisenoCatalogo => ({
  handle, titulo, resumen, pieza: "llavero", llavero: l, etiquetas,
})
const LLAVEROS_IMPRESION: DisenoCatalogo[] = [
  llavero("llavero-con-nombre-impreso-3d", "Llavero con nombre", "Llavero con el nombre que quieras en letra cursiva y en relieve. Escribe el nombre al agregarlo al carrito.", { texto: "Sofía", forma: "rect", fuente: "pacifico", alto: 12, maxTexto: 12 }, ["llavero con nombre", "regalo", "personalizado"]),
  llavero("llavero-corazon-con-nombre-impreso-3d", "Llavero de corazón con nombre", "Corazón con el nombre o la palabra que quieras en relieve. Para mamá, para tu pareja o para recuerdos.", { texto: "Mamá", forma: "corazon", fuente: "lobster", alto: 11, maxTexto: 10 }, ["llavero corazón", "día de las madres", "regalo"]),
  llavero("placa-mascota-con-nombre-impresa-3d", "Placa para mascota con nombre y teléfono", "Placa redonda con huellita, el nombre de tu mascota y tu teléfono abajo, con argolla para el collar.", { texto: "Max\n55 1234 5678", forma: "circulo", fuente: "montserrat", alto: 9, icono: "huella", escala: 45, maxTexto: 30 }, ["placa mascota", "perro", "gato", "collar"]),
  llavero("etiqueta-maleta-con-nombre-impresa-3d", "Etiqueta para maleta con nombre", "Etiqueta con punta y argolla para la maleta o la mochila, con el nombre grande para encontrarla rápido.", { texto: "VIAJE", forma: "etiqueta", fuente: "bebas-neue", alto: 14, maxTexto: 12 }, ["etiqueta maleta", "viaje", "mochila"]),
  llavero("llavero-inicial-estrella-impreso-3d", "Llavero con inicial y estrella", "Llavero redondo con una estrella y tu inicial. Escribe la letra al agregarlo al carrito.", { texto: "A", forma: "circulo", fuente: "cinzel", alto: 16, icono: "estrella", maxTexto: 2 }, ["llavero inicial", "letra", "regalo"]),
  llavero("llavero-negocio-impreso-3d", "Llavero para tu negocio o evento", "Llavero rectangular con el nombre de tu marca o evento. Ideal para regalar a clientes: pide varios y súbele tu logo en la herramienta.", { texto: "TU MARCA", forma: "rect", fuente: "oswald", alto: 11, maxTexto: 16 }, ["llaveros personalizados", "promocionales", "negocio", "evento"]),
  llavero("placa-puerta-con-nombre-impresa-3d", "Placa para puerta con nombre", "Placa rectangular para la puerta del cuarto, la oficina o el taller, con letras en relieve.", { texto: "Taller", forma: "rect", fuente: "oswald", alto: 22, maxTexto: 14 }, ["placa puerta", "letrero", "cuarto", "oficina"]),
  llavero("adorno-con-fecha-impreso-3d", "Adorno ovalado con fecha o nombre", "Adorno ovalado con la fecha o el nombre que quieras, para recuerdos de boda, XV años o bautizo.", { texto: "2026", forma: "ovalo", fuente: "cinzel", alto: 16, maxTexto: 12 }, ["recuerdos", "boda", "xv años", "bautizo"]),
]

// Letras 3D listas (25 nov 2026): de pie para mesa, para colgar o huecas para
// LED. También personalizables: el cliente escribe su palabra al agregarlas.
const letras = (handle: string, titulo: string, resumen: string, l: LetrasCatalogo, etiquetas: string[]): DisenoCatalogo => ({
  handle, titulo, resumen, pieza: "letras", letras: l, etiquetas,
})
const LETRAS_IMPRESION: DisenoCatalogo[] = [
  letras("letras-love-de-pie-impresas-3d", "Letras LOVE de pie", "Letras de 6 cm unidas en una base, para la repisa, el escritorio o la mesa de dulces. Puedes pedirlas con otra palabra.", { texto: "LOVE", estilo: "pie", fuente: "alfa-slab-one", alto: 60, profundidad: 12, maxTexto: 5 }, ["letras decorativas", "love", "regalo", "decoración"]),
  letras("letras-home-de-pie-impresas-3d", "Letras HOME de pie", "Letras de 5 cm con base para la sala o la entrada. Escribe otra palabra si la quieres distinta.", { texto: "HOME", estilo: "pie", fuente: "montserrat", alto: 50, profundidad: 12, maxTexto: 5 }, ["letras decorativas", "home", "casa", "decoración"]),
  letras("letras-xv-anos-de-pie-impresas-3d", "Letras XV para mesa de XV años", "Letras XV de 10 cm con base, para la mesa principal o de pastel. También con tu nombre o con iniciales.", { texto: "XV", estilo: "pie", fuente: "cinzel", alto: 100, profundidad: 15, maxTexto: 3 }, ["xv años", "fiesta", "mesa de pastel", "decoración de eventos"]),
  letras("letras-familia-pared-impresas-3d", "Letras FAMILIA para pared", "Letras sueltas de 8 cm para colgar, con barreno oculto atrás. Incluye la plantilla de montaje para que queden derechas.", { texto: "FAMILIA", estilo: "pared", fuente: "montserrat", alto: 80, profundidad: 12, maxTexto: 8 }, ["letras para pared", "familia", "decoración", "sala"]),
  letras("letras-nombre-pared-impresas-3d", "Letras con tu nombre para pared", "Tu nombre o el de tu negocio en letras de 10 cm para colgar, con barreno oculto atrás y plantilla de montaje.", { texto: "SOFIA", estilo: "pared", fuente: "alfa-slab-one", alto: 100, profundidad: 14, maxTexto: 8 }, ["letras con nombre", "cuarto de niños", "negocio", "pared"]),
  letras("letras-huecas-led-impresas-3d", "Letras huecas para LED", "Letras de 10 cm huecas por atrás para meter tira LED; el frente delgado deja pasar la luz. Para negocios y fiestas.", { texto: "OPEN", estilo: "luz", fuente: "alfa-slab-one", alto: 100, profundidad: 25, maxTexto: 6 }, ["letras luminosas", "led", "anuncio", "negocio"]),
]

// Mapas topográficos impresos (27 nov 2026): montañas reales en capas, a dos
// colores (base y montaña, y la cumbre). Las alturas son de Mapzen Terrain Tiles.
const mapa = (handle: string, titulo: string, resumen: string, m: MapaCatalogo, etiquetas: string[]): DisenoCatalogo => ({
  handle, titulo, resumen, pieza: "mapa", mapa: m, etiquetas,
})
const MAPAS_IMPRESION: DisenoCatalogo[] = [
  mapa("mapa-pico-de-orizaba-impreso-3d", "Mapa topográfico del Pico de Orizaba", "El volcán más alto de México en 10 capas, con el relieve real. Pídelo a dos colores para que la cumbre se vea nevada.", { lugar: "Pico de Orizaba", lat: 19.03, lon: -97.27, km: 12, ancho: 120, capas: 10 }, ["mapa topográfico", "pico de orizaba", "citlaltépetl", "volcán", "regalo"]),
  mapa("mapa-popocatepetl-iztaccihuatl-impreso-3d", "Mapa topográfico del Popocatépetl e Iztaccíhuatl", "Los dos volcanes juntos en 10 capas, con el relieve real. A dos colores, las cumbres salen de otro color.", { lugar: "Popocatépetl e Iztaccíhuatl", lat: 19.1, lon: -98.65, km: 40, ancho: 120, capas: 10 }, ["mapa topográfico", "popocatépetl", "iztaccíhuatl", "volcanes", "regalo"]),
  mapa("mapa-nevado-de-toluca-impreso-3d", "Mapa topográfico del Nevado de Toluca", "El Xinantécatl y su cráter en 10 capas, con el relieve real. Para tu escritorio o para regalar a quien lo subió.", { lugar: "Nevado de Toluca", lat: 19.11, lon: -99.76, km: 10, ancho: 120, capas: 10 }, ["mapa topográfico", "nevado de toluca", "xinantécatl", "volcán", "regalo"]),
  mapa("mapa-cerro-de-la-silla-impreso-3d", "Mapa topográfico del Cerro de la Silla", "El cerro de Monterrey en 10 capas, con el relieve real. Un recuerdo regio para la casa o la oficina.", { lugar: "Cerro de la Silla", lat: 25.63, lon: -100.23, km: 9, ancho: 120, capas: 10 }, ["mapa topográfico", "cerro de la silla", "monterrey", "regalo"]),
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
  ...MODELOS_IMPRESION,
  ...LLAVEROS_IMPRESION,
  ...LETRAS_IMPRESION,
  ...MAPAS_IMPRESION,
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
  if (d.pieza === "letras" && d.letras) {
    const l = d.letras
    const q = new URLSearchParams({ modo: "impresion", texto: l.texto, estilo: l.estilo, fuente: l.fuente, alto: String(l.alto), profundidad: String(l.profundidad) })
    return `/disenar/letras-3d?${q.toString()}${extra}`
  }
  if (d.pieza === "llavero" && d.llavero) {
    const l = d.llavero
    const q = new URLSearchParams({ texto: l.texto, forma: l.forma, fuente: l.fuente, alto: String(l.alto) })
    if (l.icono) q.set("icono", l.icono)
    if (l.escala) q.set("escala", String(l.escala))
    return `/disenar/llaveros?${q.toString()}${extra}`
  }
  if (d.pieza === "mapa" && d.mapa) {
    const m = d.mapa
    const q = new URLSearchParams({ lat: String(m.lat), lon: String(m.lon), km: String(m.km), capas: String(m.capas), ancho: String(m.ancho) })
    return `/disenar/mapa-topografico?${q.toString()}${extra}`
  }
  if (d.pieza === "modelo") {
    // la página propia del modelo (título y rangos desde el servidor); las medidas van en la liga
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(d.valores || {})) q.set(k, String(v))
    const qs = q.toString()
    return `/disenar/modelos-3d/${d.modelo}${qs ? `?${qs}` : ""}${qs ? extra : extra.replace(/^&/, "?")}`
  }
  return `/disenar/texturizador?${aUrl(d.diseno || {})}${extra}`
}
