import type { Metadata } from "next"
import { notFound } from "next/navigation"

import DescargaPlano from "@/components/hetna/planos/DescargaPlano"
import MedidasPlano from "@/components/hetna/planos/MedidasPlano"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { acomodoPorMaterial, dxfPlano, hojasNecesarias, listaCorte, medidasGenerales, puntosBarrenos } from "@/lib/planos/calculo"
import { tornilleria, unionesDe } from "@/lib/planos/uniones"
import { cajasRuedas, piezasPorPaso, svgArmado, svgExplotado, svgHoja, svgPaso } from "@/lib/planos/dibujo"
import { medidasDe, medidasDeConsulta, redimensionarQueQuepa } from "@/lib/planos/medidas"
import { buscarPlano } from "@/lib/planos/fuente"
import { MATERIALES_PLANO, type PiezaPlano } from "@/lib/planos/modelos"
import { cotizarPlano } from "@/lib/planos/precio"
import { pesos, type ConfigPrecios } from "@/lib/cotizador/estimador"
import TalleresPlano from "@/components/hetna/planos/TalleresPlano"
import { listOffers } from "@/lib/data/offers"
import { listProducts } from "@/lib/data/products"
import type { StoreOffer } from "@/lib/helpers/buybox"
import { variantesPlano } from "@/lib/planos/tienda"

// El producto del plano en la tienda (plano-<slug>) con las ofertas de los talleres
async function ofertasDelPlano(slug: string, locale: string) {
  try {
    const { response } = await listProducts({ countryCode: locale, queryParams: { handle: [`plano-${slug}`], limit: 1 } as never })
    const prod = response.products[0]
    if (!prod) return null
    const { offers } = await listOffers({ productId: prod.id, countryCode: locale })
    return { prod, offers: offers as StoreOffer[] }
  } catch {
    return null
  }
}

// Ajustes de precio del dueño (Panel de HETNA > Precios de la calculadora)
async function configPrecios(): Promise<ConfigPrecios | null> {
  try {
    const r = await fetch(`${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/hetna-precios`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      next: { revalidate: 300 },
    })
    return r.ok ? ((await r.json()).cfg as ConfigPrecios) || null : null
  } catch {
    return null
  }
}

// Sin generateStaticParams: el layout raíz lee headers() y cookies(), así que
// la página se arma en cada visita como el resto del sitio (prerenderizada
// daba 500 en producción).

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { slug } = await params
  const borrador = String((await searchParams).borrador || "")
  const pl = await buscarPlano(slug, borrador || undefined)
  if (!pl) return {}
  return {
    // la vista previa de un borrador no se indexa
    ...(borrador ? { robots: { index: false, follow: false } } : {}),
    alternates: { canonical: `https://hetnacnc.com/mx/planos/${pl.slug}` },
    title: `Plano gratis: ${pl.nombre} (lista de corte y DXF)`,
    description: `${pl.resumen} Plano con lista de corte, acomodo en la hoja, pasos de armado y DXF para router CNC.`,
  }
}

// Detalle de la unión a tope: la pieza A presenta su cara, el tornillo entra al canto de B
const DETALLE_TOPE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 200" role="img" aria-label="Unión a tope con tornillo" style="width:100%;height:auto">' +
  '<rect x="30" y="40" width="40" height="140" fill="#E9C995" stroke="#6B4E2A" stroke-width="2"/>' +
  '<rect x="70" y="100" width="160" height="40" fill="#F1DDB5" stroke="#6B4E2A" stroke-width="2"/>' +
  '<rect x="14" y="116" width="96" height="8" fill="#5A6472"/><path d="M14 112 L14 128 L8 120 Z" fill="#5A6472"/>' +
  '<line x1="22" y1="112" x2="22" y2="128" stroke="#FAF9F6" stroke-width="2"/>' +
  '<text x="50" y="30" font-size="13" font-family="Inter,Arial,sans-serif" text-anchor="middle" fill="#142033">A (cara)</text>' +
  '<text x="150" y="92" font-size="13" font-family="Inter,Arial,sans-serif" text-anchor="middle" fill="#142033">B (canto)</text>' +
  '<text x="130" y="170" font-size="12" font-family="Inter,Arial,sans-serif" text-anchor="middle" fill="#6B6A63">barreno guía de 3 mm en A</text>' +
  "</svg>"

const Titulo = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <h2 className="m-0 flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-wide text-[#FF9F57]">
    <span className="rounded bg-[#FF6A1A] px-1.5 text-[12px] text-white">{n}</span>
    {children}
  </h2>
)

