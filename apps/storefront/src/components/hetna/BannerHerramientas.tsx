import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { piezasDe } from "@/lib/publicidad/consultas"

import { EnlacePub, ImagenPieza } from "./publicidad/PiezasBase"
import PubVista from "./publicidad/PubVista"
import { ServicioIcono } from "./ServicioIcono"
import { SERVICIOS_PRINCIPALES } from "./servicios-datos"

export default async function BannerHerramientas() {
  const primera = SERVICIOS_PRINCIPALES[0]
  // Si subes una imagen en el panel (espacio "Banner de herramientas"), se usa como fondo.
  // Los textos que dejes vacíos se quedan como siempre.
  const p = (await piezasDe("banner_herramientas"))[0]
  const claseBotonPrincipal =
    "rounded-full bg-[#C2560A] px-6 py-3 text-[14.5px] font-bold text-white hover:bg-[#A84A08]"

  return (
    <section className="px-4 lg:px-16 py-8 md:py-10">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0F1826] via-[#142033] to-[#1E3250] p-6 md:p-10 lg:p-12">
        {p?.imagen_url && (
          <>
            <ImagenPieza p={p} />
            <div aria-hidden="true" className="absolute inset-0 bg-[#0F1826]/70" />
          </>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#C2560A]/30 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-[#F2A65A]/15 blur-3xl" />

        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <span className="inline-block rounded-full bg-[#C2560A] px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-white">
              Herramientas CNC
            </span>
            <h2 className="mt-4 text-[30px] md:text-[42px] font-extrabold leading-[1.08] text-white">
              {p?.titulo || "Del archivo a la pieza, con herramientas hechas para tu taller"}
            </h2>
            <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-[#C9D2E0]">
              {p?.subtitulo || "Genera diseños, simula tu CAM, cotiza, aprende y resuelve dudas con IA especializada en CNC."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {p?.boton ? (
                <EnlacePub id={p.id} publicidad={p.es_publicidad} className={claseBotonPrincipal}>
                  {p.boton}
                </EnlacePub>
              ) : (
                primera && (
                  <LocalizedClientLink href={"/servicios/" + primera.slug} className={claseBotonPrincipal}>
                    Explorar herramientas
                  </LocalizedClientLink>
                )
              )}
              <LocalizedClientLink
                href="/servicios/cotizador-cnc"
                className="rounded-full border border-white/30 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-white/10"
              >
                Cotizar un proyecto
              </LocalizedClientLink>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SERVICIOS_PRINCIPALES.map((s) => (
              <LocalizedClientLink
                key={s.slug}
                href={"/servicios/" + s.slug}
                className="group flex items-start gap-4 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.13] hover:ring-[#F2A65A]/60 sm:last:col-span-2"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C2560A] to-[#F2A65A] text-white shadow-lg">
                  <ServicioIcono nombre={s.icono} size={24} />
                </span>
                <span className="flex flex-col">
                  <span className="text-[16px] font-bold text-white">{s.nombre}</span>
                  <span className="mt-0.5 text-[13px] leading-snug text-[#C9D2E0]">{s.resumen}</span>
                  <span className="mt-2 text-[13px] font-bold text-[#F2A65A] group-hover:underline">Entrar →</span>
                </span>
              </LocalizedClientLink>
            ))}
          </div>
        </div>
        {p && <PubVista ids={[p.id]} />}
      </div>
    </section>
  )
}
