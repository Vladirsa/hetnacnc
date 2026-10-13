import { Headphones, Package, Truck, Users } from "lucide-react"

const ITEMS = [
  {
    icono: Package,
    titulo: "Productos CNC",
    texto: "Máquinas, herramientas y materiales",
  },
  {
    icono: Users,
    titulo: "Talleres y proveedores",
    texto: "Conecta con profesionales CNC",
  },
  {
    icono: Truck,
    titulo: "Envíos a México",
    texto: "Compra desde cualquier estado",
  },
  {
    icono: Headphones,
    titulo: "Soporte en español",
    texto: "Atención y asesoría",
  },
]

export default function BarraConfianza() {
  return (
    <section
      aria-label="Por qué comprar en HETNA CNC"
      className="border-b border-[#E7E4DC] bg-white"
    >
      <ul className="m-0 grid max-w-[1280px] list-none grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 lg:mx-auto lg:grid-cols-4 lg:gap-0 lg:px-16 lg:py-0">
        {ITEMS.map((it) => {
          const Ico = it.icono
          return (
            <li
              key={it.titulo}
              className="flex items-center gap-3 lg:justify-center lg:border-l lg:border-[#E7E4DC] lg:py-3.5 lg:first:border-l-0"
            >
              <span className="shrink-0 text-[#C2560A]">
                <Ico size={22} strokeWidth={1.75} />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-semibold text-[#142033]">
                  {it.titulo}
                </span>
                <span className="text-[11.5px] text-[#6B6A63]">{it.texto}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
