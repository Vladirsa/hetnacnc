// "Mándamelo por correo" de las herramientas del Estudio (/disenar/*): quien
// diseña algo y se iría sin dejar contacto puede mandarse su archivo (DXF) y
// el precio aproximado para que se lo corten. Con su permiso entra al
// Reactivador de estimados (lib/estimados.ts): seguimiento a los 2 y 7 días.
//
// El archivo lo arma el navegador; aquí sólo se acepta un DXF de texto, con
// tope de tamaño y nombre puesto por el servidor, y nunca en las herramientas
// cuya descarga se paga con créditos (el correo no puede regalar el archivo).
import { STORE_URL, boton, esc, marco } from "./licitacion"
import type { PrecioDesglosado } from "./precio-instantaneo"

/**
 * slug → [nombre, descarga de pago]. Copia de HERRAMIENTAS_DISENO del
 * storefront (src/lib/hetna/disenar.ts); la prueba revisa que no se separen.
 * "De pago" incluye las que cobran la descarga con créditos aunque abrir la
 * herramienta sea gratis.
 */
export const HERRAMIENTAS: Record<string, [string, boolean]> = {
  "caja-con-juntas": ["Caja con juntas de dedo", false],
  "letras-3d": ["Letras 3D en caja", false],
  letreros: ["Letreros y nombres", false],
  llaveros: ["Llaveros y placas con nombre", false],
  texturizador: ["Texturizador para impresión 3D", false],
  rompecabezas: ["Rompecabezas", false],
  vectorizador: ["Vectorizador de imágenes", false],
  "muebles-desde-imagen": ["Mueble desde una imagen", true],
  "costillas-desde-imagen": ["Costillas desde imagen", false],
  "molduras-tallados": ["Molduras y tallados", true],
  "muebles-ensamble": ["Muebles de ensamble sin tornillos", true],
  "despiece-muebles": ["Cocina y muebles de melamina a la medida", true],
  "plantillas-empaque": ["Plantillas de empaque", false],
  "grabado-foto": ["Foto para grabado láser", false],
  "litofania-relieve": ["Litofanías y relieves 3D", false],
  "patrones-radiales": ["Patrones radiales", false],
  convertidor: ["Convertidor y reescalador", false],
  "partir-3d": ["Partir modelo 3D", false],
  "moldes-3d": ["Generador de moldes 3D", false],
  "modelos-3d": ["Modelos 3D a tu medida", false],
  "svg-a-stl": ["SVG o DXF a STL", false],
  "anidado-piezas": ["Anidado de piezas", false],
  celosias: ["Celosías y paneles decorativos", false],
  "celosia-desde-imagen": ["Celosía desde imagen", false],
  "patron-voronoi": ["Patrón Voronoi", false],
  "bisagra-viva": ["Bisagra viva (madera flexible)", false],
  "codigo-qr": ["Código QR para grabar", false],
  "rebanado-capas": ["Rebanado en capas (3D a 2D)", false],
  engranes: ["Engranes", false],
  relojes: ["Relojes de pared", false],
  "organizador-cajon": ["Organizadores de cajón", false],
  "lamparas-capas": ["Lámparas por capas", false],
  "estencil-letras": ["Esténcil de letras", false],
  "marcos-portarretratos": ["Marcos y portarretratos", false],
  "esferas-navidad": ["Esferas navideñas con nombre", false],
  "imagen-a-3d": ["Imagen a 3D con IA", true],
}

export const nombreHerramienta = (slug?: string | null) => (slug && HERRAMIENTAS[slug]?.[0]) || "tu diseño"
export const urlHerramienta = (slug: string) => `${STORE_URL}/mx/disenar/${slug}`

/** Tope del DXF adjunto (caracteres): cabe en el límite de las Server Actions de Next (1 MB). */
export const DXF_MAX = 700_000
// DXF de texto: grupos "0 / SECTION" al principio y sólo caracteres imprimibles
// (latin-1 para nombres de capa con acento)
const PARECE_DXF = /^\s*0\r?\n\s*SECTION\r?\n/
const SOLO_TEXTO = /^[\t\r\n\x20-\x7E -ÿ]*$/
export const esDxf = (s: string) => s.length > 20 && s.length <= DXF_MAX && PARECE_DXF.test(s) && SOLO_TEXTO.test(s) && /\n\s*EOF\s*$/.test(s)

const SERVICIOS_PRECIO = ["laser_co2", "plasma", "router", "impresion_3d", "fibra", "oxicorte", "waterjet"]

export type PedidoHerramienta = {
  email: string
  nombre: string | null
  herramienta: string
  /** nombre del archivo (sin extensión), ya limpio */
  archivo: string
  dxf: string | null
  /** para el precio (vocabulario de /store/precio-instantaneo); null si la herramienta no lo sabe */
  precio: { servicio: string; material?: string; calibre?: string; ancho: number; largo: number; cantidad: number; corte_mm?: number; perforaciones?: number } | null
  /** texto del trabajo que guarda la tabla de estimados (p. ej. "Corte láser") */
  servicio: string
}

const corto = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

