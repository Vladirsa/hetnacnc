// Textos fijos de la tienda que seguían en español en /us (auditoría del 25 nov 2026,
// revisados con el navegador después de traducir). Los nombres de productos y los
// artículos son contenido de la tienda y no van aquí.
export const EN_UI_AUDITORIA: Record<string, string> = {
  // Inicio y tarjetas
  "Gratis": "Free",
  "Envío gratis desde": "Free shipping from",
  "Varios talleres": "Multiple shops",
  "Créditos": "Credits",
  "Más productos": "More products",
  "Máquinas, herramientas y materiales bajo cotización": "Machines, tools and materials on request",
  "Planos de muebles para taller": "Furniture plans for workshops",
  "HETNA en Latinoamérica, EUA y España": "HETNA in Latin America, the US and Spain",
  "Anúnciate en HETNA": "Advertise on HETNA",
  "Usamos cookies para que el sitio funcione y, con tu permiso, para estadísticas y anuncios.":
    "We use cookies to make the site work and, with your permission, for analytics and ads.",
  "Talleres y proveedores destacados": "Featured shops and suppliers",
  "Tu taller o tus materiales frente a quien está por mandar a fabricar.": "Your shop or your materials in front of people about to order a part.",
  "Ver la tienda por categorías →": "Browse the store by category →",
  "Máquinas, herramientas, materiales y diseños CNC de talleres de todo México. Compra dentro de HETNA o pide que te lo fabriquen.":
    "Machines, tools, materials and CNC designs from shops across Mexico. Buy on HETNA or have it made for you.",
  "Diseños": "Designs",
  "A tu medida": "Made to measure",
  "Muebles para armar": "Furniture to assemble",
  "¿Hablas español?": "Do you speak Spanish?",
  "Ver la app HETNA CNC en español": "See the HETNA CNC app in Spanish",
  // Cotizar
  "Sube tu archivo o escribe las medidas y ve un precio aproximado al instante. Si te conviene, pide propuestas: los talleres de la red te cotizan durante 7 días y tú eliges y pagas dentro de HETNA.":
    "Upload your file or enter the measurements and see an approximate price instantly. If it works for you, request proposals: shops in the network quote for 7 days and you choose and pay on HETNA.",
  "MB. El archivo se lee aquí en tu navegador; sólo se sube cuando pides propuestas.":
    "MB. The file is read here in your browser; it is only uploaded when you request proposals.",
  "Corte de MDF, triplay, acrílico, PVC, aluminio": "Cutting MDF, plywood, acrylic, PVC, aluminum",
  "MDF y acrílico delgados, grabado": "Thin MDF and acrylic, engraving",
  "Lámina y placa de acero, inoxidable, aluminio": "Steel, stainless and aluminum sheet and plate",
  "Láser de fibra": "Fiber laser",
  "Lámina metálica con acabado fino": "Sheet metal with a fine finish",
  "Piezas en PLA, PETG, ABS, resina": "Parts in PLA, PETG, ABS, resin",
  "Sube tu archivo o escribe las medidas y aquí aparece el estimado al instante.": "Upload your file or enter the measurements and the estimate appears here instantly.",
  "¿Necesitas diseño, grabado, producción por volumen o no tienes medidas? Llena la solicitud completa":
    "Need design, engraving, volume production, or don't have measurements? Fill out the full request",
  "📷 ¿No tienes archivo? Toma una foto o un boceto": "📷 No file? Take a photo or a sketch",
  "De la pieza que quieres copiar, de un dibujo a mano o de una referencia. La IA llena la solicitud por ti y tú la revisas antes de mandarla.":
    "Of the part you want to copy, a hand drawing or a reference. AI fills in the request for you and you review it before sending.",
  "Que HETNA elija por mí.": "Let HETNA choose for me.",
  "Cuando lleguen propuestas, te mandamos la que mejor equilibra precio, tiempo y cumplimiento del taller. Tú sólo confirmas y pagas.":
    "When proposals arrive, we send you the one with the best balance of price, lead time and shop reliability. You just confirm and pay.",
  "Talleres cerca de ti": "Shops near you",
  "Escribe tu código postal en el formulario y los ordenamos por cercanía.": "Enter your ZIP code in the form and we'll sort them by distance.",
  ": diseño + corte + entrega": ": design + cutting + delivery",
  "Diseño incluido": "Design included",
  "Envío a todo México": "Shipping across Mexico",
  "Cotizar con este taller": "Get a quote from this shop",
}

// Frases con números o lugares
export const REGLAS_UI_AUDITORIA: [RegExp, string][] = [
  [/^· (\d+) a (\d+) días$/, "· $1 to $2 days"],
]
