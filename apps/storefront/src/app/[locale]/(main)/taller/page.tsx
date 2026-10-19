import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { cargarPerfil, listarCotizaciones } from "@/lib/cotizador/acciones"
import {
  dinero,
  ESTATUS_CLASE,
  ESTATUS_ETIQUETA,
  fechaCorta,
  frasePlan,
  PLAN_ETIQUETA,
} from "@/lib/cotizador/formato"

export const metadata: Metadata = {
  title: "Panel del taller — HETNA CNC",
  description: "Tus cotizaciones, tu plan y los costos de tu taller en un solo lugar.",
}

export default async function TallerPanel() {
  // Las dos llamadas son independientes: se piden juntas para no sumar dos
  // viajes al backend en serie.
  const [resPerfil, resCotizaciones] = await Promise.all([cargarPerfil(), listarCotizaciones({ limite: 5 })])

  if (!resPerfil.ok) {
    return <Aviso titulo="No se pudo cargar tu taller" detalle={resPerfil.mensaje} />
  }

  const { perfil, plan } = resPerfil.datos

  // Sin perfil no hay nada que mostrar todavía: el taller aún no se dio de
  // alta. Es la única pantalla que ve hasta que lo haga.
  if (!perfil) {
    return (
      <section className="pt-10 max-w-[720px]">
        <h1 className="text-[28px] lg:text-[34px] font-bold text-[#1B1B18] leading-tight">
          Da de alta tu taller
        </h1>
        <p className="mt-3 text-[15px] text-[#4A4943] leading-relaxed">
          Captura el nombre de tu taller y tus costos por hora. Con eso las cotizaciones
          salen con tus números y tu nombre, no con precios de referencia.
        </p>
        <p className="mt-2 text-[14px] text-[#6B6A63]">
          Al darte de alta empiezan 14 días de prueba sin límite de cotizaciones.
        </p>
        <LocalizedClientLink
          href="/taller/perfil"
          className="mt-6 inline-flex bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
        >
          Capturar los datos de mi taller
        </LocalizedClientLink>
      </section>
    )
  }

  const cotizaciones = resCotizaciones.ok ? resCotizaciones.datos.cotizaciones : []
  const moneda = perfil.moneda || "MXN"

  return (
    <section className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">
            {perfil.nombre_comercial}
          </h1>
          {plan && (
            <p className="mt-1.5 text-[14px] text-[#6B6A63]">
              Plan <span className="font-semibold text-[#1B1B18]">{PLAN_ETIQUETA[plan.plan]}</span>
              {" · "}
              {frasePlan(plan)}
            </p>
          )}
        </div>
        <LocalizedClientLink
          href="/taller/cotizaciones/nueva"
          className="inline-flex bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
        >
          Nueva cotización
        </LocalizedClientLink>
      </div>

      {!tieneCostosPropios(perfil) && (
        <div className="mt-6 rounded-[12px] border border-[#E2D3B8] bg-[#FBF5E9] px-4 py-3.5 text-[14px] text-[#6B5A2E]">
          Todavía no capturas tus costos por hora, así que los precios se calculan con
          valores de referencia.{" "}
          <LocalizedClientLink href="/taller/perfil" className="font-semibold underline">
            Captura los tuyos
          </LocalizedClientLink>{" "}
          para que el margen sea real.
        </div>
      )}

      <h2 className="mt-10 text-[18px] font-bold text-[#1B1B18]">Últimas cotizaciones</h2>

      {cotizaciones.length === 0 ? (
        <p className="mt-3 text-[15px] text-[#6B6A63]">
          Aún no has emitido ninguna.{" "}
          <LocalizedClientLink href="/taller/cotizaciones/nueva" className="font-semibold text-[#B34D07] underline">
            Arma la primera
          </LocalizedClientLink>
          .
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {cotizaciones.map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/taller/cotizaciones/${c.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3.5 hover:border-[#C2560A] transition-colors"
              >
                <span className="font-mono text-[13px] text-[#6B6A63] w-[120px]">
                  {c.folio} Rev {c.revision}
                </span>
                <span className="flex-1 min-w-[160px] text-[15px] font-semibold text-[#1B1B18]">
                  {c.cliente_nombre}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${ESTATUS_CLASE[c.estatus]}`}>
                  {ESTATUS_ETIQUETA[c.estatus]}
                </span>
                <span className="text-[13px] text-[#6B6A63] w-[100px]">{fechaCorta(c.fecha)}</span>
                <span className="text-[15px] font-bold text-[#1B1B18] tabular-nums">
                  {dinero(c.total, c.moneda || moneda)}
                </span>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      )}

      {cotizaciones.length > 0 && (
        <LocalizedClientLink
          href="/taller/cotizaciones"
          className="mt-5 inline-flex text-[14px] font-semibold text-[#B34D07] hover:underline"
        >
          Ver todas →
        </LocalizedClientLink>
      )}
    </section>
  )
}

// Un 0 en los costos significa "sin capturar", no "cuesta cero" -- es la misma
// regla que aplica el motor en el backend (costosDeTaller).
function tieneCostosPropios(perfil: { costo_hora_maquina: number; costo_hora_operador: number; costo_hora_taller: number }) {
  return Boolean(
    Number(perfil.costo_hora_maquina) || Number(perfil.costo_hora_operador) || Number(perfil.costo_hora_taller)
  )
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <section className="pt-10 max-w-[620px]">
      <h1 className="text-[24px] font-bold text-[#1B1B18]">{titulo}</h1>
      <p className="mt-2 text-[15px] text-[#4A4943]">{detalle}</p>
    </section>
  )
}
