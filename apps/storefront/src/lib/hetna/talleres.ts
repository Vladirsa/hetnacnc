import { sdk } from "@/lib/client"
import { type Tarifas, leerTarifas } from "@/lib/hetna/estimado"
import { type AcabadoTaller, leerAcabados } from "@/lib/hetna/acabados"
import { capacidadVigente, type CapacidadLibre } from "@/lib/hetna/capacidad-libre"

// Tipos de máquina (mismos valores que apps/vendor/src/routes/perfil-taller)
export const TIPOS_MAQUINA: [string, string][] = [
  ["router", "Router CNC"],
  ["laser_co2", "Láser CO2"],
  ["laser_fibra", "Láser de fibra"],
  ["plasma", "Plasma CNC"],
  ["fresadora", "Fresadora / centro de maquinado"],
  ["torno", "Torno CNC"],
  ["impresora_3d", "Impresora 3D"],
  ["waterjet", "Chorro de agua"],
  ["dobladora", "Dobladora / plegadora"],
  ["otra", "Otra"],
]
export const nombreTipoMaquina = (t?: string) => TIPOS_MAQUINA.find(([v]) => v === t)?.[1] ?? ""

export type Maquina = {
  nombre: string
  tipo?: string
  marca?: string
  // Área de trabajo en mm (las fichas de antes sólo traen `area` en texto)
  x?: number
  y?: number
  z?: number
  area?: string
  potencia?: string
  controlador?: string
  detalle?: string
}

// Proveedor que vende desde otro país (decisión del 24 nov 2026): envía puerta a
// puerta con impuestos pagados (DDP: DHL, FedEx, UPS…) y HETNA le paga por PayPal.
export type Importacion = { pais: string; entrega_min?: number; entrega_max?: number }

export type Perfil = {
  // Si vende desde otro país: sus productos se marcan «De importación»
  importacion?: Importacion
  // Licitaciones 3.0: taller (fabrica), proveedor (vende productos) o ambos
  tipo_cuenta?: "taller" | "proveedor" | "ambos"
  marcas?: string[]
  ciudad?: string
  estado?: string
  // Código postal del taller (no se publica; sirve para "cerca de ti")
  cp?: string
  // "diseno" | "entrega_local" | "envio": lo que ofrece además de maquinar
  ofrece: string[]
  // Tarifas por proceso para el estimado rápido de "Fabrícamelo"
  tarifas: Tarifas
  lema?: string
  servicios: string[]
  capacidades: string[]
  maquinas: Maquina[]
  materiales: string[]
  entrega?: string
  // Horario de atención, texto libre del taller ("Lunes a viernes 9 a 18")
  horario?: string
  anos?: number
  calificacion?: number
  resenas?: number
  // Fase 4 (Trust & Ranking): promedios por indicador y dimensiones separadas
  indicadores?: Record<string, number | null>
  reputacion_comercial?: number
  capacidad_tecnica?: number
  historial_suficiente?: boolean
  // Lo que el taller HIZO en HETNA (packages/api/src/lib/reputacion-medida.ts),
  // recalculado cada día: puntualidad real, terminados, reclamos, respuesta.
  medido?: Medido
  // Acabados que hace (pintura, doblez, roscado…) y su "precio desde" (estrategia 2.1)
  acabados: AcabadoTaller[]
  galeria: string[]
}

export type Medido = {
  terminados: number
  puntualidad_pct: number | null
  con_fecha: number
  retraso_promedio_dias: number | null
  terminados_pct: number | null
  reclamos: number
  reclamos_resueltos: number
  puntaje: number | null
  suficiente: boolean
  respuesta_horas: number | null
}

const leerMedido = (v: unknown): Medido | undefined => {
  if (!v || typeof v !== "object") return undefined
  const m = v as Record<string, unknown>
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null)
  return {
    terminados: n(m.terminados) ?? 0,
    puntualidad_pct: n(m.puntualidad_pct),
    con_fecha: n(m.con_fecha) ?? 0,
    retraso_promedio_dias: n(m.retraso_promedio_dias),
    terminados_pct: n(m.terminados_pct),
    reclamos: n(m.reclamos) ?? 0,
    reclamos_resueltos: n(m.reclamos_resueltos) ?? 0,
    puntaje: n(m.puntaje),
    suficiente: m.suficiente === true,
    respuesta_horas: n(m.respuesta_horas),
  }
}

