import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import { CompartirLiga } from "@/components/hetna/recomienda/CompartirLiga"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { UserNavigation } from "@/components/molecules/UserNavigation/UserNavigation"
import { obtenerRecomienda } from "@/lib/recomienda/acciones"

// Mi cuenta > Recomienda y gana (packages/api/src/lib/cupones.ts): la liga del
// cliente, cuántos amigos lleva, sus cupones y las condiciones de la promoción.

const metadataEs: Metadata = {
  title: "Recomienda y gana",
  description: "Comparte tu liga de HETNA CNC y gana un cupón por cada amigo que compre.",
  robots: { index: false, follow: false },
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" })

export default async function RecomiendaPage() {
  const res = await obtenerRecomienda()

  if (!res.ok) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>Recomienda y gana</TS></h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]"><TS>{res.mensaje}</TS></p>
          {res.noAutenticado && (
            <LocalizedClientLink
              href="/login"
              className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
            >
              <TS>Iniciar sesión</TS>
            </LocalizedClientLink>
          )}
        </div>
      </main>
    )
  }

  const d = res.datos
  const pendientes = Math.max(0, d.amigos_registrados - d.amigos_con_recompensa)
  const vigentes = d.cupones.filter((c) => !c.usado && !c.vencido)

  return (
    <main className="container pb-16">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="min-w-0 md:col-span-3">
          <div className="flex flex-wrap gap-1.5 text-[13px] text-[#6B6A63]">
            <LocalizedClientLink href="/user" className="hover:text-[#B34D07]">
              <TS>Mi cuenta</TS>
            </LocalizedClientLink>
            <span>/</span>
            <span className="font-medium text-[#1B1B18]"><TS>Recomienda y gana</TS></span>
          </div>

          <h1 className="mt-4 text-[26px] font-bold text-[#1B1B18] lg:text-[32px]"><TS>Recomienda y gana</TS></h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[#4A4943]">
            <TS>Tu amigo recibe</TS> <b>{pesos(d.monto)}</b> <TS>en su primera compra y tú ganas</TS> <b>{pesos(d.monto)}</b> <TS>cuando compre. Sin
            límite de amigos (hasta 20 cupones al año).</TS>
          </p>

          <section className="mt-6 rounded-[16px] border border-[#E7E4DC] bg-white p-5 lg:p-6">
            <h2 className="text-[17px] font-bold text-[#1B1B18]"><TS>Tu liga</TS></h2>
            <p className="mb-4 mt-1 text-[14px] text-[#6B6A63]">
              <TS>Compártela por WhatsApp, Facebook o donde quieras. Tu código es</TS> <b className="text-[#1B1B18]">{d.codigo}</b>.
            </p>
            <CompartirLiga liga={d.liga} monto={d.monto} minimo={d.minimo} />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#6B6A63]"><TS>Amigos registrados</TS></p>
              <p className="mt-1 text-[26px] font-bold text-[#1B1B18]">{d.amigos_registrados}</p>
            </div>
            <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#6B6A63]"><TS>Por comprar</TS></p>
              <p className="mt-1 text-[26px] font-bold text-[#1B1B18]">{pendientes}</p>
            </div>
            <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#6B6A63]"><TS>Cupones ganados</TS></p>
              <p className="mt-1 text-[26px] font-bold text-[#1B1B18]">{d.cupones.length}</p>
            </div>
          </section>

          <section className="mt-5 rounded-[16px] border border-[#E7E4DC] bg-white p-5 lg:p-6">
            <h2 className="text-[17px] font-bold text-[#1B1B18]"><TS>Tus cupones</TS></h2>
            {d.bienvenida.disponible && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-2 border-dashed border-[#C2560A] bg-[#FFF8F2] p-4">
                <div>
                  <p className="text-[18px] font-bold tracking-wider text-[#1B1B18]">{d.bienvenida.codigo}</p>
                  <p className="text-[13px] text-[#4A4943]">
                    {pesos(d.monto)} <TS>en tu primera compra de</TS> {pesos(d.minimo)} <TS>o más</TS>
                  </p>
                </div>
                <LocalizedClientLink href="/" className="rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#A84A08]">
                  <TS>Ir a la tienda</TS>
                </LocalizedClientLink>
              </div>
            )}
            {d.cupones.length === 0 && !d.bienvenida.disponible && (
              <p className="mt-2 text-[14px] text-[#6B6A63]">
                <TS>Aún no tienes cupones. Ganas uno por cada amigo que compre con tu liga.</TS>
              </p>
            )}
            {d.cupones.map((c) => (
              <div key={c.codigo} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E7E4DC] p-4">
                <div>
                  <p className={`text-[17px] font-bold tracking-wider ${c.usado || c.vencido ? "text-[#9A978C] line-through" : "text-[#1B1B18]"}`}>
                    {c.codigo}
                  </p>
                  <p className="text-[13px] text-[#4A4943]">
                    {pesos(d.monto)} <TS>en compras de</TS> {pesos(d.minimo)} <TS>o más</TS>
                    {c.vence ? ` · vence el ${fecha(c.vence)}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                    c.usado ? "bg-[#F1EFEA] text-[#6B6A63]" : c.vencido ? "bg-[#FDECEA] text-[#9B3225]" : "bg-[#E6F4EC] text-[#14683F]"
                  }`}
                >
                  {c.usado ? "Usado" : c.vencido ? "Vencido" : "Disponible"}
                </span>
              </div>
            ))}
            {vigentes.length > 0 && (
              <p className="mt-3 text-[13px] text-[#6B6A63]"><TS>Escribe el código en tu carrito, en "Código de descuento".</TS></p>
            )}
          </section>

          <section className="mt-5 rounded-[16px] bg-[#F6F4EF] p-5 lg:p-6">
            <h2 className="text-[16px] font-bold text-[#1B1B18]"><TS>Cómo funciona</TS></h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-[#4A4943]">
              <li><TS>Tu amigo entra con tu liga y crea su cuenta.</TS></li>
              <li>
                <TS>En su primera compra de</TS> {pesos(d.minimo)} <TS>o más usa el código</TS> <b>{d.bienvenida.codigo}</b> <TS>y recibe</TS> {pesos(d.monto)} <TS>de
                descuento.</TS>
              </li>
              <li>
                {d.dias_espera} <TS>días después de su compra, si no la canceló, te llega por correo tu cupón de</TS> {pesos(d.monto)}.
              </li>
            </ol>
            <h3 className="mt-4 text-[14px] font-bold text-[#1B1B18]"><TS>Condiciones</TS></h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[#6B6A63]">
              <li>
                <TS>Los cupones aplican en compras de</TS> {pesos(d.minimo)} <TS>o más en productos (sin contar envío), uno por compra, y no se
                cambian por dinero.</TS>
              </li>
              <li>{d.bienvenida.codigo} <TS>es solo para la primera compra de cada cuenta.</TS></li>
              <li>
                <TS>Tu cupón de recompensa es personal (solo funciona con tu cuenta), de un solo uso y vence a los 90 días. Máximo 20
                cupones por año.</TS>
              </li>
              <li>
                <TS>La recompensa cuenta solo si tu amigo se registró con tu liga, es una persona distinta a ti y su compra de</TS>{" "}
                {pesos(d.minimo)} <TS>o más está pagada y no se canceló ni se devolvió.</TS>
              </li>
              <li><TS>HETNA puede cancelar cupones obtenidos con cuentas falsas o abusos, y cambiar o terminar la promoción avisando en esta página.</TS></li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
