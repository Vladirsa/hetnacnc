// Qué talleres pueden hacer un producto: según cómo se fabrica (celosía →
// corte láser, router o plasma; pieza maquilada en madera o aluminio → router
// o fresadora; impresa → impresora 3D) se buscan talleres que lo marcaron en
// su perfil, ya sea en "Servicios" o en sus máquinas (panel del taller,
// apps/vendor/src/routes/perfil-taller).
//
// El taller o HETNA pueden fijarlo a mano con metadata.procesos del producto
// (claves de PROCESOS separadas por coma: "corte_laser,router").
import { tipoProducto } from "@/lib/hetna/tipo-producto"
import type { Taller } from "@/lib/hetna/talleres"

export type Proceso = "impresion_3d" | "corte_laser" | "corte_plasma" | "router" | "maquinado_metal" | "torno"

/** Por proceso: nombre para el cliente, los servicios del perfil y los tipos de máquina que lo cubren. */
export const PROCESOS: Record<Proceso, { nombre: string; servicios: string[]; maquinas: string[]; cotizar: string }> = {
  impresion_3d: { nombre: "impresión 3D", servicios: ["Impresión 3D"], maquinas: ["impresora_3d"], cotizar: "Impresión 3D" },
  corte_laser: { nombre: "corte láser", servicios: ["Corte láser", "Grabado"], maquinas: ["laser_co2", "laser_fibra"], cotizar: "Corte láser" },
  corte_plasma: { nombre: "corte plasma", servicios: ["Corte plasma"], maquinas: ["plasma", "laser_fibra", "waterjet"], cotizar: "Corte plasma" },
  router: { nombre: "router CNC", servicios: ["Corte CNC", "Fresado de madera"], maquinas: ["router"], cotizar: "Corte CNC" },
  maquinado_metal: { nombre: "maquinado", servicios: ["Fresado de metal", "Maquinado"], maquinas: ["fresadora", "router"], cotizar: "Maquinado" },
  torno: { nombre: "torno CNC", servicios: ["Maquinado"], maquinas: ["torno"], cotizar: "Maquinado" },
}

type ProductoMin = Parameters<typeof tipoProducto>[0] & { title?: string | null }

const texto = (v: unknown) => (typeof v === "string" ? v : "")
const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** Procesos con que se fabrica el producto (vacío si no aplica: servicios, herramientas, archivos sueltos sin pieza). */
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
  const metal = /alumin|acero|inox|lamina|metal|cobre|laton/.test(t)
  if (/impres|3d print|stl|pla\b|petg|resina/.test(t) && !/router|laser|plasma/.test(t)) return ["impresion_3d"]
  if (/torne|torno|flecha|buje/.test(t)) return ["torno", "maquinado_metal"]
  if (/celosi|letrero|corte|calad|acrilico|mdf|recort|silueta|plantilla|stencil/.test(t) || tipo === "corte")
    return metal ? ["corte_plasma", "corte_laser", "router"] : ["corte_laser", "router"]
  if (/tallad|relieve|3d|maquil|maquin|fresad|molde|madera|pino|parota/.test(t) || tipo === "tallado")
    return metal ? ["maquinado_metal", "router"] : ["router"]
  if (tipo === "a_medida") return metal ? ["maquinado_metal", "corte_plasma"] : ["router", "corte_laser"]
  return []
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
