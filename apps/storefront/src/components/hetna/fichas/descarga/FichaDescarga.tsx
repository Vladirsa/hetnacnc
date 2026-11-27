// Ficha de un diseño para descargar (DXF, STL…). Piezas que usa la ficha:
//   vistasGaleria   fotos del producto + vista 3D de muestra + esquema de medidas (si los trae)
//   ColumnaDescarga lo que va antes del botón: lo más importante, licencia, qué
//                   recibes y "Pedir una modificación"
//   AbajoDescarga   pieza fabricada, cómo funciona, pestañas y preguntas frecuentes
// Regla: nada de existencias, tiempos de envío ni reseñas que no existan.
// Todo sale del producto (descripción, metadata) o de reglas que ya son ciertas
// para cualquier descarga en HETNA.
import { TS } from "@/i18n/TS"
import "@/components/hetna/tienda/fuentes-tienda.css"
import Image from "@/lib/imagenes/Imagen"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { caracteristicasDe } from "@/components/hetna/fichas/LoMasImportante"
import { faq } from "@/lib/helpers/product-metadata"
import { esquemaDe, svgEsquema } from "@/lib/hetna/plano-diseno"
import { REGLAS_COMUNES, licenciaDe } from "@/lib/hetna/licencias"
import { datosDigital } from "@/lib/hetna/tipo-ficha"
import { formatosDe, programasPara } from "@/lib/hetna/formatos"
import { fotosFabricadaDe, coloresVistaDe, vistaPreviaDe } from "@/lib/hetna/ficha-tecnica"
import { htmlSeguro } from "@/lib/seguridad/html-seguro"
import type { VistaGaleria } from "./GaleriaDescarga"
import { Pestanas } from "./Pestanas"

type Producto = {
  handle?: string | null
  title?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  images?: { id?: string; url: string }[] | null
}

const meta = (p: Producto) => (p.metadata || {}) as Record<string, unknown>

export function vistasGaleria(p: Producto): VistaGaleria[] {
  const fotos: VistaGaleria[] = (p.images || [])
    .filter((i) => i?.url)
    .map((i, n) => ({ clave: i.id || `foto-${n}`, tipo: "foto", url: i.url, titulo: `Foto ${n + 1}` }))
  // La vista 3D va segunda: la primera foto sigue siendo la portada
  const vp = vistaPreviaDe(p.metadata)
  if (vp) fotos.splice(Math.min(1, fotos.length), 0, { clave: "modelo", tipo: "modelo", url: vp.url, formato: vp.formato, titulo: "Vista 3D", colores: coloresVistaDe(p.metadata) })
  const e = esquemaDe(p)
  return e ? [...fotos, { clave: "esquema", tipo: "esquema", svg: svgEsquema(e), titulo: "Detalle del patrón" }] : fotos
}

/** "Pedir una modificación": solicitud dentro de HETNA con el diseño ya ligado. */
export function ligaModificacion(p: Producto, vendedor?: { handle?: string | null } | null) {
  const q = new URLSearchParams({ necesidad: "Diseño" })
  if (vendedor?.handle) q.set("taller", vendedor.handle)
  q.set("descripcion", `una modificación del diseño "${p.title || "de la tienda"}"${p.handle ? ` (hetnacnc.com/mx/products/${p.handle})` : ""}`)
  return `/cotizar?${q.toString()}`
}

function formatos(p: Producto): string | null {
  const meta = datosDigital(p.metadata).filas.find(([k]) => k === "Formatos incluidos")?.[1]
  if (meta) return meta
  const hallados = formatosDe(p)
  return hallados.length ? hallados.join(", ") : null
}

const Marca = ({ si }: { si: boolean }) => (
  <span
    className={`mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${si ? "bg-[#E8F5EC] text-[#17803F]" : "bg-[#FDECEC] text-[#B91C1C]"}`}
    aria-label={si ? "Sí" : "No"}
  >
    <TS>{si ? "✓" : "✕"}</TS>
  </span>
)

