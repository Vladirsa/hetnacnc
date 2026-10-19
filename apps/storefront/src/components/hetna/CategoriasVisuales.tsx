import { FileCode, ShoppingBag, Wrench } from "lucide-react"
import type { ComponentType } from "react"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

type Cat = HttpTypes.StoreProductCategory

const hijosDe = (c: Cat): Cat[] => (c.category_children as Cat[] | undefined) ?? []

const TEMAS: Record<
  string,
  { icono: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; fondo: string; lema: string }
> = {
  tienda: {
    icono: ShoppingBag,
    fondo: "from-[#0F1826] via-[#142033] to-[#1E3250]",
    lema: "Máquinas, herramientas y materiales",
  },
  digital: {
    icono: FileCode,
    fondo: "from-[#8A3A05] via-[#B34D07] to-[#E07B22]",
    lema: "Diseños, software y archivos listos para CNC",
  },
  servicios: {
    icono: Wrench,
    fondo: "from-[#123B36] via-[#1A5249] to-[#2B7A6C]",
    lema: "Talleres que fabrican tus piezas",
  },
}

const quita = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

const Chip = ({ c }: { c: Cat }) => (
  <LocalizedClientLink
    href={"/categories/" + c.handle}
    className="rounded-full bg-[#FAF6EF] px-3 py-1.5 text-[12.5px] text-[#1B1B18] ring-1 ring-[#E7E4DC] hover:bg-[#F2A65A]/25 hover:text-[#8A3A05]"
  >
    {c.name}
  </LocalizedClientLink>
)

export default function CategoriasVisuales({ categorias }: { categorias: Cat[] }) {
  const raices = categorias.filter((r) => hijosDe(r).length > 0)
  if (!raices.length) return null

  return (
    <section className="px-4 lg:px-16 py-10 md:py-14">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 max-w-[720px]">
          <h2 className="text-[30px] md:text-[44px] font-extrabold leading-[1.08] text-[#142033]">
            Compra por <span className="text-[#C2560A]">categoría</span>
          </h2>
          <p className="mt-2 text-[15px] md:text-[17px] text-[#6B6A63]">
            Encuentra lo que necesitas, o pide que lo fabriquen por ti.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {raices.map((raiz) => {
            const tema = TEMAS[quita(raiz.handle || raiz.name)] ?? TEMAS[quita(raiz.name)] ?? TEMAS.tienda
            const Icono = tema.icono
            const hijos = hijosDe(raiz)
            const conNietos = hijos.some((h) => hijosDe(h).length > 0)

            return (
              <div key={raiz.id} className="flex flex-col overflow-hidden rounded-[24px] border border-[#E7E4DC] bg-white">
                <LocalizedClientLink
                  href={"/categories/" + raiz.handle}
                  className={"relative block overflow-hidden bg-gradient-to-br p-6 md:p-7 text-white " + tema.fondo}
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-[0.10]"
                    style={{
                      backgroundImage:
                        "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
                      backgroundSize: "28px 28px",
                    }}
                  />
                  <Icono size={140} strokeWidth={1.2} className="absolute -right-6 -bottom-8 text-white/20" />
                  <span className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                    <Icono size={26} strokeWidth={2} />
                  </span>
                  <h3 className="relative text-[26px] md:text-[30px] font-extrabold leading-none">{raiz.name}</h3>
                  <p className="relative mt-2 max-w-[260px] text-[14px] leading-snug text-white/85">{tema.lema}</p>
                </LocalizedClientLink>

                <div className="flex flex-1 flex-col gap-5 p-5 md:p-6">
                  {conNietos ? (
                    hijos.map((g) => (
                      <div key={g.id}>
                        <LocalizedClientLink
                          href={"/categories/" + g.handle}
                          className="text-[15px] font-bold text-[#142033] hover:text-[#B34D07]"
                        >
                          {g.name}
                        </LocalizedClientLink>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {hijosDe(g)
                            .slice(0, 6)
                            .map((h) => (
                              <Chip key={h.id} c={h} />
                            ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {hijos.map((h) => (
                        <Chip key={h.id} c={h} />
                      ))}
                    </div>
                  )}
                  <LocalizedClientLink
                    href={"/categories/" + raiz.handle}
                    className="mt-auto inline-flex w-fit items-center rounded-full bg-[#C2560A] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#A84A08]"
                  >
                    Ver todo en {raiz.name} →
                  </LocalizedClientLink>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
