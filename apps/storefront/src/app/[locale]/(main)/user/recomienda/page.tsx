import type { Metadata } from "next"

import { CompartirLiga } from "@/components/hetna/recomienda/CompartirLiga"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { UserNavigation } from "@/components/molecules/UserNavigation/UserNavigation"
import { obtenerRecomienda } from "@/lib/recomienda/acciones"

// Mi cuenta > Recomienda y gana (packages/api/src/lib/cupones.ts): la liga del
// cliente, cuántos amigos lleva, sus cupones y las condiciones de la promoción.

export const metadata: Metadata = {
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
          <h1 className="text-[24px] font-bold text-[#1B1B18]">Recomienda y gana</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">{res.mensaje}</p>
          {res.noAutenticado && (
            <LocalizedClientLink
              href="/login"
              className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
            >
              Iniciar sesión
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
              Mi cuenta
            </LocalizedClientLink>
            <span>/</span>
            <span className="font-medium text-[#1B1B18]">Recomienda y gana</span>
          </div>

          <h1 className="mt-4 text-[26px] font-bold text-[#1B1B18] lg:text-[32px]">Recomienda y gana</h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[#4A4943]">
            Tu amigo recibe <b>{pesos(d.monto)}</b> en su primera compra y tú ganas <b>{pesos(d.monto)}</b> cuando compre. Sin
            límite de amigos (hasta 20 cupones al año).
          </p>

          <section className="mt-6 rounded-[16px] border border-[#E7E4DC] bg-white p-5 lg:p-6">
            <h2 className="text-[17px] font-bold text-[#1B1B18]">Tu liga</h2>
            <p className="mb-4 mt-1 text-[14px] text-[#6B6A63]">
              Compártela por WhatsApp, Facebook o donde quieras. Tu código es <b className="text-[#1B1B18]">{d.codigo}</b>.
            </p>
            <CompartirLiga liga={d.liga} monto={d.monto} minimo={d.minimo} />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#6B6A63]">Amigos registrados</p>
              <p className="mt-1 text-[26px] font-bold text-[#1B1B18]">{d.amigos_registrados}</p>
            </div>
            <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#6B6A63]">Por comprar</p>
              <p className="mt-1 text-[26px] font-bold text-[#1B1B18]">{pendientes}</p>
            </div>
            <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#6B6A63]">Cupones ganados</p>
              <p className="mt-1 text-[26px] font-bold text-[#1B1B18]">{d.cupones.length}</p>
            </div>
          </section>

          <section className="mt-5 rounded-[16px] border border-[#E7E4DC] bg-white p-5 lg:p-6">
            <h2 className="text-[17px] font-bold text-[#1B1B18]">Tus cupones</h2>
            {d.bienvenida.disponible && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-2 border-dashed border-[#C2560A] bg-[#FFF8F2] p-4">
                <div>
                  <p className="text-[18px] font-bold tracking-wider text-[#1B1B18]">{d.bienvenida.codigo}</p>
                  <p className="text-[13px] text-[#4A4943]">
                    {pesos(d.monto)} en tu primera compra de {pesos(d.minimo)} o más
                  </p>
                </div>
                <LocalizedClientLink href="/" className="rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#A84A08]">
                  Ir a la tienda
                </LocalizedClientLink>
              </div>
            )}
            {d.cupones.length === 0 && !d.bienvenida.disponible && (
              <p className="mt-2 text-[14px] text-[#6B6A63]">
                Aún no tienes cupones. Ganas uno por cada amigo que compre con tu liga.
              </p>
            )}
            {d.cupones.map((c) => (
              <div key={c.codigo} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E7E4DC] p-4">
                <div>
                  <p className={`text-[17px] font-bold tracking-wider ${c.usado || c.vencido ? "text-[#9A978C] line-through" : "text-[#1B1B18]"}`}>
                    {c.codigo}
                  </p>
                  <p className="text-[13px] text-[#4A4943]">
                    {pesos(d.monto)} en compras de {pesos(d.minimo)} o más
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
              <p className="mt-3 text-[13px] text-[#6B6A63]">Escribe el código en tu carrito, en "Código de descuento".</p>
            )}
          </section>

          <section className="mt-5 rounded-[16px] bg-[#F6F4EF] p-5 lg:p-6">
            <h2 className="text-[16px] font-bold text-[#1B1B18]">Cómo funciona</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-[#4A4943]">
              <li>Tu amigo entra con tu liga y crea su cuenta.</li>
              <li>
                En su primera compra de {pesos(d.minimo)} o más usa el código <b>{d.bienvenida.codigo}</b> y recibe {pesos(d.monto)} de
                descuento.
              </li>
              <li>
                {d.dias_espera} días después de su compra, si no la canceló, te llega por correo tu cupón de {pesos(d.monto)}.
              </li>
            </ol>
            <h3 className="mt-4 text-[14px] font-bold text-[#1B1B18]">Condiciones</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[#6B6A63]">
              <li>
                Los cupones aplican en compras de {pesos(d.minimo)} o más en productos (sin contar envío), uno por compra, y no se
                cambian por dinero.
              </li>
              <li>{d.bienvenida.codigo} es solo para la primera compra de cada cuenta.</li>
              <li>
                Tu cupón de recompensa es personal (solo funciona con tu cuenta), de un solo uso y vence a los 90 días. Máximo 20
                cupones por año.
              </li>
              <li>
                La recompensa cuenta solo si tu amigo se registró con tu liga, es una persona distinta a ti y su compra de{" "}
                {pesos(d.minimo)} o más está pagada y no se canceló ni se devolvió.
              </li>
              <li>HETNA puede cancelar cupones obtenidos con cuentas falsas o abusos, y cambiar o terminar la promoción avisando en esta página.</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}
