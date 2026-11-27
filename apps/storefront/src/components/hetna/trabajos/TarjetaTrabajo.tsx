import { T } from "@/components/hetna/i18n/Idioma"
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
        <span className="font-bold text-[#6B675C]">
          {t.folio}
          {t.tipo === "suministro" && <span className="ml-1.5 rounded-full bg-[#EEF6F0] px-2 py-0.5 text-[#1E7B3A]"><T>Suministro</T></span>}
        </span>
        {t.estado === "abierta" ? (
          <span className="rounded-full bg-[#EEF6EE] px-2 py-0.5 font-bold text-[#1F5A2B]">
            <T>{dias === 0 ? "Cierra hoy" : dias === 1 ? "Cierra mañana" : `${dias} días para cotizar`}</T>
          </span>
        ) : (
          <span className="rounded-full bg-[#F3F1EA] px-2 py-0.5 font-bold text-[#6B675C]">
            <T>{t.estado === "asignada" ? "Ya tiene taller" : "Cerrado"}</T>
          </span>
        )}
      </div>
      <h3 className="font-extrabold leading-snug text-[#142033]">{tituloTrabajo(t)}</h3>
      <p className="line-clamp-3 text-sm text-[#44433D]"><T>{t.descripcion || "🔒 Descripción reservada para talleres autorizados."}</T></p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-[#6B675C]">
        {t.cantidad && <span>📦 <T>{/^\d+$/.test(t.cantidad) ? `${t.cantidad} pzas` : t.cantidad}</T></span>}
        {lugar && <span>📍 {lugar}</span>}
        <span>💬 <T>{t.propuestas === 1 ? "1 propuesta" : `${t.propuestas} propuestas`}</T></span>
      </div>
    </LocalizedClientLink>
  )
}
