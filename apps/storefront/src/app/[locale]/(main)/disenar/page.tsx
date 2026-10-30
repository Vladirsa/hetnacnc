import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { BloquePublicidad } from "@/components/hetna/disenar/BloquePublicidad"
import { CatalogoDisenar } from "@/components/hetna/disenar/CatalogoDisenar"
import { ESCANEAR, HERRAMIENTAS_DISENO } from "@/lib/hetna/disenar"
import { DISENO_A_LA_MEDIDA } from "@/lib/hetna/herramientas"

// Inicio del espacio "Diseñar y escanear": portada, buscador, catálogo por
// secciones, franja del escaneo 3D (servicio de pago) y cómo funciona.
const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Diseñar y escanear para CNC gratis: cajas, letreros, vectorizar, muebles y escaneo 3D",
  description:
    "Espacio de trabajo gratis para CNC y láser: 170+ cajas, 35 plantillas de empaque, letreros en DXF, vectorizador, despiece de muebles, grabado de fotos, litofanías, SVG a STL, anidado, convertidor y escaneo 3D de piezas. Sin instalar nada.",
  alternates: {
    canonical: `${SITIO}/mx/disenar`,
    languages: { "es-MX": `${SITIO}/mx/disenar`, "en-US": `${SITIO}/us/disenar` },
  },
}

// Foto de portada opcional: apps/storefront/public/img/disenar/hero.jpg
// (una pieza real cortada con láser o router, con sombra, a la derecha).
// Si no existe, se ve el dibujo de líneas.
const PORTADA = "/img/disenar/hero.jpg"

const Dibujo = () => (
  <svg viewBox="0 0 560 240" className="h-full w-full" fill="none" stroke="#FF6A1A" strokeOpacity="0.55" strokeWidth="1.5" aria-hidden="true">
    <path d="M20 60h110v40h-40v50h40v40H20v-40h40v-50H20z" />
    <path d="M190 30h120l30 30v150H190z M310 30v30h30" />
    <path d="M215 80h70M215 110h70M215 140h70M215 170h40" />
    <circle cx="450" cy="120" r="80" />
    <circle cx="450" cy="120" r="52" />
    <circle cx="450" cy="120" r="22" />
    <path d="M450 40v160M370 120h160M394 64l112 112M506 64L394 176" />
    <path d="M520 28l24 24-24 24-24-24zM520 164l24 24-24 24-24-24z" />
  </svg>
)

