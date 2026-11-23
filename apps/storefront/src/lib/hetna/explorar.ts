// Explorar el catálogo con pestañas y filtros (opción C que eligió Vlado, 23 nov 2026).
//
// Pestañas: Todo · Productos · Diseños · A tu medida · Talleres. Cada pestaña
// tiene sus propios filtros (la licencia sólo sale en Diseños; en Talleres,
// estado, tipo de máquina, material y tipo de cuenta).
//
// El catálogo cabe de sobra en memoria (hasta 300 productos), así que se trae
// completo y aquí se filtra y se cuenta. Eso permite:
//   - que cada opción diga cuántos resultados tiene ("Tlaxcala (7)");
//   - esconder las opciones sin resultados y los grupos con una sola opción
//     (catálogo honesto: nada de filtros que llevan a "0 productos");
//   - que la página llegue armada desde el servidor (Google la lee completa) y
//     que los filtros sean enlaces normales (se pueden compartir y abrir aparte).
//
// Dentro de un mismo grupo las opciones se suman (Puebla O Tlaxcala); entre
// grupos se restringen (Puebla Y router). Cada grupo cuenta sin aplicarse a sí
// mismo, como en las tiendas grandes, para que se puedan marcar varias.
//
// Parámetros de la dirección:
//   tipo      productos | disenos | medida | talleres (sin él: Todo)
//   cat       categorías (handles, separadas por coma)
//   estado    estados del taller (slug: tlaxcala, ciudad-de-mexico)
//   maquina   tipo de taller (router, laser_co2… de TIPOS_MAQUINA)
//   taller    handle del taller
//   material  slug del material
//   cuenta    taller | proveedor (sólo en Talleres)
//   licencia  personal | comercial | comercial_ampliada (sólo en Diseños)
//   min_price, max_price, disponible=1, sortBy, page, query (los de siempre)
import "server-only"

import type { HttpTypes } from "@medusajs/types"

import { sdk } from "@/lib/client"
import { getRegion } from "@/lib/data/regions"
import { PRODUCT_LIMIT } from "@/const"
import { estadoMx } from "@/lib/hetna/directorio"
import { listarTalleres, nombreTipoMaquina, type Taller } from "@/lib/hetna/talleres"
import { tipoProducto } from "@/lib/hetna/tipo-producto"
import { cumpleLicencia, filtrarYOrdenar, leerFiltros, ordenValido, precioMinimo } from "@/lib/helpers/filtrar-listado"

export type Pestana = "todo" | "productos" | "disenos" | "medida" | "talleres"

export const PESTANAS: { id: Pestana; nombre: string; h1: string; titulo: string; intro: string; descripcion: string }[] = [
  {
    id: "todo",
    nombre: "Todo",
    h1: "Todos los productos",
    titulo: "Todos los productos CNC",
    intro: "Máquinas, herramientas, materiales y diseños CNC de talleres de todo México. Compra dentro de HETNA o pide que te lo fabriquen.",
    descripcion: "Máquinas, herramientas, materiales y diseños CNC de talleres de todo México. Filtra por categoría, estado, tipo de taller y material.",
  },
  {
    id: "productos",
    nombre: "Productos",
    h1: "Productos CNC",
    titulo: "Productos, herramientas y materiales CNC",
    intro: "Máquinas, herramientas, refacciones y materiales para CNC que venden talleres y proveedores de México. Pagas dentro de HETNA con Mercado Pago.",
    descripcion: "Compra máquinas, fresas, refacciones y materiales para CNC a talleres y proveedores de México. Filtra por estado, taller y material.",
  },
  {
    id: "disenos",
    nombre: "Diseños",
    h1: "Diseños CNC para descargar",
    titulo: "Diseños CNC para descargar (DXF, SVG, STL)",
    intro: "Archivos listos para cortar en láser, router o plasma. Se descargan al momento y cada uno dice qué licencia trae: uso personal o para vender las piezas.",
    descripcion: "Archivos DXF, SVG y STL para láser, router y plasma CNC. Descarga inmediata y licencia clara: uso personal o para vender las piezas.",
  },
  {
    id: "medida",
    nombre: "A tu medida",
    h1: "Fabricación a tu medida",
    titulo: "Fabricación CNC a tu medida y servicios",
    intro: "Piezas que el taller fabrica bajo pedido y servicios en línea, como programación CAM o diseño. Dinos la medida y el material, y el taller te manda su precio.",
    descripcion: "Piezas CNC fabricadas bajo pedido y servicios de CAM y diseño. Elige el taller por estado y tipo de máquina, y paga dentro de HETNA.",
  },
  {
    id: "talleres",
    nombre: "Talleres",
    h1: "Talleres CNC",
    titulo: "Talleres CNC en México por estado y tipo de máquina",
    intro: "Talleres CNC y proveedores registrados en HETNA. Filtra por estado, tipo de máquina y material, y pide tu cotización dentro de la plataforma.",
    descripcion: "Encuentra talleres CNC en México por estado, tipo de máquina (láser, router, plasma, torno) y material. Pide cotización dentro de HETNA.",
  },
]

