// Empresas del directorio (perfiles públicos que armó el buscador, aún no
// registradas en HETNA) que ofrecen el servicio de una guía en una ciudad.
//
// Por qué (25 nov 2026, Search Console): Google ya muestra el sitio para
// "cnc router monterrey", "plasma cnc monterrey", "cnc router puebla"... pero
// las páginas /cnc/<guía>/<ciudad> estaban en noindex porque sólo contaban los
// talleres registrados (sólo Tlaxcala y Toluca se indexaban). Con al menos
// MIN_DIRECTORIO empresas reales del servicio en el estado, la página ya no es
// una "puerta" vacía: las lista con liga a su perfil (donde se pide cotización).
import { directorioMexico, type EmpresaDirectorio } from "@/lib/hetna/directorio"
import { enCiudad, type Ciudad, type Guia } from "@/lib/seo/guias"

export const MIN_DIRECTORIO = 3

// Qué palabras de su nombre o servicios cuentan para cada guía con ciudades
const CLAVES: Record<string, RegExp> = {
  "taller-router-cnc-mexico": /router|fresad|pantograf|mdf|madera|carpinter|maquinad/,
  "corte-laser-mdf": /laser/,
  "corte-laser-acrilico": /laser/,
  "corte-plasma": /plasma|oxicorte/,
  "impresion-3d": /impresion 3d|impresora 3d|impresiones 3d|3d print|filamento/,
}

const simple = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

export async function directorioDeGuia(g: Guia, c: Ciudad): Promise<EmpresaDirectorio[]> {
  const clave = CLAVES[g.slug]
  if (!clave) return []
  const todas = await directorioMexico().catch(() => [] as EmpresaDirectorio[])
  return todas
    .filter((e) => e.tipo === "taller" && enCiudad(c, e.estado, e.ciudad))
    .filter((e) => clave.test(simple(`${e.empresa} ${e.servicios || ""} ${e.segmento || ""}`)))
    // Primero las que dicen la ciudad (no sólo el estado)
    .sort((a, b) => Number(enCiudad(c, "", b.ciudad)) - Number(enCiudad(c, "", a.ciudad)) || a.empresa.localeCompare(b.empresa))
}