const FranjaEscaneo = () => (
  <section className="relative overflow-hidden rounded-[18px] bg-[#142033] px-5 py-6 text-white lg:px-8 lg:py-8">
    <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 opacity-30" aria-hidden="true">
      <svg viewBox="0 0 200 200" fill="none" stroke="#FFC53D" strokeWidth="1.2" className="h-full w-full">
        <path d="M100 20l70 40v80l-70 40-70-40V60z" />
        <path d="M30 60l70 40 70-40M100 100v80" />
        <path d="M60 40l80 46M140 40L60 86" strokeDasharray="4 4" />
      </svg>
    </div>
    <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div>
        <span className="inline-block rounded-full bg-[#FFC53D] px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-[#142033]">
          Nuevo · Escaneo 3D con fotos
        </span>
        <h2 className="mt-3 text-[24px] font-extrabold leading-tight lg:text-[30px]">¿Tienes la pieza pero no el archivo? Tómale fotos con tu celular.</h2>
        <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-white/80">
          Te devolvemos el modelo 3D con medidas reales (STL/OBJ) para reproducirla, repararla o mandarla a fabricar con un taller. Sin escáner y sin instalar nada.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px] text-white/75">
          <div>
            <dt className="text-[20px] font-extrabold text-[#19B374]">Gratis</dt>
            <dd>vista previa con tus fotos</dd>
          </div>
          <div>
            <dt className="text-[20px] font-extrabold text-[#FFC53D]">Créditos</dt>
            <dd>escaneo con medidas reales</dd>
          </div>
          <div>
            <dt className="text-[20px] font-extrabold text-[#5EC8FF]">En tu perfil</dt>
            <dd>queda guardado para volver a usarlo</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <LocalizedClientLink href={`/disenar/${ESCANEAR}`} className="rounded-xl bg-[#FFC53D] px-5 py-3 text-[14.5px] font-extrabold text-[#142033] hover:brightness-105">
            Probar gratis con mis fotos
          </LocalizedClientLink>
          <LocalizedClientLink href="/user/creditos" className="rounded-xl bg-[#FF6A1A] px-5 py-3 text-[14.5px] font-extrabold text-white hover:bg-[#E65C12]">
            Comprar créditos
          </LocalizedClientLink>
          <LocalizedClientLink href="/cotizar?necesidad=Dise%C3%B1o" className="rounded-xl border border-white/30 px-5 py-3 text-[14.5px] font-bold text-white hover:bg-white/10">
            Mejor que un taller la mida
          </LocalizedClientLink>
        </div>
      </div>
      <ol className="grid content-center gap-2 text-[13.5px] text-white/85">
        {[
          ["1", "Toma de 15 a 80 fotos alrededor de la pieza, con buena luz."],
          ["2", "Súbelas aquí y elige vista previa (gratis) o escaneo con medidas (créditos)."],
          ["3", "Descarga el STL u OBJ, o manda la pieza a fabricar con Fabrícamelo."],
        ].map(([n, t]) => (
          <li key={n} className="flex gap-3 rounded-xl bg-white/5 px-3.5 py-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FFC53D] text-[12px] font-extrabold text-[#142033]">{n}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  </section>
)

export default function DisenarInicio() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Diseñar y escanear",
    url: `${SITIO}/mx/disenar`,
    inLanguage: "es-MX",
    isPartOf: { "@type": "WebSite", name: "HETNA CNC", url: SITIO },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: HERRAMIENTAS_DISENO.length,
      itemListElement: HERRAMIENTAS_DISENO.map((h, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: h.nombre,
        url: `${SITIO}/mx/disenar/${h.slug}`,
      })),
    },
  }

  return (
    <div className="pb-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Portada */}
      <section className="relative overflow-hidden bg-[#142033] text-white">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-cover bg-right bg-no-repeat lg:block"
          style={{ backgroundImage: `linear-gradient(90deg, #142033 0%, rgba(20,32,51,0.35) 45%, rgba(20,32,51,0) 100%), url(${PORTADA})` }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block" aria-hidden="true">
          <Dibujo />
        </div>
        <div className="relative px-4 py-8 lg:px-8 lg:py-12">
          <span className="inline-block rounded-full bg-[#FF6A1A] px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide">Gratis · sin instalar · sin cuenta</span>
          <h1 className="mt-3 max-w-[720px] text-[30px] font-extrabold leading-[1.1] lg:text-[42px]">Diseña tu pieza en minutos. Descárgala o que un taller te la haga.</h1>
          <p className="mt-3 max-w-[600px] text-[15.5px] leading-relaxed text-white/80">
            Cajas, letreros, plantillas de empaque, vectorizado, relieves y escaneo 3D. Ves la pieza en 3D y bajas el archivo para láser, router o impresora.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <LocalizedClientLink href="/disenar/cajas" className="rounded-xl bg-[#FF6A1A] px-5 py-3 text-[15px] font-extrabold text-white hover:bg-[#E65C12]">
              Empezar con una caja
            </LocalizedClientLink>
            <LocalizedClientLink href="/cotizar" className="rounded-xl border border-white/40 px-5 py-3 text-[15px] font-bold text-white hover:bg-white/10">
              Mejor que me la fabriquen
            </LocalizedClientLink>
          </div>
        </div>
      </section>

      <div className="px-4 pt-6 lg:px-8">
        <CatalogoDisenar franja={<FranjaEscaneo />} />
      </div>

      {/* Publicidad (en pantallas grandes va en la columna de la izquierda) */}
      <div className="px-4 pt-8 lg:px-8 xl:hidden">
        <BloquePublicidad compacto />
      </div>

      {/* Cómo funciona */}
      <section className="mt-10 border-t border-[#E7E4DC] bg-white px-4 py-8 lg:px-8">
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1", "#FF6A1A", "Diseña gratis", "Pones medidas o subes tu imagen. Lo ves en 3D al instante."],
            ["2", "#FFC53D", "Descarga o fabrícalo", "DXF, SVG, PDF o STL para tu máquina. O toca «Fabrícamelo»."],
            ["3", "#19B374", "Taller cerca de ti", "Ves precio estimado por taller y eliges: recoger o envío a tu casa."],
            ["4", "#0EA5E9", "Recibe tu pieza", "Pagas en HETNA; el taller cobra cuando entrega."],
          ].map(([n, c, t, d]) => (
            <li key={n}>
              <span className="text-[34px] font-extrabold leading-none" style={{ color: c }}>{n}</span>
              <p className="mt-1.5 text-[16px] font-bold text-[#1B1B18]">{t}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[#4A4943]">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-4 px-4 pt-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-[14px] bg-[#142033] p-5 text-white">
          <h2 className="text-[18px] font-bold">¿Prefieres que te hagamos el diseño?</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">De tu idea, foto o boceto a un archivo listo para tu máquina, hecho a la medida.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DISENO_A_LA_MEDIDA.map((s) => (
              <LocalizedClientLink key={s.href} href={s.href} className="rounded-full border border-white/30 px-3.5 py-1.5 text-[13px] font-semibold hover:bg-white hover:text-[#142033]">
                {s.nombre}
              </LocalizedClientLink>
            ))}
          </div>
        </div>
        <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
          <h2 className="text-[18px] font-bold text-[#1B1B18]">¿Ya tienes el archivo?</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#4A4943]">
            Pásalo a G-code con las pasadas, el avance y las revoluciones calculados, o mándalo a fabricar con talleres CNC de todo México.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LocalizedClientLink href="/cam/subir" className="inline-flex rounded-[10px] bg-[#C2560A] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#A84A08]">
              DXF a G-code
            </LocalizedClientLink>
            <LocalizedClientLink href="/fabricacion" className="inline-flex rounded-[10px] border border-[#E7E4DC] px-4 py-2.5 text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A]">
              Te fabricamos tu pieza
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </div>
  )
}
