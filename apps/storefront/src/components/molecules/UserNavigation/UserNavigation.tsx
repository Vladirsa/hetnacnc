"use client"

// Menú de "Mi cuenta": agrupado como en los marketplaces grandes (Compras,
// Fabricación, Comunidad, Cuenta), en español y con iconos. En celular es un
// desplegable para no empujar el contenido hacia abajo.
import { LogoutButton } from "@/components/atoms"
import { IconoCuenta, type NombreIcono } from "@/components/hetna/cuenta/IconoCuenta"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useUnreads } from "@talkjs/react"
import { usePathname } from "next/navigation"

// externo: rutas que no sirve Next con idioma (/seller del backend, /cotizador/
// de nginx); van con <a> normal para que no se les ponga /mx delante.
type Item = { label: string; href: string; icono: NombreIcono; insignia?: "chat"; externo?: boolean }

const GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: "Compras",
    items: [
      { label: "Resumen", href: "/user", icono: "resumen" },
      { label: "Mis pedidos", href: "/user/orders", icono: "pedidos" },
      { label: "Mis envíos", href: "/user/envios", icono: "envios" },
      { label: "Mis descargas", href: "/user/descargas", icono: "descargas" },
      { label: "Favoritos", href: "/favoritos", icono: "favoritos" },
      { label: "Devoluciones", href: "/user/returns", icono: "devoluciones" },
    ],
  },
  {
    titulo: "Fabricación y herramientas",
    items: [
      { label: "Cotizador para talleres", href: "/cotizador/", icono: "cotizador", externo: true },
      { label: "Escaneos 3D", href: "/user/escaneos", icono: "escaneos" },
      { label: "Trabajos CAM", href: "/user/cam", icono: "cam" },
      { label: "Mis créditos", href: "/user/creditos", icono: "creditos" },
    ],
  },
  {
    titulo: "Vender",
    items: [
      { label: "Mi tienda", href: "/seller", icono: "tienda", externo: true },
      { label: "Vender en HETNA", href: "/talleres/unete", icono: "taller" },
    ],
  },
  {
    titulo: "Comunidad",
    items: [
      { label: "Mensajes con talleres", href: "/mensajes", icono: "mensajes", insignia: "chat" },
      { label: "Talleres que sigo", href: "/foro-cnc/red?ver=siguiendo", icono: "siguiendo" },
      { label: "Mi perfil del foro", href: "/foro-cnc/mi-perfil", icono: "foro" },
    ],
  },
  {
    titulo: "Cuenta",
    items: [
      { label: "Datos y contraseña", href: "/user/settings", icono: "seguridad" },
      { label: "Direcciones", href: "/user/addresses", icono: "direcciones" },
      { label: "Ayuda", href: "/preguntas-frecuentes", icono: "ayuda" },
    ],
  },
]

export const UserNavigation = () => {
  const unreads = useUnreads()
  // "/mx/user/orders/123" -> "/user/orders/123"
  const ruta = (usePathname() || "").replace(/^\/[a-z]{2}(?=\/)/, "")
  const activo = (href: string) => {
    const base = href.split("?")[0]
    return base === "/user" ? ruta === "/user" : ruta === base || ruta.startsWith(base + "/")
  }
  const actual = GRUPOS.flatMap((g) => g.items).find((i) => !i.externo && activo(i.href))

  const lista = (
    <nav aria-label="Mi cuenta" className="flex flex-col gap-4">
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <p className="m-0 mb-1 px-3 text-[11.5px] font-bold uppercase tracking-wide text-[#9A978C]">{g.titulo}</p>
          <ul className="m-0 list-none p-0">
            {g.items.map((i) => (
              <li key={i.href}>
                {i.externo ? (
                  <a
                    href={i.href}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px] text-[#1B1B18] hover:bg-[#F6F4EF]"
                  >
                    <IconoCuenta n={i.icono} size={19} />
                    <span className="flex-1">{i.label}</span>
                  </a>
                ) : (
                <LocalizedClientLink
                  href={i.href}
                  aria-current={activo(i.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px] ${
                    activo(i.href) ? "bg-[#FDEEE1] font-semibold text-[#B34D07]" : "text-[#1B1B18] hover:bg-[#F6F4EF]"
                  }`}
                >
                  <IconoCuenta n={i.icono} size={19} />
                  <span className="flex-1">{i.label}</span>
                  {i.insignia === "chat" && Boolean(unreads?.length) && (
                    <span className="min-w-[20px] rounded-full bg-[#C2560A] px-1.5 text-center text-[11px] font-bold leading-5 text-white">
                      {unreads?.length}
                    </span>
                  )}
                </LocalizedClientLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="border-t border-[#E7E4DC] pt-2">
        <LogoutButton unstyled className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[14.5px] text-[#6B6A63] hover:bg-[#F6F4EF]">
          <IconoCuenta n="salir" size={19} />
          Cerrar sesión
        </LogoutButton>
      </div>
    </nav>
  )

  return (
    <>
      {/* Celular: desplegable */}
      <details className="group rounded-[14px] border border-[#E7E4DC] bg-white md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold text-[#1B1B18]">
          <span className="flex items-center gap-2">
            {actual && <IconoCuenta n={actual.icono} size={19} />}
            Mi cuenta{actual && actual.href !== "/user" ? ` · ${actual.label}` : ""}
          </span>
          <span className="text-[#9A978C] transition group-open:rotate-180" aria-hidden="true">
            ▾
          </span>
        </summary>
        <div className="border-t border-[#E7E4DC] p-2">{lista}</div>
      </details>
      {/* Escritorio: columna fija */}
      <aside className="hidden h-min rounded-[14px] border border-[#E7E4DC] bg-white p-3 md:block">{lista}</aside>
    </>
  )
}
