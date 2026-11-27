// /mx/anunciate — kit de medios y compra de publicidad. Los números (vistas al
// mes y % de clics por espacio) son reales: salen de los anuncios que ya
// corrieron en HETNA (lib/publicidad/consultas.ts metricasEspacios).
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import FormAnunciate, { type EspacioVenta } from "@/components/hetna/publicidad/FormAnunciate"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { metricasEspacios } from "@/lib/publicidad/consultas"
import { calcularMonto, miles, PAQUETES_VISTAS, pesos, PRECIO_30_DIAS, PRECIO_MIL_VISTAS } from "@/lib/publicidad/precios"
import { ESPACIOS, ORDEN_ESPACIOS, nombreCorto } from "@/lib/publicidad/tipos"

const metadataEs: Metadata = {
  title: { absolute: "Publicidad en HETNA CNC: anuncia tu taller o tu marca" },
  description:
    "Pon tu taller, tus productos o tu marca frente a la comunidad CNC de México. Elige el espacio, paga por semana, mes, año o por vistas, y mide tus clics en tu panel.",
  alternates: { canonical: "https://hetnacnc.com/mx/anunciate" },
}

export const revalidate = 3600

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const PREGUNTAS = [
  {
    q: "¿Qué cuenta como una vista?",
    a: "Que tu anuncio se mostró en la pantalla de una persona. Contamos una vez por persona y por visita, y no contamos a los robots de buscadores.",
  },
  {
    q: "¿Qué pasa si compro un paquete de vistas y no se llega a la cifra?",
    a: "Tu anuncio sigue saliendo sin costo hasta cumplir todas las vistas que pagaste. Nunca vence antes.",
  },
  {
    q: "¿Cómo veo cómo va mi anuncio?",
    a: "Al pagar te llega a tu correo la liga de tu panel: ahí ves si ya está activo, sus vistas, sus clics y cuándo termina, y desde ahí lo renuevas.",
  },
  {
    q: "¿Por qué los talleres y proveedores CNC no pueden ligar a su propia página?",
    a: "En HETNA los pedidos, pagos y mensajes entre talleres y clientes se hacen dentro de la plataforma, para que ambos estén protegidos. Por eso su anuncio lleva a su perfil o sus productos en HETNA. Las marcas de otro giro (telefonía, bancos, bebidas…) sí pueden ligar a su página.",
  },
  {
    q: "¿Qué anuncios no se aceptan?",
    a: "Los engañosos, ofensivos, de productos prohibidos o de armas, y los de talleres o proveedores CNC que lleven fuera de HETNA. Si no aprobamos el tuyo, te devolvemos tu dinero completo.",
  },
]

