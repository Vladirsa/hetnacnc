import type { Metadata } from "next"
import { descripcionCorta } from "@/lib/helpers/seo"
import { notFound } from "next/navigation"

import { EscanearPieza } from "@/components/hetna/disenar/EscanearPieza"
import { Herramienta } from "@/components/hetna/estudio/Herramienta"
import { JsonLd } from "@/components/hetna/JsonLd"
import { ContarUsoHerramienta } from "@/components/hetna/estudio/ContarUsoHerramienta"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { ESCANEAR, ESTUDIOS, buscarHerramientaDiseno, estudioDe, type HerramientaDiseno } from "@/lib/hetna/disenar"
import { migas } from "@/lib/hetna/schema"
import { CATEGORIAS, MODELOS } from "@/lib/generador/modelos3d"


// Una herramienta abierta dentro del estudio 3D o 2D (pantalla completa). La
// barra con las herramientas la pone el layout de (estudio).
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; herramienta: string }> }

const SLUGS = new Set(["caja-con-juntas", "letreros", "letras-3d", "llaveros", "texturizador", "cortadores-galletas", "rompecabezas", "vectorizador", "despiece-muebles", "plantillas-empaque", "grabado-foto", "litofania-relieve", "patrones-radiales", "convertidor", "svg-a-stl", "anidado-piezas", "celosias", "patron-voronoi", "celosia-desde-imagen", "bisagra-viva", "codigo-qr", "rebanado-capas", "engranes", "relojes", "organizador-cajon", "lamparas-capas", "estencil-letras", "marcos-portarretratos", "esferas-navidad", "muebles-ensamble", "muebles-desde-imagen", "molduras-tallados", "costillas-desde-imagen", "partir-3d", "moldes-3d", "modelos-3d"])

// "letreros" se pinta oscuro dentro de Letreros y placas (los tres modos)
// las herramientas que juntan varias (Imagen, Archivos) ponen su propio tema
const OSCURAS = new Set(["rompecabezas", "letras-3d", "caja-con-juntas", "patrones-radiales", "letreros", "grabado-foto", "litofania-relieve", "convertidor", "anidado-piezas", "svg-a-stl", "llaveros", "texturizador", "cortadores-galletas", "vectorizador", "celosias", "patron-voronoi", "celosia-desde-imagen", "bisagra-viva", "codigo-qr", "rebanado-capas", "engranes", "relojes", "organizador-cajon", "lamparas-capas", "estencil-letras", "marcos-portarretratos", "esferas-navidad", "despiece-muebles", "muebles-ensamble", "muebles-desde-imagen", "molduras-tallados", "costillas-desde-imagen"])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { herramienta } = await params
  const h = buscarHerramientaDiseno(herramienta)
  if (!h) return {}
  const descripcion = h.meta || descripcionCorta(h.descripcion)
  const url = `${SITIO}/mx/disenar/${h.slug}`
  // Al compartir en WhatsApp/Facebook: el título y la descripción de la herramienta
  // (sin esto salían los genéricos de HETNA del layout)
  const imagen = h.imagen ? { url: h.imagen, alt: h.nombre } : { url: "/og-hetna.png", width: 1200, height: 630, alt: "HETNA CNC" }
  return {
    title: h.titulo,
    description: descripcion,
    alternates: {
      canonical: url,
      languages: { "es-MX": url },
    },
    openGraph: { type: "website", locale: "es_MX", siteName: "HETNA CNC", title: `${h.titulo} | HETNA CNC`, description: descripcion, url, images: [imagen] },
    twitter: { card: "summary_large_image", title: `${h.titulo} | HETNA CNC`, description: descripcion, images: [imagen.url] },
  }
}

// Datos estructurados: qué es la herramienta (aplicación web gratis de HETNA) y
// dónde está (migas). Sólo datos reales: nada de calificaciones ni reseñas.
const datosHerramienta = (h: HerramientaDiseno) => {
  const url = `${SITIO}/mx/disenar/${h.slug}`
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name: h.nombre,
      alternateName: h.titulo,
      description: h.descripcion,
      url,
      applicationCategory: "DesignApplication",
      operatingSystem: "Navegador web",
      browserRequirements: "Requiere JavaScript",
      inLanguage: "es-MX",
      ...(h.imagen ? { image: `${SITIO}${h.imagen}` } : {}),
      ...(h.acceso === "gratis"
        ? { isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" } }
        : {}),
      provider: { "@type": "Organization", "@id": `${SITIO}/#organization`, name: "HETNA CNC", url: SITIO },
    },
    migas([
      { nombre: "Inicio", ruta: `${SITIO}/mx` },
      { nombre: "Diseñar", ruta: `${SITIO}/mx/disenar` },
      { nombre: h.nombre },
    ]),
  ]
}

