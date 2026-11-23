// Mismos países que packages/api/src/lib/latam.ts. `cotizador`: el Cotizador
// para talleres ya funciona ahí con su moneda e impuesto (app: lib/services/pais.dart).
export type PaisLatam = { clave: string; nombre: string; bandera: string; moneda: string; cotizador?: string; ciudades: string[]; nota?: string; region?: "latam" | "eua" | "europa"; en_hoja?: string[] }
// `en_hoja`: otras formas en que el buscador escribe el país en la hoja de prospectos.

export const PAISES_LATAM: PaisLatam[] = [
  { clave: "co", nombre: "Colombia", bandera: "🇨🇴", moneda: "pesos colombianos", cotizador: "pesos colombianos e IVA del 19%", ciudades: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga"] },
  { clave: "cl", nombre: "Chile", bandera: "🇨🇱", moneda: "pesos chilenos", cotizador: "pesos chilenos e IVA del 19%", ciudades: ["Santiago", "Valparaíso", "Concepción", "Antofagasta"] },
  { clave: "pe", nombre: "Perú", bandera: "🇵🇪", moneda: "soles", cotizador: "soles e IGV del 18%", ciudades: ["Lima", "Arequipa", "Trujillo", "Chiclayo"] },
  { clave: "ar", nombre: "Argentina", bandera: "🇦🇷", moneda: "pesos argentinos", ciudades: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"] },
  { clave: "gt", nombre: "Guatemala", bandera: "🇬🇹", moneda: "quetzales", ciudades: ["Ciudad de Guatemala", "Quetzaltenango"] },
  { clave: "ec", nombre: "Ecuador", bandera: "🇪🇨", moneda: "dólares", ciudades: ["Quito", "Guayaquil", "Cuenca"] },
  { clave: "cr", nombre: "Costa Rica", bandera: "🇨🇷", moneda: "colones", ciudades: ["San José", "Alajuela", "Heredia"] },
  { clave: "bo", nombre: "Bolivia", bandera: "🇧🇴", moneda: "bolivianos", ciudades: ["Santa Cruz", "La Paz", "Cochabamba"] },
  { clave: "do", en_hoja: ["Republica Dominicana", "Dominicana"], nombre: "República Dominicana", bandera: "🇩🇴", moneda: "pesos dominicanos", ciudades: ["Santo Domingo", "Santiago de los Caballeros"] },
  { clave: "es", nombre: "España", bandera: "🇪🇸", moneda: "euros", ciudades: ["Madrid", "Barcelona", "Valencia", "Sevilla"], region: "europa", en_hoja: ["Espana", "Spain"] },
  // EUA hispano (fase 5.2): talleres y clientes que trabajan en español
  {
    clave: "us",
    nombre: "Estados Unidos",
    bandera: "🇺🇸",
    moneda: "dólares",
    ciudades: ["Los Ángeles", "Houston", "Dallas", "San Antonio", "Phoenix", "Chicago", "Miami"],
    nota: "Pensado para talleres y clientes hispanos: todo en español, de un taller a otro.",
    region: "eua",
    en_hoja: ["EE. UU.", "EEUU", "USA", "United States"],
  },
  { clave: "uy", nombre: "Uruguay", bandera: "🇺🇾", moneda: "pesos uruguayos", ciudades: ["Montevideo", "Canelones", "Maldonado"] },
  { clave: "py", nombre: "Paraguay", bandera: "🇵🇾", moneda: "guaraníes", ciudades: ["Asunción", "Ciudad del Este", "Encarnación"] },
  { clave: "sv", nombre: "El Salvador", bandera: "🇸🇻", moneda: "dólares", ciudades: ["San Salvador", "Santa Ana", "San Miguel"] },
]

/** Dirección de la página de pre-registro de cada país (España y EUA con la suya propia). */
export const rutaPais = (clave: string) => (clave === "es" ? "/mx/espana" : clave === "us" ? "/mx/estados-unidos" : `/mx/latinoamerica/${clave}`)
export const paisPorClave = (c: string) => PAISES_LATAM.find((p) => p.clave === c)