export const leerPestana = (v: unknown): Pestana => {
  const s = String(Array.isArray(v) ? v[0] : v ?? "")
  return (PESTANAS.find((p) => p.id === s && s !== "todo")?.id ?? "todo") as Pestana
}

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

// --------------------------------------------------------------- tipos

export type Opcion = { valor: string; nombre: string; n: number; activa: boolean }
export type Grupo = { clave: string; titulo: string; opciones: Opcion[]; universo?: number }
export type Activo = { clave: string; valor: string; nombre: string }

export type ResultadoExplorar = {
  pestana: Pestana
  totales: Record<Pestana, number>
  chips: Opcion[] // categorías rápidas (o tipos de máquina en Talleres)
  chipsClave: string
  grupos: Grupo[]
  activos: Activo[]
  total: number
  paginas: number
  pagina: number
  productos: HttpTypes.StoreProduct[]
  talleres: Taller[]
  fallo: boolean
}

type Cat = { id: string; name: string; handle: string; parent_category_id?: string | null }

type Item = {
  p: HttpTypes.StoreProduct
  pestana: Exclude<Pestana, "todo" | "talleres">
  cats: Set<string> // handles propios y de sus categorías padre
  estados: Set<string>
  maquinas: Set<string>
  talleres: Set<string>
  materiales: Map<string, string> // slug → nombre
}

// Categorías raíz que sólo agrupan el menú (no sirven como atajo)
const CONTENEDORES = new Set(["tienda"])

const MATERIALES_CONOCIDOS = ["MDF", "Acrílico", "Madera", "Pino", "Triplay", "Aluminio", "Acero", "Acero inoxidable", "Latón", "Cobre", "Nylon", "PVC", "Policarbonato", "Cuero", "Vidrio", "Piedra", "Foamboard", "Coroplast", "PLA", "PETG", "Resina"]

// --------------------------------------------------------------- datos

const tienda = () => (sdk as unknown as { store: Record<string, { query: (p: unknown) => Promise<unknown> }> }).store

const CAMPOS_PRODUCTO =
  "*variants.calculated_price,+variants.inventory_quantity,*variants.options," +
  "*attribute_values,*attribute_values.attribute,*categories,*tags,*type,+metadata"

async function traerProductos(regionId: string, query?: string): Promise<{ productos: HttpTypes.StoreProduct[]; fallo: boolean }> {
  const productos: HttpTypes.StoreProduct[] = []
  try {
    for (let offset = 0; offset < 300; offset += 100) {
      const r = (await tienda().products.query({
        q: query || undefined,
        region_id: regionId,
        order: "-created_at",
        limit: 100,
        offset,
        fields: CAMPOS_PRODUCTO,
        fetchOptions: { next: { revalidate: 120 } },
      } as never)) as { products?: HttpTypes.StoreProduct[]; count?: number }
      const lote = r.products ?? []
      productos.push(...lote)
      if (lote.length < 100 || (r.count !== undefined && productos.length >= r.count)) break
    }
    return { productos, fallo: false }
  } catch {
    return { productos, fallo: productos.length === 0 }
  }
}

