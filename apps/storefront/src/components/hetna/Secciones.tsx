import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// Iconos simples de trazo para las secciones del inicio
const Ico = ({ d, size = 28 }: { d: string[]; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d.map((p) => (
      <path key={p} d={p} />
    ))}
  </svg>
)

const ICONOS: Record<string, string[]> = {
  tienda: ["M3 9l1.5-5h15L21 9", "M4 9v11h16V9", "M9 20v-6h6v6"],
  diseno: ["M3 3h18v18H3z", "M3 9h18", "M9 21V9"],
  maquila: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"],
  herramientas: ["M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z"],
  cotizador: ["M3 4h18v14H3z", "M7 9h10", "M7 13h6"],
  corte: ["M4 2h16v20H4z", "M8 6h8", "M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"],
  visor: ["M2 12l10-7 10 7-10 7z", "M2 12v5l10 7 10-7v-5"],
  torno: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  generador: ["M12 3v4M12 17v4M3 12h4M17 12h4", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  elegir: ["M21 21l-4.3-4.3", "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"],
  cotizar: ["M9 11l3 3 8-8", "M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"],
  recibir: ["M1 6h14v11H1z", "M15 10h4l3 3v4h-7z", "M6 19a1.5 1.5 0 1 0 0-.01", "M18 19a1.5 1.5 0 1 0 0-.01"],
}

export type Pilar = { icono: string; titulo: string; texto: string; accion: string; href: string }

export const PilaresHome = ({ pilares }: { pilares: Pilar[] }) => (
  <section className="px-4 lg:px-16 pt-10 pb-10" aria-labelledby="pilares-titulo">
    <h2 id="pilares-titulo" className="font-display text-[20px] lg:text-[22px] font-semibold m-0">
      Un ecosistema CNC completo, no solo una tienda
    </h2>
    <p className="m-0 mt-1 mb-5 text-[14px] text-[#6B6A63] max-w-[640px]">
      Compra, descarga, manda a fabricar y usa herramientas para tu taller, todo en un solo lugar.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {pilares.map((p, i) => (
        <LocalizedClientLink
          key={p.titulo}
          href={p.href}
          className="group bg-white border border-[#E7E4DC] rounded-[14px] p-6 flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(27,27,24,0.08)]"
        >
          <span className="flex items-center justify-between">
            <span className="w-11 h-11 rounded-[10px] bg-[#142033] text-[#F2A65E] flex items-center justify-center">
              <Ico d={ICONOS[p.icono]} />
            </span>
            <span className="font-display text-[13px] font-semibold text-[#B8B4A8]">0{i + 1}</span>
          </span>
          <span className="font-display font-semibold text-[17px] leading-tight">{p.titulo}</span>
          <span className="text-[14px] leading-[1.55] text-[#4A4A45]">{p.texto}</span>
          <span className="mt-auto text-[13.5px] font-semibold text-[#B34D07] group-hover:underline">
            {p.accion} →
          </span>
        </LocalizedClientLink>
      ))}
    </div>
  </section>
)

export type Herramienta = {
  icono: string
  nombre: string
  que: string
  beneficio: string
  disponible: boolean
  href?: string
}

const Estado = ({ disponible }: { disponible: boolean }) => (
  <span
    className={`text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 ${
      disponible ? "bg-[#DDF3E6] text-[#14653A]" : "bg-[#FFF3D6] text-[#8A5A00]"
    }`}
  >
    {disponible ? "Disponible" : "Muy pronto"}
  </span>
)

export const HerramientasHome = ({ herramientas }: { herramientas: Herramienta[] }) => (
  <section className="px-4 lg:px-16 pb-10" aria-labelledby="herr-titulo">
    <h2 id="herr-titulo" className="font-display text-[20px] lg:text-[22px] font-semibold m-0">
      Herramientas inteligentes para tu taller
    </h2>
    <p className="m-0 mt-1 mb-5 text-[14px] text-[#6B6A63] max-w-[640px]">
      Ahorra tiempo y errores antes de cortar. Las que dicen “Muy pronto” están en construcción.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {herramientas.map((h) => {
        const contenido = (
          <>
            <span className="flex items-center justify-between">
              <span className="text-[#142033]">
                <Ico d={ICONOS[h.icono]} size={26} />
              </span>
              <Estado disponible={h.disponible} />
            </span>
            <span className="font-semibold text-[15.5px]">{h.nombre}</span>
            <span className="text-[13.5px] leading-[1.5] text-[#4A4A45]">{h.que}</span>
            <span className="text-[13px] font-semibold text-[#14653A]">{h.beneficio}</span>
            {h.disponible && h.href && (
              <span className="mt-auto text-[13.5px] font-semibold text-[#B34D07]">Usar ahora →</span>
            )}
          </>
        )
        const clase =
          "bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-2.5"
        return h.disponible && h.href ? (
          <LocalizedClientLink
            key={h.nombre}
            href={h.href}
            className={`${clase} transition hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(27,27,24,0.08)]`}
          >
            {contenido}
          </LocalizedClientLink>
        ) : (
          <div key={h.nombre} className={`${clase} opacity-90`}>
            {contenido}
          </div>
        )
      })}
    </div>
  </section>
)

const PASOS = [
  { icono: "elegir", titulo: "Elige", texto: "Un producto, un diseño digital o un servicio de maquila." },
  { icono: "cotizar", titulo: "Cotiza o compra", texto: "Paga con tarjeta o Mercado Pago, o pide tu cotización por WhatsApp." },
  { icono: "recibir", titulo: "Recibe", texto: "En tu taller, o tu pieza terminada, con envío a todo México." },
]

export const ComoFunciona = () => (
  <section className="px-4 lg:px-16 pb-10" aria-labelledby="como-titulo">
    <h2 id="como-titulo" className="font-display text-[20px] lg:text-[22px] font-semibold m-0 mb-5">
      Cómo funciona
    </h2>
    <ol className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-3 gap-4">
      {PASOS.map((p, i) => (
        <li key={p.titulo} className="bg-[#142033] text-white rounded-[14px] p-6 flex gap-4 items-start">
          <span className="shrink-0 w-10 h-10 rounded-full bg-[#C2560A] flex items-center justify-center font-display font-bold text-[17px]">
            {i + 1}
          </span>
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-display font-semibold text-[16px]">
              {p.titulo}
              <span className="text-[#F2A65E]">
                <Ico d={ICONOS[p.icono]} size={18} />
              </span>
            </span>
            <span className="text-[13.5px] leading-[1.5] text-[#C9D2E0]">{p.texto}</span>
          </span>
        </li>
      ))}
    </ol>
  </section>
)
