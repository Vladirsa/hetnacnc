// Nombres de capa para el CAM del cliente. Por dentro las capas dicen qué
// operación son (BARRENO_D8_P11_ARRIBA, RANURA_P8_ABAJO, CANTO_D8_P34...); al
// exportar se escriben con la plantilla que el cliente escoja. {d} = diámetro,
// {p} = profundidad (0 = pasado), {cara} = ARRIBA o ABAJO.
// Una capa con "@" trae el nombre que el cliente le puso al herraje.
export type PlantillasCapas = { corte: string; barrenoArriba: string; barrenoAbajo: string; ranura: string; canto: string }
export const CAPAS_INICIO: PlantillasCapas = {
  corte: "corte",
  barrenoArriba: "BARRENO_D{d}_P{p}_ARRIBA",
  barrenoAbajo: "BARRENO_D{d}_P{p}_ABAJO",
  ranura: "RANURA_P{p}_{cara}",
  canto: "CANTO_D{d}_P{p}",
}

const llenar = (pl: string, c: string, x: Record<string, string>) => (pl.trim() ? pl.trim().replace(/\{(d|p|cara)\}/g, (_, k: string) => x[k] ?? "") : c)

export function capaFinal(c: string, pl?: PlantillasCapas) {
  const at = c.indexOf("@")
  if (at >= 0) return c.slice(at + 1)
  if (!pl) return c
  if (c === "corte") return llenar(pl.corte, c, {})
  let m = /^BARRENO_D([\d_]+)_P([\d_]+)_(ARRIBA|ABAJO)$/.exec(c)
  if (m) return llenar(m[3] === "ARRIBA" ? pl.barrenoArriba : pl.barrenoAbajo, c, { d: m[1], p: m[2], cara: m[3] })
  m = /^RANURA_P([\d_]+)_(ARRIBA|ABAJO)$/.exec(c)
  if (m) return llenar(pl.ranura, c, { p: m[1], cara: m[2] })
  m = /^CANTO_D([\d_]+)_P([\d_]+)$/.exec(c)
  if (m) return llenar(pl.canto, c, { d: m[1], p: m[2] })
  return c
}
