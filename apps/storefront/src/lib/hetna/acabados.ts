// Acabados que hace cada taller (estrategia 2.1). Misma lista que
// packages/api/src/lib/acabados.ts y apps/vendor/src/routes/perfil-taller.
export const NOMBRE_ACABADO: Record<string, string> = {
  pintura_electrostatica: "Pintura electrostática",
  pintura: "Pintura o barniz",
  lijado: "Lijado y pulido",
  doblez: "Doblez de lámina",
  roscado: "Roscado / machuelado",
  grabado: "Grabado (láser o fresa)",
  anodizado: "Anodizado / galvanizado",
  soldadura: "Soldadura",
  ensamble: "Ensamble",
}

export type AcabadoTaller = { clave: string; nombre: string; precio?: string }

export function leerAcabados(v: unknown): AcabadoTaller[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === "string" ? { clave: x } : (x as { clave?: string; precio?: string })))
    .filter((x): x is { clave: string; precio?: string } => !!x && typeof x.clave === "string" && x.clave in NOMBRE_ACABADO)
    .map((x) => ({ clave: x.clave, nombre: NOMBRE_ACABADO[x.clave], ...(x.precio ? { precio: String(x.precio).slice(0, 40) } : {}) }))
}
