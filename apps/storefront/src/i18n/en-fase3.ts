// Fase 3 del inglés: catálogo (productos y categorías).
// Los nombres de categoría ya llegan en inglés (i18n/datos.ts), así que las
// plantillas que los usan se traducen con reglas y no frase por frase.
// Las frases exactas del diccionario ganan a estas reglas.
export const EN_FASE3: Record<string, string> = {
  // Conteos de /categories (components/hetna/explorar)
  "taller": "shop",
  "diseño": "design",
  "diseños": "designs",
  "producto publicado": "product listed",
  "productos publicados": "products listed",
  "Próximamente": "Coming soon",
}

export const REGLAS_FASE3: [RegExp, string][] = [
  [/^(.+) en México: cotiza con talleres CNC$/, "$1 in Mexico: Get Quotes from CNC Shops"],
  [
    /^(.+) con talleres CNC de todo México\. Describe tu pieza, recibe propuestas y paga seguro en (.+)\.$/,
    "$1 with CNC shops across Mexico. Describe your part, get proposals and pay securely on $2.",
  ],
  [/^Compra (.+) en (.+): precios en pesos y envío a todo México\.$/, "Buy $1 on $2: prices in pesos and shipping across Mexico."],
  [/^Categoría (.+) - (.+)$/, "$1 category - $2"],
  // Conteos y precios de la tienda (components/hetna/tienda/piezas.tsx)
  [/^1 producto$/, "1 product"],
  [/^(\d+) productos$/, "$1 products"],
  [/^1 servicio$/, "1 service"],
  [/^(\d+) servicios$/, "$1 services"],
  [/^1 paquete$/, "1 package"],
  [/^(\d+) paquetes$/, "$1 packages"],
  [/^Desde \$0 · hay gratis$/, "From $$0 · some are free"],
  [/^Desde (\$[\d,.]+)$/, "From $1"],
]
