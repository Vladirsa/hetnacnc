// Formatos de los diseños digitales y con qué programas se abren.
// Sirve en servidor y navegador. Lo de los programas es del formato, no del
// producto: un DXF se abre en cualquier programa que lea DXF, así que decirlo
// es cierto para todos los archivos de ese tipo.

export const PROGRAMAS: Record<string, string[]> = {
  DXF: ["VCarve / Aspire", "Fusion 360", "LightBurn", "AutoCAD", "Inkscape"],
  SVG: ["LightBurn", "VCarve / Aspire", "Inkscape", "Illustrator"],
  STL: ["Cura", "PrusaSlicer", "Bambu Studio", "Fusion 360"],
  "3MF": ["Bambu Studio", "PrusaSlicer", "Cura"],
  STEP: ["Fusion 360", "SolidWorks", "FreeCAD"],
  OBJ: ["Blender", "Fusion 360", "Cura"],
  CRV: ["VCarve / Aspire"],
  NC: ["Tu controlador (G-code)"],
}

const CONOCIDOS = Object.keys(PROGRAMAS)

/** Formatos del producto: de metadata.formatos y, si no viene, del título o del handle ("…-stl-3mf"). */
export function formatosDe(p: { title?: string | null; handle?: string | null; metadata?: Record<string, unknown> | null }): string[] {
  const m = (p.metadata || {}) as Record<string, unknown>
  const crudo = Array.isArray(m.formatos) ? m.formatos.join(" ") : typeof m.formatos === "string" ? m.formatos : ""
  const texto = (crudo || `${p.title || ""} ${(p.handle || "").replace(/-/g, " ")}`).toUpperCase()
  const halla = CONOCIDOS.filter((f) => new RegExp(`(^|[^A-Z0-9])${f}([^A-Z0-9]|$)`).test(texto))
  // STP es lo mismo que STEP
  if (/(^|[^A-Z0-9])STP([^A-Z0-9]|$)/.test(texto) && !halla.includes("STEP")) halla.push("STEP")
  return halla
}

/** Programas que abren esos formatos, sin repetir (máximo `max`). */
export function programasPara(formatos: string[], max = 6): string[] {
  return [...new Set(formatos.flatMap((f) => PROGRAMAS[f] || []))].slice(0, max)
}
