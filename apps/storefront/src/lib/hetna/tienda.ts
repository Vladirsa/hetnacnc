// La tienda (/mx/tienda): categorías con conteos y precios "desde" calculados
// en el momento desde los productos publicados. Nada de números escritos a mano.
//
// Cada producto cae en UNA sola categoría, así que la suma de los conteos es
// igual al total de productos publicados:
//   creditos-3d          metadata.producto_creditos_3d (se pagan en /user/creditos)
//   servicios-cam        servicios (lib/hetna/tipo-ficha.ts)
//   disenos-digitales    archivos para descargar (DXF, STL…)
//   maquinas-cnc         físicos en una categoría de máquinas
//   herramientas-materiales  el resto de los físicos
// Los planes del Cotizador y los talleres del directorio NO son productos de
// la tienda: van en tarjetas aparte y la página lo aclara.
import "server-only"

import { listProducts } from "@/lib/data/products"
import { listarPaquetes } from "@/lib/creditos/acciones"
import { tipoFicha } from "@/lib/hetna/tipo-ficha"
import { listarTalleres } from "@/lib/hetna/talleres"
import { PLANES_APP } from "@/lib/hetna/app-taller"

export type ClaveCategoria = "disenos-digitales" | "servicios-cam" | "creditos-3d" | "maquinas-cnc" | "herramientas-materiales"
export type ComoSeCompra = "descarga" | "servicio" | "creditos" | "proximamente"

export type DefCategoria = {
  clave: ClaveCategoria
  nombre: string
  descripcion: string
  como: Exclude<ComoSeCompra, "proximamente">
  imagen?: string
  patron: "hex" | "rejilla" | "puntos" | "lineas"
}

export const CATEGORIAS: DefCategoria[] = [
  {
    clave: "disenos-digitales",
    nombre: "Diseños digitales DXF y STL",
    descripcion: "Archivos listos para cortar o imprimir. Los pagas y los descargas al momento.",
    como: "descarga",
    patron: "hex",
  },
  {
    clave: "servicios-cam",
    nombre: "Servicios CAM y CAD",
    descripcion: "Programas de 3, 4 y 5 ejes, posprocesadores y revisión de tu G-code por un especialista.",
    como: "servicio",
    imagen: "/productos/cam/servicio-cam-3-ejes.jpg",
    patron: "lineas",
  },
  {
    clave: "creditos-3d",
    nombre: "Créditos para Imagen a 3D",
    descripcion: "Convierte una foto en un modelo 3D con IA o escanea una pieza. Se pagan por paquete.",
    como: "creditos",
    patron: "puntos",
  },
  {
    clave: "maquinas-cnc",
    nombre: "Máquinas CNC",
    descripcion: "Routers, láser, plasma y fresadoras de talleres y distribuidores de México.",
    como: "servicio",
    patron: "rejilla",
  },
  {
    clave: "herramientas-materiales",
    nombre: "Herramientas y materiales",
    descripcion: "Fresas, boquillas, consumibles y material en hoja para tu taller.",
    como: "servicio",
    patron: "rejilla",
  },
]

export type ProductoTienda = {
  id: string
  handle: string
  titulo: string
  imagen: string | null
  categoria: ClaveCategoria
  /** MXN con IVA. 0 = gratis. null = sin precio en línea */
  precio: number | null
}

export type CategoriaTienda = DefCategoria & {
  conteo: number
  desde: number | null // MXN con IVA; 0 = hay gratis
  estado: ComoSeCompra
}

export type CatalogoTienda = {
  total: number
  categorias: CategoriaTienda[]
  productos: ProductoTienda[]
  talleres: { activos: number; verificados: number }
  planes: { nombre: string; precio: string }[]
  /** true si el API no contestó: la página no debe decir "0 productos" */
  fallo: boolean
}

const esMaquina = (cats: { handle?: string | null; name?: string | null }[] | null | undefined) =>
  (cats || []).some((c) => /maquina|máquina|router|laser|láser|plasma|fresadora|torno/i.test(`${c.handle || ""} ${c.name || ""}`))

function categoriaDe(p: any): ClaveCategoria {
  const m = (p?.metadata || {}) as Record<string, unknown>
  if (m.producto_creditos_3d === true || m.producto_creditos_3d === "true") return "creditos-3d"
  const tipo = tipoFicha(p)
  if (tipo === "servicio") return "servicios-cam"
  if (tipo === "digital") return "disenos-digitales"
  return esMaquina(p?.categories) ? "maquinas-cnc" : "herramientas-materiales"
}

