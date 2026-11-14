import { EMPRESA } from "@/lib/hetna/empresa"
import type { TipoFicha } from "@/lib/hetna/tipo-ficha"

// Tres razones para comprar tranquilo, justo debajo del precio y las opciones.
// Solo se dice lo que ya es cierto en la plataforma (pago, envío y devoluciones publicados).
// Cada tipo de producto dice lo suyo (auditoría de mejoras, tarea 2): un
// archivo o un servicio no tienen envío.
export default function ConfianzaProducto({ tipo = "fisico" }: { tipo?: TipoFicha }) {
  const pago = ["Pago protegido", "Pagas dentro de HETNA con Mercado Pago."]
  const items =
    tipo === "digital"
      ? [pago, ["Descarga inmediata", "El archivo queda en Mi cuenta › Mis descargas."], ["Archivo garantizado", "Si está dañado o no corresponde, te lo cambiamos o te devolvemos tu dinero."]]
      : tipo === "servicio"
        ? [pago, ["Entrega en línea", "Recibes tus archivos en tu cuenta; nada va por paquetería."], ["Dudas antes de pagar", "Pregúntale al taller por el chat de HETNA."]]
        : [
            pago,
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
