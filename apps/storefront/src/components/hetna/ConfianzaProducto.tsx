import { EMPRESA } from "@/lib/hetna/empresa"

// Tres razones para comprar tranquilo, justo debajo del precio y las opciones.
// Solo se dice lo que ya es cierto en la plataforma (pago, envío y devoluciones publicados).
export default function ConfianzaProducto() {
  const items = [
    ["Pago protegido", "Pagas dentro de HETNA con Mercado Pago."],
    ["Envíos HETNA", "Ves el costo y los días de entrega antes de pagar."],
    ["Devoluciones", `${EMPRESA.diasDevolucion} días hábiles en productos físicos sin uso.`],
  ]
  return (
    <ul className="my-4 grid gap-2 rounded-lg bg-[#F7F5EF] p-4 text-sm sm:grid-cols-1" data-testid="product-trust">
      {items.map(([t, d]) => (
        <li key={t} className="flex gap-2">
          <span className="font-bold text-[#C2560A]">✓</span>
          <span>
            <strong className="text-[#142033]">{t}.</strong> <span className="text-[#40403A]">{d}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
