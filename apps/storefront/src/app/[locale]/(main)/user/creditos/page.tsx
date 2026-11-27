import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import { UserNavigation } from "@/components/molecules/UserNavigation/UserNavigation"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ComprarPaquetes } from "@/components/hetna/creditos/ComprarPaquetes"
import { Movimientos } from "@/components/hetna/creditos/Movimientos"
import { listarPaquetes, obtenerSaldo } from "@/lib/creditos/acciones"

const metadataEs: Metadata = {
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
          <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>Entra a tu cuenta</TS></h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">
            <TS>Los créditos viven en tu cuenta: ahí se guardan y desde ahí se gastan.</TS>
          </p>
          <LocalizedClientLink
            href="/login"
            className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
          >
            <TS>Iniciar sesión</TS>
          </LocalizedClientLink>
        </div>
      </main>
    )
  }

  const saldo = res.ok ? res.datos.saldo : 0
  const ilimitado = res.ok && res.datos.ilimitado
  const porEscaneo = res.ok ? res.datos.creditos_por_escaneo : 5
  const alcanzan = Math.floor(saldo / Math.max(porEscaneo, 1))

  return (
    <main className="container pb-16">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
      <UserNavigation />
      <div className="min-w-0 md:col-span-3">
      <div className="text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/user" className="hover:text-[#B34D07]">
          <TS>Mi cuenta</TS>
        </LocalizedClientLink>
        <span>/</span>
        <span className="font-medium text-[#1B1B18]"><TS>Créditos</TS></span>
      </div>

      <h1 className="mt-4 text-[26px] font-bold text-[#1B1B18] lg:text-[32px]">
        <TS>Mis créditos</TS>
      </h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[#4A4943]">
        <TS>Los créditos pagan las herramientas de HETNA: diseño de muebles y cocinas,
        molduras y tallados, escaneo 3D y cotizador. No son dinero, no caducan y no se
        pueden retirar.</TS>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-[14px] border border-[#E7E4DC] bg-[#142033] p-6 text-white">
            <p className="text-[12px] uppercase tracking-wide text-[#9FB0C9]"><TS>Tu saldo</TS></p>
            <p className="mt-1 text-[40px] font-bold leading-none">
              <TS>{ilimitado ? "∞" : saldo}</TS><TS>{" "}</TS>
              <span className="text-[18px] font-semibold text-[#9FB0C9]">
                <TS>{ilimitado ? "créditos ilimitados" : saldo === 1 ? "crédito" : "créditos"}</TS>
              </span>
            </p>
            <p className="mt-2 text-[14px] text-[#9FB0C9]">
              <TS>{ilimitado
                ? "Cuenta de HETNA: el escaneo 3D, el cotizador y las descargas no te descuentan nada."
                : alcanzan > 0
                ? `Te alcanza para ${alcanzan} ${alcanzan === 1 ? "escaneo 3D" : "escaneos 3D"} (${porEscaneo} créditos cada uno).`
                : `Un escaneo 3D cuesta ${porEscaneo} créditos. Todavía no te alcanza.`}</TS>
            </p>
            {!res.ok && (
              <p className="mt-3 rounded-[8px] bg-[#1F3350] px-3 py-2 text-[13px]">
                <TS>No pudimos leer tu saldo ahorita.</TS> <TS>{res.mensaje}</TS>
              </p>
            )}
          </section>

          <section>
            <h2 className="text-[18px] font-bold text-[#1B1B18]"><TS>Comprar créditos</TS></h2>
            <p className="mt-1 text-[14px] text-[#4A4943]">
              <TS>Eliges el paquete y pagas al momento con Mercado Pago o PayPal. Al confirmarse
              el pago, los créditos entran solos a tu cuenta.</TS>
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
            <h3 className="text-[14px] font-bold text-[#1B1B18]"><TS>¿En qué se gastan?</TS></h3>
            <ul className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-[#4A4943]">
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  <LocalizedClientLink href="/disenar/muebles-ensamble" className="font-semibold text-[#B34D07] underline">
                    <TS>Muebles</TS>
                  </LocalizedClientLink><TS>{" "}</TS>
                  y<TS>{" "}</TS>
                  <LocalizedClientLink href="/disenar/despiece-muebles" className="font-semibold text-[#B34D07] underline">
                    <TS>cocina integral</TS>
                  </LocalizedClientLink>
                  <TS>: diseñar, editar, cotizar y guardar es gratis. Bajar archivos, planos y etiquetas: 1 crédito por cada 40 piezas (un mueble, 1; una cocina, unos 5). Leer una imagen con IA: 2 (se regresan si no sirve).</TS>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  <TS>Molduras: 1 crédito; panel tallado: 2. El mismo diseño nunca se cobra dos veces.</TS>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  <LocalizedClientLink
                    href="/disenar/imagen-a-3d"
                    className="font-semibold text-[#B34D07] underline"
                  >
                    <TS>Escaneo 3D</TS>
                  </LocalizedClientLink>
                  : <TS>{porEscaneo}</TS> <TS>créditos por pieza. La vista previa es gratis.</TS>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  <LocalizedClientLink
                    href="/cotizar"
                    className="font-semibold text-[#B34D07] underline"
                  >
                    <TS>Cotizador</TS>
                  </LocalizedClientLink>
                  <TS>: las primeras cotizaciones no cuestan.</TS>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#C2560A]">·</span>
                <span>
                  <TS>El</TS><TS>{" "}</TS>
                  <LocalizedClientLink
                    href="/herramientas-cnc#laboratorio-cam"
                    className="font-semibold text-[#B34D07] underline"
                  >
                    <TS>Laboratorio CAM</TS>
                  </LocalizedClientLink><TS>{" "}</TS>
                  <TS>es gratis y sin cuenta.</TS>
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
      </div>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