function precioDe(p: any): number | null {
  if ((p?.metadata as any)?.archivo_gratis === true) return 0
  const montos = (p?.variants || [])
    .map((v: any) => v?.calculated_price?.calculated_amount)
    .filter((x: unknown): x is number => typeof x === "number" && x >= 0)
  return montos.length ? Math.min(...montos) : null
}

export async function catalogoTienda(countryCode: string): Promise<CatalogoTienda> {
  const productos: ProductoTienda[] = []
  let fallo = false
  for (let page = 1; page <= 10; page++) {
    const r = await listProducts({
      countryCode,
      pageParam: page,
      queryParams: {
        limit: 100,
        fields: "id,title,handle,thumbnail,metadata,*type,*tags,*categories,*variants.calculated_price",
      } as never,
    })
    if (r.fallo) {
      fallo = true
      break
    }
    for (const p of r.response.products as any[]) {
      productos.push({
        id: p.id,
        handle: p.handle,
        titulo: p.title,
        imagen: p.thumbnail || null,
        categoria: categoriaDe(p),
        precio: precioDe(p),
      })
    }
    if (!r.nextPage) break
  }

  // Los paquetes de créditos no tienen oferta en el carrito: su precio sale de su catálogo
  const creditos = productos.some((p) => p.categoria === "creditos-3d") ? await listarPaquetes().catch(() => null) : null
  if (creditos?.paquetes.length) {
    for (const p of productos) {
      if (p.categoria !== "creditos-3d" || p.precio != null) continue
      const paq = creditos.paquetes.find((x) => x.handle === p.handle)
      if (paq) p.precio = paq.precio
    }
  }

  const categorias: CategoriaTienda[] = CATEGORIAS.map((c) => {
    const suyos = productos.filter((p) => p.categoria === c.clave)
    const precios = suyos.map((p) => p.precio).filter((x): x is number => typeof x === "number")
    return {
      ...c,
      conteo: suyos.length,
      desde: precios.length ? Math.min(...precios) : null,
      estado: suyos.length ? c.como : "proximamente",
    }
  })

  const talleres = await listarTalleres().catch(() => [])
  return {
    total: productos.length,
    categorias,
    productos,
    talleres: { activos: talleres.length, verificados: talleres.filter((t) => t.verificado).length },
    planes: PLANES_APP.map((p) => ({ nombre: p.nombre, precio: p.precio })),
    fallo,
  }
}

// Fabricación por proceso: todas van al mismo cotizador (/cotizar) con el
// proceso preseleccionado. El valor de `servicio` es literal de la lista del
// formulario (lib/trabajos/servicios.ts).
export const PROCESOS: { nombre: string; servicio: string; texto: string; imagen: string }[] = [
  { nombre: "Corte láser", servicio: "Corte láser", texto: "MDF, acrílico y lámina con acabado fino", imagen: "/images/hero/Gemini_Generated_Image_52m1mt52m1mt52m1.jpg" },
  { nombre: "Corte plasma", servicio: "Corte plasma", texto: "Placa y lámina de acero, inoxidable y aluminio", imagen: "/images/hero/Gemini_Generated_Image_eytqoceytqoceytq.jpg" },
  { nombre: "Maquinado CNC", servicio: "Maquinado", texto: "Piezas de metal y plástico a tolerancia", imagen: "/laboratorio-cam/laboratorio-alabe-5-ejes.webp" },
  { nombre: "Router CNC", servicio: "Corte CNC", texto: "Madera, MDF, triplay, PVC y aluminio", imagen: "/images/hero/Gemini_Generated_Image_mz62mcmz62mcmz62.jpg" },
  { nombre: "Impresión 3D", servicio: "Impresión 3D", texto: "PLA, PETG, ABS y resina, se cotiza por pieza", imagen: "/images/hero/Gemini_Generated_Image_kliqxukliqxukliq.jpg" },
]

export const ligaCotizar = (p: { servicio?: string; descripcion?: string; origen?: string } = {}) => {
  const q = new URLSearchParams()
  if (p.servicio) q.set("servicio", p.servicio)
  if (p.descripcion) q.set("descripcion", p.descripcion)
  if (p.origen) q.set("origen", p.origen)
  const s = q.toString()
  return `/cotizar${s ? `?${s}` : ""}`
}
