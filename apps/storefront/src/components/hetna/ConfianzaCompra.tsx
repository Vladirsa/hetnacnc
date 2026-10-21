import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA } from "@/lib/hetna/empresa"

// Las razones para pagar tranquilo, en el carrito y en la pasarela.
//
// Cada punto dice algo que HETNA de verdad hace hoy y que está publicado en una
// página del sitio: si no se puede enlazar, no va aquí. Prometer en el carrito
// lo que no se cumple en la entrega es la forma más cara de ganar una venta.
const BLOQUES = [
  {
    titulo: "Entrega y devoluciones",
    puntos: [
      `${EMPRESA.diasDevolucion} días hábiles para devolver un producto físico sin uso.`,
      "Si llegó dañado, incompleto o distinto, el envío de regreso no te cuesta.",
      "Ves el costo y los días de entrega antes de pagar.",
    ],
    href: "/devoluciones",
    liga: "Leer la política",
  },
  {
    titulo: "Pago seguro",
    puntos: [
      "Pagas dentro de HETNA con Mercado Pago.",
      "Los datos de tu tarjeta no pasan por el taller ni se guardan aquí.",
    ],
    href: "/formas-de-pago",
    liga: "Formas de pago",
  },
  {
    titulo: "Tus datos",
    puntos: [
      "Tu dirección se comparte sólo con el taller que te envía.",
      "Puedes pedir que se borren tus datos cuando quieras.",
    ],
    href: "/aviso-de-privacidad",
    liga: "Aviso de privacidad",
  },
]

export const ConfianzaCompra = () => (
  <div className="flex flex-col gap-3">
    {BLOQUES.map((b) => (
      <div key={b.titulo} className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
        <h3 className="text-[14px] font-bold text-[#1B1B18]">{b.titulo}</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {b.puntos.map((p) => (
            <li key={p} className="flex gap-2 text-[13px] leading-relaxed text-[#4A4943]">
              <span className="font-bold text-[#C2560A]">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <LocalizedClientLink
          href={b.href}
          className="mt-2 inline-block text-[13px] font-semibold text-[#B34D07] underline"
        >
          {b.liga}
        </LocalizedClientLink>
      </div>
    ))}
  </div>
)
