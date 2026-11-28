import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { Suspense } from "react"

import {
  BeneficiosTaller,
  PasosTaller,
  PerfilesTaller,
  PreguntasTaller,
  RegistroTaller,
} from "@/components/hetna/taller/ParaTalleres"
import { AvisoReclamarPerfil } from "@/components/hetna/taller/AvisoReclamarPerfil"
import { GuardarInvitacion } from "@/components/hetna/taller/GuardarInvitacion"
import { ComparativaComisiones } from "@/components/hetna/taller/ComparativaComisiones"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres } from "@/lib/hetna/talleres"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

export const revalidate = 300

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/talleres/unete" },
  title: { absolute: "Únete a la red de talleres CNC HETNA y recibe proyectos" },
  description:
    "Registra tu taller CNC gratis y recibe solicitudes de corte, maquila y producción de clientes de todo México. Cotiza lo que te conviene y cobra en HETNA.",
}

// La página para los TALLERES (la de /talleres es el directorio para los
// clientes). Responde en orden lo que un dueño de taller pregunta: qué gano,
// cómo funciona, si es para mí, cuánto cuesta, cómo me pagan, y termina en el
// registro. Los números (talleres, trabajos esperando precio, lugares de
// fundador) salen de la base: no se inventa ninguno.

const CUPO_FUNDADORES = 30

const COMO_GANAS = [
  ["Proyectos de fabricación", "Clientes que ya decidieron fabricar y buscan quién lo haga: piezas, letreros, muebles, refacciones."],
  ["Cotizaciones", "Te llegan solicitudes con material, medidas, cantidad, fecha y archivo. Cotizas sólo las que te interesan."],
  ["Producción por volumen", "Lotes y pedidos recurrentes de empresas que buscan un proveedor fijo."],
  ["Visibilidad", "Tu perfil en el directorio de talleres de México, por servicio, material y estado."],
  ["Contacto con clientes", "Clientes de tu zona y de todo el país que no te encontrarían por tu cuenta."],
  ["Venta de servicios y productos", "Publica tus servicios y vende productos en tu propia tienda dentro de HETNA."],
]

const RECIBES = [
  ["Piezas únicas", "Refacciones, regalos, piezas a la medida."],
  ["Prototipos", "Una o pocas piezas para probar una idea."],
  ["Lotes", "De decenas a miles de piezas iguales."],
  ["Maquila", "Marcas que te mandan su diseño para que tú lo fabriques."],
  ["Producción recurrente", "Pedidos que se repiten cada mes."],
  ["Diseño", "Clientes sin plano que necesitan que se los dibujen."],
]

const BTN = "inline-flex items-center justify-center rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
const H2 = "text-2xl font-extrabold text-[#142033] sm:text-3xl"

