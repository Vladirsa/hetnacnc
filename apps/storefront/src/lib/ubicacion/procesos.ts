// Qué talleres pueden hacer un producto: según cómo se fabrica (celosía →
// corte láser, router o plasma; pieza maquilada en madera o aluminio → router
// o fresadora; impresa → impresora 3D) se buscan talleres que lo marcaron en
// su perfil, ya sea en "Servicios" o en sus máquinas (panel del taller,
// apps/vendor/src/routes/perfil-taller: SERVICIOS y lib/hetna/talleres.ts:
// TIPOS_MAQUINA; procesos.test.ts revisa que los textos coincidan).
//
// Sólo aplica a lo que se FABRICA: productos de corte o tallado, piezas bajo
// pedido y diseños o piezas cuyo nombre lo dice (celosía, letrero, relieve,
// maquilado…). Las herramientas y servicios nunca; los materiales, máquinas,
// filamento y consumibles tampoco, porque no traen esas palabras
// (procesos.test.ts lo revisa con ejemplos).
// El taller o HETNA pueden fijarlo a mano con metadata.procesos del producto
// (claves de PROCESOS separadas por coma: "corte_laser,router").
import { tipoProducto } from "@/lib/hetna/tipo-producto"
import type { Taller } from "@/lib/hetna/talleres"
import type { TipoMaquina } from "@/lib/cotizador/estimador"
import { sinAcentos } from "@/lib/hetna/directorio"

export type Proceso = "impresion_3d" | "corte_laser" | "corte_plasma" | "router" | "maquinado_metal" | "torno"

/**
 * Por proceso: nombre para el cliente, los servicios del perfil y los tipos de
 * máquina que lo cubren, el servicio con que se prellena /cotizar y la máquina
 * del cotizador rápido de "Fabrícalo" (FabricarDiseno).
 */
export const PROCESOS: Record<Proceso, { nombre: string; servicios: string[]; maquinas: string[]; cotizar: string; estimador?: TipoMaquina }> = {
  impresion_3d: { nombre: "impresión 3D", servicios: ["Impresión 3D"], maquinas: ["impresora_3d"], cotizar: "Impresión 3D", estimador: "impresora_3d" },
  corte_laser: { nombre: "corte láser", servicios: ["Corte láser", "Grabado"], maquinas: ["laser_co2", "laser_fibra"], cotizar: "Corte láser", estimador: "laser_co2" },
  corte_plasma: { nombre: "corte plasma", servicios: ["Corte plasma"], maquinas: ["plasma", "laser_fibra", "waterjet"], cotizar: "Corte plasma", estimador: "plasma" },
  router: { nombre: "router CNC", servicios: ["Corte CNC", "Fresado de madera"], maquinas: ["router"], cotizar: "Corte CNC", estimador: "router" },
  maquinado_metal: { nombre: "maquinado", servicios: ["Fresado de metal", "Maquinado"], maquinas: ["fresadora", "router"], cotizar: "Maquinado", estimador: "router_3d" },
  torno: { nombre: "torno CNC", servicios: ["Maquinado"], maquinas: ["torno"], cotizar: "Maquinado" },
}

type ProductoMin = Parameters<typeof tipoProducto>[0] & { title?: string | null }

const texto = (v: unknown) => (typeof v === "string" ? v : "")

const CORTE = /celosi|letrero|calad|silueta|plantilla|stencil|corte (laser|plasma|cnc)|cortad[oa] (en|a) (laser|plasma|cnc)/
const TALLADO = /tallad|relieve|maquilad|maquinad|fresad|molde|bajo relieve/
const IMPRESO = /impres[oa] (en )?3d|impresion 3d|\bstl\b/
const TORNO = /torneado|torno/
// Metal: el acrílico no cuenta aunque diga "lámina"
const esMetal = (t: string) => /alumin|acero|inox|metal|cobre|laton/.test(t) || (/lamina/.test(t) && !/acrilic|mdf|madera|pvc|plastic/.test(t))

/** Procesos con que se fabrica el producto (vacío si no se fabrica: existencias, herramientas, servicios). */
export function procesosDeProducto(p: ProductoMin | null | undefined): Proceso[] {
  if (!p) return []
  const m = (p.metadata || {}) as Record<string, unknown>
  const fijos = texto(m.procesos)
    .split(/[\s,;]+/)
    .filter((x): x is Proceso => x in PROCESOS)
  if (fijos.length) return [...new Set(fijos)]
  if (m.impresion_bajo_pedido === true) return ["impresion_3d"]

  const tipo = tipoProducto(p as never)
  if (tipo === "servicio" || tipo === "herramienta") return []
  const t = sinAcentos(
    [p.title, ...(p.categories || []).map((c) => `${c?.name || ""} ${c?.handle || ""}`), ...(p.tags || []).map((x) => x?.value || ""), texto(m.material)].join(" ")
  )
  const metal = esMetal(t)
  if (IMPRESO.test(t)) return ["impresion_3d"]
  if (TORNO.test(t)) return ["torno", "maquinado_metal"]
  if (tipo === "corte" || CORTE.test(t)) return metal ? ["corte_plasma", "corte_laser", "router"] : ["corte_laser", "router"]
  if (tipo === "tallado" || TALLADO.test(t)) return metal ? ["maquinado_metal", "router"] : ["router"]
  // Pieza bajo pedido sin más pistas: lo más común
  if (tipo === "a_medida") return metal ? ["maquinado_metal", "corte_plasma"] : ["router", "corte_laser"]
  return [] // sin pistas de que se fabrique
}

/** ¿El taller hace alguno de estos procesos? (por sus servicios o por el tipo de sus máquinas) */
export function tallerHace(t: Pick<Taller, "perfil">, procesos: Proceso[]): boolean {
  const servicios = new Set(t.perfil.servicios)
  const maquinas = new Set(t.perfil.maquinas.map((m) => m.tipo).filter(Boolean) as string[])
  return procesos.some((k) => PROCESOS[k].servicios.some((s) => servicios.has(s)) || PROCESOS[k].maquinas.some((x) => maquinas.has(x)))
}

/** "corte láser o router CNC" */
export const nombreProcesos = (procesos: Proceso[]) => {
  const n = procesos.map((k) => PROCESOS[k].nombre)
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} o ${n[n.length - 1]}` : n[0] || ""
}
