// Qué tan cerca está un taller del cliente, sin coordenadas: los perfiles de
// taller guardan municipio, estado y código postal (panel del taller, "Perfil
// del taller"), y del cliente sabemos su código postal (→ municipio y estado
// con /store/envios/cp) o, si no lo ha dado, el estado aproximado por su IP.
//
//   0 = en tu municipio (mismo código postal o mismo municipio y estado)
//   1 = en tu estado
//   2 = en un estado vecino
//   3 = más lejos
//   4 = no sabemos (el taller no puso su ubicación o no sabemos la del cliente)
//
// Los estados vecinos salen de @webrek/mx-geo (MIT, geometrías de INEGI),
// copiados aquí por clave INEGI para no cargar el paquete en la tienda.
import { estadoMx } from "@/lib/hetna/directorio"

export type UbicacionCliente = { cp?: string; municipio?: string; estado?: string }
export type UbicacionTaller = { cp?: string; ciudad?: string; estado?: string }
export type Nivel = 0 | 1 | 2 | 3 | 4

// Clave INEGI → nombre como en ESTADOS_MX (lib/hetna/directorio.ts)
const CLAVES: Record<string, string> = {
  "01": "Aguascalientes", "02": "Baja California", "03": "Baja California Sur", "04": "Campeche",
  "05": "Coahuila", "06": "Colima", "07": "Chiapas", "08": "Chihuahua", "09": "Ciudad de México",
  "10": "Durango", "11": "Guanajuato", "12": "Guerrero", "13": "Hidalgo", "14": "Jalisco",
  "15": "Estado de México", "16": "Michoacán", "17": "Morelos", "18": "Nayarit", "19": "Nuevo León",
  "20": "Oaxaca", "21": "Puebla", "22": "Querétaro", "23": "Quintana Roo", "24": "San Luis Potosí",
  "25": "Sinaloa", "26": "Sonora", "27": "Tabasco", "28": "Tamaulipas", "29": "Tlaxcala",
  "30": "Veracruz", "31": "Yucatán", "32": "Zacatecas",
}

// @webrek/mx-geo 0.9.1, vecinos.json
const VECINOS: Record<string, string[]> = {
  "01": ["14", "32"], "02": ["03", "26"], "03": ["02"], "04": ["23", "27", "31"], "05": ["08", "10", "19", "32"],
  "06": ["14", "16"], "07": ["20", "27", "30"], "08": ["05", "10", "25", "26"], "09": ["15", "17"],
  "10": ["05", "08", "18", "25", "32"], "11": ["14", "16", "22", "24", "32"], "12": ["15", "16", "17", "20", "21"],
  "13": ["15", "21", "22", "24", "29", "30"], "14": ["01", "06", "11", "16", "18", "32"],
  "15": ["09", "12", "13", "16", "17", "21", "22", "29"], "16": ["06", "11", "12", "14", "15", "22"],
  "17": ["09", "12", "15", "21"], "18": ["10", "14", "25", "32"], "19": ["05", "24", "28", "32"],
  "20": ["07", "12", "21", "30"], "21": ["12", "13", "15", "17", "20", "29", "30"], "22": ["11", "13", "15", "16", "24"],
  "23": ["04", "31"], "24": ["11", "13", "19", "22", "28", "30", "32"], "25": ["08", "10", "18", "26"],
  "26": ["02", "08", "25"], "27": ["04", "07", "30"], "28": ["19", "24", "30"], "29": ["13", "15", "21"],
  "30": ["07", "13", "20", "21", "24", "27", "28"], "31": ["04", "23"], "32": ["01", "05", "10", "11", "14", "18", "19", "24"],
}

const sinAcentos = (s?: string) => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()

// Nombres que usa el catálogo de códigos postales (SEPOMEX) y no están en estadoMx
// ni los que trae la base de IP (DB-IP, en inglés)
const LARGOS: Record<string, string> = {
  "coahuila de zaragoza": "Coahuila", "michoacan de ocampo": "Michoacán", "veracruz de ignacio de la llave": "Veracruz",
  "mexico city": "Ciudad de México", "state of mexico": "Estado de México", "estado de mexico": "Estado de México",
  "baja california norte": "Baja California",
}

/** Nombre del estado como en ESTADOS_MX ("Michoacán de Ocampo" → "Michoacán", "CDMX" → "Ciudad de México"), o "". */
export function normalizarEstado(texto?: string): string {
  const n = sinAcentos(texto)
  if (!n) return ""
  return LARGOS[n] || estadoMx(texto) || ""
}

const claveDe = (estado?: string) => {
  const nombre = normalizarEstado(estado)
  return Object.keys(CLAVES).find((k) => CLAVES[k] === nombre) || ""
}

/** ¿Son estados vecinos? (acepta nombres en cualquier forma que entienda normalizarEstado) */
export function sonVecinos(a?: string, b?: string): boolean {
  const ka = claveDe(a), kb = claveDe(b)
  return !!ka && !!kb && (VECINOS[ka] || []).includes(kb)
}

export function nivelCercania(t: UbicacionTaller, u: UbicacionCliente | null | undefined): Nivel {
  if (!u) return 4
  const eu = normalizarEstado(u.estado), et = normalizarEstado(t.estado)
  if (u.cp && t.cp && u.cp === t.cp) return 0
  if (!eu || !et) return 4
  if (eu !== et) return sonVecinos(eu, et) ? 2 : 3
  if (u.municipio && t.ciudad && sinAcentos(u.municipio) === sinAcentos(t.ciudad)) return 0
  return 1
}

export const ETIQUETA_NIVEL: Record<Nivel, string | null> = {
  0: "En tu municipio",
  1: "En tu estado",
  2: "Estado vecino",
  3: null,
  4: null,
}

/**
 * Ordena por cercanía y, a igual cercanía, por `desempate` (p. ej. destacado,
 * verificado o precio). Estable: lo que empata queda en su orden original.
 */
export function ordenarPorCercania<T extends object>(lista: T[], ubic: (x: T) => UbicacionTaller, u: UbicacionCliente | null | undefined, desempate?: (a: T, b: T) => number): (T & { nivel: Nivel })[] {
  return lista
    .map((x, i) => ({ x, i, nivel: nivelCercania(ubic(x), u) }))
    .sort((a, b) => a.nivel - b.nivel || (desempate ? desempate(a.x, b.x) : 0) || a.i - b.i)
    .map(({ x, nivel }) => ({ ...x, nivel }))
}

/** ¿Hay al menos uno en el municipio o en el estado del cliente? */
export const hayCerca = (niveles: Nivel[]) => niveles.some((n) => n <= 1)
