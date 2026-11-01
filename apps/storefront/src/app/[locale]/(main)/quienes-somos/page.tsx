import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, ubicacionEmpresa } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  title: "Quiénes somos",
  description:
    "HETNA CNC es un marketplace mexicano de CNC: tienda, diseños, servicios de fabricación y una red de talleres en todo México.",
}

const CADENA = [
  ["¿Solo quieres el diseño?", "Te lo vendemos listo para cortar."],
  ["¿No quieres diseñar?", "Te lo diseñamos."],
  ["¿No tienes máquina?", "Te lo maquilamos con talleres de la red."],
]

export default function QuienesSomos() {
  return (
    <PaginaInfo
      etiqueta="HETNA CNC"
      titulo="Quiénes somos"
      resumen="Un marketplace hecho por y para quienes trabajan con CNC en México."
    >
      <p className="text-lg font-semibold text-[#142033]">
        “No quieres hacer nada, yo te vendo el diseño. No quieres diseñar, yo te lo diseño. Quieres maquilarlo y no tienes
        cómo, yo te lo maquilo.”
      </p>

      <h2>Qué hacemos</h2>
      <p>
        HETNA CNC nace en {ubicacionEmpresa()} para resolver toda la cadena de la fabricación digital en un solo lugar:
        máquinas, herramientas, materiales, diseños listos para cortar y servicios de fabricación con talleres de todo
        México.
      </p>

      <div className="my-5 grid gap-3 sm:grid-cols-3">
        {CADENA.map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-[#F3F1EA] p-4">
            <p className="font-bold text-[#142033]">{t}</p>
            <p className="mt-1 text-sm">{d}</p>
          </div>
        ))}
      </div>

      <h2>Para talleres</h2>
      <p>
        Los talleres de la red ofrecen sus servicios en el <LocalizedClientLink href="/talleres">directorio de talleres</LocalizedClientLink>,
        reciben solicitudes de cotización y venden con Envíos HETNA, sin contratar paqueterías por su cuenta. Además tienen
        herramientas para cotizar desde el celular.
      </p>

      <h2>Comunidad</h2>
      <p>
        Somos parte de la comunidad CNC de México: administramos el grupo de Facebook “Router CNC México” y compartimos
        contenido en <LocalizedClientLink href="/servicios/aprendizaje-cnc">Aprendizaje CNC</LocalizedClientLink>.
      </p>

      <h2>Nuestro compromiso</h2>
      <ul>
        <li>Precios claros en pesos y envío calculado antes de pagar.</li>
        <li>Información clara de cada taller: servicios, máquinas, materiales y tiempos de entrega.</li>
        <li>Pagos y tratos dentro de la plataforma, para que tu compra quede respaldada.</li>
        <li>Atención en español: {EMPRESA.horario}.</li>
      </ul>
    </PaginaInfo>
  )
}
