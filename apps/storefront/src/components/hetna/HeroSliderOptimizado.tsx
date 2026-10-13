"use client"

import { useCallback, useEffect, useState } from "react"
import type { ComponentType } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Cog,
  Boxes,
  Cpu,
  FileCode,
  Flame,
  Monitor,
  Package,
  Store,
  User,
  Wrench,
  Zap,
} from "lucide-react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

type Icono = ComponentType<{ size?: number; strokeWidth?: number }>
type Paso = { icono: Icono; texto: string }
type Boton = { texto: string; href: string; externo?: boolean }
type Slide = {
  titulo: string
  subtitulo: string
  botones: [Boton, Boton]
  bullets: string[]
  pasos: Paso[]
  video?: string // opcional: ruta de un video corto en /public, ej. "/videos/slide1.mp4"
}

// Para cambiar un texto del hero, edítalo aquí.
const SLIDES: Slide[] = [
  {
    titulo: "Todo lo que necesitas para fabricar con CNC",
    subtitulo:
      "Máquinas, herramientas, materiales, diseños y servicios de fabricación, reunidos en una sola plataforma.",
    botones: [
      { texto: "Explorar HetNa", href: "/servicios" },
      { texto: "Ver categorías", href: "/categories" },
    ],
    bullets: ["🛒 Compra y vende", "⚙️ Servicios CNC", "🇲🇽 Proveedores en México"],
    pasos: [
      { icono: Cog, texto: "Router" },
      { icono: Zap, texto: "Láser" },
      { icono: Flame, texto: "Plasma" },
      { icono: Package, texto: "Pieza terminada" },
      { icono: Store, texto: "Tienda online" },
    ],
  },
  {
    titulo: "Del diseño a la pieza terminada",
    subtitulo:
      "Sube tu proyecto, solicita una cotización y encuentra talleres CNC capaces de fabricarlo.",
    botones: [
      { texto: "Cotizar proyecto", href: "/servicios/cotizador-cnc" },
      { texto: "Solicitar maquila", href: "/servicios/laboratorio-cam" },
    ],
    bullets: ["📐 Diseño 2D y 3D", "🛠️ Maquinado CNC", "📦 Piezas terminadas"],
    pasos: [
      { icono: FileCode, texto: "Archivo DXF/STL" },
      { icono: Cpu, texto: "Simulación CAM" },
      { icono: Cog, texto: "Máquina trabajando" },
      { icono: Package, texto: "Pieza física" },
    ],
  },
  {
    titulo: "Compra, vende y encuentra oportunidades CNC",
    subtitulo:
      "Conecta con proveedores, fabricantes y diseñadores de todo México desde un solo lugar.",
    botones: [
      { texto: "Explorar marketplace", href: "/categories" },
      { texto: "Vender en HetNa", href: "/seller", externo: true },
    ],
    bullets: ["🏪 Tiendas y vendedores", "📁 Diseños CNC", "🤝 Nuevos clientes"],
    pasos: [
      { icono: Wrench, texto: "Fresas" },
      { icono: Cog, texto: "Motores" },
      { icono: Boxes, texto: "Máquinas" },
      { icono: FileCode, texto: "Archivos STL/DXF" },
      { icono: Package, texto: "Piezas" },
    ],
  },
  {
    titulo: "La plataforma donde crece tu taller CNC",
    subtitulo:
      "Aprende, encuentra proveedores, consigue clientes y lleva tus proyectos CNC al siguiente nivel.",
    botones: [
      { texto: "Crear cuenta", href: "/register" },
      { texto: "Descubrir servicios", href: "/servicios" },
    ],
    bullets: ["🎓 Aprende CNC", "💼 Consigue clientes", "🚀 Haz crecer tu taller"],
    pasos: [
      { icono: User, texto: "Operador CNC" },
      { icono: Monitor, texto: "CAD/CAM" },
      { icono: Cog, texto: "Máquina" },
      { icono: Package, texto: "Pieza" },
      { icono: ClipboardCheck, texto: "Pedido recibido" },
    ],
  },
]