export default async function Anunciate({ searchParams }: Props) {
  const q = await searchParams
  const espacio = Array.isArray(q.espacio) ? q.espacio[0] : q.espacio
  const hayError = q.error === "pago"
  const metricas = await metricasEspacios()

  const espacios: EspacioVenta[] = ORDEN_ESPACIOS.map((id) => ({
    id,
    nombre: ESPACIOS[id].nombre,
    donde: ESPACIOS[id].donde,
    medidas: ESPACIOS[id].medidas.replace(/\s*\(opcional.*\)/, ""),
    anchoMax: ESPACIOS[id].anchoMax,
    ratio: ESPACIOS[id].ratio,
    max: ESPACIOS[id].max,
    precio: PRECIO_30_DIAS[id],
    milVistas: PRECIO_MIL_VISTAS[id],
    vistasMes: metricas[id]?.vistasMes ?? null,
  }))

  const conDatos = Object.values(metricas).filter((m) => m.ctr != null)
  const ctrPromedio = conDatos.length ? Math.round((conDatos.reduce((s, m) => s + (m.ctr || 0), 0) / conDatos.length) * 10) / 10 : null

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-8 lg:py-12 flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B34D07]"><TS>Publicidad en HETNA CNC</TS></p>
          <h1 className="m-0 font-display text-[30px] sm:text-[42px] leading-[1.1] font-bold text-[#1B1B18]">
            <TS>Pon tu taller o tu marca frente a quien compra y fabrica con CNC</TS>
          </h1>
          <p className="m-0 max-w-[760px] text-[16px] leading-relaxed text-[#44433D]">
            <TS>HETNA reúne a talleres, makers y empresas que buscan diseños, servicios de corte y maquinado, máquinas y herramientas. Tu anuncio sale donde
            ellos ya están mirando: el inicio, la tienda, las fichas de producto, el directorio de talleres, el cotizador y el foro.</TS>
          </p>
          <ul className="m-0 grid gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Desde una semana", `Prueba desde ${pesos(Math.min(...ORDEN_ESPACIOS.map((id) => calcularMonto(id, 7))))}`],
              ["Pagas por tiempo o por vistas", "Semana, mes, 3 meses, año o paquetes de vistas"],
              ["Mides todo", "Panel con vistas y clics de tu anuncio"],
              ["Sin contratos", "Pagas con Mercado Pago: tarjeta, OXXO o transferencia"],
            ].map(([t, d]) => (
              <li key={t} className="list-none rounded-[12px] border border-[#E7E4DC] bg-white p-4">
                <p className="m-0 text-[15px] font-bold text-[#1B1B18]">{t}</p>
                <p className="m-0 mt-1 text-[13.5px] text-[#6B6A63]">{d}</p>
              </li>
            ))}
          </ul>
        </header>

        <section aria-labelledby="t-espacios" className="flex flex-col gap-3">
          <h2 id="t-espacios" className="m-0 text-[24px] font-bold text-[#1B1B18]">
            <TS>Espacios y tarifas</TS>
          </h2>
          <p className="m-0 text-[14px] text-[#6B6A63]">
            <TS>Vistas y clics reales de los anuncios que ya corrieron en HETNA; se actualizan cada hora.</TS>
            {ctrPromedio != null && <> <TS>Hoy, en promedio,</TS> {ctrPromedio}<TS>% de quienes ven un anuncio le dan clic.</TS></>}
          </p>
          <div className="overflow-x-auto rounded-[14px] border border-[#E7E4DC] bg-white">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13.5px]">
              <thead className="bg-[#F4F1EA] text-[12px] uppercase tracking-wide text-[#6B6A63]">
                <tr>
                  <th className="px-3 py-2.5"><TS>Espacio</TS></th>
                  <th className="px-3 py-2.5 text-right"><TS>Vistas al mes</TS></th>
                  <th className="px-3 py-2.5 text-right"><TS>Clics</TS></th>
                  <th className="px-3 py-2.5 text-right"><TS>Semana</TS></th>
                  <th className="px-3 py-2.5 text-right"><TS>Mes</TS></th>
                  <th className="px-3 py-2.5 text-right"><TS>3 meses</TS></th>
                  <th className="px-3 py-2.5 text-right"><TS>Año</TS></th>
                  <th className="px-3 py-2.5 text-right"><TS>1,000 vistas</TS></th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {espacios.map((e) => (
                  <tr key={e.id} className="border-t border-[#F0EDE6] align-top">
                    <td className="px-3 py-3">
                      <p className="m-0 font-bold text-[#1B1B18]">{nombreCorto(e.nombre)}</p>
                      <p className="m-0 mt-0.5 max-w-[320px] text-[12.5px] leading-snug text-[#6B6A63]">{e.donde}</p>
                      <p className="m-0 mt-0.5 text-[12px] text-[#9A978F]">{e.medidas}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{e.vistasMes ? miles(e.vistasMes) : <span className="text-[#9A978F]"><TS>nuevo</TS></span>}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {metricas[e.id]?.ctr != null ? `${metricas[e.id].ctr}%` : <span className="text-[#9A978F]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{pesos(calcularMonto(e.id, 7))}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{pesos(calcularMonto(e.id, 30))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pesos(calcularMonto(e.id, 90))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pesos(calcularMonto(e.id, 365))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pesos(e.milVistas)}</td>
                    <td className="px-3 py-3">
                      <a href={`?espacio=${e.id}#comprar`} className="inline-flex min-h-[40px] items-center rounded-[10px] border border-[#C2560A] px-3 text-[13px] font-bold text-[#B34D07] hover:bg-[#FFF6EE]">
                        <TS>Elegir</TS>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[12.5px] text-[#6B6A63]">
            <TS>Semana: para probar (sale más cara por día). 3 meses: 10% menos. Año: 25% menos. Paquetes de vistas:</TS> {PAQUETES_VISTAS.map((v) => miles(v)).join(", ")}.
          </p>
        </section>

        <section aria-labelledby="t-formas" className="grid gap-4 md:grid-cols-2">
          <h2 id="t-formas" className="sr-only">
            <TS>Formas de pagar</TS>
          </h2>
          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
            <p className="m-0 text-[17px] font-bold text-[#1B1B18]"><TS>Por tiempo</TS></p>
            <p className="m-0 mt-1 text-[14px] leading-relaxed text-[#44433D]">
              <TS>Ideal para talleres y proveedores: tu anuncio sale todos los días del periodo. Si en el espacio hay más anuncios que lugares, se turnan
              para que todos salgan.</TS>
            </p>
          </div>
          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
            <p className="m-0 text-[17px] font-bold text-[#1B1B18]"><TS>Por vistas</TS></p>
            <p className="m-0 mt-1 text-[14px] leading-relaxed text-[#44433D]">
              <TS>Ideal para marcas: compras un número de vistas garantizadas y tu anuncio sale hasta cumplirlas. Si tarda más de lo estimado, sigue
              saliendo sin costo.</TS>
            </p>
          </div>
        </section>

        <section aria-labelledby="t-comprar" className="flex flex-col gap-3">
          <h2 id="t-comprar" className="m-0 text-[24px] font-bold text-[#1B1B18]">
            <TS>Contrata tu anuncio</TS>
          </h2>
          {hayError && (
            <p role="alert" className="m-0 bg-[#FFF6E8] border border-[#F2C98F] text-[#5A3A12] rounded-[12px] px-4 py-3 text-[14px]">
              <TS>El pago no se completó. No se te cobró nada. Puedes intentarlo de nuevo.</TS>
            </p>
          )}
          <FormAnunciate espacios={espacios} inicial={espacio} />
          <p className="m-0 text-[13.5px] text-[#6B6A63]">
            <TS>¿Una campaña en varios espacios o por más tiempo?</TS>{" "}
            <LocalizedClientLink href="/contacto" className="font-semibold text-[#B34D07] underline">
              <TS>Escríbenos desde Contacto</TS>
            </LocalizedClientLink>{" "}
            <TS>y te armamos un paquete.</TS>
          </p>
        </section>

        <section aria-labelledby="t-faq" className="flex flex-col gap-2">
          <h2 id="t-faq" className="m-0 text-[24px] font-bold text-[#1B1B18]">
            <TS>Preguntas frecuentes</TS>
          </h2>
          <div className="divide-y divide-[#F0EDE6] rounded-[14px] border border-[#E7E4DC] bg-white px-5">
            {PREGUNTAS.map((p) => (
              <details key={p.q} className="group py-1">
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[#1B1B18]">
                  {p.q}
                  <span className="text-[20px] text-[#C2560A] transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="m-0 pb-3 text-[14.5px] leading-relaxed text-[#44433D]">{p.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
