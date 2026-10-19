// Inserta un bloque de datos estructurados (JSON-LD) en la página.
// Se usa <script> normal (no next/script) para que salga en el HTML inicial
// y Google lo lea sin esperar a que cargue el JavaScript.

import { textoJsonLd } from "@/lib/hetna/schema"

export function JsonLd({ datos, id }: { datos: unknown; id?: string }) {
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: textoJsonLd(datos) }} />
}
