import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { diasRestantes, lugarTrabajo, tituloTrabajo, type TrabajoPublico } from "@/lib/trabajos/datos"

// Un trabajo del tablero. Dice lo que un taller necesita para decidir si le
// interesa cotizar -- qué, cuánto, dónde, para cuándo -- y cuánta competencia
// lleva. Nada del cliente.
export function TarjetaTrabajo({ trabajo: t }: { trabajo: TrabajoPublico }) {
  const dias = diasRestantes(t)
  const lugar = lugarTrabajo(t)
  return (
    <LocalizedClientLink
      href={`/trabajos/${t.folio}`}
      className="flex h-full flex-col gap-2 rounded-2xl border border-[#E7E4DC] bg-white p-4 transition hover:border-[#C2560A] hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-[#6B675C]">{t.folio}</span>
        {t.estado === "abierta" ? (
          <span className="rounded-full bg-[#EEF6EE] px-2 py-0.5 font-bold text-[#1F5A2B]">
            {dias === 0 ? "Cierra hoy" : dias === 1 ? "Cierra mañana" : `${dias} días para cotizar`}
          </span>
        ) : (
          <span className="rounded-full bg-[#F3F1EA] px-2 py-0.5 font-bold text-[#6B675C]">
            {t.estado === "asignada" ? "Ya tiene taller" : "Cerrado"}
          </span>
        )}
      </div>
      <h3 className="font-extrabold leading-snug text-[#142033]">{tituloTrabajo(t)}</h3>
      <p className="line-clamp-3 text-sm text-[#44433D]">{t.descripcion}</p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-[#6B675C]">
        {t.cantidad && <span>📦 {/^\d+$/.test(t.cantidad) ? `${t.cantidad} pzas` : t.cantidad}</span>}
        {lugar && <span>📍 {lugar}</span>}
        <span>💬 {t.propuestas === 1 ? "1 propuesta" : `${t.propuestas} propuestas`}</span>
      </div>
    </LocalizedClientLink>
  )
}
