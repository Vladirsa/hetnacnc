import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ComprarPaquetes } from "@/components/hetna/creditos/ComprarPaquetes"
import { Movimientos } from "@/components/hetna/creditos/Movimientos"
import { listarPaquetes, obtenerSaldo } from "@/lib/creditos/acciones"

export const metadata: Metadata = {
  title: "Mis créditos",
  description: "Tu saldo de créditos para las herramientas de HETNA CNC.",
  robots: { index: false, follow: false },
}

export default async function CreditosPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [res, { paquetes, proveedores }] = await Promise.all([obtenerSaldo(), listarPaquetes()])

  if (!res.ok && res.noAutenticado) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]">Entra a tu cuenta</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">
            Los créditos viven en tu cuenta: ahí se guardan y desde ahí se gastan.
          </p>
          <LocalizedClientLink
            href="/login"
            className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
          >
            Iniciar sesión
          </LocalizedClientLink>
        </div>
      </main>
    )
  }

  const saldo = res.ok ? res.datos.saldo : 0
  const porEscaneo = res.ok ? res.datos.creditos_por_escaneo : 5
  const alcanzan = Math.floor(saldo / Math.max(porEscaneo, 1))

  return (
    <main className="container">
      <div className="pt-4 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/user" className="hover:text-[#B34D07]">
          Mi cuenta
        </LocalizedClientLink>
        <span>/</span>
        <span className="font-medium text-[#1B1B18]">Créditos</span>
      </div>

      <h1 className="mt-4 text-[26px] font-bold text-[#1B1B18] lg:text-[32px]">
        Mis créditos
      </h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[#4A4943]">
        Los créditos pagan las herramientas de HETNA: el escaneo 3D profesional y el
        cotizador. No son dinero, no caducan y no se pueden retirar.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-[14px] border border-[#E7E4DC] bg-[#142033] p-6 text-white">
            <p className="text-[12px] uppercase tracking-wide text-[#9FB0C9]">Tu saldo</p>
            <p className="mt-1 text-[40px] font-bold leading-none">
              {saldo}{" "}
              <span className="text-[18px] font-semibold text-[#9FB0C9]">
                {saldo === 1 ? "crédito" : "créditos"}
              </span>
            </p>
            <p className="mt-2 text-[14px] text-[#9FB0C9]">
              {alcanzan > 0
                ? `Te alcanza para ${alcanzan} ${alcanzan === 1 ? "escaneo 3D" : "escaneos 3D"} (${porEscaneo} créditos cada uno).`
                : `Un escaneo 3D cuesta ${porEscaneo} créditos. Todavía no te alcanza.`}
            </p>
            {!res.ok && (
              <p className="mt-3 rounded-[8px] bg-[#1F3350] px-3 py-2 text-[13px]">
                No pudimos leer tu saldo ahorita. {res.mensaje}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-[18px] font-bold text-[#1B1B18]">Comprar créditos</h2>
            <p className="mt-1 text-[14px] text-[#4A4943]">
              Eliges el paquete y pagas al momento con Mercado Pago o PayPal. Al confirmarse
              el pago, los créditos entran solos a tu cuenta.
            </p>
            <ComprarPaquetes
              paquetes={paquetes}
              proveedores={proveedores}
              locale={locale}
              porEscaneo={porEscaneo}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Movimientos movimientos={res.ok ? res.datos.movimientos : []} />

          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
            <h3 className="text-[14px] font-bold text-[#1B1B18]">¿En qué se gastan?</h3>
            <ul className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-[#4A4943]">
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  <LocalizedClientLink
                    href="/disenar/escanear-pieza"
                    className="font-semibold text-[#B34D07] underline"
                  >
                    Escaneo 3D
                  </LocalizedClientLink>
                  : {porEscaneo} créditos por pieza. La vista previa es gratis.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  <LocalizedClientLink
                    href="/cotizar"
                    className="font-semibold text-[#B34D07] underline"
                  >
                    Cotizador
                  </LocalizedClientLink>
                  : las primeras cotizaciones no cuestan.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  El{" "}
                  <LocalizedClientLink
                    href="/herramientas-cnc#laboratorio-cam"
                    className="font-semibold text-[#B34D07] underline"
                  >
                    Laboratorio CAM
                  </LocalizedClientLink>{" "}
                  es gratis y sin cuenta.
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  )
}
