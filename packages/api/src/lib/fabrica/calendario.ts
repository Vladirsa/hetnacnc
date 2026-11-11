// @ts-nocheck
// Calendario de fechas especiales de México (una sola fuente para los fondos de
// temporada y los videos de productos por fecha). Las fechas son fijas o reglas
// fijas (Día del Padre = 3.er domingo de junio). El Buen Fin NO va aquí: sus
// fechas se anuncian cada año y supone descuentos reales (lo pone el dueño).

export type FechaEspecial = {
  clave: string
  nombre: string
  /** Día de la fecha en un año (mes 1-12). */
  dia: (anio: number) => { mes: number; dia: number }
  /** Días antes en que empiezan los videos de productos. */
  anticipacion: number
  /** Días antes en que el fondo de temporada entra a la rotación general (0 = nunca). */
  fondoGeneral: number
  /** Etiquetas o categorías (handle) de producto sugeridas; se editan en el panel. */
  etiquetas: string[]
  tema: string // fondo del video
  icono: string // dibujo del gancho
  gancho: string // lo que se ve
  narracion: string // lo que se dice al inicio
  cta: string
}

const fija = (mes: number, dia: number) => () => ({ mes, dia })
/** n-ésimo domingo de un mes (Día del Padre: 3.er domingo de junio). */
const domingo = (mes: number, n: number) => (anio: number) => {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay()
  return { mes, dia: 1 + ((7 - primero) % 7) + (n - 1) * 7 }
}

export const FECHAS: FechaEspecial[] = [
  { clave: "reyes", nombre: "Día de Reyes", dia: fija(1, 6), anticipacion: 12, fondoGeneral: 12, etiquetas: ["dia-de-reyes", "reyes-magos"], tema: "navidad", icono: "caja", gancho: "Regalos de Reyes", narracion: "¿Ya tienes los regalos de Reyes?", cta: "Encuéntralos en HETNA" },
  { clave: "san_valentin", nombre: "Día del Amor y la Amistad", dia: fija(2, 14), anticipacion: 14, fondoGeneral: 0, etiquetas: ["san-valentin", "amor-y-amistad"], tema: "amor", icono: "corazon", gancho: "Regala algo único", narracion: "Este 14 de febrero, regala algo hecho a la medida.", cta: "Encuéntralo en HETNA" },
  { clave: "dia_nino", nombre: "Día del Niño", dia: fija(4, 30), anticipacion: 14, fondoGeneral: 0, etiquetas: ["dia-del-nino", "juguetes"], tema: "ninos", icono: "cohete", gancho: "Día del Niño", narracion: "Ideas para regalar este Día del Niño.", cta: "Encuéntralos en HETNA" },
  { clave: "dia_madre", nombre: "Día de las Madres", dia: fija(5, 10), anticipacion: 21, fondoGeneral: 0, etiquetas: ["dia-de-las-madres", "10-de-mayo"], tema: "madre", icono: "corazon", gancho: "Para mamá", narracion: "¿Ya tienes el regalo para mamá este 10 de mayo?", cta: "Encuéntralo en HETNA" },
  { clave: "dia_maestro", nombre: "Día del Maestro", dia: fija(5, 15), anticipacion: 10, fondoGeneral: 0, etiquetas: ["dia-del-maestro"], tema: "pizarron", icono: "foco", gancho: "Gracias, maestro", narracion: "Un detalle para agradecer a tu maestro.", cta: "Encuéntralo en HETNA" },
  { clave: "dia_padre", nombre: "Día del Padre", dia: domingo(6, 3), anticipacion: 21, fondoGeneral: 0, etiquetas: ["dia-del-padre"], tema: "padre", icono: "llave", gancho: "Para papá", narracion: "¿Qué le vas a regalar a papá este año?", cta: "Encuéntralo en HETNA" },
  { clave: "patrio", nombre: "Fiestas Patrias", dia: fija(9, 16), anticipacion: 15, fondoGeneral: 15, etiquetas: ["fiestas-patrias", "15-de-septiembre"], tema: "patrio", icono: "casa", gancho: "¡Viva México!", narracion: "Para celebrar las fiestas patrias.", cta: "Encuéntralo en HETNA" },
  { clave: "muertos", nombre: "Día de Muertos", dia: fija(11, 2), anticipacion: 21, fondoGeneral: 13, etiquetas: ["dia-de-muertos", "altar-de-muertos"], tema: "muertos", icono: "foco", gancho: "Día de Muertos", narracion: "Para tu altar y tus ofrendas de Día de Muertos.", cta: "Encuéntralo en HETNA" },
  { clave: "navidad", nombre: "Navidad", dia: fija(12, 24), anticipacion: 30, fondoGeneral: 23, etiquetas: ["navidad", "decoracion-navidena"], tema: "navidad", icono: "caja", gancho: "Regalos de Navidad", narracion: "Regalos y adornos para esta Navidad.", cta: "Encuéntralos en HETNA" },
]

/** Fecha de hoy en México como { anio, mes, dia }. */
export function hoyMx(d = new Date()) {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(d)
    .filter((p) => p.type !== "literal")
    .map((p) => Number(p.value))
  return { anio, mes, dia }
}

const diaNum = (anio: number, mes: number, dia: number) => Math.round(Date.UTC(anio, mes - 1, dia) / 86_400_000)

/** Próxima vez que cae la fecha (hoy incluido) y cuántos días faltan. */
export function proxima(f: FechaEspecial, d = new Date()) {
  const h = hoyMx(d)
  const hoy = diaNum(h.anio, h.mes, h.dia)
  for (const anio of [h.anio, h.anio + 1]) {
    const x = f.dia(anio)
    const n = diaNum(anio, x.mes, x.dia)
    if (n >= hoy) return { anio, mes: x.mes, dia: x.dia, faltan: n - hoy }
  }
  return null
}

/** Fin del día de la fecha en México (para que nada salga después). */
export function finDelDia(p: { anio: number; mes: number; dia: number }) {
  // 23:59 en Ciudad de México (UTC-6, sin horario de verano desde 2022)
  return new Date(Date.UTC(p.anio, p.mes - 1, p.dia, 23 + 6, 59))
}

/** Fechas en temporada de videos de productos; la más cercana primero. */
export function fechasActivas(d = new Date(), lista = FECHAS) {
  return lista
    .map((f) => ({ f, p: proxima(f, d)! }))
    .filter(({ f, p }) => p && p.faltan <= f.anticipacion)
    .sort((a, b) => a.p.faltan - b.p.faltan)
}

/** Fondos de temporada que entran a la rotación general hoy (la fecha más cercana gana). */
export function temporadaDe(d = new Date()) {
  const act = FECHAS.map((f) => ({ f, p: proxima(f, d) }))
    .filter(({ f, p }) => f.fondoGeneral > 0 && p && p.faltan <= f.fondoGeneral)
    .sort((a, b) => a.p!.faltan - b.p!.faltan)
  return act.length ? [act[0].f.tema] : []
}
