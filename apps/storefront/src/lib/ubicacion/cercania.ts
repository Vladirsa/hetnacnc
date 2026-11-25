// Qué tan cerca está un taller del cliente, sin coordenadas: los perfiles de
// taller guardan municipio y estado (panel del taller, "Perfil del taller"), y
// del cliente sabemos su código postal (→ municipio y estado con
// /store/envios/cp) o, si no lo ha dado, el estado aproximado por su IP.
//
//   0 = en tu municipio (mismo municipio y estado)
//   1 = en tu estado
//   2 = en un estado vecino
//   3 = más lejos
//   4 = no sabemos (el taller no puso su ubicación o no sabemos la del cliente)
//
// No se compara el código postal del taller: no todas las listas lo reciben
// (las ofertas de impresión mandan sólo ciudad y estado) y así la regla es la
// misma en todas.
//
// Los estados vecinos salen de @webrek/mx-geo 0.9.1 (vecinos.json, MIT,
// geometrías de INEGI), copiados aquí por clave INEGI para no cargar el paquete.
import { ESTADOS_MX, estadoMx, sinAcentos } from "@/lib/hetna/directorio"

export type UbicacionCliente = { cp?: string; municipio?: string; estado?: string }
export type UbicacionTaller = { ciudad?: string; estado?: string }
export type Nivel = 0 | 1 | 2 | 3 | 4

// Clave INEGI → nombre como en ESTADOS_MX
const CLAVES: Record<string, string> = {
  "01": "Aguascalientes", "02": "Baja California", "03": "Baja California Sur", "04": "Campeche",
  "05": "Coahuila", "06": "Colima", "07": "Chiapas", "08": "Chihuahua", "09": "Ciudad de México",
  "10": "Durango", "11": "Guanajuato", "12": "Guerrero", "13": "Hidalgo", "14": "Jalisco",
  "15": "Estado de México", "16": "Michoacán", "17": "Morelos", "18": "Nayarit", "19": "Nuevo León",
  "20": "Oaxaca", "21": "Puebla", "22": "Querétaro", "23": "Quintana Roo", "24": "San Luis Potosí",
  "25": "Sinaloa", "26": "Sonora", "27": "Tabasco", "28": "Tamaulipas", "29": "Tlaxcala",
  "30": "Veracruz", "31": "Yucatán", "32": "Zacatecas",
}

const VECINOS_INEGI: Record<string, string[]> = {
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

// Nombre del estado → nombres de sus vecinos (se arma una vez al cargar)
const VECINOS = new Map(Object.entries(VECINOS_INEGI).map(([k, v]) => [CLAVES[k], new Set(v.map((x) => CLAVES[x]))]))
if (VECINOS.size !== ESTADOS_MX.length || ESTADOS_MX.some((e) => !VECINOS.has(e))) throw new Error("cercania: la tabla de vecinos no cuadra con ESTADOS_MX")

/** Nombre del estado como en ESTADOS_MX ("Michoacán de Ocampo" → "Michoacán", "CDMX" → "Ciudad de México"), o "". */
export const normalizarEstado = (texto?: string) => estadoMx(texto)

/** ¿Son estados vecinos? (acepta nombres en cualquier forma que entienda normalizarEstado) */
export const sonVecinos = (a?: string, b?: string) => !!VECINOS.get(normalizarEstado(a))?.has(normalizarEstado(b))

/** "Apizaco, Tlaxcala" */
export const textoUbicacion = (u: { ciudad?: string; municipio?: string; estado?: string } | null | undefined) =>
  u ? [u.ciudad ?? u.municipio, u.estado].filter(Boolean).join(", ") : ""

/** Ciudad y estado del perfil público de un taller (seller.metadata.perfil). */
export function ubicacionDePerfil(metadata: unknown): UbicacionTaller {
  const p = ((metadata as { perfil?: Record<string, unknown> } | null)?.perfil || {}) as Record<string, unknown>
  const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
  return { ciudad: t(p.ciudad), estado: t(p.estado) }
}

export function nivelCercania(t: UbicacionTaller, u: UbicacionCliente | null | undefined): Nivel {
  if (!u) return 4
  const eu = normalizarEstado(u.estado), et = normalizarEstado(t.estado)
  if (!eu || !et) return 4
  if (eu !== et) return sonVecinos(eu, et) ? 2 : 3
  if (u.municipio && t.ciudad && sinAcentos(u.municipio) === sinAcentos(t.ciudad)) return 0
  return 1
}

/** Cada elemento con su nivel, calculado una sola vez (cada lista arma su propio orden). */
export const conNivel = <T,>(lista: T[], ubic: (x: T) => UbicacionTaller, u: UbicacionCliente | null | undefined) =>
  lista.map((item, i) => ({ item, i, nivel: nivelCercania(ubic(item), u) }))

export const ETIQUETA_NIVEL: Record<Nivel, string | null> = {
  0: "En tu municipio",
  1: "En tu estado",
  2: "Estado vecino",
  3: null,
  4: null,
}

/** ¿Hay al menos uno en el municipio o en el estado del cliente? */
export const hayCerca = (niveles: Nivel[]) => niveles.some((n) => n <= 1)
