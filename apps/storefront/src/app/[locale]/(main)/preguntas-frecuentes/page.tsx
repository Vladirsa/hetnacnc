import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/preguntas-frecuentes" },
  title: "Preguntas frecuentes",
  description:
    "Respuestas sobre compras, envíos, pagos, cotizaciones de maquila CNC y cómo vender tu taller en HETNA CNC.",
}

const PREGUNTAS: { p: string; r: string }[] = [
  {
    p: "¿Qué es HETNA CNC?",
    r: "Un marketplace mexicano especializado en CNC: máquinas, herramientas, materiales, diseños digitales y servicios de fabricación (corte láser, router, plasma, maquinado e impresión 3D) con talleres de todo México.",
  },
  {
    p: "¿Cómo compro un producto?",
    r: "Agrégalo al carrito, escribe tu dirección de entrega y elige Envíos HETNA. Verás el costo del envío antes de pagar.",
  },
  {
    p: "¿Cuánto cuesta el envío y cuánto tarda?",
    r: "Envíos HETNA calcula el costo con tu código postal en el checkout, junto con los días estimados de entrega. El costo depende del peso, medidas y destino.",
  },
  {
    p: "¿Qué formas de pago aceptan?",
    r: "Pagos con Mercado Pago. Para compras grandes o trabajos cotizados también puedes pagar por transferencia SPEI; escríbenos para darte los datos.",
  },
  {
    p: "¿Cómo pido una cotización de maquila o corte?",
    r: "En Cotizar describes tu trabajo (material, cantidad, medidas y fecha) y puedes adjuntar la liga a tus archivos DXF, SVG, STL o STEP. Te enviamos la cotización por correo. Para corte láser y router tienes además un precio estimado al instante.",
  },
  {
    p: "¿Mis datos los ve el taller?",
    r: "No. Tus datos de contacto solo los ve HETNA. El taller recibe la descripción del trabajo y la cotización pasa por la plataforma, así tu compra queda protegida.",
  },
  {
    p: "¿Puedo devolver un producto?",
    r: `Sí, en productos físicos sin uso dentro de ${EMPRESA.diasDevolucion} días hábiles después de recibirlos. Los trabajos fabricados a la medida y los diseños digitales descargados no tienen devolución, salvo defecto. Consulta la política completa de devoluciones.`,
  },
  {
    p: "¿Cómo rastreo mi pedido?",
    r: "Entra a tu cuenta, en Mis pedidos, para ver el estado de cada compra.",
  },
  {
    p: "Tengo un taller, ¿cómo vendo en HETNA?",
    r: "Regístrate como vendedor, completa tu Perfil público (servicios, máquinas, materiales y tiempos de entrega) y publica tus productos. Tu taller aparece en el directorio de talleres por estado.",
  },
  {
    p: "¿Cuál es el horario de atención?",
    r: `${EMPRESA.horario}. Por WhatsApp te respondemos en ese horario.`,
  },
]

export default function PreguntasFrecuentes() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.map((x) => ({
      "@type": "Question",
      name: x.p,
      acceptedAnswer: { "@type": "Answer", text: x.r },
    })),
  }

  return (
    <PaginaInfo
      etiqueta="Ayuda"
      titulo="Preguntas frecuentes"
      resumen="Lo que más nos preguntan sobre compras, envíos, pagos y cotizaciones."
      jsonLd={jsonLd}
    >
      <div className="divide-y divide-[#E7E4DC]">
        {PREGUNTAS.map((x) => (
          <details key={x.p} className="group py-4 first:pt-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[#142033]">
              {x.p}
              <span className="text-[#C2560A] transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-[#40403A]">{x.r}</p>
          </details>
        ))}
      </div>
      <p className="mt-6">
        Más información en <LocalizedClientLink href="/devoluciones">Devoluciones</LocalizedClientLink>,{" "}
        <LocalizedClientLink href="/formas-de-pago">Formas de pago</LocalizedClientLink> y{" "}
        <LocalizedClientLink href="/servicios/envios-hetna">Envíos HETNA</LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}
