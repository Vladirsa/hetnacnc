// Portada del inicio. Si hay imágenes activas en el panel de publicidad (espacio "carrusel principal"),
// se muestran ellas; si no hay ninguna, se muestra el carrusel de texto de siempre.
import { piezasDe } from "@/lib/publicidad/consultas"

import HeroSliderClasico from "./HeroSliderClasico"
import HeroConImagenes from "./publicidad/HeroConImagenes"

export default async function HeroSliderOptimizado() {
  const piezas = await piezasDe("carrusel_principal")
  return piezas.length > 0 ? <HeroConImagenes piezas={piezas} /> : <HeroSliderClasico />
}
