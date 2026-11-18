"use client"

// Cuerpo de /mx/tienda: buscador, filtros por tipo de compra, Fabricación a
// medida, rejilla de categorías, fabricación por proceso y cierre. Los datos
// (conteos y precios "desde") llegan calculados del servidor
// (lib/hetna/tienda.ts); aquí sólo se filtran y se buscan.
import Image from "@/lib/imagenes/Imagen"
import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { trackCotizarBusqueda } from "@/lib/analytics/events"
import type { CatalogoTienda, CategoriaTienda, ProductoTienda } from "@/lib/hetna/tienda"
import { Avisame } from "./Avisame"
import { BTN, BTN2, Etiqueta, Patron, mxn, textoConteo, textoDesde } from "./piezas"

type Proceso = { nombre: string; servicio: string; texto: string; imagen: string }
type Filtro = "todo" | "comprar" | "cotizar" | "digital" | "proximamente"

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const cotizarHref = (p: { servicio?: string; descripcion?: string; origen?: string }) => {
  const q = new URLSearchParams()
  if (p.servicio) q.set("servicio", p.servicio)
  if (p.descripcion) q.set("descripcion", p.descripcion)
  if (p.origen) q.set("origen", p.origen)
  const s = q.toString()
  return `/cotizar${s ? `?${s}` : ""}`
}