export default async function PlanoPagina({ params, searchParams }: { params: Promise<{ slug: string; locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, locale } = await params
  const consulta = await searchParams
  const borrador = typeof consulta.borrador === "string" ? consulta.borrador : ""
  const base = await buscarPlano(slug, borrador || undefined)
  if (!base) notFound()
  // "Modifica las medidas": ?ancho=&fondo=&alto= (mm)
  const { plano: pl, ajustado } = redimensionarQueQuepa(base, medidasDeConsulta(consulta))
  const original = medidasDe(base.piezas, base.ruedas)
  const cambiado = pl !== base
  const [cfg, tienda] = await Promise.all([configPrecios(), ofertasDelPlano(slug, locale)])

  const m = medidasGenerales(pl)
  const { filas } = listaCorte(pl)
  const acs = acomodoPorMaterial(filas)
  const hojas = hojasNecesarias(acs)
  const pasos = piezasPorPaso(pl.piezas, pl.pasos)
  const ruedas = cajasRuedas(pl.piezas, pl.ruedas)
  const previas: Set<PiezaPlano>[] = []
  pasos.reduce((acum, s) => { previas.push(new Set(acum)); s.forEach((q) => acum.add(q)); return acum }, new Set<PiezaPlano>())
  const dxfs = dxfPlano(acs, filas)
  const filaDe = new Map(filas.map((f) => [f.letra, f]))
  // Uniones: tornillos y clavos calculados de la geometría (lib/planos/uniones.ts)
  const uniones = unionesDe(pl)
  const torn = tornilleria(pl, uniones)
  const resumenUniones = (() => {
    const base = (n: string) => n.replace(/\s\d+(?=\s·|$)/, "").trim()
    const m = new Map<string, { texto: string; cantidad: number }>()
    for (const u of uniones.uniones) {
      const clave = `${base(pl.piezas[u.a].nombre)}|${base(pl.piezas[u.b].nombre)}|${u.fijacion}|${u.largoTornillo || ""}`
      const t = m.get(clave) || { texto: `${base(pl.piezas[u.a].nombre)} → ${base(pl.piezas[u.b].nombre)}: ${u.fijacion === "tornillo" ? `tornillo de ${u.largoTornillo}` : "clavo o grapa"}`, cantidad: 0 }
      t.cantidad += u.cantidad * (pl.juego?.cantidad ?? 1)
      m.set(clave, t)
    }
    return [...m.values()]
  })()
  // la tornillería exacta reemplaza las líneas aproximadas de tornillos y clavos
  const herrajes = [
    ...torn.tornillos.map((t) => `${t.cantidad} tornillos para madera de ${t.largo}`),
    ...(torn.clavos ? [`${torn.clavos} clavos de 3/4" o grapas`] : []),
    ...pl.herrajes.filter((h) => !(torn.tornillos.length && /^tornillos para madera/i.test(h)) && !(torn.clavos && /^(clavos|grapas)/i.test(h))),
  ]
  const cot = (() => {
    try {
      return { ok: true as const, ...cotizarPlano(pl, cfg) }
    } catch {
      return { ok: false as const }
    }
  })()
  // A la medida: los precios de los talleres se ajustan como cambia el costo de fabricarlo
  const factorMedida = (() => {
    if (!cambiado || !cot.ok) return 1
    try {
      return cot.precio / cotizarPlano(base, cfg).precio
    } catch {
      return 1
    }
  })()
  const caja = "rounded-2xl border border-white/10 bg-[#1B2A42] p-4"

  return (
    <main className="w-full bg-[#FAF9F6]">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm } body * { visibility: hidden } #lamina, #lamina * { visibility: visible } #lamina { position: absolute; inset: 0; } }`}</style>
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 lg:px-6">
        <div className="mb-4 flex flex-wrap gap-1.5 text-[13px] text-[#6B6A63] print:hidden">
          <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
          <span>/</span>
          <LocalizedClientLink href="/planos" className="hover:text-[#B34D07]">Planos</LocalizedClientLink>
          <span>/</span>
          <span className="font-medium text-[#1B1B18]">{pl.nombre}</span>
        </div>

        {borrador ? (
          <p className="mb-4 rounded-xl border border-[#FFD3B0] bg-[#FFF4E5] px-4 py-3 text-[14px] font-semibold text-[#8A4B00] print:hidden">
            Vista previa de un borrador: todavía no está publicado. Apruébalo o recházalo en el panel (Planos IA).
          </p>
        ) : null}
        <MedidasPlano key={`${m.ancho}-${m.fondo}-${m.alto}`} original={original} actual={m} ajustado={ajustado} />

        <article id="lamina" className="overflow-hidden rounded-3xl bg-[#142033] p-5 text-white sm:p-8" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-4">
            <div>
              <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-[#FF9F57]">Plano HETNA CNC · hetnacnc.com/planos</p>
              <h1 className="font-display m-0 mt-1 text-[28px] font-bold leading-tight sm:text-[36px]">{pl.nombre}</h1>
              <p className="m-0 mt-1 max-w-[680px] text-[14px] text-white/80">{pl.descripcion}</p>
            </div>
            <p className="m-0 text-[13px] text-white/75">
              {m.ancho} × {m.fondo} × {m.alto} mm · {pl.nivel} · {pl.horas}
              {pl.juego ? ` · se cortan ${pl.juego.cantidad} ${pl.juego.nombre}` : ""}
              {cambiado ? <span className="block text-[#FF9F57]">Medidas modificadas (original: {original.ancho} × {original.fondo} × {original.alto} mm)</span> : null}
            </p>
          </header>

          <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`${caja} bg-[#F6F1E7]`}>
              <Titulo n="1">Mueble armado</Titulo>
              <div className="mt-2 rounded-xl bg-[#FAF9F6] p-2" dangerouslySetInnerHTML={{ __html: svgArmado(pl.piezas, `${pl.nombre} armado`, ruedas) }} />
            </div>
            <div className={caja}>
              <Titulo n="2">Vista explotada</Titulo>
              <div className="mt-2 rounded-xl bg-[#FAF9F6] p-2" dangerouslySetInnerHTML={{ __html: svgExplotado(pl.piezas, `${pl.nombre} explotado`) }} />
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className={caja}>
              <Titulo n="3">Lista de corte</Titulo>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-[12.5px]">
                  <thead className="text-[#FF9F57]">
                    <tr><th className="py-1 pr-2">Pieza</th><th className="pr-2">Descripción</th><th className="pr-2">Cant.</th><th className="pr-2">Largo</th><th className="pr-2">Ancho</th><th className="pr-2">Esp.</th></tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.letra} className="border-t border-white/10">
                        <td className="py-1 pr-2 font-extrabold">{f.letra}</td>
                        <td className="pr-2 text-white/85">{f.nombre}</td>
                        <td className="pr-2">{f.cantidad}</td>
                        <td className="pr-2">{f.largo}</td>
                        <td className="pr-2">{f.ancho}</td>
                        <td className="pr-2">{f.grosor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="m-0 mt-2 text-[11.5px] text-white/60">Medidas en mm. Material: {[...new Set(filas.map((f) => MATERIALES_PLANO[f.material].nombre))].join(", ")}.</p>
            </div>
            <div className={caja}>
              <Titulo n="4">Acomodo en la hoja</Titulo>
              <p className="m-0 mt-1 text-[12.5px] text-white/75">{hojas.map((h) => `${h.hojas} ${h.hojas === 1 ? "hoja" : "hojas"} de ${h.nombre}`).join(" · ")} (2440 × 1220 mm)</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {acs.flatMap((a) => a.acomodo.hojas.map((h, i) => (
                  <figure key={`${a.material}-${i}`} className="m-0 rounded-xl bg-[#FAF9F6] p-1.5">
                    <div dangerouslySetInnerHTML={{ __html: svgHoja(h, `${a.nombre} hoja ${i + 1}`, (c) => puntosBarrenos(c, filaDe.get(c.nombre))) }} />
                    <figcaption className="text-center text-[11px] text-[#6B6A63]">{a.nombre} · hoja {i + 1}</figcaption>
                  </figure>
                )))}
              </div>
            </div>
          </section>

          <section className={`${caja} mt-4`}>
            <Titulo n="5">Pasos de armado</Titulo>
            <ol className="m-0 mt-3 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 lg:grid-cols-5">
              {pl.pasos.map((ps, i) => (
                <li key={ps.titulo} className="rounded-xl bg-[#FAF9F6] p-2 text-[#142033]">
                  <div dangerouslySetInnerHTML={{ __html: svgPaso(pl.piezas, previas[i], pasos[i], `Paso ${i + 1}: ${ps.titulo}`) }} />
                  <p className="m-0 mt-1 text-[13px] font-bold">{i + 1}. {ps.titulo}</p>
                  <p className="m-0 text-[12px] text-[#40403A]">{ps.nota}</p>
                </li>
              ))}
            </ol>
          </section>

          {resumenUniones.length ? (
            <section className={`${caja} mt-4`}>
              <Titulo n="6">Uniones y tornillería</Titulo>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[1fr_260px]">
                <div>
                  <p className="m-0 text-[13px] text-white/80">
                    {torn.tornillos.map((t) => `${t.cantidad} tornillos de ${t.largo}`).join(" · ")}
                    {torn.clavos ? ` · ${torn.clavos} clavos o grapas` : ""}
                    {torn.barrenos ? ` · ${torn.barrenos} barrenos guía de 3 mm (en el DXF, capa «barrenos»; puntos naranjas en el acomodo)` : ""}
                  </p>
                  <ul className="m-0 mt-2 grid list-disc grid-cols-1 gap-x-6 pl-5 text-[12.5px] text-white/85 sm:grid-cols-2">
                    {resumenUniones.map((u) => (
                      <li key={u.texto}>
                        {u.texto} <b>×{u.cantidad}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="m-0 mt-2 text-[11.5px] text-white/60">Unión a tope con pegamento blanco y tornillo. Avellana los barrenos para que la cabeza quede al ras; los clavos o grapas son para respaldos y fondos delgados. Puertas y tapas van con bisagras.</p>
                </div>
                <div className="rounded-xl bg-[#FAF9F6] p-2" dangerouslySetInnerHTML={{ __html: DETALLE_TOPE }} />
              </div>
            </section>
          ) : null}

          <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={caja}>
              <Titulo n="7">Herrajes</Titulo>
              <ul className="m-0 mt-2 list-disc pl-5 text-[13px] text-white/85">{herrajes.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
            <div className={caja}>
              <Titulo n="8">Herramientas</Titulo>
              <ul className="m-0 mt-2 list-disc pl-5 text-[13px] text-white/85">{pl.herramientas.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
            <div className={caja}>
              <Titulo n="9">Notas</Titulo>
              <ul className="m-0 mt-2 list-disc pl-5 text-[13px] text-white/85">
                {pl.notas.map((h) => <li key={h}>{h}</li>)}
                <li>Revisa el grosor real de tu triplay antes de cortar.</li>
              </ul>
            </div>
          </section>
        </article>

        {tienda ? (
          <div className="mt-6 print:hidden">
            <TalleresPlano
              offers={tienda.offers}
              variantes={variantesPlano(tienda.prod as never)}
              locale={locale}
              factorMedida={factorMedida}
              medidaTexto={`${m.ancho} × ${m.fondo} × ${m.alto} mm`}
            />
          </div>
        ) : null}

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 print:hidden">
          <DescargaPlano slug={pl.slug} nombre={cambiado ? `${pl.nombre} ${m.ancho}x${m.fondo}x${m.alto}` : pl.nombre} dxfs={dxfs} />
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="m-0 text-[16px] font-bold text-[#142033]">¿No tienes router o prefieres que te lo corten?</p>
            <p className="m-0 text-[14px] text-[#40403A]">Un taller de HETNA te corta las piezas o te entrega el mueble armado. Pide propuestas con el plano: es gratis.</p>
            {cot.ok ? (
              <div className="rounded-xl bg-[#F6F1E7] p-3 text-[14px] text-[#142033]">
                <p className="m-0 font-bold">Kit de piezas cortadas y lijadas{cambiado ? ` a ${m.ancho} × ${m.fondo} × ${m.alto} mm` : ""}</p>
                <p className="m-0 mt-1 text-[22px] font-extrabold">{pesos(cot.min)} – {pesos(cot.max)} <span className="text-[13px] font-semibold text-[#6B6A63]">aprox., más envío</span></p>
                <p className="m-0 mt-1 text-[13px] text-[#40403A]">
                  {cot.piezas} piezas · {cot.hojas} {cot.hojas === 1 ? "hoja" : "hojas"} de triplay · peso con empaque ≈ {cot.pesoKg} kg · fabricación ≈ {cot.diasFabricacion} días hábiles más el envío
                </p>
                <p className="m-0 mt-1 text-[12px] text-[#6B6A63]">Precio de referencia de router CNC en México; el taller confirma el precio final. No incluye herrajes ni armado.</p>
              </div>
            ) : null}
            <LocalizedClientLink href="/cotizar" className="inline-flex w-fit items-center rounded-[12px] bg-[#142033] px-5 py-3 text-[15px] font-bold text-white">
              Pedir que me lo fabriquen
            </LocalizedClientLink>
            <LocalizedClientLink href="/planos" className="text-[14px] font-semibold text-[#B34D07]">Ver más planos →</LocalizedClientLink>
          </div>
        </section>
      </div>
    </main>
  )
}
