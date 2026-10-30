import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { IconoCuenta, type NombreIcono } from "@/components/hetna/cuenta/IconoCuenta"
import { UserNavigation } from "@/components/molecules"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { obtenerSaldo } from "@/lib/creditos/acciones"
import { retrieveCustomer } from "@/lib/data/customer"
import { listOrders } from "@/lib/data/orders"
import { misEnvios } from "@/lib/envios/cotizar"
import { sesionForo } from "@/lib/foro/consultas"
import { ligaWhatsApp } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  title: "Mi cuenta | HETNA CNC",
  robots: { index: false, follow: false },
}

// "Mi cuenta": como en los marketplaces grandes (Mercado Libre, Amazon): arriba
// lo que necesita atención, luego lo último que compró y una cuadrícula de
// tarjetas (icono, título, una línea de qué se hace ahí) que lleva a todo.

type Tarjeta = { titulo: string; texto: string; href: string; icono: NombreIcono; dato?: string; externo?: boolean }
type Aviso = { tono: "rojo" | "ambar" | "azul"; texto: string; href: string; accion: string; externo?: boolean }

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fecha = (s: string | Date) => new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

const estadoPedido = (o: { status?: string; fulfillment_status?: string; payment_status?: string }): [string, string] => {
  if (o.status === "canceled") return ["Cancelado", "bg-[#F3F1EA] text-[#6B675C]"]
  if (o.payment_status && ["not_paid", "awaiting", "requires_action"].includes(o.payment_status)) return ["Pago pendiente", "bg-[#FFF3E0] text-[#9A4A06]"]
  switch (o.fulfillment_status) {
    case "delivered":
    case "partially_delivered":
      return ["Entregado", "bg-[#E6F4EC] text-[#14683F]"]
    case "shipped":
    case "partially_shipped":
      return ["En camino", "bg-[#E8F0FB] text-[#1D4F8C]"]
    default:
      return ["Preparando", "bg-[#F3F1EA] text-[#44433D]"]
  }
}

const TONOS = {
  rojo: "border-[#F5B5AE] bg-[#FDECEA] text-[#8A1C14]",
  ambar: "border-[#F2C98F] bg-[#FFF8EE] text-[#5A3A12]",
  azul: "border-[#C9D6EC] bg-[#EEF3FB] text-[#1D3E6E]",
}

