"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { useCallback, useEffect, useState } from "react"

import { LogoutButton } from "@/components/atoms/LogoutButton/LogoutButton"
import { Dropdown } from "@/components/molecules/Dropdown/Dropdown"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ProfileIcon } from "@/icons"
import { contarSinLeer } from "@/lib/chat/campanita"
import { obtenerSaldo } from "@/lib/creditos/acciones"

// El menú de la cuenta.
//
// Antes eran cuatro enlaces sueltos. Ahora enseña de un vistazo las tres cosas
// que alguien abre este menú para ver: quién está dentro, qué le falta atender
// (mensajes) y cuánto saldo le queda para las herramientas.
//
// El saldo se pide la PRIMERA vez que se abre el menú, no al cargar la página.
// La cabecera está en todas las pantallas del sitio: cobrarle una llamada al
// backend a cada visita, para un número que casi nadie mira, se paga en
// milisegundos en todas las páginas.
export const UserDropdown = ({
  isLoggedIn,
  nombre,
  correo,
}: {
  isLoggedIn: boolean
  nombre?: string | null
  correo?: string | null
}) => {
  const [abierto, setAbierto] = useState(false)
  const [saldo, setSaldo] = useState<{ creditos: number; porEscaneo: number; ilimitado: boolean } | null>(null)
  const [pedido, setPedido] = useState(false)

  // Mensajes sin leer: del servidor, igual que la campanita. Antes salía de
  // useUnreads() de TalkJS, y sólo con importarlo cada visitante (con o sin
  // sesión) bajaba el SDK del chat en todas las páginas.
  const [sinLeer, setSinLeer] = useState(0)
  useEffect(() => {
    if (!isLoggedIn) return
    contarSinLeer()
      .then((r) => r.ok && setSinLeer(r.total))
      .catch(() => {})
  }, [isLoggedIn, abierto])

  const traerSaldo = useCallback(async () => {
    if (pedido || !isLoggedIn) return
    setPedido(true)
    const res = await obtenerSaldo()
    if (res.ok) {
      setSaldo({ creditos: res.datos.saldo, porEscaneo: res.datos.creditos_por_escaneo, ilimitado: res.datos.ilimitado })
    }
  }, [pedido, isLoggedIn])

  useEffect(() => {
    if (abierto) void traerSaldo()
  }, [abierto, traerSaldo])

  const etiqueta = (nombre || correo || "").trim()
  const inicial = (etiqueta || "?").charAt(0).toUpperCase()

  return (
    <div
      className="relative"
      onMouseOver={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
      onFocus={() => setAbierto(true)}
    >
      <LocalizedClientLink
        href={isLoggedIn ? "/user" : "/login"}
        className="relative flex items-center"
        aria-label={isLoggedIn ? "Mi cuenta" : "Iniciar sesión"}
      >
        {isLoggedIn && etiqueta ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C2560A] text-[13px] font-bold text-white">
            {inicial}
          </span>
        ) : (
          <ProfileIcon size={20} />
        )}
        {isLoggedIn && sinLeer > 0 && (
          <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#9B3225] px-1 text-[10px] font-bold leading-none text-white">
            {sinLeer}
          </span>
        )}
      </LocalizedClientLink>

      <Dropdown show={abierto}>
        <div className="w-[270px] overflow-hidden rounded-[12px] bg-white shadow-lg">
          {isLoggedIn ? (
            <>
              <LocalizedClientLink
                href="/user"
                className="flex items-center gap-3 bg-[#FFF8F3] px-4 py-3 hover:bg-[#FDEEE1]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C2560A] text-[15px] font-bold text-white">
                  {inicial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-[#1B1B18]">
                    {etiqueta || "Mi cuenta"}
                  </span>
                  <span className="block text-[12px] text-[#6B6A63]"><T>Ver tu perfil</T></span>
                </span>
              </LocalizedClientLink>

              <Grupo>
                <Opcion href="/user/orders" icono="📦"><T>Compras</T></Opcion>
                <Opcion href="/user/envios" icono="🚚"><T>Mis envíos</T></Opcion>
                <Opcion href="/user/messages" icono="💬" insignia={sinLeer}>
                  <T>Mensajes</T>
                </Opcion>
                <Opcion href="/user/returns" icono="↩️"><T>Devoluciones</T></Opcion>
              </Grupo>

              <Grupo>
                <LocalizedClientLink
                  href="/user/creditos"
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#F7F5EF]"
                >
                  <span className="flex items-center gap-3 text-[14px] text-[#1B1B18]">
                    <span aria-hidden="true" className="w-5 text-center">🎟️</span>
                    <T>Saldo</T>
                  </span>
                  <span className="text-[14px] font-bold text-[#1B1B18]">
                    {saldo === null ? (
                      <span className="text-[13px] font-normal text-[#A5A29A]">…</span>
                    ) : saldo.ilimitado ? (
                      "Ilimitados"
                    ) : (
                      `${saldo.creditos} ${saldo.creditos === 1 ? "crédito" : "créditos"}`
                    )}
                  </span>
                </LocalizedClientLink>

                {saldo !== null && !saldo.ilimitado && (
                  <p className="px-4 pb-2 text-[12px] leading-snug text-[#6B6A63]">
                    {saldo.creditos >= saldo.porEscaneo
                      ? `Te alcanza para ${Math.floor(saldo.creditos / saldo.porEscaneo)} ${
                          Math.floor(saldo.creditos / saldo.porEscaneo) === 1
                            ? "escaneo 3D"
                            : "escaneos 3D"
                        }.`
                      : "No te alcanza para un escaneo todavía."}{" "}
                    <LocalizedClientLink
                      href="/user/creditos"
                      className="font-semibold text-[#B34D07] underline"
                    >
                      <T>Comprar</T>
                    </LocalizedClientLink>
                  </p>
                )}

                <a
                  href="/seller"
                  className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#1B1B18] hover:bg-[#F7F5EF]"
                >
                  <span aria-hidden="true" className="w-5 text-center">🏪</span>
                  <span className="flex-1"><T>Mi tienda</T></span>
                </a>
                <Opcion href="/user/escaneos" icono="📷"><T>Mis escaneos 3D</T></Opcion>
                <Opcion href="/herramientas-cnc" icono="🛠️"><T>Herramientas CNC</T></Opcion>
                <Opcion href="/user/cam" icono="🧭"><T>Mis trabajos CAM</T></Opcion>
                <Opcion href="/user/solicitudes" icono="🏭"><T>Mis solicitudes de fabricación</T></Opcion>
                <Opcion href="/user/piezas" icono="🔁"><T>Mis piezas (repetir pedido)</T></Opcion>
                <Opcion href="/cotizar" icono="📐"><T>Cotizar una pieza</T></Opcion>
              </Grupo>

              <Grupo ultimo>
                <Opcion href="/user/addresses" icono="📍"><T>Direcciones</T></Opcion>
                <Opcion href="/user/settings" icono="⚙️"><T>Configuración de la cuenta</T></Opcion>
                <LogoutButton
                  unstyled
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-[#1B1B18] hover:bg-[#F7F5EF]"
                >
                  <span aria-hidden="true" className="w-5 text-center">🚪</span>
                  <T>Salir</T>
                </LogoutButton>
              </Grupo>
            </>
          ) : (
            <div className="p-4">
              <p className="text-[14px] font-bold text-[#1B1B18]"><T>Entra a tu cuenta</T></p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6B6A63]">
                <T>Para ver tus compras, tus mensajes y el saldo de tus herramientas.</T>
              </p>
              <LocalizedClientLink
                href="/login"
                className="mt-3 block rounded-[10px] bg-[#C2560A] px-4 py-2.5 text-center text-[14px] font-semibold text-white hover:bg-[#A84A08]"
              >
                <T>Iniciar sesión</T>
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/register"
                className="mt-2 block rounded-[10px] border border-[#E7E4DC] px-4 py-2.5 text-center text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A]"
              >
                <T>Crear cuenta</T>
              </LocalizedClientLink>
            </div>
          )}
        </div>
      </Dropdown>
    </div>
  )
}

const Grupo = ({ children, ultimo }: { children: React.ReactNode; ultimo?: boolean }) => (
  <div className={ultimo ? "py-1" : "border-b border-[#EDEAE2] py-1"}>{children}</div>
)

const Opcion = ({
  href,
  icono,
  insignia,
  children,
}: {
  href: string
  icono: string
  insignia?: number
  children: React.ReactNode
}) => (
  <LocalizedClientLink
    href={href}
    className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#1B1B18] hover:bg-[#F7F5EF]"
  >
    <span aria-hidden="true" className="w-5 text-center">{icono}</span>
    <span className="flex-1">{children}</span>
    {Boolean(insignia) && (
      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#9B3225] px-1 text-[11px] font-bold leading-none text-white">
        {insignia}
      </span>
    )}
  </LocalizedClientLink>
)
