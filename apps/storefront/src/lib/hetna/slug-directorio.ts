// Slug de los perfiles no reclamados del directorio (/talleres/directorio/<slug>).
//
// El slug sale del `id` de la fila en la hoja de prospectos, que casi siempre es
// un dominio ("maquinados.com.mx") pero a veces es una liga de Facebook o
// Instagram ("facebook.com/p/Dispro-Impresión-HD-…"). La regla vieja sólo
// cambiaba los puntos por guiones, así que esas ligas dejaban diagonales y
// acentos en el slug; la ruta tiene un solo segmento ([slug]) y esos perfiles
// respondían 404 aunque estaban en el mapa del sitio (revisión del 24 nov 2026).
//
// Regla: minúsculas, sin acentos, sólo letras a-z, números y guiones sueltos.
// Es idempotente (slugDirectorio(slugDirectorio(x)) === slugDirectorio(x)) y
// para los dominios da lo mismo que la regla vieja, así que sus URLs no cambian.
// Las que sí cambian se redirigen con 301 en middleware.ts.
//
// La misma función vive en los nodos Code de n8n, que no pueden importar
// archivos: scripts/prospectos/n8n/directorio/comun.js y directorio_publico.js
// (slugDe). Una prueba (packages/api/src/lib/__tests__/slug-directorio.unit.spec.ts)
// revisa que las tres copias den lo mismo.

export const LARGO_MAXIMO_SLUG = 120

export function slugDirectorio(id: unknown): string {
  return String(id ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LARGO_MAXIMO_SLUG)
    .replace(/-+$/, "")
}

const FORMA_VALIDA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** ¿La ruta /talleres/directorio/[slug] puede servir este slug tal cual? */
export function esSlugDirectorio(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length <= LARGO_MAXIMO_SLUG && FORMA_VALIDA.test(slug)
}