/** producto → talleres que lo venden (de las ofertas). */
async function vendedoresPorProducto(regionId: string): Promise<Map<string, Set<string>>> {
  const mapa = new Map<string, Set<string>>()
  try {
    for (let offset = 0; offset < 1000; offset += 100) {
      const r = (await tienda().offers.query({
        region_id: regionId,
        fields: "id,product_id,seller_id",
        limit: 100,
        offset,
        fetchOptions: { next: { revalidate: 300 } },
      } as never)) as { offers?: { product_id?: string; seller_id?: string }[]; count?: number }
      const lote = r.offers ?? []
      for (const o of lote) {
        if (!o.product_id || !o.seller_id) continue
        if (!mapa.has(o.product_id)) mapa.set(o.product_id, new Set())
        mapa.get(o.product_id)!.add(o.seller_id)
      }
      if (lote.length < 100) break
    }
  } catch {
    // sin ofertas, los filtros de taller/estado simplemente no salen
  }
  return mapa
}

async function traerCategorias(): Promise<Cat[]> {
  try {
    const r = (await tienda().productCategories.query({
      fields: "id,name,handle,parent_category_id",
      limit: 500,
      fetchOptions: { next: { revalidate: 300 } },
    } as never)) as { product_categories?: Cat[] }
    return r.product_categories ?? []
  } catch {
    return []
  }
}

// --------------------------------------------------------------- lectura

const valores = (sp: URLSearchParams, k: string) => new Set((sp.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean))

const textoDe = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "")

function materialesDe(p: HttpTypes.StoreProduct): Map<string, string> {
  const out = new Map<string, string>()
  const meter = (raw: string) => {
    for (const parte of raw.split(/[,/;|]| y /)) {
      const t = parte.trim()
      if (!t || t.length > 30) continue
      // "MDF 3 mm" → MDF; se queda con el material conocido si lo menciona
      const conocido = MATERIALES_CONOCIDOS.find((m) => slug(t).split("-").includes(slug(m)) || slug(t).startsWith(slug(m)))
      const nombre = conocido ?? t.replace(/\s*\d.*$/, "").trim()
      if (nombre) out.set(slug(nombre), nombre.charAt(0).toUpperCase() + nombre.slice(1))
    }
  }
  const m = (p.metadata || {}) as Record<string, unknown>
  if (textoDe(m.material)) meter(textoDe(m.material))
  for (const a of (p as { attribute_values?: { value?: unknown; attribute?: { name?: string | null } | null }[] }).attribute_values ?? []) {
    if (/material/i.test(a?.attribute?.name || "") && textoDe(a.value)) meter(textoDe(a.value))
  }
  return out
}

function pestanaDe(p: HttpTypes.StoreProduct, deServicios: boolean): Item["pestana"] {
  // Los paquetes de créditos 3D pagan el servicio de escaneo: no son un producto físico
  const m = (p.metadata || {}) as Record<string, unknown>
  if (m.producto_creditos_3d === true || m.producto_creditos_3d === "true") return "medida"
  const t = tipoProducto(p as never)
  if (t === "digital") return "disenos"
  if (deServicios) return "medida"
  if (t === "a_medida" || t === "servicio") return "medida"
  return "productos"
}

const estadoDeTaller = (t: Taller) => estadoMx(t.perfil.estado, t.perfil.ciudad) || t.perfil.estado || ""
const maquinasDeTaller = (t: Taller) => new Set(t.perfil.maquinas.map((m) => m.tipo || "").filter(Boolean))

