// Mismos países que packages/api/src/lib/latam.ts. `cotizador`: el Cotizador
// para talleres ya funciona ahí con su moneda e impuesto (app: lib/services/pais.dart).
export type PaisLatam = { clave: string; nombre: string; bandera: string; moneda: string; cotizador?: string; ciudades: string[] }

export const PAISES_LATAM: PaisLatam[] = [
  { clave: "co", nombre: "Colombia", bandera: "🇨🇴", moneda: "pesos colombianos", cotizador: "pesos colombianos e IVA del 19%", ciudades: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga"] },
  { clave: "cl", nombre: "Chile", bandera: "🇨🇱", moneda: "pesos chilenos", cotizador: "pesos chilenos e IVA del 19%", ciudades: ["Santiago", "Valparaíso", "Concepción", "Antofagasta"] },
  { clave: "pe", nombre: "Perú", bandera: "🇵🇪", moneda: "soles", cotizador: "soles e IGV del 18%", ciudades: ["Lima", "Arequipa", "Trujillo", "Chiclayo"] },
  { clave: "ar", nombre: "Argentina", bandera: "🇦🇷", moneda: "pesos argentinos", ciudades: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"] },
  { clave: "gt", nombre: "Guatemala", bandera: "🇬🇹", moneda: "quetzales", ciudades: ["Ciudad de Guatemala", "Quetzaltenango"] },
  { clave: "ec", nombre: "Ecuador", bandera: "🇪🇨", moneda: "dólares", ciudades: ["Quito", "Guayaquil", "Cuenca"] },
  { clave: "cr", nombre: "Costa Rica", bandera: "🇨🇷", moneda: "colones", ciudades: ["San José", "Alajuela", "Heredia"] },
  { clave: "bo", nombre: "Bolivia", bandera: "🇧🇴", moneda: "bolivianos", ciudades: ["Santa Cruz", "La Paz", "Cochabamba"] },
  { clave: "do", nombre: "República Dominicana", bandera: "🇩🇴", moneda: "pesos dominicanos", ciudades: ["Santo Domingo", "Santiago de los Caballeros"] },
  { clave: "es", nombre: "España", bandera: "🇪🇸", moneda: "euros", ciudades: ["Madrid", "Barcelona", "Valencia", "Sevilla"] },
]
export const paisPorClave = (c: string) => PAISES_LATAM.find((p) => p.clave === c)