const Secuencia = ({ pasos, activo }: { pasos: Paso[]; activo: boolean }) => {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
    if (!activo) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIdx(pasos.length - 1)
      return
    }
    const t = setInterval(() => setIdx((i) => (i + 1) % pasos.length), 1100)
    return () => clearInterval(t)
  }, [activo, pasos.length])

  return (
    <div
      className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-4"
      aria-hidden="true"
    >
      {pasos.map((p, i) => {
        const Ico = p.icono
        const actual = i === idx
        const hecho = i < idx
        return (
          <div key={p.texto} className="flex items-center gap-1.5">
            <div className="flex w-[68px] flex-col items-center gap-1.5">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-500 ${
                  actual
                    ? "scale-110 border-[#F2A65A] bg-[#C2560A] text-white shadow-lg"
                    : hecho
                    ? "border-white/30 bg-white/20 text-white"
                    : "border-white/10 bg-white/5 text-white/40"
                }`}
              >
                <Ico size={22} />
              </span>
              <span
                className={`text-center text-[10.5px] leading-tight transition-colors duration-500 ${
                  actual ? "text-white" : "text-white/50"
                }`}
              >
                {p.texto}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <span
                className={`text-sm transition-colors duration-500 ${
                  hecho ? "text-[#F2A65A]" : "text-white/20"
                }`}
              >
                ›
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const BotonHero = ({ b, primario }: { b: Boton; primario: boolean }) => {
  const clase = `rounded-[10px] px-5 py-2.5 text-[14px] font-semibold transition ${
    primario
      ? "bg-[#C2560A] text-white hover:bg-[#A84A08]"
      : "border-[1.5px] border-white/70 text-white hover:bg-white/10"
  }`
  return b.externo ? (
    <a href={b.href} className={clase}>
      {b.texto}
    </a>
  ) : (
    <LocalizedClientLink href={b.href} className={clase}>
      {b.texto}
    </LocalizedClientLink>
  )
}

export default function HeroSliderOptimizado() {
  const [actual, setActual] = useState(0)
  const [pausado, setPausado] = useState(false)
  const total = SLIDES.length

  const ir = useCallback((i: number) => setActual((i + total) % total), [total])

  useEffect(() => {
    if (pausado) return
    const t = setTimeout(() => setActual((a) => (a + 1) % total), 6500)
    return () => clearTimeout(t)
  }, [actual, pausado, total])

  return (
    <section
      className="relative overflow-hidden bg-[#142033] text-white"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 85% 20%, rgba(194,86,10,0.35), transparent 55%), radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "auto, 22px 22px",
      }}
      aria-roledescription="carousel"
      aria-label="Portada de HETNA CNC"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="grid">
        {SLIDES.map((s, i) => {
          const visible = i === actual
          const Titulo = i === 0 ? "h1" : "h2"
          return (
            <div
              key={s.titulo}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={!visible}
              inert={!visible}
              className={`col-start-1 row-start-1 transition-opacity duration-700 ${
                visible ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <div className="mx-auto flex max-w-[1280px] items-center gap-8 px-4 pb-14 pt-7 lg:px-16 lg:pt-10">
                <div className="flex flex-1 flex-col gap-3.5">
                  <Titulo className="font-display m-0 text-[24px] font-bold leading-[1.1] tracking-[-0.01em] md:text-[34px] lg:text-[40px]">
                    {s.titulo}
                  </Titulo>
                  <p className="m-0 max-w-[560px] text-[13.5px] leading-[1.55] text-[#C9D2E0] md:text-[15px]">
                    {s.subtitulo}
                  </p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {s.bullets.map((b) => (
                      <li
                        key={b}
                        className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/90 md:text-[13px]"
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex flex-wrap gap-3">
                    <BotonHero b={s.botones[0]} primario />
                    <BotonHero b={s.botones[1]} primario={false} />
                  </div>
                </div>
                <div className="hidden shrink-0 lg:block">
                  {s.video ? (
                    visible && (
                      <video
                        src={s.video}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="none"
                        className="h-[230px] w-[420px] rounded-2xl object-cover"
                      />
                    )
                  ) : (
                    <Secuencia pasos={s.pasos} activo={visible} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-3 left-4 flex items-center gap-2 lg:left-16">
        {SLIDES.map((s, i) => (
          <button
            key={s.titulo}
            type="button"
            onClick={() => ir(i)}
            aria-label={`Ir a la diapositiva ${i + 1}`}
            aria-current={i === actual}
            className={`h-2 rounded-full transition-all ${
              i === actual ? "w-6 bg-[#C2560A]" : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
      <div className="absolute bottom-2 right-4 flex gap-2 lg:right-16">
        <button
          type="button"
          onClick={() => ir(actual - 1)}
          aria-label="Anterior"
          className="rounded-full bg-white/10 p-1.5 hover:bg-white/20"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => ir(actual + 1)}
          aria-label="Siguiente"
          className="rounded-full bg-white/10 p-1.5 hover:bg-white/20"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  )
}
