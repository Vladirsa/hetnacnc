// Los servicios que el cliente puede pedir en una solicitud. Es la misma
// lista para el formulario y para los filtros del tablero de trabajos: el
// backend compara el texto literal contra el perfil de cada taller, así que
// si las dos listas se separan, un filtro deja de encontrar nada.
export const SERVICIOS_SOLICITUD = [
  "Corte CNC",
  "Corte láser",
  "Corte plasma",
  "Grabado",
  "Fresado de madera",
  "Fresado de metal",
  "Maquinado",
  "Impresión 3D",
  "Diseño CAD/CAM",
  "Otro",
]