export { textoRespuesta } from "./respuesta"

export type Taller = {
  id: string
  handle: string
  nombre: string
  descripcion?: string
  logo?: string | null
  banner?: string | null
  fundador: boolean
  // Invitó a otro taller que ya vende (packages/api/src/lib/referidos.ts)
  embajador: boolean
  // Aprobado por HETNA con identificación y fotos del taller (lo marca solo el administrador)
  verificado: boolean
  // Fase 3: constancia fiscal revisada por HETNA y certificaciones acreditadas vigentes
  empresaVerificada: boolean
  certificaciones: { tipo: string; nombre: string; emisor: string | null; vigencia: string | null }[]
  // Estrategia 3.4: avisó que tiene máquina libre (vence sola)
  capacidadLibre: CapacidadLibre | null
  perfil: Perfil
  // Servicios con precio "desde" (panel > Mis servicios; packages/api/src/lib/paquetes-servicio.ts)
  paquetes: Paquete[]
}

export type Paquete = {
  id: string
  titulo: string
  desde: number
  entrega_dias: number | null
  descripcion: string
  categoria: "diseno-2d-3d" | "programacion-cam" | "otro"
}

// Lo valida la API al guardar; aquí sólo se filtra lo que no tenga forma
const leerPaquetes = (v: unknown): Paquete[] =>
  (Array.isArray(v) ? v : [])
    .filter((x: any) => x && typeof x.id === "string" && typeof x.titulo === "string" && Number(x.desde) > 0)
    .slice(0, 12)
    .map((x: any) => ({
      id: x.id,
      titulo: String(x.titulo).slice(0, 80),
      desde: Number(x.desde),
      entrega_dias: Number(x.entrega_dias) > 0 ? Number(x.entrega_dias) : null,
      descripcion: String(x.descripcion || "").slice(0, 600),
      categoria: ["diseno-2d-3d", "programacion-cam"].includes(x.categoria) ? x.categoria : "otro",
    }))

type SellerCrudo = {
  id: string
  handle: string
  name: string
  description?: string | null
  logo?: string | null
  banner?: string | null
  metadata?: Record<string, unknown> | null
}

const lista = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : []

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number)
  return typeof n === "number" && Number.isFinite(n) ? n : undefined
}

const texto = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined

