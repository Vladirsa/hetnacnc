// Puente entre el perfil de cada taller y el motor de cálculo
// (cotizador-engine.ts). El motor ya recibe cfg/costos como parámetro, así que
// volverlo multi-taller no requiere tocarlo: basta resolver aquí qué cfg y qué
// costos le corresponden a quién.
//
// cotizador-datos.json sigue siendo la referencia (las tarifas de HETNA) y
// hace de valor por defecto: un taller que acaba de registrarse cotiza desde
// el primer minuto y va reemplazando los números por los suyos.
import cotizadorDatos from "./cotizador-datos.json"
import type { CotizadorCfg, CotizadorCostos, CotizadorTipo } from "./cotizador-engine"

const datos = cotizadorDatos as any

// Forma que se espera dentro de TallerPerfil.tarifas (campo json), una entrada
// por clave de servicio. El tipo del modelo es Record<string, unknown>, así que
// se valida al leerlo en cfgDeTaller en vez de confiar en el tipo.
export type TarifasDeServicio = { tarifas?: Record<string, number>; rangos?: Rango[] }

type Rango = { desde: number; hasta: number; precio: number }

export type PerfilParaMotor = {
  costo_hora_taller?: number
  costo_hora_maquina?: number
  costo_hora_operador?: number
  margen_minimo?: number
  margen_recomendado?: number
  iva_pct?: number
  tarifas?: Record<string, unknown> | null
}

export type ServicioCfg = {
  clave: string
  nombre: string
  emoji?: string
  tarifas?: Record<string, number>
  rangos?: unknown[]
  tipos?: { n: string; f?: string; k?: number }[]
}

export function listaServicios(): { clave: string; nombre: string; emoji?: string; tipos: string[] }[] {
  return (datos.servicios as ServicioCfg[]).map((s) => ({
    clave: s.clave,
    nombre: s.nombre,
    emoji: s.emoji,
    tipos: (s.tipos || []).map((t) => t.n),
  }))
}

export function servicioPorClave(clave: string): ServicioCfg | null {
  return (datos.servicios as ServicioCfg[]).find((s) => s.clave === clave) || null
}

export function tipoPorNombre(servicio: ServicioCfg, nombre?: string): CotizadorTipo | null {
  const tipos = servicio.tipos || []
  if (!tipos.length) {
    return null
  }
  const t = nombre ? tipos.find((x) => x.n === nombre) : tipos[0]
  if (!t) {
    return null
  }
  return { n: t.n, nombre: t.n, formula: t.f, factor: t.k }
}

// Los costos del taller sólo pisan a los de referencia cuando ya los capturó.
// Un 0 significa "sin capturar", no "cuesta cero" -- cotizar con costo de
// máquina en 0 daría precios por debajo del costo real.
export function costosDeTaller(perfil: PerfilParaMotor): CotizadorCostos {
  const base = datos.costos as CotizadorCostos
  return {
    costoHoraTaller: perfil.costo_hora_taller || base.costoHoraTaller,
    costoHoraMaquina: perfil.costo_hora_maquina || base.costoHoraMaquina,
    costoHoraOperador: perfil.costo_hora_operador || base.costoHoraOperador,
    margenMinimo: perfil.margen_minimo || base.margenMinimo,
    margenRecomendado: perfil.margen_recomendado || base.margenRecomendado,
    ivaPct: typeof perfil.iva_pct === "number" ? perfil.iva_pct : base.ivaPct,
  }
}

export function cfgDeTaller(perfil: PerfilParaMotor, servicio: ServicioCfg): CotizadorCfg {
  const crudo = perfil.tarifas?.[servicio.clave]
  const propias = (crudo && typeof crudo === "object" ? crudo : null) as TarifasDeServicio | null
  return {
    tarifas: propias?.tarifas || servicio.tarifas,
    rangos: propias?.rangos || (servicio.rangos as CotizadorCfg["rangos"]),
  }
}

export type PartidaParaTotales = { cantidad?: number; precio_unitario?: number; subtotal?: number }

export function subtotalDePartida(partida: PartidaParaTotales): number {
  if (typeof partida.subtotal === "number" && partida.subtotal > 0) {
    return redondea(partida.subtotal)
  }
  return redondea((partida.cantidad ?? 1) * (partida.precio_unitario ?? 0))
}

export function totalesDeCotizacion(
  partidas: PartidaParaTotales[],
  opciones: { descuento?: number; envio?: number; iva_pct?: number; aplicar_iva?: boolean }
): { subtotal: number; descuento: number; iva: number; envio: number; total: number } {
  const subtotal = redondea(partidas.reduce((acc, p) => acc + subtotalDePartida(p), 0))
  const descuento = redondea(opciones.descuento ?? 0)
  const envio = redondea(opciones.envio ?? 0)
  const base = Math.max(0, subtotal - descuento)
  const iva = opciones.aplicar_iva ? redondea(base * ((opciones.iva_pct ?? 0) / 100)) : 0
  return { subtotal, descuento, iva, envio, total: redondea(base + iva + envio) }
}

function redondea(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}