/** Lo que se lee antes de pagar: pastillas, licencia y qué recibes. */
export function ColumnaDescarga({ product, vendedor }: { product: Producto; vendedor?: { handle?: string | null; name?: string | null } | null }) {
  // 23 nov 2026 (borrador aprobado): la licencia, "Qué recibes" y "Vendido
  // por" van en las pestañas de abajo, y "¿Lo quieres ya fabricado?" debajo
  // de "Fabrícalo"; en la columna de compra sólo quedan las características.
  const pastillas = caracteristicasDe(product.description)
  if (!pastillas.length) return null

  return (
    <div className="mt-4 flex flex-col gap-4" data-testid="columna-descarga">
      {pastillas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Lo más importante">
          {pastillas.map((t) => (
            <li key={t} className="rounded-full border border-[#D4D9DF] bg-[#F4F5F7] px-2.5 py-1 text-[12.5px] font-semibold leading-tight text-[#1E2329]">
              <TS>{t}</TS>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}

/** "¿Lo quieres ya fabricado o con otras medidas?": va debajo de "Fabrícalo". */
export function ModificarDiseno({ product, vendedor }: { product: Producto; vendedor?: { handle?: string | null; name?: string | null } | null }) {
  return (
      <section className="rounded-xl border border-dashed border-[#C5CCD3] bg-[#F7F8FA] p-4" aria-labelledby="titulo-modificar">
        <h2 id="titulo-modificar" className="m-0 text-[14.5px] font-bold text-[#1E2329]">
          <TS>¿Lo quieres ya fabricado o con otras medidas?</TS>
        </h2>
        <p className="m-0 mt-1 text-[13px] text-[#3A414B]">
          <TS>Pide una modificación</TS><TS>{vendedor?.name ? ` a ${vendedor.name}` : ""}</TS> <TS>o a los talleres de la red: te mandan su propuesta y pagas dentro de HETNA.</TS>
        </p>
        <LocalizedClientLink
          href={ligaModificacion(product, vendedor)}
          className="mt-2 inline-flex min-h-[44px] items-center rounded border border-[#1E2329] bg-white px-4 text-[14px] font-semibold text-[#1E2329] hover:bg-[#1E2329] hover:text-white"
        >
          <TS>Pedir una modificación</TS>
        </LocalizedClientLink>
        <a
          href="#fabricar"
          className="mt-2 ml-2 inline-flex min-h-[44px] items-center rounded bg-[#1E2329] px-4 text-[14px] font-semibold text-white hover:bg-[#3A414B]"
        >
          <TS>Cotizar fabricación</TS>
        </a>
      </section>
  )
}

/** Fotos reales de la pieza ya fabricada: del vendedor y de compradores (reseñas publicadas). */
function PiezaFabricada({ fotos, compradores }: { fotos: string[]; compradores: string[] }) {
  if (!fotos.length && !compradores.length) return null
  return (
    <section aria-labelledby="titulo-fabricada" className="rounded-md border border-[#D4D9DF] bg-white p-5">
      <h2 id="titulo-fabricada" className="fuente-condensada m-0 text-[26px] font-bold uppercase leading-none text-[#1E2329]">
        <TS>La pieza fabricada</TS>
      </h2>
      <p className="m-0 mt-1 text-[13.5px] text-[#5B6370]"><TS>Fotos reales de la pieza ya cortada o impresa con este archivo.</TS></p>
      {fotos.length > 0 && (
        <>
          <p className="m-0 mt-3 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#5B6370]"><TS>Del vendedor</TS></p>
          <ul className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((u) => (
              <li key={u} className="relative aspect-square overflow-hidden rounded border border-[#E2E5E9] bg-[#F4F5F7]">
                <a href={u} target="_blank" rel="noopener noreferrer" aria-label="Ver foto de la pieza fabricada">
                  <Image src={u} alt="Pieza fabricada" fill sizes="(min-width: 640px) 180px, 33vw" className="object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {compradores.length > 0 && (
        <>
          <p className="m-0 mt-3 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#5B6370]"><TS>De compradores</TS></p>
          <ul className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {compradores.map((id) => (
              <li key={id} className="relative aspect-square overflow-hidden rounded border border-[#E2E5E9] bg-[#F4F5F7]">
                <a href={`/api/resena-foto/${id}`} target="_blank" rel="noopener noreferrer" aria-label="Ver foto de un comprador">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/resena-foto/${id}`} alt="Foto de un comprador" loading="lazy" className="h-full w-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

const PASOS = [
  { n: "01", t: "Pagas", d: "Dentro de HETNA, con Mercado Pago. Tu pago queda protegido." },
  { n: "02", t: "Descargas", d: "" }, // su texto lleva liga, va abajo
  { n: "03", t: "Cortas", d: "Lo abres en tu CAM (Vectric, Fusion, ArtCAM…), eliges herramienta y material, y a la máquina." },
]

/** Lo que va debajo: cómo funciona, pestañas y preguntas frecuentes. */
export function AbajoDescarga({
  product,
  fotosCompradores = [],
  vendido,
}: {
  product: Producto
  fotosCompradores?: string[]
  /** Tarjeta del vendedor, para la pestaña "Vendido por" */
  vendido?: React.ReactNode
}) {
  const preguntas = faq(product.metadata)
  const pastillas = caracteristicasDe(product.description)
  const filas = datosDigital(product.metadata).filas
  const { licencia, piezas } = licenciaDe(product.metadata)
  const m = meta(product)
  const fmt = formatos(product)
  const programas = programasPara(formatosDe(product))
  const otros = filas.filter(([k]) => k !== "Formatos incluidos")

  return (
    <div className="flex flex-col gap-6">
      <Pestanas
        pestanas={[
          {
            clave: "descripcion",
            titulo: "Descripción",
            contenido: product.description ? (
              <div className="product-details text-[15px] leading-relaxed text-[#2E333A]" dangerouslySetInnerHTML={{ __html: htmlSeguro(product.description) }} />
            ) : (
              <p className="m-0 text-[14px] text-[#5B6370]"><TS>El vendedor no escribió una descripción.</TS></p>
            ),
          },
          {
            clave: "especificaciones",
            titulo: "Especificaciones",
            contenido: (
              <dl className="m-0 grid grid-cols-1 gap-x-6 text-[14px] sm:grid-cols-[minmax(160px,auto)_1fr]">
                {[
                  ...(filas.some(([k]) => k === "Formatos incluidos") || !formatosDe(product).length
                    ? []
                    : ([["Formatos incluidos", formatosDe(product).join(", ")]] as [string, string][])),
                  ...filas,
                  ...(programasPara(formatosDe(product)).length
                    ? ([["Compatible con", programasPara(formatosDe(product), 8).join(", ")]] as [string, string][])
                    : []),
                  ...(pastillas.length ? ([["Características", pastillas.join(" · ")]] as [string, string][]) : []),
                  ["Licencia", piezas ? `${licencia.nombre} (hasta ${piezas.toLocaleString("es-MX")} piezas)` : licencia.nombre] as [string, string],
                  ["Entrega", "Descarga digital. No se envía nada por paquetería."] as [string, string],
                  ...(typeof m.archivo_gratis === "boolean" && m.archivo_gratis ? ([["Precio", "Gratis, con tu cuenta"]] as [string, string][]) : []),
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="border-b border-[#EEF0F2] py-2 font-semibold text-[#1E2329]"><TS>{k}</TS></dt>
                    <dd className="fuente-mono m-0 border-b border-[#EEF0F2] py-2 text-[13.5px] text-[#2E333A]"><TS>{v}</TS></dd>
                  </div>
                ))}
              </dl>
            ),
          },
          {
            clave: "licencia",
            titulo: "Licencia",
            contenido: (
              <div className="text-[14px] text-[#2E333A]">
                <p className="m-0">
                  <strong><TS>Licencia</TS> <TS>{licencia.nombre}</TS>.</strong> <TS>{licencia.resumen}</TS>
                </p>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {licencia.permisos.map((x) => (
                    <li key={x.que} className="flex gap-2">
                      <Marca si={x.si} />
                      <span>
                        <TS>{x.que}</TS>
                        {x.nota ? <span className="text-[#5B6370]"> (<TS>{x.nota}</TS>)</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 mt-4 font-semibold text-[#1E2329]"><TS>Aplica a todas las licencias</TS></p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[#3A414B]">
                  {REGLAS_COMUNES.map((r) => (
                    <li key={r}><TS>{r}</TS></li>
                  ))}
                </ul>
                <p className="m-0 mt-3 text-[13px] text-[#5B6370]">
                  <TS>Sin devolución una vez descargado, salvo que el archivo esté dañado o no corresponda a lo anunciado.</TS><TS>{" "}</TS>
                  <LocalizedClientLink href="/devoluciones" className="underline">
                    <TS>Ver política</TS>
                  </LocalizedClientLink><TS>{" "}</TS>
                  ·<TS>{" "}</TS>
                  <LocalizedClientLink href="/licencias-disenos" className="underline">
                    <TS>Comparar las tres licencias</TS>
                  </LocalizedClientLink>
                </p>
              </div>
            ),
          },
          {
            clave: "recibes",
            titulo: "Qué recibes",
            contenido: (
          <section aria-labelledby="titulo-recibes">
            <h2 id="titulo-recibes" className="sr-only">
              <TS>Qué recibes</TS>
            </h2>
            <ul className="mt-2 grid gap-1.5 text-[13.5px] text-[#1E2329]">
              <li className="flex gap-2">
                <Marca si />
                <span><TS>{fmt ? `El archivo en ${fmt}` : "El archivo del diseño"}</TS><TS>, listo para tu CAM.</TS></span>
              </li>
              {programas.length > 0 && (
                <li className="flex gap-2">
                  <Marca si />
                  <span>
                    <TS>Se abre en:</TS> <b className="font-semibold"><TS>{programas.join(", ")}</TS></b>
                    <TS>{" "}</TS><TS>y cualquier programa que lea</TS> <TS>{formatosDe(product).join(" o ")}</TS>.
                  </span>
                </li>
              )}
              {otros.map(([k, v]) => (
                <li key={k} className="flex gap-2">
                  <Marca si />
                  <span>
                    <TS>{k}</TS>: <TS>{v}</TS>
                  </span>
                </li>
              ))}
              <li className="flex gap-2">
                <Marca si />
                <span>
                  <TS>Lo descargas en</TS><TS>{" "}</TS>
                  <LocalizedClientLink href="/user/descargas" className="font-semibold underline">
                    <TS>Mi cuenta › Mis descargas</TS>
                  </LocalizedClientLink><TS>{" "}</TS>
                  <TS>en cuanto se confirma el pago.</TS>
                </span>
              </li>
              <li className="flex gap-2">
                <Marca si />
                <span><TS>Licencia</TS> <TS>{licencia.nombre}</TS> <TS>a tu nombre.</TS></span>
              </li>
            </ul>
          </section>
            ),
          },
          ...(vendido ? [{ clave: "vendedor", titulo: "Vendido por", contenido: vendido }] : []),
        ]}
      />
      <PiezaFabricada fotos={fotosFabricadaDe(product.metadata)} compradores={fotosCompradores.slice(0, 8)} />

      <section aria-labelledby="titulo-como" className="rounded-md border border-[#D4D9DF] bg-white p-5">
        <h2 id="titulo-como" className="fuente-condensada m-0 text-[26px] font-bold uppercase leading-none text-[#1E2329]">
          <TS>Cómo funciona</TS>
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {PASOS.map((p) => (
            <li key={p.n} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="fuente-mono flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#E85D04] text-[15px] font-bold text-white">{p.n}</span>
              <div>
                <p className="m-0 text-[16px] font-bold text-[#1E2329]"><TS>{p.t}</TS></p>
                <p className="m-0 mt-0.5 text-[14px] leading-snug text-[#5B6370]">
                  {p.n === "02" ? (
                    <>
                      <TS>El archivo aparece en</TS><TS>{" "}</TS>
                      <LocalizedClientLink href="/user/descargas" className="font-semibold text-[#1E2329] underline">
                        <TS>Mi cuenta › Mis descargas</TS>
                      </LocalizedClientLink><TS>{" "}</TS>
                      <TS>en cuanto se confirma el pago.</TS>
                    </>
                  ) : (
                    p.d
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>


      {preguntas.length > 0 && (
        <section aria-labelledby="titulo-faq" className="rounded-md border border-[#D4D9DF] bg-white p-5">
          <script
            id="ld-faq-product"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: preguntas.map((q) => ({ "@type": "Question", name: q.pregunta, acceptedAnswer: { "@type": "Answer", text: q.respuesta } })),
              }).replace(/</g, "\\u003c"),
            }}
          />
          <h2 id="titulo-faq" className="fuente-condensada m-0 text-[26px] font-bold uppercase leading-none text-[#1E2329]">
            <TS>Preguntas frecuentes</TS>
          </h2>
          <div className="mt-3 divide-y divide-[#EEF0F2]">
            {preguntas.map((q) => (
              <details key={q.pregunta} className="group py-1">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[#1E2329]">
                  <TS>{q.pregunta}</TS>
                  <span className="text-[20px] text-[#E85D04] transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="m-0 pb-3 text-[14.5px] leading-relaxed text-[#3A414B]"><TS>{q.respuesta}</TS></p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
