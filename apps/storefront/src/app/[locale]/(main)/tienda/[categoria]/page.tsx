// /mx/tienda/<categoria> — los productos de una categoría de la tienda.
// Una categoría sin productos muestra "Próximamente" con Avísame (nunca 404);
// una que no existe manda a /mx/tienda.
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import Image from "@/lib/imagenes/Imagen"
import { redirect } from "next/navigation"

import "@/components/hetna/tienda/fuentes-tienda.css"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { Avisame } from "@/components/hetna/tienda/Avisame"
import { BTN, BTN2, Etiqueta, Patron, mxn, textoConteo, textoDesde } from "@/components/hetna/tienda/piezas"
import { CATEGORIAS, catalogoTienda, ligaCotizar } from "@/lib/hetna/tienda"

export const revalidate = 60

const definicion = (clave: string) => CATEGORIAS.find((c) => c.clave === clave)

async function generateMetadataEs({ params }: { params: Promise<{ locale: string; categoria: string }> }): Promise<Metadata> {
  const { categoria } = await params
  const c = definicion(categoria)
  if (!c) return {}
  return {
    title: `${c.nombre} · Tienda HETNA CNC`,
    description: c.descripcion,
    // La versión oficial de cada categoría es la de /mx (las de otros países son copias)
    alternates: { canonical: `https://hetnacnc.com/mx/tienda/${c.clave}` },
  }
}

export default async function CategoriaTiendaPage({ params }: { params: Promise<{ locale: string; categoria: string }> }) {
  const { locale, categoria } = await params
  const def = definicion(categoria)
  if (!def) redirect(`/${locale}/tienda`)

  const catalogo = await catalogoTienda(locale)
  const cat = catalogo.categorias.find((c) => c.clave === def.clave)!
  const productos = catalogo.productos
    .filter((p) => p.categoria === def.clave)
    .sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity))
  const digital = def.como === "descarga" || def.como === "creditos"

  return (
    <main className="w-full bg-[#E9ECEF] text-[#1E2329]">
      <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <nav aria-label="Migas" className="text-[13px] text-[#5B6370]">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <LocalizedClientLink href="/" className="hover:text-[#1E2329] hover:underline">
                <TS>Inicio</TS>
              </LocalizedClientLink>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <LocalizedClientLink href="/tienda" className="hover:text-[#1E2329] hover:underline">
                <TS>Tienda</TS>
              </LocalizedClientLink>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-[#1E2329]">
              {def.nombre}
            </li>
          </ol>
        </nav>

        <header className="mt-4 flex flex-col gap-3">
          <div>
            <Etiqueta tipo={cat.estado} />
          </div>
          <h1 className="fuente-condensada text-[40px] font-bold uppercase leading-[0.9] sm:text-[56px]">{def.nombre}</h1>
          <p className="max-w-2xl text-[16px] text-[#3A414B]"><TS>{def.descripcion}</TS></p>
          {!catalogo.fallo && cat.conteo > 0 && (
            <p className="fuente-mono text-[14px] text-[#1E2329]">
              <TS>{textoConteo(cat.conteo, cat.estado)}</TS> · <TS>{textoDesde(cat.desde)}</TS>
              {digital ? " · Sin envío: es descarga" : ""}
            </p>
          )}
        </header>

        {catalogo.fallo ? (
          <p className="mt-6 rounded-md border border-[#F3C9A8] bg-[#FFF4EC] px-4 py-3 text-[14px] text-[#A84303]">
            <TS>No pudimos leer el catálogo en este momento. Recarga la página en un minuto.</TS>
          </p>
        ) : productos.length === 0 ? (
          <section className="mt-6 grid gap-6 rounded-md border border-[#D4D9DF] bg-white p-6 sm:grid-cols-[1fr_1.2fr] sm:p-8">
            <div className="h-40 overflow-hidden rounded sm:h-auto">
              <Patron tipo={def.patron} />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Etiqueta tipo="proximamente" />
              </div>
              <h2 className="fuente-condensada text-[30px] font-bold uppercase leading-none"><TS>Aún sin productos</TS></h2>
              <p className="text-[15px] text-[#5B6370]">
                <TS>Estamos sumando proveedores para esta categoría. Déjanos tu correo o celular y te avisamos en cuanto se publique el primero.</TS>
              </p>
              <div className="max-w-sm">
                <Avisame categoria={def.clave} nombre={def.nombre} />
              </div>
              <p className="text-[14px] text-[#5B6370]">
                <TS>¿Lo necesitas ya?</TS>{" "}
                <LocalizedClientLink href={ligaCotizar({ descripcion: def.nombre, origen: "tienda-categoria" })} className="font-semibold text-[#C24E03] underline">
                  <TS>Cotízalo con talleres</TS>
                </LocalizedClientLink>
                .
              </p>
            </div>
          </section>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {productos.map((p) => (
              <li key={p.id}>
                <LocalizedClientLink href={`/products/${p.handle}`} className="group flex h-full flex-col rounded-md border border-[#D4D9DF] bg-white hover:border-[#1E2329]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-t-md bg-[#F4F5F7]">
                    {p.imagen ? (
                      <Image src={p.imagen} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
                    ) : (
                      <Patron tipo={def.patron} />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div>
                      <Etiqueta tipo={cat.estado} />
                    </div>
                    <h2 className="line-clamp-2 text-[16px] font-semibold leading-snug text-[#1E2329]"><TS>{p.titulo}</TS></h2>
                    <div className="fuente-mono mt-auto flex items-baseline justify-between border-t border-dashed border-[#D4D9DF] pt-3 text-[14px]">
                      <span className="font-semibold">{p.precio == null ? "Precio por cotización" : p.precio === 0 ? "Gratis" : mxn(p.precio)}</span>
                      <span className="text-[13px] font-semibold text-[#C24E03] group-hover:underline"><TS>Ver →</TS></span>
                    </div>
                  </div>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-col gap-2 sm:flex-row">
          <LocalizedClientLink href="/tienda" className={BTN2}>
            <TS>← Todas las categorías</TS>
          </LocalizedClientLink>
          <LocalizedClientLink href="/cotizar" className={BTN}>
            <TS>¿No está? Cotízalo</TS>
          </LocalizedClientLink>
        </div>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
