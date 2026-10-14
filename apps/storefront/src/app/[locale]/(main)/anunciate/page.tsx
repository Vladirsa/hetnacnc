import type { Metadata } from "next"

import FormAnunciate, { type EspacioVenta } from "@/components/hetna/publicidad/FormAnunciate"
import { PRECIO_30_DIAS } from "@/lib/publicidad/precios"
import { ESPACIOS, ORDEN_ESPACIOS } from "@/lib/publicidad/tipos"

export const metadata: Metadata = {
  title: { absolute: "Anuncia tu taller o tus productos CNC | HETNA CNC" },
  description: "Pon tu taller, tus herramientas o tus servicios frente a miles de personas que trabajan con CNC en México. Elige tu espacio, paga con Mercado Pago y listo.",
  alternates: { canonical: "https://hetnacnc.com/mx/anunciate" },
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function Anunciate({ searchParams }: Props) {
  const q = await searchParams
  const espacio = Array.isArray(q.espacio) ? q.espacio[0] : q.espacio
  const hayError = q.error === "pago"
  const espacios: EspacioVenta[] = ORDEN_ESPACIOS.map((id) => ({
    id,
    nombre: ESPACIOS[id].nombre,
    medidas: ESPACIOS[id].medidas.replace(/\s*\(opcional.*\)/, ""),
    anchoMax: ESPACIOS[id].anchoMax,
    ratio: ESPACIOS[id].ratio,
    max: ESPACIOS[id].max,
    precio: PRECIO_30_DIAS[id],
  }))

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="max-w-[960px] mx-auto px-4 lg:px-8 py-8 lg:py-12 flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="m-0 font-display text-[30px] sm:text-[38px] leading-[1.15] font-bold text-[#1B1B18]">Anuncia tu taller frente a quien compra CNC</h1>
          <p className="m-0 text-[16px] leading-relaxed text-[#44433D]">
            HETNA CNC reúne a talleres, makers y empresas que buscan máquinas, herramientas y servicios de corte, grabado y maquinado.
            Tu anuncio aparece donde ellos ya están mirando: el inicio, las categorías y el foro.
          </p>
          <ul className="m-0 pl-5 text-[15px] text-[#44433D] flex flex-col gap-1">
            <li>Pagas una vez con Mercado Pago (tarjeta, OXXO o transferencia).</li>
            <li>Revisamos tu anuncio en un día y lo activamos.</li>
            <li>Te avisamos antes de que venza para que lo renueves.</li>
          </ul>
        </header>
        {hayError && (
          <p role="alert" className="m-0 bg-[#FFF6E8] border border-[#F2C98F] text-[#5A3A12] rounded-[12px] px-4 py-3 text-[14px]">
            El pago no se completó. No se te cobró nada. Puedes intentarlo de nuevo.
          </p>
        )}
        <FormAnunciate espacios={espacios} inicial={espacio} />
      </div>
    </main>
  )
}
