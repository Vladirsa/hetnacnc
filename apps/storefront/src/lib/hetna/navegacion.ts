// Datos del menú principal (auditoría del 13 nov 2026, problema 5: navegación
// demasiado extensa). Una sola fuente para la barra de computadora y el menú
// de celular.
//
// Menú principal de cinco secciones: Categorías (tienda), Fabricación (por
// tipo de proceso), Herramientas CNC, Talleres y Foro CNC. Más dos accesos
// rápidos: cotizar un trabajo y vender en HETNA.

export type EnlaceMenu = { texto: string; href: string; detalle?: string }
export type GrupoMenu = { titulo: string; enlaces: EnlaceMenu[] }

// Fabricación por tipo de proceso: cada enlace lleva a la página del servicio
// (talleres y trabajos abiertos) o a su guía.
export const FABRICACION: GrupoMenu[] = [
  {
    titulo: "Corte",
    enlaces: [
      { texto: "Corte láser", href: "/categories/corte-laser" },
      { texto: "Router CNC", href: "/cnc/taller-router-cnc-mexico" },
      { texto: "Corte plasma", href: "/categories/corte-plasma" },
    ],
  },
  {
    titulo: "Maquinado",
    enlaces: [
      { texto: "Maquinado CNC", href: "/categories/maquinado-cnc" },
      { texto: "Torneado CNC", href: "/categories/torneado-cnc" },
      { texto: "4 y 5 ejes", href: "/categories/maquinado-4-y-5-ejes" },
      { texto: "Aluminio", href: "/cnc/maquinado-cnc-aluminio" },
    ],
  },
  {
    titulo: "Impresión 3D y producción",
    enlaces: [
      { texto: "Impresión 3D", href: "/categories/impresion-3d" },
      { texto: "Prototipos", href: "/categories/prototipado" },
      { texto: "Maquila por lotes", href: "/categories/maquila" },
    ],
  },
  {
    titulo: "Diseño y CAM",
    enlaces: [
      { texto: "Diseño 2D y 3D", href: "/categories/diseno-2d-3d" },
      { texto: "Programación CAM", href: "/categories/programacion-cam" },
      { texto: "Archivos DXF", href: "/cnc/archivos-dxf-router-cnc" },
    ],
  },
]

// Pie del menú de Fabricación
export const FABRICACION_EXTRA: EnlaceMenu[] = [
  { texto: "Cómo funciona", href: "/fabricacion" },
  { texto: "Trabajos abiertos", href: "/trabajos" },
  { texto: "Guías CNC", href: "/cnc" },
]

// Accesos rápidos (arriba del menú de celular)
export const ACCESOS_RAPIDOS: EnlaceMenu[] = [
  { texto: "Cotizar un trabajo", href: "/cotizar", detalle: "Recibe propuestas de talleres" },
  { texto: "Precio al instante", href: "/cotizar/corte-laser", detalle: "Láser, router, plasma y 3D" },
  { texto: "Calculadora CNC", href: "/calculadora-cnc", detalle: "Avance y RPM" },
]
