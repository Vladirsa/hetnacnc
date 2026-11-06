// Opciones del formulario de fabricación. Viven aparte porque las usan el
// formulario y la página /fabricacion (sus botones abren el formulario ya
// con la necesidad elegida: /cotizar?necesidad=...).

// Lo que el cliente quiere lograr, en sus palabras. No es el proceso: quien
// necesita "una pieza terminada" no tiene por qué saber si es láser o router.
export const NECESIDADES = [
  { valor: "Cortar piezas", detalle: "Tengo el diseño, necesito que lo corten" },
  { valor: "Grabar o marcar", detalle: "Logotipos, letreros, números de serie" },
  { valor: "Pieza terminada", detalle: "Cortada, con acabado y lista para usar" },
  { valor: "Diseño", detalle: "No tengo plano, necesito que me lo dibujen" },
  { valor: "Prototipo", detalle: "Una o pocas piezas para probar una idea" },
  { valor: "Producción por volumen", detalle: "Cientos de piezas o pedidos que se repiten" },
] as const

// Qué tiene el cliente para mostrar la pieza. Decide si se le pide archivo.
export const TIENE_ARCHIVO = [
  { valor: "Tengo archivo profesional", detalle: "DXF, DWG, SVG, AI, STL, STEP…", pideArchivo: true },
  { valor: "Tengo boceto o foto", detalle: "Un dibujo a mano o fotos de la pieza", pideArchivo: true },
  { valor: "Tengo idea o referencia", detalle: "Una imagen de internet o una pieza parecida", pideArchivo: true },
  { valor: "No tengo archivo, necesito diseño", detalle: "Lo describes y un diseñador lo prepara", pideArchivo: false },
] as const

export const ACABADOS = [
  "Sin acabado (tal como sale de la máquina)",
  "Lijado",
  "Pintura o barniz",
  "Pintura electrostática",
  "Anodizado / galvanizado",
  "Ensamble",
  "No sé, que me recomienden",
]

export const EXTENSIONES_ARCHIVO = [
  ".dxf", ".dwg", ".svg", ".ai", ".eps", ".pdf", ".cdr",
  ".stl", ".step", ".stp", ".iges", ".igs", ".3mf", ".obj", ".f3d", ".skp",
  ".png", ".jpg", ".jpeg", ".webp", ".heic",
  ".zip", ".rar", ".7z",
]
// Subida directa a Backblaze desde el navegador (lib/subir-archivo): 500 MB.
// Si la directa falla, se sube por el servidor, que admite hasta 50 MB.
export const MAX_MB_ARCHIVO = 500
export const MAX_MB_ARCHIVO_SERVIDOR = 50
export const MAX_ARCHIVOS = 5

// Tolerancia que pide el cliente (Licitaciones 2.0). "Normal" basta para casi
// todo en router, láser y plasma; las finas encarecen y no todos las dan.
export const TOLERANCIAS = [
  "Normal (±0.5 mm)",
  "Fina (±0.1 mm)",
  "Precisión (±0.05 mm o menos)",
  "No sé, que me recomienden",
]
