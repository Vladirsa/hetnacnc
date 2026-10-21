import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA } from "@/lib/hetna/empresa"

import { LogosPago } from "./LogosPago"

// Las razones para pagar tranquilo, en el carrito y en la pasarela.
//
// Va en UNA tarjeta compacta y no en tres. El motivo no es de gusto: la columna
// derecha está pegada al scroll, y un bloque pegajoso más alto que la pantalla
// nunca se ve pegado -- se queda quieto hasta que ya lo pasaste. Con tres
// tarjetas la columna medía más de 900 px y por eso el resumen "no se movía".
//
// Cada punto dice algo que HETNA de verdad hace hoy y que está publicado en una
// página del sitio: si no se puede enlazar, no va aquí. Prometer en el carrito
// lo que no se cumple en la entrega es la forma más cara de ganar una venta.
const PUNTOS = [
  {
    texto: `${EMPRESA.diasDevolucion} días para devolver. Si llegó dañado, el regreso no te cuesta.`,
    href: "/devoluciones",
  },
  {
    texto: "Pagas dentro de HETNA. Tu tarjeta no pasa por el taller.",
    href: "/formas-de-pago",
  },
  {
    texto: "Tu dirección se comparte sólo con el taller que te envía.",
    href: "/aviso-de-privacidad",
  },
]

export const ConfianzaCompra = () => (
  <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
    <div className="flex items-center gap-2">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1E7A52"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2l8 3.5v5.9c0 5-3.4 9.3-8 10.6-4.6-1.3-8-5.6-8-10.6V5.5L12 2z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      <h3 className="text-[14px] font-bold text-[#1B1B18]">Tu compra está protegida</h3>
    </div>

    <ul className="mt-2.5 flex flex-col gap-2">
      {PUNTOS.map((p) => (
        <li key={p.href} className="flex gap-2 text-[13px] leading-relaxed text-[#4A4943]">
          <span className="font-bold text-[#1E7A52]">✓</span>
          <span>
            {p.texto}{" "}
            <LocalizedClientLink href={p.href} className="font-semibold text-[#B34D07] underline">
              Ver
            </LocalizedClientLink>
          </span>
        </li>
      ))}
    </ul>

    <div className="mt-3 border-t border-[#EDEAE2] pt-3">
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#6B6A63]">
        Puedes pagar con
      </p>
      <LogosPago />
    </div>
  </div>
)