export function TiendaVista({
  catalogo,
  procesos,
  publicidad,
}: {
  catalogo: CatalogoTienda
  procesos: Proceso[]
  // Espacio de publicidad (componente de servidor), debajo de las categorías
  publicidad?: React.ReactNode
}) {
  const [q, setQ] = useState("")
  const [filtro, setFiltro] = useState<Filtro>("todo")
  const cats = catalogo.categorias
  const conProductos = cats.filter((c) => c.conteo > 0)
  const proximas = cats.filter((c) => c.conteo === 0)
  const digitales = cats.filter((c) => c.clave === "disenos-digitales" || c.clave === "creditos-3d")
  const suma = (xs: CategoriaTienda[]) => xs.reduce((s, c) => s + c.conteo, 0)

  const chips: [Filtro, string, number][] = [
    ["todo", "Todo", catalogo.total],
    ["comprar", "Comprar ahora", suma(conProductos)],
    ["cotizar", "Cotizar", procesos.length],
    ["digital", "Digital", suma(digitales)],
    ["proximamente", "Próximamente", proximas.length],
  ]

  const termino = q.trim()
  const busqueda = useMemo(() => {
    if (!termino) return null
    const t = sinAcentos(termino)
    const palabras = t.split(/\s+/).filter((w) => w.length >= 2)
    const coincide = (texto: string) => {
      const x = sinAcentos(texto)
      return palabras.length ? palabras.every((w) => x.includes(w)) : x.includes(t)
    }
    const nombreCat = (c: CategoriaTienda) => `${c.nombre} ${c.descripcion}`
    return {
      productos: catalogo.productos.filter((p) => coincide(`${p.titulo} ${cats.find((c) => c.clave === p.categoria)?.nombre || ""}`)),
      categorias: cats.filter((c) => coincide(nombreCat(c))),
      procesos: procesos.filter((p) => coincide(`${p.nombre} ${p.texto}`)),
    }
  }, [termino, catalogo.productos, cats, procesos])

  const verTodo = filtro === "todo"

  return (
    <div className="mt-6">
      {/* Buscador */}
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor="buscar-tienda" className="sr-only">
          Buscar en la tienda
        </label>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#5B6370]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id="buscar-tienda"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca: celosía, fresa, corte láser, CAM…"
          className="h-14 w-full rounded-md border-2 border-[#1E2329] bg-white pl-14 pr-4 text-[17px] text-[#1E2329] outline-none placeholder:text-[#8A929C] focus:border-[#E85D04] sm:h-16 sm:text-[19px]"
        />
      </form>

      {busqueda ? (
        <Resultados termino={termino} r={busqueda} cats={cats} alLimpiar={() => setQ("")} />
      ) : (
        <>
          {/* Filtros por tipo de compra: desplazables dentro del componente */}
          <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Tipo de compra">
            <div className="flex w-max gap-2">
              {chips.map(([k, t, n]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={filtro === k}
                  onClick={() => setFiltro(k)}
                  className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[14px] font-semibold ${
                    filtro === k ? "border-[#1E2329] bg-[#1E2329] text-white" : "border-[#C5CCD3] bg-white text-[#1E2329] hover:border-[#1E2329]"
                  }`}
                >
                  {t}
                  <span className={`fuente-mono text-[13px] ${filtro === k ? "text-[#FFB27A]" : "text-[#5B6370]"}`}>{n}</span>
                </button>
              ))}
            </div>
          </div>

          {(verTodo || filtro === "cotizar") && <Destacada />}

          {filtro !== "cotizar" && (
            <section aria-labelledby="titulo-categorias" className="mt-8">
              <h2 id="titulo-categorias" className="fuente-condensada text-[28px] font-bold uppercase leading-none text-[#1E2329]">
                Categorías
              </h2>
              {catalogo.fallo && (
                <p className="mt-3 rounded-md border border-[#F3C9A8] bg-[#FFF4EC] px-4 py-3 text-[14px] text-[#A84303]">
                  No pudimos leer el catálogo en este momento. Recarga la página en un minuto.
                </p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(filtro === "proximamente" ? [] : filtro === "digital" ? digitales.filter((c) => c.conteo > 0) : conProductos).map((c) => (
                  <TarjetaCategoria key={c.clave} c={c} />
                ))}
                {verTodo && <TarjetaCotizador planes={catalogo.planes} />}
                {verTodo && <TarjetaTalleres activos={catalogo.talleres.activos} verificados={catalogo.talleres.verificados} />}
                {(verTodo || filtro === "proximamente") && !catalogo.fallo && proximas.map((c) => <TarjetaProxima key={c.clave} c={c} />)}
              </div>
              {verTodo && !catalogo.fallo && (
                <p className="fuente-mono mt-4 text-[13px] leading-relaxed text-[#5B6370]">
                  Total en la tienda: {catalogo.total} {catalogo.total === 1 ? "producto publicado" : "productos publicados"}
                  {conProductos.length > 1 ? ` (${conProductos.map((c) => c.conteo).join(" + ")})` : ""}. Los planes del Cotizador y los talleres del
                  directorio no son productos de la tienda y no entran en la cuenta.{" "}
                  <LocalizedClientLink href="/categories" className="font-semibold text-[#C24E03] underline">
                    Ver todos los productos en una lista
                  </LocalizedClientLink>
                </p>
              )}
            </section>
          )}

          {verTodo && publicidad}

          {(verTodo || filtro === "cotizar") && <Procesos procesos={procesos} />}
        </>
      )}

      <Cierre />
    </div>
  )
}

// ---------------------------------------------------------------------------
function Destacada() {
  return (
    <section className="mt-6 overflow-hidden rounded-md bg-[#1E2329] text-white" aria-labelledby="titulo-fabricacion">
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <div className="relative min-h-[200px] md:order-2 md:min-h-[320px]">
          <Image
            src="/images/hero/Gemini_Generated_Image_52m1mt52m1mt52m1.jpg"
            alt="Cabezal láser cortando una placa en un taller"
            fill
            priority
            sizes="(min-width: 768px) 48vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 md:order-1">
          <div>
            <Etiqueta tipo="cotizacion" />
          </div>
          <h2 id="titulo-fabricacion" className="fuente-condensada text-[34px] font-bold uppercase leading-[0.95] sm:text-[44px]">
            Fabricación a medida
          </h2>
          <p className="max-w-md text-[16px] leading-relaxed text-white/80">
            Cotiza tu pieza en 2 minutos, sin registro. Sube tu archivo o escribe las medidas, ve un precio aproximado al instante y pide propuestas a los talleres.
          </p>
          <div>
            <LocalizedClientLink href="/cotizar" className={BTN}>
              Cotizar mi pieza
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </section>
  )
}

function Foto({ c }: { c: { imagen?: string; patron: string; nombre: string } }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-t-md">
      {c.imagen ? (
        <Image src={c.imagen} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
      ) : (
        <Patron tipo={c.patron} />
      )}
    </div>
  )
}

function Tarjeta({ children, foto }: { children: React.ReactNode; foto: React.ReactNode }) {
  return (
    <article className="flex flex-col rounded-md border border-[#D4D9DF] bg-white">
      {foto}
      <div className="flex flex-1 flex-col gap-2 p-4">{children}</div>
    </article>
  )
}

function Cifras({ izq, der }: { izq: string; der: string }) {
  return (
    <div className="fuente-mono mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-dashed border-[#D4D9DF] pt-3 text-[13px]">
      <span className="text-[#1E2329]">{izq}</span>
      <span className="font-semibold text-[#1E2329]">{der}</span>
    </div>
  )
}

const ACCION: Record<string, string> = {
  "disenos-digitales": "Ver diseños",
  "servicios-cam": "Ver servicios",
  "creditos-3d": "Ver paquetes",
  "maquinas-cnc": "Ver máquinas",
  "herramientas-materiales": "Ver productos",
}

function TarjetaCategoria({ c }: { c: CategoriaTienda }) {
  return (
    <Tarjeta foto={<Foto c={c} />}>
      <div>
        <Etiqueta tipo={c.estado} />
      </div>
      <h3 className="fuente-condensada text-[24px] font-bold uppercase leading-none text-[#1E2329]">{c.nombre}</h3>
      <p className="text-[14px] leading-snug text-[#5B6370]">{c.descripcion}</p>
      <Cifras izq={textoConteo(c.conteo, c.estado)} der={textoDesde(c.desde)} />
      <LocalizedClientLink href={`/tienda/${c.clave}`} className={`${BTN} mt-2 w-full`}>
        {ACCION[c.clave]}
      </LocalizedClientLink>
    </Tarjeta>
  )
}

function TarjetaProxima({ c }: { c: CategoriaTienda }) {
  return (
    <Tarjeta foto={<Foto c={{ ...c, imagen: undefined }} />}>
      <div>
        <Etiqueta tipo="proximamente" />
      </div>
      <h3 className="fuente-condensada text-[24px] font-bold uppercase leading-none text-[#1E2329]">{c.nombre}</h3>
      <p className="text-[14px] leading-snug text-[#5B6370]">{c.descripcion}</p>
      <Cifras izq="0 productos" der="Aún sin productos" />
      <div className="mt-2">
        <Avisame categoria={c.clave} nombre={c.nombre} />
      </div>
    </Tarjeta>
  )
}

function TarjetaCotizador({ planes }: { planes: { nombre: string; precio: string }[] }) {
  return (
    <Tarjeta
      foto={
        <div className="relative h-36 overflow-hidden rounded-t-md">
          <Image src="/img/herramientas/cotizador-precio.jpg" alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover object-top" />
        </div>
      }
    >
      <div>
        <Etiqueta tipo="talleres" />
      </div>
      <h3 className="fuente-condensada text-[24px] font-bold uppercase leading-none text-[#1E2329]">Cotizador para talleres</h3>
      <p className="text-[14px] leading-snug text-[#5B6370]">La app para cotizar, cobrar y llevar tus pedidos. Es una suscripción, no un producto de la tienda.</p>
      <div className="fuente-mono mt-auto grid grid-cols-2 gap-1 border-t border-dashed border-[#D4D9DF] pt-3 text-[13px] text-[#1E2329]">
        {planes.map((p) => (
          <span key={p.nombre}>
            {p.nombre} <b>{p.precio}</b>
            <span className="text-[#5B6370]">/mes</span>
          </span>
        ))}
      </div>
      <LocalizedClientLink href="/servicios/cotizador-cnc#planes" className={`${BTN2} mt-2 w-full`}>
        Ver planes
      </LocalizedClientLink>
    </Tarjeta>
  )
}

function TarjetaTalleres({ activos, verificados }: { activos: number; verificados: number }) {
  return (
    <Tarjeta foto={<div className="h-36 overflow-hidden rounded-t-md"><Patron tipo="hex" oscuro /></div>}>
      <div>
        <Etiqueta tipo="directorio" />
      </div>
      <h3 className="fuente-condensada text-[24px] font-bold uppercase leading-none text-[#1E2329]">Talleres CNC</h3>
      <p className="text-[14px] leading-snug text-[#5B6370]">
        {activos === 0
          ? "Todavía no hay talleres activos. ¿Tienes uno? Sé el primero: registrarte es gratis."
          : `Talleres que ya reciben pedidos en HETNA. ¿Tienes un taller? Regístralo gratis.`}
      </p>
      <Cifras
        izq={`${activos} ${activos === 1 ? "taller activo" : "talleres activos"}`}
        der={`${verificados} ${verificados === 1 ? "verificado" : "verificados"}`}
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {activos > 0 && (
          <LocalizedClientLink href="/talleres" className={BTN2}>
            Ver talleres
          </LocalizedClientLink>
        )}
        <LocalizedClientLink href="/talleres/unete" className={`${BTN} ${activos > 0 ? "" : "sm:col-span-2"}`}>
          Registrar mi taller
        </LocalizedClientLink>
      </div>
    </Tarjeta>
  )
}

function Procesos({ procesos }: { procesos: Proceso[] }) {
  return (
    <section aria-labelledby="titulo-procesos" className="mt-10">
      <h2 id="titulo-procesos" className="fuente-condensada text-[28px] font-bold uppercase leading-none text-[#1E2329]">
        Fabricación por proceso
      </h2>
      <p className="mt-1 text-[15px] text-[#5B6370]">Elige el proceso y cotiza con talleres. Se cotiza por pieza, sin registro.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {procesos.map((p) => (
          <LocalizedClientLink
            key={p.nombre}
            href={cotizarHref({ servicio: p.servicio })}
            className="group flex min-h-[44px] overflow-hidden rounded-md border border-[#D4D9DF] bg-white hover:border-[#1E2329] lg:flex-col"
          >
            <div className="relative w-28 shrink-0 lg:h-28 lg:w-full">
              <Image src={p.imagen} alt="" fill sizes="(min-width: 1024px) 18vw, 112px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-1 p-3">
              <span className="fuente-condensada text-[20px] font-bold uppercase leading-none text-[#1E2329]">{p.nombre}</span>
              <span className="text-[13px] leading-snug text-[#5B6370]">{p.texto}</span>
              <span className="mt-1 text-[13px] font-semibold text-[#C24E03] group-hover:underline">Cotizar →</span>
            </div>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  )
}

function Cierre() {
  return (
    <section className="mt-12 flex flex-col gap-4 rounded-md border-2 border-[#1E2329] bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <h2 className="fuente-condensada text-[30px] font-bold uppercase leading-none text-[#1E2329]">¿No está lo que buscas?</h2>
        <p className="mt-2 max-w-xl text-[15px] text-[#5B6370]">
          Descríbelo y te conseguimos quién lo fabrique. Si tienes dudas, escríbenos desde Contacto: te respondemos aquí mismo, dentro de HETNA.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <LocalizedClientLink href="/cotizar" className={BTN}>
          Cotizar lo que necesito
        </LocalizedClientLink>
        <LocalizedClientLink href="/contacto" className={BTN2}>
          Contacto
        </LocalizedClientLink>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
function Resultados({
  termino,
  r,
  cats,
  alLimpiar,
}: {
  termino: string
  r: { productos: ProductoTienda[]; categorias: CategoriaTienda[]; procesos: Proceso[] }
  cats: CategoriaTienda[]
  alLimpiar: () => void
}) {
  const nada = r.productos.length === 0
  const cotizar = () => {
    trackCotizarBusqueda(termino)
    // Se guarda en HETNA aunque el navegador se vaya enseguida
    try {
      const datos = JSON.stringify({ tipo: "busqueda_cotizar", termino })
      if (navigator.sendBeacon) navigator.sendBeacon("/api/tienda-interes", new Blob([datos], { type: "application/json" }))
      else fetch("/api/tienda-interes", { method: "POST", headers: { "Content-Type": "application/json" }, body: datos, keepalive: true })
    } catch {
      // la cotización sigue aunque no se guarde la métrica
    }
  }
  const etiquetaDe = (p: ProductoTienda) => cats.find((c) => c.clave === p.categoria)?.estado || "servicio"

  return (
    <section className="mt-5" aria-live="polite">
      <p className="fuente-mono text-[14px] text-[#5B6370]">
        {r.productos.length} {r.productos.length === 1 ? "producto" : "productos"} para «{termino}»
      </p>

      {r.productos.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.productos.map((p) => (
            <li key={p.id}>
              <LocalizedClientLink href={`/products/${p.handle}`} className="flex min-h-[44px] gap-3 rounded-md border border-[#D4D9DF] bg-white p-3 hover:border-[#1E2329]">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-[#F4F5F7]">
                  {p.imagen ? <Image src={p.imagen} alt="" fill sizes="80px" className="object-cover" /> : <Patron tipo="hex" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Etiqueta tipo={etiquetaDe(p)} />
                  <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-[#1E2329]">{p.titulo}</p>
                  <p className="fuente-mono mt-1 text-[14px] font-semibold text-[#1E2329]">
                    {p.precio == null ? "Precio por cotización" : p.precio === 0 ? "Gratis" : mxn(p.precio)}
                  </p>
                </div>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      )}

      {(r.categorias.length > 0 || r.procesos.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.categorias.map((c) => (
            <LocalizedClientLink key={c.clave} href={`/tienda/${c.clave}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[#C5CCD3] bg-white px-3 text-[14px] font-semibold text-[#1E2329] hover:border-[#1E2329]">
              {c.nombre}
              <span className="fuente-mono text-[12px] font-normal text-[#5B6370]">{c.conteo ? textoConteo(c.conteo, c.estado) : "Próximamente"}</span>
            </LocalizedClientLink>
          ))}
          {r.procesos.map((p) => (
            <LocalizedClientLink key={p.nombre} href={cotizarHref({ servicio: p.servicio, descripcion: termino, origen: "tienda-busqueda" })} onClick={cotizar} className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[#C5CCD3] bg-white px-3 text-[14px] font-semibold text-[#1E2329] hover:border-[#1E2329]">
              Cotizar {p.nombre.toLowerCase()}
            </LocalizedClientLink>
          ))}
        </div>
      )}

      {nada && (
        <div className="mt-4 rounded-md border-2 border-dashed border-[#E85D04] bg-white p-5 sm:p-6">
          <h3 className="fuente-condensada text-[26px] font-bold uppercase leading-none text-[#1E2329]">Todavía no vendemos «{termino}»</h3>
          <p className="mt-2 max-w-xl text-[15px] text-[#5B6370]">
            Pero te lo podemos conseguir: cotízalo y los talleres de HETNA te mandan su precio. Ya llevamos escrito lo que buscaste.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <LocalizedClientLink href={cotizarHref({ descripcion: termino, origen: "tienda-busqueda" })} onClick={cotizar} className={BTN}>
              Cotizar «{termino.length > 28 ? `${termino.slice(0, 26)}…` : termino}»
            </LocalizedClientLink>
            <button type="button" onClick={alLimpiar} className={BTN2}>
              Ver todas las categorías
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