// Guía con precio y talleres para mandar a fabricar lo que sale de la herramienta (lib/seo/guias.ts)
const GUIA_DE_HERRAMIENTA: Record<string, [string, string]> = {
  celosias: ["celosias-mdf-a-medida", "¿No tienes máquina? Celosías de MDF a medida con precio al instante"],
  "celosia-desde-imagen": ["celosias-mdf-a-medida", "¿No tienes máquina? Celosías de MDF a medida con precio al instante"],
  "letras-3d": ["letras-3d-acrilico", "¿No tienes máquina? Letras 3D de acrílico y MDF con precio al instante"],
  "moldes-3d": ["moldes-3d-resina", "¿No tienes impresora? Moldes impresos en 3D con precio al instante"],
  "partir-3d": ["impresion-3d", "¿No tienes impresora? Impresión 3D con precio al instante"],
  "modelos-3d": ["impresion-3d", "¿No tienes impresora? Impresión 3D con precio al instante"],
  "grabado-foto": ["grabado-laser", "¿No tienes láser? Grabado láser con precio al instante"],
  "codigo-qr": ["grabado-laser", "¿No tienes láser? Grabado láser con precio al instante"],
}

// Texto visible debajo de la herramienta (sale en el HTML del servidor): qué hace
// y las demás herramientas del mismo estudio. Para quien llega desde el buscador
// y para los buscadores e IA, que no ven lo que dibuja el navegador.
function AcercaDe({ h }: { h: HerramientaDiseno }) {
  const otras = ESTUDIOS[estudioDe(h.slug)].herramientas.filter((o) => o.slug !== h.slug)
  return (
    <section aria-labelledby="acerca-herramienta" className="border-t border-[#2B3648] bg-[#0D1015] px-4 py-6 text-[#C9CED6] lg:px-8">
      <div className="mx-auto max-w-[920px]">
        <h2 id="acerca-herramienta" className="m-0 text-[16px] font-semibold text-white">{h.titulo}</h2>
        <p className="m-0 mt-1.5 text-[14px] leading-relaxed">{h.descripcion}</p>
        {GUIA_DE_HERRAMIENTA[h.slug] && (
          <p className="m-0 mt-1.5 text-[14px]">
            <LocalizedClientLink href={`/cnc/${GUIA_DE_HERRAMIENTA[h.slug][0]}`} className="font-semibold text-[#FF8A47] hover:text-white">
              {GUIA_DE_HERRAMIENTA[h.slug][1]} →
            </LocalizedClientLink>
          </p>
        )}
        {h.slug === "modelos-3d" && (
          // Cada modelo tiene su página (disenar/modelos-3d/[modelo]): ligas en el HTML para los buscadores
          <div className="mt-3">
            {CATEGORIAS.map((c) => (
              <nav key={c.id} aria-label={c.nombre} className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="w-[120px] shrink-0 font-semibold text-white">{c.nombre}</span>
                {MODELOS.filter((m) => m.categoria === c.id).map((m) => (
                  <LocalizedClientLink key={m.id} href={`/disenar/modelos-3d/${m.id}`} className="rounded-full border border-[#2B3648] px-3 py-1 hover:border-[#FF6A1A] hover:text-white">
                    {m.nombre}
                  </LocalizedClientLink>
                ))}
              </nav>
            ))}
          </div>
        )}
        <p className="m-0 mt-1.5 text-[13px] text-[#8D96A3]">
          Herramienta {h.acceso === "gratis" ? "gratis" : "con créditos"} de HETNA CNC, el marketplace mexicano de CNC. Funciona en el navegador, sin instalar nada.
        </p>
        {otras.length > 0 && (
          <nav aria-label="Más herramientas" className="mt-3 flex flex-wrap gap-2 text-[13px]">
            {otras.map((o) => (
              <LocalizedClientLink key={o.slug} href={`/disenar/${o.slug}`} className="rounded-full border border-[#2B3648] px-3 py-1 hover:border-[#FF6A1A] hover:text-white">
                {o.corto}
              </LocalizedClientLink>
            ))}
            <LocalizedClientLink href="/disenar" className="rounded-full border border-[#2B3648] px-3 py-1 hover:border-[#FF6A1A] hover:text-white">
              Todas las herramientas
            </LocalizedClientLink>
          </nav>
        )}
      </div>
    </section>
  )
}

export default async function HerramientaDiseno({ params }: Props) {
  const { herramienta, locale } = await params
  if (herramienta === ESCANEAR) return <EscanearPieza locale={locale} />
  if (!SLUGS.has(herramienta)) notFound()
  const h = buscarHerramientaDiseno(herramienta)
  // Las herramientas que ya tienen su propio estudio oscuro van tal cual; las
  // demás se pintan con el tema oscuro común (.tema-estudio, globals.css).
  return (
    <>
      {h && <JsonLd datos={datosHerramienta(h)} />}
      <ContarUsoHerramienta herramienta={herramienta} />
      {OSCURAS.has(herramienta) ? (
        <Herramienta slug={herramienta} />
      ) : (
        <div className="tema-estudio flex-1">
          <Herramienta slug={herramienta} />
        </div>
      )}
      {h && <AcercaDe h={h} />}
    </>
  )
}
