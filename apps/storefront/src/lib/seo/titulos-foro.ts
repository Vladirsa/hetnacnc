// Títulos para Google (<title>) de temas del foro que tienen búsquedas
// concretas en Search Console. El título visible del tema (h1) no cambia: sólo
// lo que sale en el resultado de Google. Clave: slug del tema.
//
// Cómo agregar uno: el reporte «SEO semanal» de Telegram dice qué búsqueda le
// falta al título; aquí se escribe con esas palabras al inicio y sin pasar de
// ~60 caracteres (Google corta lo demás).
export const TITULOS_SEO_FORO: Record<string, string> = {
  // 27 nov 2026: «g97 cnc» (pos 10.8), «g96 cnc» (17.4), «g97 torno cnc» (7.7), «g96 y g97 cnc» (8.8)
  "torno-cnc-cuando-usar-g96-y-cuando-g97": "G96 y G97 en torno CNC: diferencia y cuándo usar cada uno",
}
