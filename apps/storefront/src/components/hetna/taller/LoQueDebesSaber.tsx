// "Lo que debes saber antes de unirte" (/talleres/unete). Responde lo que la
// revisión del 27 nov 2026 encontró sin contestar: cuánto cuestan los planes y
// en qué cambian, cuándo se libera el pago, cómo se resuelve un problema entre
// cliente y taller, y cuántas solicitudes llegan por material y por estado.
// Ningún número se escribe a mano: precios y límites salen de lib/hetna/app-taller,
// los plazos de lib/hetna/promesas y lib/hetna/empresa, y los conteos de la base.
import { TS } from "@/i18n/TS"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { FUNCIONES_PLANES, PLANES_APP } from "@/lib/hetna/app-taller"
import { EMPRESA } from "@/lib/hetna/empresa"
import { DIAS_CIERRE_AUTOMATICO, DIAS_HABILES_DECISION_DISPUTA } from "@/lib/hetna/promesas"
import { resumenSolicitudes } from "@/lib/trabajos/datos"

const TARJETA = "min-w-0 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6"
const H3 = "text-lg font-extrabold text-[#142033]"
const LI = "flex gap-2 text-sm leading-relaxed text-[#40403A]"

// Del backend: lib/reclamos-pedido.ts DIAS_HABILES_RESPUESTA
const DIAS_HABILES_RESPUESTA_TALLER = 3

const fila = (nombre: string) => FUNCIONES_PLANES.find((f) => f.nombre === nombre)?.planes
const celda = (v: boolean | string | undefined) => (v === true ? "Sí" : v === false ? "No" : v || "—")

