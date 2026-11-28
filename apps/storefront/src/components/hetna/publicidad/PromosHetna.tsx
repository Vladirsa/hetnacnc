"use client"

// Promo propia de HETNA en el espacio de anuncio de la ficha de producto
// mientras nadie lo ha comprado (opción C que eligió Vlado, 27 nov 2026): se
// turnan tres promos, una distinta en cada visita. Cuando hay un anuncio pagado,
// AnunciosEspacio lo enseña a él y esto no sale.
//
// El servidor dibuja siempre la promo `inicio` (así el HTML es el mismo para
// todos y no hay error de hidratación); ya en el navegador se cambia a la
// siguiente de la última que vio esa persona.
import { useEffect, useState } from "react"

import { T } from "@/components/hetna/i18n/Idioma"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

type Promo = {
  clave: string
  href: string
  etiqueta: string
  titulo: string
  texto: string
  boton: string
  icono: string
  estilo: "oscuro" | "claro" | "blanco"
}

const PROMOS: Promo[] = [
  {
    clave: "cotizar",
    href: "/cotizar",
    etiqueta: "Fabricación a la medida",
    titulo: "¿Lo necesitas en otra medida o material?",
    texto: "Cotiza tu pieza en 2 minutos con talleres de todo México",
    boton: "Cotizar mi pieza →",
    icono: "📐",
    estilo: "oscuro",
  },
  {
    clave: "cotizador",
    href: "/cotizador",
    etiqueta: "¿Tienes taller CNC?",
    titulo: "Cotiza en minutos con la app HETNA",
    texto: "Costos, utilidad y cotizaciones con tu logo · 14 días gratis",
    boton: "Probar gratis →",
    icono: "🧮",
    estilo: "claro",
  },
  {
    clave: "envios",
    href: "/servicios/envios-hetna",
    etiqueta: "Envíos HETNA",
    titulo: "Envía tus piezas a todo México",
    texto: "Guías con paqueterías desde tu panel, sin contratar por tu cuenta",
    boton: "Ver envíos →",
    icono: "🚚",
    estilo: "blanco",
  },
]

const ESTILOS = {
  oscuro: {
    caja: "bg-[#142033] text-white",
    icono: "bg-[#C2560A] text-white",
    etiqueta: "text-[#F2B98C]",
    titulo: "text-white",
    texto: "text-white/75",
    boton: "bg-white text-[#142033] group-hover:bg-[#FFF1E6]",
  },
  claro: {
    caja: "bg-[#FFF4EC] ring-1 ring-[#F3C9A8]",
    icono: "bg-[#142033] text-white",
    etiqueta: "text-[#A84303]",
    titulo: "text-[#142033]",
    texto: "text-[#6B6A63]",
    boton: "bg-[#C2560A] text-white group-hover:bg-[#A84A08]",
  },
  blanco: {
    caja: "bg-white ring-1 ring-[#E7E4DC]",
    icono: "bg-[#E8F5EC] text-[#17603A]",
    etiqueta: "text-[#17603A]",
    titulo: "text-[#142033]",
    texto: "text-[#6B6A63]",
    boton: "ring-1 ring-[#142033] text-[#142033] group-hover:bg-[#F4F1EA]",
  },
}

const LLAVE = "hetna_promo_ficha"

export default function PromosHetna({ inicio = 0, espacio }: { inicio?: number; espacio: string }) {
  const [i, setI] = useState(inicio % PROMOS.length)

  useEffect(() => {
    // La siguiente de la que vio la última vez; sin memoria del navegador, al azar
    let previa: number | null = null
    try {
      const v = window.localStorage.getItem(LLAVE)
      if (v !== null && /^\d+$/.test(v)) previa = Number(v)
    } catch {
      previa = null
    }
    const siguiente = previa === null ? Math.floor(Math.random() * PROMOS.length) : previa + 1
    const elegido = (siguiente + inicio) % PROMOS.length
    setI(elegido)
    try {
      // Sólo la primera promo de la página avanza el turno (la ficha tiene dos espacios)
      if (inicio === 0) window.localStorage.setItem(LLAVE, String(siguiente % PROMOS.length))
    } catch {
      // sin memoria del navegador: no pasa nada, la próxima vez sale al azar
    }
  }, [inicio])

  const p = PROMOS[i]
  const e = ESTILOS[p.estilo]

  return (
    <div className="flex flex-col gap-1.5" data-testid="promo-hetna" data-promo={p.clave}>
      <LocalizedClientLink
        href={p.href}
        className={`group flex min-h-[96px] items-center gap-4 rounded-2xl p-4 transition-shadow hover:shadow-md sm:p-5 ${e.caja}`}
      >
        <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[22px] ${e.icono}`}>
          {p.icono}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${e.etiqueta}`}><T>{p.etiqueta}</T></span>
          <span className={`text-[16px] font-bold leading-snug ${e.titulo}`}><T>{p.titulo}</T></span>
          <span className={`text-[12.5px] leading-snug ${e.texto}`}><T>{p.texto}</T></span>
          <span className={`mt-1 text-[13px] font-bold underline-offset-2 group-hover:underline sm:hidden ${e.etiqueta}`}><T>{p.boton}</T></span>
        </span>
        <span className={`hidden min-h-[44px] shrink-0 items-center rounded-lg px-4 text-[13.5px] font-bold transition-colors sm:inline-flex ${e.boton}`}>
          <T>{p.boton}</T>
        </span>
      </LocalizedClientLink>
      <div className="flex items-center justify-between px-1">
        <span className="flex gap-1.5" aria-hidden="true">
          {PROMOS.map((x, k) => (
            <span key={x.clave} className={`h-1.5 w-1.5 rounded-full ${k === i ? "bg-[#C2560A]" : "bg-[#D6D2C8]"}`} />
          ))}
        </span>
        <LocalizedClientLink href={`/anunciate?espacio=${espacio}#comprar`} className="text-[11.5px] text-[#8A887F] hover:text-[#B34D07] hover:underline">
          <T>¿Quieres anunciarte aquí?</T>
        </LocalizedClientLink>
      </div>
    </div>
  )
}
