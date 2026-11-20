// Acabados y procesos extra (estrategia 2.1, como SendCutSend pero con red de
// talleres): cada taller marca en su perfil qué acabados hace y, si quiere, un
// "precio desde". Las solicitudes que piden un acabado les llegan primero a
// los talleres que lo hacen (lib/difusion.ts).
//
// La misma lista vive en el portal del taller (apps/vendor/src/routes/perfil-taller)
// y en la tienda (apps/storefront/src/lib/hetna/acabados.ts).

export const ACABADOS_TALLER = [
  { clave: "pintura_electrostatica", nombre: "Pintura electrostática", busca: /electrost[aá]tic|polvo|powder/i },
  { clave: "pintura", nombre: "Pintura o barniz", busca: /pintura o barniz|\bbarniz|\blaca\b|\blaqueado|\bpintad|\bpintura\b(?! electro)/i },
  { clave: "lijado", nombre: "Lijado y pulido", busca: /lijad|pulid/i },
  { clave: "doblez", nombre: "Doblez de lámina", busca: /dobl[eé]z|doblad|plegad/i },
  { clave: "roscado", nombre: "Roscado / machuelado", busca: /roscad|machuel|cuerda/i },
  { clave: "grabado", nombre: "Grabado (láser o fresa)", busca: /grabad/i },
  { clave: "anodizado", nombre: "Anodizado / galvanizado", busca: /anodiz|galvaniz|zincad|niquelad|cromad/i },
  { clave: "soldadura", nombre: "Soldadura", busca: /soldad|soldar/i },
  { clave: "ensamble", nombre: "Ensamble", busca: /ensambl|armad/i },
] as const

export type ClaveAcabado = (typeof ACABADOS_TALLER)[number]["clave"]
export type AcabadoTaller = { clave: ClaveAcabado; precio?: string }

/** Acabados que pide el cliente, leídos del campo "acabado" y de su descripción. */
export function acabadosPedidos(acabado?: string | null, descripcion?: string | null): ClaveAcabado[] {
  const a = String(acabado || "")
  if (/sin acabado|no s[eé]/i.test(a) && !descripcion) return []
  const texto = `${/sin acabado|no s[eé]/i.test(a) ? "" : a} ${descripcion || ""}`
  return ACABADOS_TALLER.filter((x) => x.busca.test(texto)).map((x) => x.clave)
}

/** Lo que el taller guardó en su perfil, limpio. */
export function acabadosDelPerfil(perfil: any): AcabadoTaller[] {
  const lista = Array.isArray(perfil?.acabados) ? perfil.acabados : []
  const validas = new Set<string>(ACABADOS_TALLER.map((x) => x.clave))
  return lista
    .map((x: any) => (typeof x === "string" ? { clave: x } : x))
    .filter((x: any) => x && validas.has(x.clave))
    .map((x: any) => ({ clave: x.clave, ...(x.precio ? { precio: String(x.precio).slice(0, 40) } : {}) }))
}

/** ¿El taller hace todos los acabados que pide el cliente? (sin acabados pedidos: false) */
export function haceAcabados(perfil: any, pedidos: ClaveAcabado[]): boolean {
  if (!pedidos.length) return false
  const suyos = new Set(acabadosDelPerfil(perfil).map((x) => x.clave))
  return pedidos.every((c) => suyos.has(c))
}
