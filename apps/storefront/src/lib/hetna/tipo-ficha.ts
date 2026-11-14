// Qué es un producto, para que su ficha diga exactamente lo que el cliente
// recibe (auditoría de mejoras del 14 nov 2026, tarea 2):
//
//   servicio  revisión CAM, programación CAM, posprocesador, diseño… Se marca
//             con metadata.producto_servicio (o es_servicio, o hetna_cam_service).
//   digital   archivo que se descarga (DXF, STL…). metadata.producto_digital,
//             la etiqueta "digital" o el tipo "digital".
//   fisico    todo lo demás: lleva existencias, envío y tiempo de entrega.
//
// Va en este orden porque los servicios CAM también traen la etiqueta
// "digital" (se entregan en línea), pero no son una descarga inmediata.

type ProductoParaTipo = {
  metadata?: Record<string, unknown> | null
  tags?: { value?: string | null }[] | null
  type?: { value?: string | null } | null
}

export type TipoFicha = "digital" | "servicio" | "fisico"

const si = (v: unknown) => v === true || v === "true" || v === "1"

export function tipoFicha(p: ProductoParaTipo | null | undefined): TipoFicha {
  const m = (p?.metadata || {}) as Record<string, unknown>
  if (si(m.producto_servicio) || si(m.es_servicio) || typeof m.hetna_cam_service === "string") return "servicio"
  const tipo = String(p?.type?.value || "").toLowerCase()
  if (si(m.producto_digital) || tipo.includes("digital") || (p?.tags || []).some((t) => String(t?.value || "").toLowerCase() === "digital"))
    return "digital"
  return "fisico"
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "")
const lista = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => texto(x)).filter(Boolean)
    : texto(v)
        .split(/\n|;/)
        .map((s) => s.trim())
        .filter(Boolean)

// ---------------------------------------------------------------- digital

export type DatosDigital = { filas: [string, string][]; licencia: string }

const LICENCIA =
  "Para tu uso: puedes cortar o imprimir las piezas que necesites. No se permite revender ni compartir el archivo. Si lo quieres para producir y vender piezas en serie, escríbenos antes de comprar."

/** Lo que trae el archivo. Sólo salen los datos que el producto tiene cargados. */
export function datosDigital(metadata?: Record<string, unknown> | null): DatosDigital {
  const m = metadata || {}
  const filas: [string, string][] = []
  const agrega = (etiqueta: string, ...claves: string[]) => {
    for (const k of claves) {
      const v = texto(m[k])
      if (v) {
        filas.push([etiqueta, v])
        return
      }
    }
  }
  agrega("Formatos incluidos", "formatos")
  agrega("Medidas", "medidas", "dimensiones")
  agrega("Material sugerido", "material_sugerido", "material")
  agrega("Grosor recomendado", "grosor", "espesor")
  agrega("Máquina", "maquina", "maquina_sugerida")
  return { filas, licencia: texto(m.licencia) || LICENCIA }
}

// ---------------------------------------------------------------- servicio

export type DatosServicio = {
  /** Dónde se empieza el servicio, si no es con el botón de compra */
  empezar?: { texto: string; href: string }
  incluye: string[]
  noIncluye: string[]
  entregables: string[]
  tiempo: string
  necesitas: string[]
  pasos: string[]
}

// Lo que ya es cierto de los servicios CAM (scripts/seed-cam-services.ts del
// API y el Laboratorio CAM). El plazo NO se inventa: si el producto no trae
// metadata.tiempo_entrega, la ficha dice que se confirma por escrito.
const CAM: Record<string, Partial<DatosServicio>> = {
  cam_3: {
    incluye: ["Trayectorias de desbaste y acabado en 3 ejes", "Verificación de zanco y portaherramienta", "Simulación del programa"],
    entregables: ["G-code listo para tu controlador"],
  },
  cam_4: {
    incluye: ["Trayectoria en espiral o por líneas con eje A", "Desbaste por niveles", "Giro continuo calculado para tu máquina"],
    entregables: ["G-code para tu máquina con eje rotativo"],
  },
  cam_5: {
    incluye: ["Orientación continua de la herramienta", "Anticolisión automática", "Límites de ejes rotativos y coordenadas de máquina con tu pivote o TCP"],
    entregables: ["G-code de 5 ejes simultáneos para tu máquina"],
  },
  post: {
    incluye: ["Posprocesador para Fusion 360 o Vectric", "Hecho para tu cinemática y tu controlador", "Tus códigos de cambio de herramienta y refrigerante"],
    entregables: ["Archivo del posprocesador listo para instalar"],
    necesitas: ["Marca y modelo de tu controlador (Mach3, Mach4, LinuxCNC, GRBL, Fanuc, Haas, Siemens, Heidenhain…)", "Un programa de ejemplo que ya funcione en tu máquina, si lo tienes"],
  },
  review: {
    incluye: ["Revisión manual de trayectorias", "Revisión de límites, cero de pieza y sujeción"],
    entregables: ["Recomendaciones por escrito"],
    necesitas: ["Tu programa (G-code) y el modelo de la pieza"],
  },
}

const NECESITAS_CAM = [
  "El modelo de tu pieza (STEP, STL u OBJ)",
  "Los datos de tu máquina: controlador, recorridos y herramientas",
  "El material y las medidas del bloque",
]
// Así funciona hoy: el trabajo se arma en el Laboratorio CAM y de ahí pasa al
// carrito con este servicio (API: workflows/cam/add-cam-job-to-cart).
const PASOS_CAM = [
  "Sube tu pieza y configura tu máquina en el Laboratorio CAM (hetnacnc.com/mx/cam/lab).",
  "Elige este servicio y paga.",
  "Un especialista prepara tus archivos.",
  "Los descargas en Mi cuenta › Mis trabajos CAM.",
]
const NO_INCLUYE_CAM = ["Fabricación de la pieza", "Material ni herramientas", "Visita o ajuste en tu taller"]

export function datosServicio(metadata?: Record<string, unknown> | null): DatosServicio {
  const m = metadata || {}
  const base = CAM[texto(m.hetna_cam_service)] || {}
  const esCam = Boolean(texto(m.hetna_cam_service))
  const de = (clave: string, respaldo: string[] = []) => {
    const l = lista(m[clave])
    return l.length ? l : respaldo
  }
  return {
    empezar: esCam ? { texto: "Empieza en el Laboratorio CAM: sube tu pieza y configura tu máquina", href: "/cam/lab" } : undefined,
    incluye: de("incluye", base.incluye),
    noIncluye: de("no_incluye", base.noIncluye || (esCam ? NO_INCLUYE_CAM : [])),
    entregables: de("entregables", base.entregables),
    tiempo: texto(m.tiempo_entrega) || "Te confirmamos el plazo por escrito antes de empezar, según tu pieza.",
    necesitas: de("necesitas", base.necesitas || (esCam ? NECESITAS_CAM : [])),
    pasos: de("pasos", esCam ? PASOS_CAM : []),
  }
}
