import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

type Paso = { titulo: string; texto: string }

const CLIENTE: Paso[] = [
  { titulo: "Sube tu proyecto", texto: "Carga tu archivo (DXF, SVG, STL, STEP) o describe lo que necesitas fabricar." },
  { titulo: "Recibe cotizaciones", texto: "Los talleres de HETNA te responden con precio y tiempo de entrega." },
  { titulo: "Elige tu taller", texto: "Compara las propuestas y confirma tu pedido con el taller que prefieras." },
  { titulo: "Fabricación y entrega", texto: "Das seguimiento a tu pedido y lo recibes terminado." },
]

const TALLER: Paso[] = [
  { titulo: "Crea tu perfil de taller", texto: "Registra tu taller con tus máquinas, materiales y capacidades." },
  { titulo: "Publica tus servicios", texto: "Corte láser, plasma, maquinado, torneado, impresión 3D y más." },
  { titulo: "Recibe y cotiza", texto: "Ve los proyectos que buscan tu servicio y envía tu cotización." },
  { titulo: "Fabrica y entrega", texto: "Cumples el pedido, lo entregas y haces crecer tu taller." },
]

const Flecha = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const Ruta = ({
  etiqueta,
  titulo,
  pasos,
  accion,
  href,
  oscuro = false,
}: {
  etiqueta: string
  titulo: string
  pasos: Paso[]
  accion: string
  href: string
  oscuro?: boolean
}) => (
  <div
    className={
      "rounded-[24px] p-5 md:p-7 " +
      (oscuro
        ? "bg-[#142033] text-white"
        : "bg-white border border-[#E7E4DC] text-[#142033]")
    }
  >
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <span
          className={
            "inline-block rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider " +
            (oscuro ? "bg-[#C2560A] text-white" : "bg-[#FAF6EF] text-[#B34D07]")
          }
        >
          {etiqueta}
        </span>
        <h3 className="mt-2 text-[22px] md:text-[26px] font-extrabold leading-tight">{titulo}</h3>
      </div>
      <LocalizedClientLink
        href={href}
        className={
          "rounded-full px-5 py-2.5 text-[14px] font-bold " +
          (oscuro
            ? "bg-white text-[#142033] hover:bg-[#FAF6EF]"
            : "bg-[#C2560A] text-white hover:bg-[#A84A08]")
        }
      >
        {accion}
      </LocalizedClientLink>
    </div>

    <ol className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-stretch lg:gap-0">
      {pasos.map((p, i) => (
        <li key={p.titulo} className="contents lg:flex lg:flex-1 lg:items-stretch">
          <div
            className={
              "flex-1 rounded-2xl p-4 " +
              (oscuro ? "bg-white/[0.07] ring-1 ring-white/10" : "bg-[#FAF6EF]")
            }
          >
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#C2560A] text-[16px] font-extrabold text-white">
              {i + 1}
            </span>
            <p className="text-[16px] font-bold leading-snug">{p.titulo}</p>
            <p className={"mt-1 text-[13.5px] leading-snug " + (oscuro ? "text-[#C9D2E0]" : "text-[#6B6A63]")}>
              {p.texto}
            </p>
          </div>
          {i < pasos.length - 1 && (
            <span
              aria-hidden="true"
              className={"hidden lg:flex shrink-0 items-center px-2 " + (oscuro ? "text-[#F2A65A]" : "text-[#C2560A]")}
            >
              <Flecha />
            </span>
          )}
        </li>
      ))}
    </ol>
  </div>
)

export default function ProcesoClienteTaller() {
  return (
    <section className="px-4 lg:px-16 py-10 md:py-14">
      <div className="mx-auto mb-8 max-w-[760px] text-center">
        <h2 className="text-[34px] md:text-[48px] font-extrabold leading-[1.05] text-[#142033]">
          Nuestro <span className="text-[#C2560A]">proceso</span>
        </h2>
        <p className="mt-3 text-[15px] md:text-[17px] text-[#6B6A63]">
          Sencillo para quien necesita fabricar y para el taller que quiere ofrecer sus servicios.
        </p>
      </div>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
        <Ruta
          etiqueta="Si eres cliente"
          titulo="Cotiza y fabrica tu proyecto"
          pasos={CLIENTE}
          accion="Cotizar mi proyecto"
          href="/servicios/cotizador-cnc"
        />
        <Ruta
          etiqueta="Si eres taller"
          titulo="Ofrece tus servicios y recibe cotizaciones"
          pasos={TALLER}
          accion="Registrar mi taller"
          href="/seller"
          oscuro
        />
      </div>
    </section>
  )
}
