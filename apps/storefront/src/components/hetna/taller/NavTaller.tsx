"use client"

import { usePathname } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

const PESTANAS = [
  { href: "/taller", etiqueta: "Panel" },
  { href: "/taller/cotizaciones", etiqueta: "Cotizaciones" },
  { href: "/taller/calculadora", etiqueta: "Calculadora" },
  { href: "/taller/escaneos", etiqueta: "Escaneos 3D" },
  { href: "/taller/perfil", etiqueta: "Mi taller" },
]

export const NavTaller = () => {
  const ruta = usePathname()

  // El pathname trae el locale al frente (/mx/taller/...). Comparar el final
  // evita tener que conocer el locale aquí.
  const activa = (href: string) =>
    href === "/taller" ? /\/taller\/?$/.test(ruta) : ruta.includes(href)

  return (
    <nav className="px-4 lg:px-16 pt-6 pb-5 border-b border-[#E7E4DC]" aria-label="Secciones del taller">
      <div className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <LocalizedClientLink
            key={p.href}
            href={p.href}
            aria-current={activa(p.href) ? "page" : undefined}
            className={`px-4 py-2 rounded-[10px] text-[14px] font-semibold transition-colors ${
              activa(p.href)
                ? "bg-[#1B1B18] text-white"
                : "border border-[#E7E4DC] text-[#1B1B18] hover:border-[#C2560A]"
            }`}
          >
            {p.etiqueta}
          </LocalizedClientLink>
        ))}
      </div>
    </nav>
  )
}
