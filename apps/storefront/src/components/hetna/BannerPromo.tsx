import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// Texto editable del banner. Cambia aquí la promoción cuando quieras.
const PROMO = {
  etiqueta: "Nuevo en HETNA",
  titulo: "Envíos HETNA: cotiza tu envío al instante",
  texto: "Calcula el costo en el checkout, sin salir de la página. Para clientes y talleres de todo México.",
  boton: "Conocer Envíos HETNA",
  href: "/servicios/envios-hetna",
}

const TALLER = {
  etiqueta: "Para talleres",
  titulo: "Publica tu taller y recibe cotizaciones",
  texto: "Perfil con mapa, tus máquinas y materiales, y clientes que te encuentran por ciudad.",
  boton: "Ver directorio de talleres",
  href: "/talleres",
}

const REJILLA =
  "repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 26px),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 26px)"

export default function BannerPromo() {
  return (
    <section aria-label="Promociones" className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className="relative overflow-hidden rounded-2xl bg-[#C2560A] p-6 text-white sm:p-8"
          style={{ backgroundImage: REJILLA }}
        >
          <p className="text-xs font-bold uppercase tracking-[.18em] text-white/80">{PROMO.etiqueta}</p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{PROMO.titulo}</h2>
          <p className="mt-2 max-w-md text-white/90">{PROMO.texto}</p>
          <LocalizedClientLink
            href={PROMO.href}
            className="mt-5 inline-block rounded-xl bg-white px-5 py-2.5 font-bold text-[#142033] transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {PROMO.boton} →
          </LocalizedClientLink>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl bg-[#142033] p-6 text-white sm:p-8"
          style={{ backgroundImage: REJILLA }}
        >
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#F2A25F]">{TALLER.etiqueta}</p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{TALLER.titulo}</h2>
          <p className="mt-2 max-w-md text-white/80">{TALLER.texto}</p>
          <LocalizedClientLink
            href={TALLER.href}
            className="mt-5 inline-block rounded-xl bg-[#C2560A] px-5 py-2.5 font-bold text-white transition hover:-translate-y-0.5 hover:brightness-110"
          >
            {TALLER.boton} →
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}