// --------------------------------------------------------------- conteo

type Filtro<T> = { clave: string; elegidos: Set<string>; cumple: (x: T, v: string) => boolean }

const cumpleTodos = <T>(x: T, filtros: Filtro<T>[], salvo?: string) =>
  filtros.every((f) => f.clave === salvo || f.elegidos.size === 0 || [...f.elegidos].some((v) => f.cumple(x, v)))

function grupo<T>(
  clave: string,
  titulo: string,
  lista: T[],
  filtros: Filtro<T>[],
  opcionesDe: (x: T) => Iterable<[string, string]>,
  orden?: (a: Opcion, b: Opcion) => number
): Grupo {
  const elegidos = filtros.find((f) => f.clave === clave)?.elegidos ?? new Set<string>()
  const cuenta = new Map<string, { nombre: string; n: number }>()
  let universo = 0
  for (const x of lista) {
    if (!cumpleTodos(x, filtros, clave)) continue
    universo++
    for (const [valor, nombre] of opcionesDe(x)) {
      const c = cuenta.get(valor) ?? { nombre, n: 0 }
      c.n++
      cuenta.set(valor, c)
    }
  }
  // Una opción elegida sigue visible aunque ya no tenga resultados (para poder quitarla)
  for (const v of elegidos) if (!cuenta.has(v)) cuenta.set(v, { nombre: v, n: 0 })
  const opciones = [...cuenta.entries()]
    .map(([valor, c]) => ({ valor, nombre: c.nombre, n: c.n, activa: elegidos.has(valor) }))
    .sort(orden ?? ((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es")))
  return { clave, titulo, opciones, universo }
}

// Un grupo que no ayuda a filtrar se esconde: con una sola opción, o cuando
// todas las opciones dan lo mismo que no filtrar (en producción, con un solo
// taller, "Tipo de taller" salía con Router 10, Láser 10, Plasma 10… de 10).
const util = (g: Grupo) => {
  if (g.opciones.some((o) => o.activa)) return true
  const con = g.opciones.filter((o) => o.n > 0)
  return con.length >= 2 && (g.universo === undefined || con.some((o) => o.n < g.universo!))
}

// --------------------------------------------------------------- principal

export async function explorar(locale: string, sp: URLSearchParams): Promise<ResultadoExplorar> {
  const pestana = leerPestana(sp.get("tipo"))
  const query = sp.get("query") || undefined
  const region = await getRegion(locale)
  const regionId = region?.id

  const [{ productos, fallo }, vendedores, cats, todosTalleres] = await Promise.all([
    regionId ? traerProductos(regionId, query) : Promise.resolve({ productos: [] as HttpTypes.StoreProduct[], fallo: true }),
    regionId ? vendedoresPorProducto(regionId) : Promise.resolve(new Map<string, Set<string>>()),
    traerCategorias(),
    listarTalleres(),
  ])

  const tallerPorId = new Map(todosTalleres.map((t) => [t.id, t]))
  const catPorId = new Map(cats.map((c) => [c.id, c]))
  const catPorHandle = new Map(cats.map((c) => [c.handle, c]))
  const ancestros = (c: Cat | undefined): Cat[] => {
    const out: Cat[] = []
    let x = c
    for (let i = 0; x && i < 6; i++) {
      out.push(x)
      x = x.parent_category_id ? catPorId.get(x.parent_category_id) : undefined
    }
    return out
  }

  const items: Item[] = productos.map((p) => {
    const ts = [...(vendedores.get(p.id) ?? [])].map((id) => tallerPorId.get(id)).filter((t): t is Taller => !!t)
    const propias = ((p as { categories?: Cat[] | null }).categories ?? []).map((c) => catPorId.get(c.id) ?? c)
    const handles = new Set(propias.flatMap((c) => ancestros(c).map((a) => a.handle)))
    return {
      p,
      pestana: pestanaDe(p, handles.has("servicios")),
      cats: handles,
      estados: new Set(ts.map(estadoDeTaller).filter(Boolean)),
      maquinas: new Set(ts.flatMap((t) => [...maquinasDeTaller(t)])),
      talleres: new Set(ts.map((t) => t.handle)),
      materiales: materialesDe(p),
    }
  })

  // Talleres que se muestran (sólo cuentas que fabrican o venden; sin pruebas)
  const talleresVisibles = todosTalleres
  const totales: Record<Pestana, number> = {
    todo: items.length,
    productos: items.filter((i) => i.pestana === "productos").length,
    disenos: items.filter((i) => i.pestana === "disenos").length,
    medida: items.filter((i) => i.pestana === "medida").length,
    talleres: talleresVisibles.length,
  }

  const nombreTaller = new Map(todosTalleres.map((t) => [t.handle, t.nombre]))
  const nombreEstado = (s: string) => s
  const orden = ordenValido(sp.get("sortBy"))
  const precio = leerFiltros(sp)

  // ------------------------------------------------ pestaña Talleres
  if (pestana === "talleres") {
    const filtrosT: Filtro<Taller>[] = [
      { clave: "maquina", elegidos: valores(sp, "maquina"), cumple: (t, v) => maquinasDeTaller(t).has(v) },
      { clave: "estado", elegidos: valores(sp, "estado"), cumple: (t, v) => slug(estadoDeTaller(t)) === v },
      { clave: "material", elegidos: valores(sp, "material"), cumple: (t, v) => t.perfil.materiales.some((m) => slug(m) === v) },
      {
        clave: "cuenta",
        elegidos: valores(sp, "cuenta"),
        cumple: (t, v) => (t.perfil.tipo_cuenta === "ambos" ? true : (t.perfil.tipo_cuenta ?? "taller") === v),
      },
    ]
    const chips = grupo("maquina", "Tipo de máquina", talleresVisibles, filtrosT, (t) => [...maquinasDeTaller(t)].map((m) => [m, nombreTipoMaquina(m) || m]))
    const grupos = [
      grupo("estado", "Estado", talleresVisibles, filtrosT, (t) => (estadoDeTaller(t) ? [[slug(estadoDeTaller(t)), estadoDeTaller(t)]] : [])),
      grupo("material", "Material que trabaja", talleresVisibles, filtrosT, (t) => t.perfil.materiales.map((m) => [slug(m), m] as [string, string])),
      grupo("cuenta", "Tipo de cuenta", talleresVisibles, filtrosT, (t) =>
        t.perfil.tipo_cuenta === "ambos"
          ? [["taller", "Taller (fabrica)"], ["proveedor", "Proveedor (vende)"]]
          : [[t.perfil.tipo_cuenta === "proveedor" ? "proveedor" : "taller", t.perfil.tipo_cuenta === "proveedor" ? "Proveedor (vende)" : "Taller (fabrica)"]]
      ),
    ].filter(util)
    const lista = talleresVisibles
      .filter((t) => cumpleTodos(t, filtrosT))
      // Primero los verificados y los que tienen más datos
      .sort((a, b) => Number(b.verificado) - Number(a.verificado) || b.perfil.maquinas.length - a.perfil.maquinas.length || a.nombre.localeCompare(b.nombre, "es"))
    const porPagina = 24
    const paginas = Math.max(1, Math.ceil(lista.length / porPagina))
    const pagina = Math.min(Math.max(1, Number(sp.get("page")) || 1), paginas)
    return {
      pestana,
      totales,
      chips: chips.opciones.filter((o) => o.n > 0 || o.activa),
      chipsClave: "maquina",
      grupos,
      activos: activosDe(sp, [chips, ...grupos]),
      total: lista.length,
      paginas,
      pagina,
      productos: [],
      talleres: lista.slice((pagina - 1) * porPagina, pagina * porPagina),
      fallo: false,
    }
  }

  // ------------------------------------------------ pestañas de productos
  const base = pestana === "todo" ? items : items.filter((i) => i.pestana === pestana)
  const licencia = pestana === "disenos" || pestana === "todo" ? precio.licencia : undefined

  const filtros: Filtro<Item>[] = [
    { clave: "cat", elegidos: valores(sp, "cat"), cumple: (i, v) => i.cats.has(v) },
    { clave: "estado", elegidos: valores(sp, "estado"), cumple: (i, v) => [...i.estados].some((e) => slug(e) === v) },
    { clave: "maquina", elegidos: valores(sp, "maquina"), cumple: (i, v) => i.maquinas.has(v) },
    { clave: "taller", elegidos: valores(sp, "taller"), cumple: (i, v) => i.talleres.has(v) },
    { clave: "material", elegidos: valores(sp, "material"), cumple: (i, v) => i.materiales.has(v) },
    ...(licencia ? [{ clave: "licencia", elegidos: new Set([licencia]), cumple: (i: Item) => cumpleLicencia(i.p, licencia) }] : []),
  ]

  // Categorías rápidas: las raíces con productos; si sólo hay una (en Diseños
  // todas cuelgan de "Digital"), se baja un nivel hasta que haya para escoger.
  // Una categoría elegida enseña además sus subcategorías.
  const conteoCat = grupo("cat", "Categoría", base, filtros, (i) => [...i.cats].map((h) => [h, catPorHandle.get(h)?.name ?? h] as [string, string]))
  const nCat = new Map(conteoCat.opciones.map((o) => [o.valor, o]))
  const hijas = (padre: string | null) =>
    cats.filter((c) => (c.parent_category_id ?? null) === padre && (nCat.get(c.handle)?.n ?? 0) > 0).map((c) => nCat.get(c.handle)!)
  // "Tienda" es sólo el contenedor del menú (Máquinas, Herramientas,
  // Materiales, Digital): en su lugar salen sus categorías.
  const expandir = (lista: Opcion[]) =>
    lista.flatMap((o) => {
      const c = catPorHandle.get(o.valor)
      const abajo = c && CONTENEDORES.has(c.handle) && !o.activa ? hijas(c.id) : []
      return abajo.length ? abajo : [o]
    })
  let nivel = expandir(hijas(null))
  for (let i = 0; i < 3 && nivel.length === 1 && !nivel[0].activa; i++) {
    const sola = catPorHandle.get(nivel[0].valor)
    const abajo = sola ? hijas(sola.id) : []
    if (!abajo.length) break
    nivel = abajo
  }
  const chips = [...nivel]
  for (const o of conteoCat.opciones.filter((x) => x.activa)) {
    if (!chips.some((c) => c.valor === o.valor)) chips.push(o)
    const c = catPorHandle.get(o.valor)
    if (c) for (const h of hijas(c.id)) if (!chips.some((x) => x.valor === h.valor)) chips.push(h)
  }

  const grupos = [
    grupo("estado", "Estado del taller", base, filtros, (i) => [...i.estados].map((e) => [slug(e), nombreEstado(e)] as [string, string])),
    grupo("maquina", "Tipo de taller", base, filtros, (i) => [...i.maquinas].map((m) => [m, nombreTipoMaquina(m) || m] as [string, string])),
    grupo("material", "Material", base, filtros, (i) => [...i.materiales.entries()]),
    grupo("taller", "Taller", base, filtros, (i) => [...i.talleres].map((h) => [h, nombreTaller.get(h) ?? h] as [string, string])),
  ].filter(util)

  if (pestana === "disenos" || pestana === "todo") {
    const g = grupo("licencia", "Licencia", base, filtros.filter((f) => f.clave !== "licencia"), (i) => {
      if (i.pestana !== "disenos") return []
      const out: [string, string][] = []
      if (cumpleLicencia(i.p, "personal")) out.push(["personal", "Personal (uso propio)"])
      if (cumpleLicencia(i.p, "comercial")) out.push(["comercial", "Para vender piezas"])
      if (cumpleLicencia(i.p, "comercial_ampliada")) out.push(["comercial_ampliada", "Producción sin límite"])
      return out
    })
    if (licencia) g.opciones = g.opciones.map((o) => ({ ...o, activa: o.valor === licencia }))
    if (pestana === "disenos" ? util(g) : g.opciones.some((o) => o.activa)) grupos.push(g)
  }

  const filtrados = filtrarYOrdenar(
    base.filter((i) => cumpleTodos(i, filtros)).map((i) => i.p),
    { min: precio.min, max: precio.max, disponible: pestana === "productos" && precio.disponible },
    orden
  )
  const paginas = Math.max(1, Math.ceil(filtrados.length / PRODUCT_LIMIT))
  const pagina = Math.min(Math.max(1, Number(sp.get("page")) || 1), paginas)

  return {
    pestana,
    totales,
    chips: chips.slice(0, 14),
    chipsClave: "cat",
    grupos,
    activos: activosDe(sp, [conteoCat, ...grupos], precio),
    total: filtrados.length,
    paginas,
    pagina,
    productos: filtrados.slice((pagina - 1) * PRODUCT_LIMIT, pagina * PRODUCT_LIMIT),
    talleres: [],
    fallo,
  }
}

const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`

function activosDe(sp: URLSearchParams, grupos: Grupo[], precio?: { min?: number; max?: number; disponible?: boolean }): Activo[] {
  const out: Activo[] = []
  for (const g of grupos) for (const o of g.opciones) if (o.activa) out.push({ clave: g.clave, valor: o.valor, nombre: o.nombre })
  if (precio?.min !== undefined) out.push({ clave: "min_price", valor: "", nombre: `Desde ${pesos(precio.min)}` })
  if (precio?.max !== undefined) out.push({ clave: "max_price", valor: "", nombre: precio.max === 0 ? "Gratis" : `Hasta ${pesos(precio.max)}` })
  if (precio?.disponible && sp.get("tipo") === "productos") out.push({ clave: "disponible", valor: "", nombre: "Con existencia" })
  return out
}

// --------------------------------------------------------------- enlaces

/** La misma dirección con una opción puesta o quitada (y sin página: vuelve a la 1). */
export function conOpcion(sp: URLSearchParams, clave: string, valor: string): string {
  const out = new URLSearchParams(sp.toString())
  out.delete("page")
  if (!valor) {
    out.delete(clave)
  } else if (clave === "licencia") {
    if (out.get("licencia") === valor) out.delete("licencia")
    else out.set("licencia", valor)
  } else {
    const s = valores(out, clave)
    if (s.has(valor)) s.delete(valor)
    else s.add(valor)
    if (s.size) out.set(clave, [...s].join(","))
    else out.delete(clave)
  }
  const q = out.toString()
  return q ? `?${q}` : "?"
}

/** Cambiar de pestaña: se queda sólo la búsqueda escrita (los filtros de una pestaña no aplican en otra). */
export function aPestana(sp: URLSearchParams, p: Pestana): string {
  const out = new URLSearchParams()
  if (p !== "todo") out.set("tipo", p)
  const q = sp.get("query")
  if (q) out.set("query", q)
  const s = out.toString()
  return s ? `?${s}` : "?"
}

/** Quitar todos los filtros de la pestaña actual. */
export function sinFiltros(sp: URLSearchParams): string {
  return aPestana(sp, leerPestana(sp.get("tipo")))
}

/** ¿Es una página que Google debe indexar? Sólo la pestaña sola (y su paginación). */
export function esIndexable(sp: URLSearchParams): boolean {
  return [...sp.keys()].every((k) => k === "tipo" || k === "page")
}

export { precioMinimo }
