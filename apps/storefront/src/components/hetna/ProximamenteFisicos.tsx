// Máquinas, herramientas y materiales mientras todavía no hay catálogo
// (auditoría del 19 nov 2026, punto 2). En vez de una fila con uno o dos
// productos que no representan nada, la portada dice la verdad: "Próximamente",
// con Avísame (se guarda dentro de HETNA), la opción de cotizarlo ya con
// talleres y una invitación a proveedores para publicar. Cuando haya 3 o más
// productos físicos, esto desaparece solo y sale su fila normal.
import { TS } from "@/i18n/TS"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { Avisame } from "@/components/hetna/tienda/Avisame"

const BLOQUES = [
  {
    clave: "maquinas-cnc",
    nombre: "Máquinas CNC",
    texto: "Routers, láser, plasma y fresadoras de talleres y distribuidores de México.",
    cotizar: "Busco una máquina CNC",
  },
  {
    clave: "herramientas-materiales",
    nombre: "Herramientas y materiales",
    texto: "Fresas, boquillas, consumibles y material en hoja para tu taller.",
    cotizar: "Busco herramientas o material",
  },
]

export function ProximamenteFisicos() {
  return (
    <section className="px-4 lg:px-16 py-4" aria-labelledby="titulo-fisicos">
      <div className="mb-3">
        <h2 id="titulo-fisicos" className="font-display m-0 text-[20px] font-bold text-[#142033]">
          <TS>Máquinas, herramientas y materiales</TS>
        </h2>
        <p className="m-0 mt-0.5 text-[13px] text-[#6B6A63]"><TS>Estamos sumando proveedores. Pide que te avisemos o cotízalo hoy con talleres.</TS></p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {BLOQUES.map((b) => (
          <article key={b.clave} className="flex flex-col gap-2 rounded-[14px] border border-[#E7E4DC] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-[16px] font-bold text-[#1B1B18]">{b.nombre}</h3>
              <span className="rounded bg-[#FFF4EC] px-2 py-0.5 text-[11px] font-bold uppercase text-[#A84303] ring-1 ring-[#F3C9A8]"><TS>Próximamente</TS></span>
            </div>
            <p className="m-0 text-[13.5px] leading-snug text-[#6B6A63]"><TS>{b.texto}</TS></p>
            <div className="mt-auto flex flex-col gap-2">
              <Avisame categoria={b.clave} nombre={b.nombre} />
              <LocalizedClientLink
                href={`/cotizar?descripcion=${encodeURIComponent(b.cotizar)}&origen=portada-proximamente`}
                className="text-[13px] font-semibold text-[#B34D07] hover:underline"
              >
                <TS>¿Lo necesitas ya? Cotízalo con talleres →</TS>
              </LocalizedClientLink>
            </div>
          </article>
        ))}
        <article className="flex flex-col justify-between gap-3 rounded-[14px] bg-[#142033] p-4 text-white">
          <div>
            <h3 className="m-0 text-[16px] font-bold"><TS>¿Vendes máquinas, herramientas o material?</TS></h3>
            <p className="m-0 mt-1 text-[13.5px] leading-snug text-white/80">
              <TS>Publica tu catálogo gratis y llega a talleres y makers de todo México. Cobras dentro de HETNA, con pago protegido.</TS>
            </p>
          </div>
          <LocalizedClientLink
            href="/talleres/unete"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[#C2560A] px-4 text-[14px] font-bold text-white hover:bg-[#A84A08]"
          >
            <TS>Vender en HETNA</TS>
          </LocalizedClientLink>
        </article>
      </div>
    </section>
  )
}
