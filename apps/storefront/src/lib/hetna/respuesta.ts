// Tiempo de respuesta del taller en texto corto (sin dependencias: se usa en
// componentes de cliente y de servidor).

/** "40 min", "3 h", "2 días" */
export const textoRespuesta = (h: number) =>
  h < 1 ? `${Math.max(5, Math.round((h * 60) / 5) * 5)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} días`
