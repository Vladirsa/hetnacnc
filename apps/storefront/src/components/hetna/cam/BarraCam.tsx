"use client"

// Barra de arriba del CAM Studio (pantalla completa, como el 3D y 2D Studio):
// cambia entre 2D (router y láser), 3D (3, 4 y 5 ejes) y Torno.
import { usePathname } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

const PESTANAS = [
  { href: "/cam/subir", corto: "2D", nombre: "Router y láser" },
  { href: "/cam/lab", corto: "3D", nombre: "3, 4 y 5 ejes" },
  { href: "/cam/torno", corto: "Torno", nombre: "eje rotativo" },
]

export function BarraCam() {
  const ruta = usePathname() || ""
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0C10]/95 text-white backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-3 lg:px-4">
        <LocalizedClientLink href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-extrabold tracking-wide" aria-label="Ir a HETNA CNC">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F07A1A] shadow-[0_0_12px_#F07A1A]" />
          <span>
            HETNA <span className="text-[#F07A1A]">CAM</span>
            <span className="hidden sm:inline"> Studio</span>
          </span>
        </LocalizedClientLink>

        <nav aria-label="Modo del CAM" className="flex min-w-0 shrink overflow-x-auto rounded-[10px] bg-white/[0.06] p-1">
          {PESTANAS.map((p) => {
            const activa = ruta.endsWith(p.href)
            return (
              <LocalizedClientLink
                key={p.href}
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={`whitespace-nowrap rounded-[8px] px-2.5 py-1 text-[13px] font-bold transition sm:px-3 ${
                  activa ? "bg-[#F07A1A] text-white" : "text-white/65 hover:text-white"
                }`}
              >
                {p.corto}
                <span className="hidden font-medium md:inline"> · {p.nombre}</span>
              </LocalizedClientLink>
            )
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 text-[13px] font-semibold">
          <LocalizedClientLink href="/laboratorio-cam" className="hidden rounded-[8px] px-2.5 py-1.5 text-white/65 hover:bg-white/10 hover:text-white md:block">
            Cómo funciona
          </LocalizedClientLink>
          <LocalizedClientLink href="/disenar" className="hidden rounded-[8px] px-2.5 py-1.5 text-white/65 hover:bg-white/10 hover:text-white sm:block">
            Diseñar
          </LocalizedClientLink>
          <LocalizedClientLink href="/user/cam" className="rounded-[8px] px-2.5 py-1.5 text-white/65 hover:bg-white/10 hover:text-white">
            Mis trabajos
          </LocalizedClientLink>
        </div>
      </div>
    </header>
  )
}