export const leerPerfil = (metadata?: Record<string, unknown> | null): Perfil => {
  const p = (metadata?.perfil ?? {}) as Record<string, unknown>
  const maquinas = Array.isArray(p.maquinas)
    ? (p.maquinas as Record<string, unknown>[])
        .map((m) => ({
          nombre: texto(m?.nombre) ?? "",
          tipo: texto(m?.tipo),
          marca: texto(m?.marca),
          x: num(m?.x),
          y: num(m?.y),
          z: num(m?.z),
          area: texto(m?.area),
          potencia: texto(m?.potencia),
          controlador: texto(m?.controlador),
          detalle: texto(m?.detalle),
        }))
        .filter((m) => m.nombre)
    : []
  const imp = p.importacion && typeof p.importacion === "object" ? (p.importacion as Record<string, unknown>) : null
  const pais = texto(imp?.pais)
  return {
    importacion: pais && !/^m[eé]xico$/i.test(pais) ? { pais, entrega_min: num(imp?.entrega_min), entrega_max: num(imp?.entrega_max) } : undefined,
    tipo_cuenta: p.tipo_cuenta === "proveedor" || p.tipo_cuenta === "ambos" ? p.tipo_cuenta : "taller",
    marcas: lista(p.marcas).slice(0, 20),
    ciudad: texto(p.ciudad),
    estado: texto(p.estado),
    cp: texto(p.cp),
    ofrece: lista(p.ofrece),
    tarifas: leerTarifas(p.tarifas),
    lema: texto(p.lema),
    servicios: lista(p.servicios),
    capacidades: lista(p.capacidades),
    maquinas,
    materiales: lista(p.materiales),
    entrega: texto(p.entrega),
    horario: texto(p.horario),
    anos: num(p.anos),
    calificacion: num(p.calificacion),
    resenas: num(p.resenas),
    indicadores: p.indicadores && typeof p.indicadores === "object" ? (p.indicadores as Record<string, number | null>) : undefined,
    reputacion_comercial: num(p.reputacion_comercial),
    capacidad_tecnica: num(p.capacidad_tecnica),
    historial_suficiente: p.historial_suficiente === true,
    medido: leerMedido(p.medido),
    acabados: leerAcabados(p.acabados),
    galeria: lista(p.galeria).filter((u) => /^https?:\/\//.test(u)).slice(0, 12),
  }
}

export const aTaller = (s: SellerCrudo): Taller => ({
  id: s.id,
  handle: s.handle,
  nombre: s.name,
  descripcion: s.description ?? undefined,
  logo: s.logo,
  banner: s.banner,
  fundador: s.metadata?.fundador === true,
  embajador: s.metadata?.embajador === true,
  verificado: s.metadata?.verificado === true,
  capacidadLibre: capacidadVigente(s.metadata?.capacidad_libre),
  empresaVerificada: s.metadata?.empresa_verificada === true,
  certificaciones: (Array.isArray(s.metadata?.certificaciones) ? s.metadata.certificaciones : []).filter(
    (c: any) => c && c.nombre && (!c.vigencia || new Date(c.vigencia).getTime() >= Date.now() - 86_400_000)
  ),
  perfil: leerPerfil(s.metadata),
  paquetes: leerPaquetes(s.metadata?.paquetes),
})

// Cuentas de prueba (metadata.prueba = true) no se muestran al público.
const esPrueba = (s: SellerCrudo) => s.metadata?.prueba === true

const CAMPOS = "id,name,handle,description,logo,banner,metadata"

// Todos los talleres, de 100 en 100 (hasta 2,000), para el directorio.
export const listarTalleres = async (): Promise<Taller[]> => {
  const todos: SellerCrudo[] = []
  try {
    for (let offset = 0; offset < 2000; offset += 100) {
      const r = (await sdk.store.sellers.query({
        fields: CAMPOS,
        limit: 100,
        offset,
        fetchOptions: { next: { revalidate: 300 } },
      } as never)) as unknown as { sellers: SellerCrudo[]; count?: number }
      const lote = r.sellers ?? []
      todos.push(...lote)
      if (lote.length < 100 || (r.count !== undefined && todos.length >= r.count)) break
    }
  } catch {
    // con lo que se alcanzó a leer
  }
  return todos.filter((s) => !esPrueba(s)).map(aTaller)
}

/** ¿Tiene una máquina (de ese tipo, si se pide) con al menos esa área en mm? */
export const tieneMaquina = (t: Taller, tipo: string, minimo: number) =>
  t.perfil.maquinas.some((m) => {
    if (tipo && m.tipo !== tipo) return false
    if (!minimo) return true
    const lados = [m.x, m.y].filter((n): n is number => typeof n === "number" && n > 0)
    if (lados.length < 2) return false
    return Math.min(...lados) >= minimo
  })

/** "1500 × 3000 mm" o el texto que capturó el taller. */
export const areaTexto = (m: Maquina) =>
  m.x && m.y ? `${m.x.toLocaleString("es-MX")} × ${m.y.toLocaleString("es-MX")}${m.z ? ` × ${m.z.toLocaleString("es-MX")}` : ""} mm` : m.area || ""

export const tallerPorHandle = async (handle: string): Promise<Taller | null> => {
  try {
    const r = (await sdk.store.sellers.query({
      handle,
      fields: CAMPOS,
      fetchOptions: { next: { revalidate: 300 } },
    } as never)) as unknown as { sellers: SellerCrudo[] }
    const s = (r.sellers ?? []).find((x) => x.handle === handle)
    return s && !esPrueba(s) ? aTaller(s) : null
  } catch {
    return null
  }
}

export const ubicacion = (p: Perfil) =>
  [p.ciudad, p.estado].filter(Boolean).join(", ")

/** «llega en 10 a 20 días hábiles» (o lo que haya capturado el proveedor). */
export const entregaImportacion = (i: Importacion) => {
  const a = i.entrega_min, b = i.entrega_max
  if (a && b && b > a) return `llega en ${a} a ${b} días hábiles`
  if (a || b) return `llega en unos ${a || b} días hábiles`
  return "llega en 10 a 20 días hábiles"
}
