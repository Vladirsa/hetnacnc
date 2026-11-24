import type { Metadata } from "next"

import { JsonLd } from "@/components/hetna/JsonLd"
import { SimuladorCnc } from "@/components/hetna/simulador/SimuladorCnc"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { migas } from "@/lib/hetna/schema"

const URL_PAGINA = "https://hetnacnc.com/mx/cam/simulador"

export const metadata: Metadata = {
  alternates: { canonical: URL_PAGINA },
  title: "Simulador CNC gratis en línea: prueba tu G-code en 3D",
  description:
    "Simulador de fresadora y router CNC en el navegador: escribe o sube tu G-code, míralo cortar en 3D y encuentra choques y errores antes de usar tu máquina. Gratis.",
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "HETNA CNC",
    url: URL_PAGINA,
    title: "Simulador CNC gratis en línea | HETNA CNC",
    description: "Escribe o sube tu G-code y míralo cortar en 3D. Detecta choques y errores antes de usar tu máquina.",
  },
}

// Los códigos que entiende el simulador (lib/simulador/gcode.ts)
const CODIGOS: [string, string][] = [
  ["G0", "Movimiento rápido (sin cortar). Nunca dentro del material."],
  ["G1", "Movimiento de corte en línea recta, con el avance F."],
  ["G2 / G3", "Arco en el sentido del reloj (G2) o al revés (G3). Centro con I y J, o radio con R."],
  ["G20 / G21", "Medidas en pulgadas (G20) o en milímetros (G21)."],
  ["G90 / G91", "Coordenadas absolutas (G90) o relativas a donde está la fresa (G91)."],
  ["G28", "Regresar al origen subiendo primero en Z."],
  ["G81 / G83", "Ciclo de taladro: baja al fondo Z desde el plano R y regresa. G80 lo cancela."],
  ["M3 / M5", "Encender (M3) y apagar (M5) el husillo. S es la velocidad en RPM."],
  ["F", "Avance de corte en mm/min (o pulg/min con G20)."],
  ["M30", "Fin del programa."],
]

const PREGUNTAS = [
  {
    p: "¿Qué es un simulador CNC?",
    r: "Un programa que lee el G-code como lo haría la máquina y te enseña en pantalla cómo se movería la herramienta y cómo quedaría la pieza. Sirve para aprender a programar y para revisar un programa antes de correrlo en tu router o fresadora.",
  },
  {
    p: "¿Qué errores detecta?",
    r: "Movimientos rápidos (G0) dentro del material, cortes con el husillo apagado, cortes sin avance F, arcos mal definidos (I, J o R que no cuadran) y cortes más profundos que el material. La máquina virtual se detiene en la línea del error, como una máquina real.",
  },
  {
    p: "¿Sirve para mi router GRBL, Mach3 o mi fresadora Fanuc?",
    r: "Sí para aprender y revisar trayectorias: usa el G-code estándar ISO que comparten GRBL, Mach3, Mach4, LinuxCNC y los controles tipo Fanuc. Los ciclos especiales, macros y la compensación de radio (G41/G42) de cada marca no se simulan.",
  },
  {
    p: "¿Mi programa se sube a internet?",
    r: "No. Todo corre en tu navegador; el archivo no sale de tu computadora.",
  },
]

export default function PaginaSimulador() {
  return (
    <div className="tema-estudio flex-1 px-3 py-4 lg:px-5">
      <JsonLd
        datos={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Simulador CNC de HETNA",
            url: URL_PAGINA,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Navegador web",
            inLanguage: "es-MX",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
            provider: { "@type": "Organization", "@id": "https://hetnacnc.com/#organization", name: "HETNA CNC", url: "https://hetnacnc.com" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: PREGUNTAS.map((f) => ({ "@type": "Question", name: f.p, acceptedAnswer: { "@type": "Answer", text: f.r } })),
          },
          migas([
            { nombre: "Inicio", ruta: "https://hetnacnc.com/mx" },
            { nombre: "Academia", ruta: "https://hetnacnc.com/mx/servicios/aprendizaje-cnc" },
            { nombre: "Simulador CNC" },
          ]),
        ]}
      />
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="m-0 text-[16px] font-bold">
          Simulador <span className="text-[#F28A3C]">CNC</span>{" "}
          <span className="text-[12.5px] font-normal text-[#8A97AB]">fresadora y router de 3 ejes: escribe tu G-code y míralo cortar</span>
        </h1>
        <LocalizedClientLink href="/servicios/aprendizaje-cnc" className="text-[12.5px] font-semibold text-[#F28A3C] hover:underline">
          Cursos de la Academia →
        </LocalizedClientLink>
      </div>

      <SimuladorCnc />

      <section className="mx-auto mt-8 max-w-[1000px] text-[#C9CED6]">
        <h2 className="text-[17px] font-bold text-white">Cómo se usa</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px]">
          <li>Elige un ejercicio o escribe tu programa (también puedes abrir un archivo .nc, .gcode o .tap).</li>
          <li>Pon las medidas de tu material y tu fresa. Z0 es la cara de arriba del material.</li>
          <li>Presiona <b>Ciclo de inicio</b>. Con <b>Bloque a bloque</b> la máquina se detiene en cada línea, como en una máquina real.</li>
          <li>Si hay un error, la máquina se detiene en esa línea y te dice qué corregir.</li>
        </ol>

        <h2 className="mt-6 text-[17px] font-bold text-white">Códigos que entiende</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <tbody>
              {CODIGOS.map(([c, d]) => (
                <tr key={c} className="border-t border-[#2B3648]">
                  <td className="whitespace-nowrap py-1.5 pr-4 font-mono font-bold text-[#F28A3C]">{c}</td>
                  <td className="py-1.5">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-6 text-[17px] font-bold text-white">Preguntas frecuentes</h2>
        {PREGUNTAS.map((f) => (
          <details key={f.p} className="border-t border-[#2B3648] py-2">
            <summary className="cursor-pointer font-semibold text-white">{f.p}</summary>
            <p className="m-0 mt-1 text-[14px]">{f.r}</p>
          </details>
        ))}

        <p className="mt-6 text-[13.5px]">
          ¿Quieres generar el G-code de tu pieza? Usa el <LocalizedClientLink href="/cam/subir" className="font-semibold text-[#F28A3C] hover:underline">CAM 2D</LocalizedClientLink> o
          calcula RPM y avance con la <LocalizedClientLink href="/calculadora-cnc" className="font-semibold text-[#F28A3C] hover:underline">Calculadora CNC</LocalizedClientLink>.
        </p>
      </section>
    </div>
  )
}