export function validarHerramientaCorreo(b: Record<string, unknown>): { ok: true; datos: PedidoHerramienta } | { ok: false; mensaje: string } {
  if (b.acepta !== true) return { ok: false, mensaje: "Marca la casilla para que te mandemos tu diseño." }
  const email = corto(b.email, 160).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, mensaje: "Revisa tu correo." }
  const herramienta = corto(b.herramienta, 60)
  const h = HERRAMIENTAS[herramienta]
  if (!h) return { ok: false, mensaje: "No reconocimos la herramienta. Recarga la página." }
  let dxf: string | null = null
  if (b.dxf != null && b.dxf !== "") {
    if (h[1]) return { ok: false, mensaje: "El archivo de esta herramienta se baja desde la página." }
    if (typeof b.dxf !== "string" || !esDxf(b.dxf)) return { ok: false, mensaje: "El archivo es muy grande para mandarlo por correo. Descárgalo desde la página." }
    dxf = b.dxf
  }
  const archivo = corto(b.archivo, 60).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || herramienta
  let precio: PedidoHerramienta["precio"] = null
  const p = b.precio as Record<string, unknown> | null | undefined
  if (p && typeof p === "object" && SERVICIOS_PRECIO.includes(String(p.servicio))) {
    const cm = (v: unknown) => Math.min(10000, Math.max(0, Number(v) || 0))
    const ancho = cm(p.ancho), largo = cm(p.largo)
    if (ancho > 0 && largo > 0)
      precio = {
        servicio: String(p.servicio),
        material: p.material ? corto(p.material, 80) : undefined,
        calibre: p.calibre ? corto(p.calibre, 80) : undefined,
        ancho,
        largo,
        cantidad: Math.min(10000, Math.max(1, Math.round(Number(p.cantidad) || 1))),
        corte_mm: Number(p.corte_mm) > 0 ? Math.min(5_000_000, Number(p.corte_mm)) : undefined,
        perforaciones: Number(p.perforaciones) > 0 ? Math.min(100_000, Math.round(Number(p.perforaciones))) : undefined,
      }
  }
  return {
    ok: true,
    datos: { email, nombre: corto(b.nombre, 120) || null, herramienta, archivo, dxf, precio, servicio: corto(b.servicio, 60) || h[0] },
  }
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`
const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.6">${t}</p>`

/** Liga a Fabrícamelo con la herramienta y el trabajo ya escritos. */
export function ligaFabricar(d: { herramienta: string; servicio?: string | null; material?: string | null }, campana: string) {
  const q = new URLSearchParams({
    desde: "herramienta",
    pieza: `${nombreHerramienta(d.herramienta)}${d.material ? ` en ${d.material}` : ""}`,
    ...(d.material ? { material: String(d.material) } : {}),
    utm_source: "correo",
    utm_medium: "herramienta",
    utm_campaign: campana,
  })
  return `${STORE_URL}/mx/cotizar?${q.toString()}`
}

export function correoHerramientaHtml(d: PedidoHerramienta, precio: Pick<PrecioDesglosado, "minimo" | "maximo"> | null) {
  const nombre = nombreHerramienta(d.herramienta)
  const hola = d.nombre ? `Hola ${esc(d.nombre.split(" ")[0])},` : "Hola,"
  const piezas = d.precio && d.precio.cantidad > 1 ? ` (${d.precio.cantidad} piezas)` : ""
  return {
    asunto: d.dxf ? `Tu archivo de ${nombre} — HETNA CNC` : `Tu diseño de ${nombre} — HETNA CNC`,
    html: marco(
      d.dxf ? "Aquí está tu archivo" : "Tu diseño te espera",
      p(hola) +
        p(
          d.dxf
            ? `Te mandamos adjunto <b>${esc(d.archivo)}.dxf</b>, el diseño que hiciste en <b>${esc(nombre)}</b>. Ábrelo en tu programa de corte o en el CAM de HETNA.`
            : `Guardamos el enlace a <b>${esc(nombre)}</b> para que vuelvas a tu diseño cuando quieras.`
        ) +
        (precio
          ? p(`<b>¿Te lo cortamos?</b> Hacerlo en ${esc(d.precio?.material || "el material que elegiste")}${piezas} cuesta aprox. <b>${pesos(precio.minimo)} a ${pesos(precio.maximo)}</b> + IVA, con material. Talleres verificados te mandan su precio final y tú eliges.`)
          : p("<b>¿No tienes máquina?</b> Un taller de HETNA te lo fabrica: mándanos tu archivo y te llegan propuestas sin costo."))
        + boton("Que me lo fabriquen", ligaFabricar({ herramienta: d.herramienta, servicio: d.servicio, material: d.precio?.material }, "herramienta_envio")) +
        `<p style="margin:16px 0 0"><a href="${esc(urlHerramienta(d.herramienta))}?utm_source=correo&utm_medium=herramienta&utm_campaign=herramienta_envio" style="color:#C2560A;font-weight:700">Volver a ${esc(nombre)} →</a></p>` +
        `<p style="margin:16px 0 0;color:#6B675C;font-size:13px">Te escribimos un par de veces más por si necesitas ayuda para fabricarlo. Puedes darte de baja con la liga de abajo.</p>`
    ),
  }
}
