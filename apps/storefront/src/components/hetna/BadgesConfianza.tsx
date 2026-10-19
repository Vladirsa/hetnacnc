import { BadgeCheck, Headset, ShieldCheck, Truck } from "lucide-react"

const BADGES = [
  { icono: ShieldCheck, titulo: "Pago seguro", texto: "Mercado Pago y PayPal" },
  { icono: Truck, titulo: "Envíos HETNA", texto: "Guías y rastreo de tu pedido" },
  { icono: BadgeCheck, titulo: "Talleres verificados", texto: "Garantía del taller y ranking" },
  { icono: Headset, titulo: "Soporte en horario", texto: "Lun a Vie, 9:00 a 18:00 h" },
]

export default function BadgesConfianza() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-3 border-t border-[#E7E4DC] pt-8 sm:grid-cols-2 lg:grid-cols-4">
      {BADGES.map((b) => {
        const Icono = b.icono
        return (
          <div
            key={b.titulo}
            className="flex items-center gap-3.5 rounded-2xl border border-[#E7E4DC] bg-white p-4"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#142033] text-[#F2A65A]">
              <Icono size={24} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold leading-tight text-[#142033]">{b.titulo}</span>
              <span className="mt-0.5 text-[13px] leading-snug text-[#6B6A63]">{b.texto}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
