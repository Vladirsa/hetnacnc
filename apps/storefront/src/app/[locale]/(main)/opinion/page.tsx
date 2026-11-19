import type { Metadata } from "next"

import { FormOpinion } from "@/components/hetna/opinion/FormOpinion"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { haySesion, leerEncuesta } from "@/lib/opinion/acciones"

// ¿Qué mejorarías? (packages/api/src/lib/opiniones.ts)
//   /opinion             buzón para clientes con sesión (Mi cuenta)
//   /opinion?t=..&p=7    encuesta de los 7 días: llega desde los botones del
//                        correo con la calificación ya elegida; no pide sesión.
export const metadata: Metadata = {
  title: "¿Qué mejorarías? | HETNA CNC",
  robots: { index: false, follow: false },
}

export default async function OpinionPage({ searchParams }: { searchParams: Promise<{ t?: string; p?: string }> }) {
  const { t = "", p } = await searchParams
  const n = Number(p)
  const puntaje = p !== undefined && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null
  const encuesta = t ? await leerEncuesta(t) : null
  const sesion = encuesta ? true : await haySesion()

  return (
    <main className="container pb-16">
      <div className="mx-auto max-w-[640px] py-8 lg:py-12">
        <h1 className="text-[26px] font-bold text-[#1B1B18] lg:text-[32px]">
          {encuesta?.nombre ? `Gracias, ${encuesta.nombre}. ` : ""}¿Qué mejorarías de HETNA CNC?
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">
          Estamos construyendo la plataforma con talleres y clientes como tú. Cuéntanos qué te gusta, qué te falta o qué te gustaría que inventáramos.
          Lo lee directamente el equipo.
        </p>

        <div className="mt-6">
          {t && !encuesta ? (
            <p className="rounded-[12px] bg-[#FFFAEB] p-4 text-[15px] text-[#4A4943]">
              La liga del correo ya venció. Si tienes cuenta,{" "}
              <LocalizedClientLink href="/login" className="font-semibold text-[#C2560A]">
                inicia sesión
              </LocalizedClientLink>{" "}
              y vuelve a esta página, o escríbenos por WhatsApp al 221 707 6014.
            </p>
          ) : sesion ? (
            <FormOpinion token={encuesta ? t : undefined} puntajeInicial={puntaje} quien={encuesta?.quien} />
          ) : (
            <div className="rounded-[12px] border border-[#E7E4DC] bg-white p-6 text-center">
              <p className="text-[15px] text-[#4A4943]">Inicia sesión para enviarnos tu opinión.</p>
              <LocalizedClientLink
                href="/login"
                className="mt-4 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
              >
                Iniciar sesión
              </LocalizedClientLink>
              <p className="mt-4 text-[13px] text-[#6B6A63]">¿Tienes un taller? Déjanos tu opinión desde el tablero de tu panel.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
