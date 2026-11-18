// Dominios cuyas fotos pasan por el optimizador de imágenes de Next
// (auditoría de seguridad del 18 nov 2026).
//
// Antes el optimizador aceptaba fotos de CUALQUIER dominio https: se podía usar
// hetnacnc.com/_next/image para bajar y reprocesar archivos de cualquier sitio
// a costa del servidor. Ahora sólo optimiza los propios; las fotos de otros
// dominios (p. ej. una liga externa que guardó el importador) se muestran tal
// cual, sin optimizar, en lugar de romperse.
//
// Para agregar uno: NEXT_PUBLIC_IMAGENES_DOMINIOS=dominio1,dominio2 en el .env
// de la tienda y volver a construir.
export const DOMINIOS_IMAGENES: string[] = [
  "hetnacnc.com",
  "www.hetnacnc.com",
  "hetnacnc.s3.us-west-004.backblazeb2.com",
  ...(process.env.NEXT_PUBLIC_IMAGENES_DOMINIOS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
]
