// Portada del inicio (auditoría de mejoras del 14 nov 2026, tarea 3): un solo
// héroe fijo, sin carrusel ni rotación, con una acción principal. En los
// primeros 5 segundos se entiende qué es HETNA CNC, para quién es y qué hacer.
//
// Antes: carrusel de 4 diapositivas donde competían "Explorar", "Cotizar" y
// "Vende con nosotros". "Vende con nosotros" ahora vive en su propia sección,
// más abajo (VenderConNosotros en HetnaHome).
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA } from "@/lib/hetna/empresa"

const PASOS = [
  { n: "1", t: "Describe tu pieza", d: "Medidas, material y tu archivo, si lo tienes" },
  { n: "2", t: "Recibe propuestas", d: "Talleres de México te cotizan" },
  { n: "3", t: "Elige y paga seguro", d: "Dentro de HETNA, con seguimiento" },
]

export default function HeroFijo() {
  return (
    <section
      className="relative overflow-hidden bg-[#142033] text-white"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 85% 20%, rgba(194,86,10,0.35), transparent 55%), radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "auto, 22px 22px",
      }}
      aria-label="Portada de HETNA CNC"
      data-testid="hero-fijo"
    >
      <div className="mx-auto flex max-w-[1280px] items-center gap-10 px-4 pb-10 pt-8 lg:px-16 lg:pb-12 lg:pt-12">
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="font-display m-0 text-[28px] font-bold leading-[1.1] tracking-[-0.01em] md:text-[38px] lg:text-[44px]">
            Fabricación CNC a medida en México
          </h1>
          <p className="m-0 max-w-[560px] text-[15px] leading-[1.55] text-[#C9D2E0] md:text-[17px]">
            Cotiza tu pieza sin registro: corte láser, router, plasma, maquinado e impresión 3D con talleres de todo
            México.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-3">
            <LocalizedClientLink
              href="/cotizar"
              className="rounded-[12px] bg-[#C2560A] px-7 py-4 text-[17px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(217,96,11,0.9)] hover:bg-[#A84A08]"
              data-testid="hero-accion-principal"
            >
              Cotiza tu pieza en 2 minutos
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/categories"
              className="inline-block py-3 text-[15px] font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
            >
              Ver diseños desde $30
            </LocalizedClientLink>
          </div>
          <p className="m-0 text-[13px] text-[#C9D2E0]">
            <a
              href={`https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent("Hola HETNA CNC, quiero cotizar una pieza")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white hover:underline"
            >
              WhatsApp {EMPRESA.whatsappVisible}
            </a>{" "}
            · Fabricación en México · Sin registro para cotizar
          </p>
        </div>
        <ol className="m-0 hidden w-[380px] shrink-0 list-none flex-col gap-3 p-0 lg:flex">
          {PASOS.map((p) => (
            <li key={p.n} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C2560A] text-[16px] font-bold">
                {p.n}
              </span>
              <span>
                <span className="block text-[15px] font-bold">{p.t}</span>
                <span className="block text-[13px] text-[#C9D2E0]">{p.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** "Vende con nosotros" fuera del héroe, en su propia franja. */
export function VenderConNosotros() {
  return (
    <section className="mx-4 my-10 flex flex-col items-start justify-between gap-4 rounded-[20px] border border-[#E7E4DC] bg-white px-6 py-6 lg:mx-16 lg:flex-row lg:items-center lg:px-10">
      <div>
        <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#C2560A]">Para talleres</p>
        <h2 className="font-display m-0 mt-1 text-[22px] font-bold text-[#142033]">¿Tienes un taller CNC? Vende con nosotros</h2>
        <p className="m-0 mt-1 max-w-[620px] text-[14px] text-[#6B675C]">
          Recibe solicitudes de clientes de todo México y cotiza desde tu panel. Los primeros talleres entran como Taller
          Fundador.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <LocalizedClientLink href="/talleres/unete" className="rounded-[10px] bg-[#142033] px-5 py-3 text-[14.5px] font-semibold text-white hover:brightness-110">
          Vende con nosotros
        </LocalizedClientLink>
        <LocalizedClientLink href="/talleres/fundadores" className="rounded-[10px] border border-[#142033] px-5 py-3 text-[14.5px] font-semibold text-[#142033]">
          Taller Fundador
        </LocalizedClientLink>
      </div>
    </section>
  )
}