function Barras({ titulo, datos, total }: { titulo: string; datos: { nombre: string; n: number }[]; total: number }) {
  const max = Math.max(...datos.map((d) => d.n), 1)
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A887F]"><TS>{titulo}</TS></p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {datos.slice(0, 6).map((d) => (
          <li key={d.nombre} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
            <span className="truncate text-[#40403A]"><TS>{d.nombre}</TS></span>
            <span className="font-mono text-[12.5px] text-[#6B675C]">
              {d.n} · {Math.round((d.n / total) * 100)}%
            </span>
            <span className="col-span-2 h-1.5 rounded-full bg-[#F1EEE7]">
              <span className="block h-1.5 rounded-full bg-[#C2560A]" style={{ width: `${Math.max(4, (d.n / max) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export async function LoQueDebesSaber() {
  const resumen = await resumenSolicitudes()
  const propuestas = fila("Propuestas a solicitudes de clientes")
  const cotizaciones = fila("Cotizaciones")

  return (
    <section className="mt-12" id="lo-que-debes-saber">
      <h2 className="text-2xl font-extrabold text-[#142033] sm:text-3xl"><TS>Lo que debes saber antes de unirte</TS></h2>
      <p className="mt-2 max-w-[760px] text-[15px] text-[#6B675C]">
        <TS>Planes, pagos, problemas y cuánto trabajo llega: todo claro desde el principio.</TS>
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Planes y precios */}
        <div className={TARJETA}>
          <h3 className={H3}><TS>Planes y precios</TS></h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wider text-[#8A887F]">
                  <th className="py-2 pr-2 font-bold"><TS>Plan</TS></th>
                  <th className="py-2 pr-2 font-bold"><TS>Precio</TS></th>
                  <th className="py-2 pr-2 font-bold"><TS>Propuestas a solicitudes</TS></th>
                  <th className="py-2 font-bold"><TS>Cotizaciones</TS></th>
                </tr>
              </thead>
              <tbody>
                {PLANES_APP.map((p, i) => (
                  <tr key={p.clave} className="border-t border-[#F1EEE7] align-top">
                    <td className="py-2 pr-2 font-bold text-[#142033]"><TS>{p.nombre}</TS></td>
                    <td className="py-2 pr-2 whitespace-nowrap text-[#40403A]">
                      {p.precio} <span className="text-[12px] text-[#8A887F]"><TS>{p.nota}</TS></span>
                    </td>
                    <td className="py-2 pr-2 text-[#40403A]"><TS>{celda(propuestas?.[i])}</TS></td>
                    <td className="py-2 text-[#40403A]"><TS>{celda(cotizaciones?.[i])}</TS></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-[#6B675C]">
            <TS>Precios en pesos mexicanos. Registrarte y recibir solicitudes es gratis; los planes pagados agregan herramientas para tu taller y más propuestas al mes.</TS>
          </p>
          <LocalizedClientLink href="/cotizador#planes" className="mt-2 inline-block text-sm font-semibold text-[#B34D07] hover:underline">
            <TS>Ver todo lo que incluye cada plan →</TS>
          </LocalizedClientLink>
        </div>

        {/* Cuándo te pagan */}
        <div className={TARJETA}>
          <h3 className={H3}><TS>Cuándo te pagan</TS></h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            <li className={LI}>
              <span aria-hidden="true">💳</span>
              <span><TS>Solicitudes de fabricación con tu Mercado Pago o PayPal conectado: el cliente te paga directo, al momento de pagar.</TS></span>
            </li>
            <li className={LI}>
              <span aria-hidden="true">🛡️</span>
              <span>
                <TS>{`Si cobra HETNA: te transferimos cuando el cliente confirma que recibió, o solo ${DIAS_CIERRE_AUTOMATICO} días después de la entrega si no dice nada.`}</TS>
              </span>
            </li>
            <li className={LI}>
              <span aria-hidden="true">📦</span>
              <span>
                <TS>{`Ventas de tu tienda: el cliente libera el pago al recibir; si no hace nada, se libera solo ${EMPRESA.diasLiberacion} días después de la entrega.`}</TS>
              </span>
            </li>
            <li className={LI}>
              <span aria-hidden="true">％</span>
              <span><TS>En las solicitudes de fabricación HETNA no cobra comisión: sólo se descuenta la comisión de cobro de Mercado Pago o PayPal.</TS></span>
            </li>
          </ul>
          <LocalizedClientLink href="/terminos-vendedores" className="mt-3 inline-block text-sm font-semibold text-[#B34D07] hover:underline">
            <TS>Ver la lista de precios completa →</TS>
          </LocalizedClientLink>
        </div>

        {/* Si hay un problema */}
        <div className={TARJETA}>
          <h3 className={H3}><TS>Si hay un problema con un pedido</TS></h3>
          <ol className="mt-3 flex flex-col gap-2.5">
            <li className={LI}>
              <span className="font-bold text-[#C2560A]">1</span>
              <span><TS>El cliente lo reporta en su pedido, con su motivo y su evidencia (fotos o video). Mientras está abierto, el pago no se libera.</TS></span>
            </li>
            <li className={LI}>
              <span className="font-bold text-[#C2560A]">2</span>
              <span>
                <TS>{`Tú respondes con tu evidencia en ${DIAS_HABILES_RESPUESTA_TALLER} días hábiles. Si no respondes, el caso se resuelve a favor del cliente.`}</TS>
              </span>
            </li>
            <li className={LI}>
              <span className="font-bold text-[#C2560A]">3</span>
              <span>
                <TS>{`HETNA revisa lo de los dos y decide en un máximo de ${DIAS_HABILES_DECISION_DISPUTA} días hábiles: liberarte el pago, o un reembolso parcial o total.`}</TS>
              </span>
            </li>
            <li className={LI}>
              <span className="font-bold text-[#C2560A]">4</span>
              <span><TS>Si la falla fue del taller, la guía de regreso la paga el taller; si el cliente se arrepintió, la paga el cliente.</TS></span>
            </li>
          </ol>
        </div>

        {/* Solicitudes por material y estado */}
        <div className={TARJETA}>
          <h3 className={H3}><TS>Solicitudes que han llegado a HETNA</TS></h3>
          {resumen && resumen.total > 0 ? (
            <>
              <p className="mt-1 text-sm text-[#6B675C]">
                <TS>Total desde el inicio:</TS> <strong className="text-[#142033]">{resumen.total}</strong>
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Barras titulo="Por material" datos={resumen.por_material} total={resumen.total} />
                <Barras titulo="Por estado" datos={resumen.por_estado} total={resumen.total} />
              </div>
              <p className="mt-4 text-[12.5px] text-[#8A887F]">
                <TS>Datos reales de la plataforma, sin las solicitudes descartadas en la revisión. Se actualizan solos.</TS>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#6B675C]">
              <TS>Estamos juntando los primeros datos. Mientras tanto, mira los trabajos que están esperando precio más abajo.</TS>
            </p>
          )}
        </div>
      </div>

      {/* Dentro de HETNA, protegido */}
      <div className="mt-4 flex gap-3 rounded-2xl border border-[#B9DFC6] bg-[#F3FAF5] p-5 text-sm leading-relaxed text-[#1F4A2C]">
        <span aria-hidden="true" className="text-xl">🔒</span>
        <p className="m-0">
          <strong><TS>Todo dentro de HETNA, todo protegido.</TS></strong>{" "}
          <TS>Si el cliente paga dentro de HETNA, el pago queda registrado y protegido: cuando cobra HETNA, el dinero se queda guardado hasta que el cliente confirma que recibió, y si hay un problema HETNA lo revisa y decide antes de soltarlo. Las reseñas y la calificación de tu taller sólo cuentan con trabajos pagados dentro. Si cliente y taller hacen el trato por fuera, HETNA no puede ayudar ni responder por esa transacción.</TS>
        </p>
      </div>
    </section>
  )
}
