import type { Metadata } from "next"

import { GeneradorGcode } from "@/components/hetna/cam/GeneradorGcode"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/cam/subir" },
  title: "De tu archivo a G-code en un minuto | Laboratorio CAM",
  description:
    "Sube tu DXF, elige material y fresa, y descarga el G-code listo para tu router. Gratis y sin cuenta.",
}

// Sin guardia de sesión a propósito: este es el flujo que alguien prueba antes
// de confiar en la plataforma. Pedirle cuenta primero es la forma más barata
// de perderlo.
export default function LaboratorioCamPage() {
  return (
    <main className="w-full bg-[#FAF9F6] min-h-[70vh]">
      <div className="px-4 lg:px-16 pt-6 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">
          Inicio
        </LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/herramientas-cnc" className="hover:text-[#B34D07]">
          Herramientas CNC
        </LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/herramientas-cnc#laboratorio-cam" className="hover:text-[#B34D07]">
          Laboratorio CAM
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Subir archivo</span>
      </div>

      <section className="px-4 lg:px-16 pt-6 pb-16">
        <h1 className="text-[30px] lg:text-[40px] font-bold text-[#1B1B18] leading-[1.1] max-w-[760px]">
          De tu archivo a G-code en un minuto
        </h1>
        <p className="mt-3 text-[16px] text-[#4A4943] leading-relaxed max-w-[620px]">
          Sube tu DXF, dinos en qué lo vas a cortar y con qué fresa. Nosotros calculamos
          las pasadas, el avance y las revoluciones, y te damos el programa listo para tu
          máquina.
        </p>
        <p className="mt-2 text-[14px] text-[#6B6A63]">
          Gratis y sin crear cuenta. No guardamos tu archivo.
        </p>

        <GeneradorGcode />

        <div className="mt-14 max-w-[760px] border-t border-[#E7E4DC] pt-8">
          <h2 className="text-[20px] font-bold text-[#1B1B18]">Qué hace y qué no</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 text-[14px] leading-relaxed">
            <div>
              <p className="font-semibold text-[#1B1B18]">Lo que hace</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[#4A4943]">
                <li>Corte de contorno en 2.5D, por fuera de la pieza y por dentro de los barrenos</li>
                <li>Compensa el radio de tu fresa para que la pieza salga de su medida</li>
                <li>Reparte las pasadas según el espesor y lo que aguanta el material</li>
                <li>Pone pestañas para que la pieza no se suelte en la última pasada</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[#1B1B18]">Lo que todavía no</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[#4A4943]">
                <li>Cajeado: vaciar un área completa, no sólo cortar su contorno</li>
                <li>Archivos SVG (por ahora sólo DXF)</li>
                <li>Láser: la potencia y las pasadas funcionan distinto</li>
                <li>3, 4 y 5 ejes: para eso está el CAM 3D del laboratorio</li>
              </ul>
            </div>
          </div>
          <p className="mt-6 text-[14px] text-[#6B6A63] leading-relaxed">
            ¿Tu pieza necesita algo de la segunda columna?{" "}
            <LocalizedClientLink href="/fabricacion" className="font-semibold text-[#B34D07] underline">
              Lo hacemos nosotros
            </LocalizedClientLink>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