export default async function UneteTallerPage() {
  const [talleres, abiertos] = await Promise.all([
    listarTalleres().catch(() => []),
    trabajosAbiertos({ limit: 3 }).catch(() => ({ trabajos: [], total: 0 })),
  ])
  const verificados = talleres.filter((t) => t.verificado).length
  const quedanFundador = Math.max(CUPO_FUNDADORES - talleres.filter((t) => t.fundador).length, 0)
  const estados = new Set(talleres.map((t) => t.perfil.estado).filter(Boolean)).size

  return (
    <main className="w-full bg-[#FAF9F6]">
      <Suspense fallback={null}>
        <AvisoReclamarPerfil />
        <GuardarInvitacion />
      </Suspense>
      {/* Hero */}
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-12 sm:py-16 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]"><TS>Red de talleres HETNA</TS></p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl"><TS>Lleva tu taller a más clientes</TS></h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            <TS>Únete a la red HETNA y recibe solicitudes de fabricación, corte, maquila y producción CNC de clientes de todo México.</TS>
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#registro" className={BTN}>
              <TS>Registrar mi taller</TS>
            </a>
            <a href="#como-funciona-taller" className="inline-flex items-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
              <TS>Ver cómo funciona</TS>
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <li><TS>✓ Registro gratis</TS></li>
            <li>
              <a href="#comisiones" className="underline decoration-white/40 underline-offset-2 hover:text-white">
                <TS>✓ Comisión más baja que Mercado Libre y Amazon</TS>
              </a>
            </li>
            <li><TS>✓ Tú eliges qué cotizar</TS></li>
            <li><TS>✓ Cobro seguro antes de fabricar</TS></li>
            {abiertos.total > 0 && (
              <li className="font-semibold text-[#F2A25F]">
                <TS>{abiertos.total === 1 ? "1 trabajo esperando precio" : `${abiertos.total} trabajos esperando precio`}</TS> <TS>ahora</TS>
              </li>
            )}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 lg:px-8">
        {/* Cómo ganas dinero */}
        <section className="mt-12">
          <h2 className={H2}><TS>Cómo gana dinero tu taller con HETNA</TS></h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMO_GANAS.map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
                <p className="font-bold text-[#142033]">$ <TS>{t}</TS></p>
                <p className="mt-1 text-sm text-[#6B675C]"><TS>{d}</TS></p>
              </div>
            ))}
          </div>
        </section>

        <ComparativaComisiones />

        <PasosTaller />
        <BeneficiosTaller />
        <PerfilesTaller />

        {/* Qué puedes recibir */}
        <section className="mt-12">
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-[#142033]"><TS>Qué puedes recibir</TS></h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {RECIBES.map(([t, d]) => (
                <li key={t}>
                  <span className="block font-bold text-[#142033]"><TS>{t}</TS></span>
                  <span className="text-sm text-[#6B675C]"><TS>{d}</TS></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {abiertos.trabajos.length > 0 && (
          <section className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={H2}><TS>Trabajos que están esperando precio</TS></h2>
              <LocalizedClientLink href="/trabajos" className="text-sm font-semibold text-[#C2560A]">
                <TS>Ver los</TS> {abiertos.total} →
              </LocalizedClientLink>
            </div>
            <p className="mt-1 text-[#6B675C]"><TS>Solicitudes reales de clientes. Regístrate para cotizarlas.</TS></p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {abiertos.trabajos.map((t) => (
                <TarjetaTrabajo key={t.folio} trabajo={t} />
              ))}
            </div>
          </section>
        )}

        {/* Confianza */}
        <section className="mt-12 rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
          <h2 className="text-2xl font-extrabold sm:text-3xl"><TS>Qué es HETNA y por qué unirte</TS></h2>
          <p className="mt-3 max-w-3xl text-white/80">
            <TS>HETNA es una plataforma mexicana especializada en fabricación CNC: conecta a clientes que necesitan piezas con talleres
            que las fabrican. Los clientes llenan una solicitud estructurada (material, medidas, cantidad, fecha y archivo), HETNA la
            revisa y la manda a los talleres compatibles, y el pago y el seguimiento pasan por la plataforma.</TS>
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Plataforma especializada", "Sólo fabricación CNC: tus clientes saben lo que piden."],
              ["Solicitudes estructuradas", "Material, medidas, cantidad, fecha y archivos en cada una."],
              ["Seguimiento", "Cada pedido con folio, avances, entrega y confirmación del cliente."],
              ["Visibilidad profesional", "Perfil, reseñas e insignia de Taller verificado."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="font-bold"><TS>{t}</TS></p>
                <p className="mt-1 text-sm text-white/70"><TS>{d}</TS></p>
              </div>
            ))}
          </div>
          {(talleres.length > 0 || abiertos.total > 0) && (
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-white/10 pt-5">
              {talleres.length > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60"><TS>Talleres en la red</TS></dt>
                  <dd className="text-2xl font-extrabold"><TS>{talleres.length}</TS></dd>
                </div>
              )}
              {verificados > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60"><TS>Verificados</TS></dt>
                  <dd className="text-2xl font-extrabold"><TS>{verificados}</TS></dd>
                </div>
              )}
              {estados > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60"><TS>Estados</TS></dt>
                  <dd className="text-2xl font-extrabold"><TS>{estados}</TS></dd>
                </div>
              )}
              {abiertos.total > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60"><TS>Trabajos esperando precio</TS></dt>
                  <dd className="text-2xl font-extrabold">{abiertos.total}</dd>
                </div>
              )}
            </dl>
          )}
          {quedanFundador > 0 && (
            <p className="mt-6 rounded-xl bg-[#C2560A] px-4 py-3 text-sm font-semibold">
              <TS>{`Quedan ${quedanFundador} de ${CUPO_FUNDADORES} lugares de Taller fundador: insignia permanente y 6 meses de plan Pro gratis.`}</TS><TS>{" "}</TS>
              <LocalizedClientLink href="/talleres/fundadores" className="underline">
                <TS>Ver detalles</TS>
              </LocalizedClientLink>
            </p>
          )}
        </section>

        <PreguntasTaller todas />
        <RegistroTaller />
      </div>
      <div className="h-12" />
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
