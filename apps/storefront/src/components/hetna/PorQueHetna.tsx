import { Cog, MapPin, ShoppingCart, Zap } from "lucide-react"

const TARJETAS = [
  {
    icono: Cog,
    titulo: "Especialistas CNC",
    texto: "Productos, herramientas y soluciones pensadas para fabricación CNC.",
  },
  {
    icono: MapPin,
    titulo: "Proveedores y talleres en México",
    texto: "Conecta con vendedores y talleres sin buscar en mil lugares.",
  },
  {
    icono: ShoppingCart,
    titulo: "Compra y producción juntas",
    texto: "Compra máquinas, herramientas, materiales y diseños, o pide que fabriquen tus piezas.",
  },
  {
    icono: Zap,
    titulo: "Cotiza y compra más rápido",
    texto: "Encuentra productos, pide cotizaciones y habla con proveedores desde un solo lugar.",
  },
]

export default function PorQueHetna() {
  return (
    <section className="px-4 lg:px-16 py-10 md:py-14">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 text-center">
          <h2 className="text-[30px] md:text-[44px] font-extrabold leading-[1.08] text-[#142033]">
            ¿Por qué <span className="text-[#C2560A]">HETNA</span>?
          </h2>
          <p className="mt-2 text-[15px] md:text-[17px] text-[#6B6A63]">
            Todo lo que necesitas para fabricar, en un solo lugar.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TARJETAS.map((t) => {
            const Icono = t.icono
            return (
              <div
                key={t.titulo}
                className="rounded-[20px] border border-[#E7E4DC] bg-white p-5 md:p-6 transition hover:-translate-y-0.5 hover:border-[#F2A65A] hover:shadow-[0_10px_28px_rgba(20,32,51,0.10)]"
              >
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF6EF] text-[#C2560A]">
                  <Icono size={26} strokeWidth={2.1} aria-hidden="true" />
                </span>
                <h3 className="text-[17px] font-bold leading-snug text-[#142033]">{t.titulo}</h3>
                <p className="mt-1.5 text-[14px] leading-snug text-[#6B6A63]">{t.texto}</p>
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-center text-[20px] md:text-[28px] font-extrabold leading-tight text-[#142033]">
          Menos tiempo buscando proveedores.{" "}
          <span className="text-[#C2560A]">Más tiempo fabricando.</span>
        </p>
      </div>
    </section>
  )
}