export default async function MiCuenta() {
  const user = await retrieveCustomer()
  if (!user) redirect("/login")

  const [pedidos, envios, saldo, foro] = await Promise.all([
    listOrders(3).catch(() => []),
    misEnvios().catch(() => ({ ok: false as const, login: false })),
    obtenerSaldo().catch(() => null),
    sesionForo().catch(() => null),
  ])
  const nombre = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
  const creditos = saldo && saldo.ok ? saldo.datos.saldo : null
  const listaEnvios = envios.ok ? envios.envios : []
  const sobrepesos = envios.ok ? envios.sobrepesos.filter((s) => s.pago_url) : []
  const sinEvidencia = listaEnvios.filter((e) => ["pagado", "guia_generada"].includes(e.estado) && !e.evidencia_completa)
  const sinPagar = listaEnvios.filter((e) => e.estado === "pendiente_pago" && e.pago_url)
  const pendientesForo = foro?.pendientes || { avisos: 0, mensajes: 0 }
  const direcciones = user.addresses?.length || 0

  // Lo que necesita atención, de lo más urgente a lo menos
  const avisos: Aviso[] = [
    ...sobrepesos.map((s): Aviso => ({
      tono: "rojo",
      texto: `Tienes un cobro por sobrepeso de ${pesos(s.monto)} (${s.referencia}). Mientras esté pendiente no puedes pedir envíos nuevos.`,
      href: s.pago_url!,
      accion: "Pagar",
      externo: true,
    })),
    ...sinEvidencia.slice(0, 2).map((e): Aviso => ({
      tono: "ambar",
      texto: `Sube las 4 fotos de tu envío ${e.folio} (alto, largo, ancho y báscula con la guía visible) antes de entregarlo.`,
      href: "/user/envios",
      accion: "Subir fotos",
    })),
    ...sinPagar.slice(0, 1).map((e): Aviso => ({
      tono: "ambar",
      texto: `Tu envío ${e.folio} está pendiente de pago.`,
      href: e.pago_url!,
      accion: "Pagar envío",
      externo: true,
    })),
    ...(pendientesForo.mensajes + pendientesForo.avisos > 0
      ? [
          {
            tono: "azul" as const,
            texto: `Tienes ${[
              pendientesForo.mensajes ? `${pendientesForo.mensajes} ${pendientesForo.mensajes === 1 ? "conversación" : "conversaciones"} con mensajes nuevos` : "",
              pendientesForo.avisos ? `${pendientesForo.avisos} ${pendientesForo.avisos === 1 ? "aviso" : "avisos"}` : "",
            ]
              .filter(Boolean)
              .join(" y ")} en el foro.`,
            href: pendientesForo.mensajes ? "/foro-cnc/mensajes" : "/foro-cnc/avisos",
            accion: "Ver",
          },
        ]
      : []),
    ...(!user.phone
      ? [{ tono: "azul" as const, texto: "Agrega tu teléfono para que la paquetería y los talleres puedan contactarte.", href: "/user/settings", accion: "Completar" }]
      : []),
  ]

  const tarjetas: Tarjeta[] = [
    { titulo: "Mis pedidos", texto: "Rastrea tus compras, revisa su estado y pide devoluciones.", href: "/user/orders", icono: "pedidos" },
    {
      titulo: "Mis envíos",
      texto: "Tus guías de Envíos HETNA, fotos de evidencia y cobros pendientes.",
      href: "/user/envios",
      icono: "envios",
      dato: listaEnvios.length ? `${listaEnvios.length} ${listaEnvios.length === 1 ? "envío" : "envíos"}` : undefined,
    },
    { titulo: "Favoritos", texto: "Productos y piezas que guardaste para después.", href: "/favoritos", icono: "favoritos" },
    { titulo: "Fabricar una pieza", texto: "Pide cotización a talleres con tu plano, foto o idea.", href: "/fabricacion", icono: "taller" },
    { titulo: "Trabajos CAM", texto: "Tus archivos y trayectorias del laboratorio CAM.", href: "/user/cam", icono: "cam" },
    {
      titulo: "Mis créditos",
      texto: "Saldo para el escaneo 3D y el cotizador; recarga cuando quieras.",
      href: "/user/creditos",
      icono: "creditos",
      dato: creditos != null ? `${creditos} ${creditos === 1 ? "crédito" : "créditos"}` : undefined,
    },
    { titulo: "Mensajes con talleres", texto: "Tus conversaciones con los talleres sobre productos y pedidos.", href: "/mensajes", icono: "mensajes" },
    { titulo: "Talleres que sigo", texto: "Novedades, productos y trabajos de los talleres que sigues.", href: "/foro-cnc/red?ver=siguiendo", icono: "siguiendo" },
    {
      titulo: "Mi perfil del foro",
      texto: foro?.perfil ? "Tu currículum, publicaciones, avisos y mensajes en la comunidad." : "Crea tu perfil para preguntar, publicar y seguir talleres.",
      href: "/foro-cnc/mi-perfil",
      icono: "foro",
      dato: foro?.perfil ? `@${foro.perfil.usuario}` : undefined,
    },
    { titulo: "Datos de tu cuenta", texto: "Nombre, correo y teléfono.", href: "/user/settings", icono: "perfil" },
    { titulo: "Seguridad", texto: "Cambia tu contraseña.", href: "/user/settings", icono: "seguridad" },
    {
      titulo: "Direcciones",
      texto: "Domicilios de entrega y de recolección guardados.",
      href: "/user/addresses",
      icono: "direcciones",
      dato: direcciones ? `${direcciones} ${direcciones === 1 ? "guardada" : "guardadas"}` : "Ninguna guardada",
    },
    { titulo: "Comunicaciones", texto: "Elige qué correos del foro te llegan y cada cuánto.", href: "/foro-cnc/mi-perfil#avisos", icono: "comunicaciones" },
    { titulo: "Privacidad", texto: "Cómo cuidamos tus datos y cómo ejercer tus derechos.", href: "/aviso-de-privacidad", icono: "privacidad" },
    { titulo: "Vender en HETNA", texto: "Abre tu taller: recibe proyectos y vende tus productos.", href: "/talleres/unete", icono: "taller" },
  ]

  return (
    <main className="container pb-16">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="flex min-w-0 flex-col gap-6 md:col-span-3">
          {/* Encabezado */}
          <section className="flex flex-wrap items-center gap-4 rounded-[18px] border border-[#E7E4DC] bg-white p-5 sm:p-6">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#C2560A] text-2xl font-bold text-white">
              {(user.first_name || user.email || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="m-0 text-[24px] font-extrabold text-[#142033] sm:text-[28px]">Hola, {user.first_name || nombre}</h1>
              <p className="m-0 truncate text-[14px] text-[#6B6A63]">
                {user.email}
                {user.created_at ? ` · Cliente desde ${new Date(user.created_at).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}` : ""}
              </p>
            </div>
            {creditos != null && (
              <LocalizedClientLink href="/user/creditos" className="rounded-[12px] bg-[#F4F1EA] px-4 py-2 text-center hover:bg-[#EDE8DC]">
                <span className="block text-[20px] font-extrabold text-[#142033]">{creditos}</span>
                <span className="text-[12px] text-[#6B6A63]">créditos</span>
              </LocalizedClientLink>
            )}
          </section>

          {/* Lo que necesita atención */}
          {avisos.length > 0 && (
            <section aria-label="Pendientes" className="flex flex-col gap-2">
              {avisos.map((a, i) => {
                const boton = "shrink-0 rounded-full bg-white/80 px-4 py-1.5 text-[13.5px] font-semibold ring-1 ring-current hover:bg-white"
                return (
                  <div key={i} className={`flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3 text-[14px] ${TONOS[a.tono]}`}>
                    <span>{a.texto}</span>
                    {a.externo ? (
                      <a href={a.href} className={boton}>
                        {a.accion}
                      </a>
                    ) : (
                      <LocalizedClientLink href={a.href} className={boton}>
                        {a.accion}
                      </LocalizedClientLink>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {/* Últimos pedidos */}
          <section className="rounded-[18px] border border-[#E7E4DC] bg-white p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="m-0 text-[17px] font-bold text-[#142033]">Tus últimas compras</h2>
              {pedidos.length > 0 && (
                <LocalizedClientLink href="/user/orders" className="text-[14px] font-semibold text-[#C2560A] hover:underline">
                  Ver todas →
                </LocalizedClientLink>
              )}
            </div>
            {pedidos.length ? (
              <ul className="m-0 mt-3 flex list-none flex-col divide-y divide-[#F0EDE6] p-0">
                {pedidos.map((o) => {
                  const [estado, color] = estadoPedido(o as never)
                  const primero = o.items?.[0]
                  return (
                    <li key={o.id}>
                      <LocalizedClientLink
                        href={`/user/orders/${(o as { order_group?: { id: string } }).order_group?.id || o.id}`}
                        className="flex items-center gap-3 py-3 hover:bg-[#FAF9F6]"
                      >
                        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#F4F1EA] text-[#9A978C]">
                          {primero?.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={primero.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <IconoCuenta n="pedidos" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-semibold text-[#1B1B18]">
                            {primero?.product_title || primero?.title || `Pedido #${o.display_id}`}
                            {(o.items?.length || 0) > 1 ? ` y ${(o.items?.length || 1) - 1} más` : ""}
                          </span>
                          <span className="text-[12.5px] text-[#6B6A63]">
                            #{o.display_id} · {o.seller?.name ? `${o.seller.name} · ` : ""}
                            {fecha(o.created_at as string)} · {pesos(Number(o.total) || 0)}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${color}`}>{estado}</span>
                      </LocalizedClientLink>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-[14px] text-[#6B6A63]">
                Todavía no tienes compras.{" "}
                <LocalizedClientLink href="/categories" className="font-semibold text-[#C2560A] underline">
                  Explora la tienda
                </LocalizedClientLink>{" "}
                o{" "}
                <LocalizedClientLink href="/fabricacion" className="font-semibold text-[#C2560A] underline">
                  pide que te fabriquen una pieza
                </LocalizedClientLink>
                .
              </p>
            )}
          </section>

          {/* Tarjetas */}
          <section aria-label="Tu cuenta" className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
            {tarjetas.map((t) => (
              <LocalizedClientLink
                key={t.titulo}
                href={t.href}
                className="group flex flex-col gap-1.5 rounded-[14px] border border-[#E7E4DC] bg-white p-3.5 transition hover:border-[#C2560A] hover:shadow-[0_2px_10px_rgba(20,32,51,0.06)] sm:gap-2 sm:p-5"
              >
                <span className="flex items-center justify-between gap-2 text-[#44433D] group-hover:text-[#C2560A]">
                  <IconoCuenta n={t.icono} size={26} />
                  {t.dato && (
                    <span className="truncate rounded-full bg-[#F4F1EA] px-2 py-0.5 text-[11px] font-semibold text-[#44433D] sm:px-2.5 sm:text-[12px]">{t.dato}</span>
                  )}
                </span>
                <span className="text-[14px] font-bold leading-tight text-[#142033] sm:text-[15.5px]">{t.titulo}</span>
                <span className="line-clamp-3 text-[12.5px] leading-snug text-[#6B6A63] sm:text-[13.5px]">{t.texto}</span>
              </LocalizedClientLink>
            ))}
            <a
              href={ligaWhatsApp("Hola, necesito ayuda con mi cuenta de HETNA CNC.")}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1.5 rounded-[14px] border border-[#E7E4DC] bg-white p-3.5 transition hover:border-[#C2560A] sm:gap-2 sm:p-5"
            >
              <span className="text-[#44433D] group-hover:text-[#C2560A]">
                <IconoCuenta n="ayuda" size={26} />
              </span>
              <span className="text-[14px] font-bold leading-tight text-[#142033] sm:text-[15.5px]">Ayuda</span>
              <span className="line-clamp-3 text-[12.5px] leading-snug text-[#6B6A63] sm:text-[13.5px]">Escríbenos por WhatsApp o revisa las preguntas frecuentes.</span>
            </a>
          </section>
        </div>
      </div>
    </main>
  )
}
