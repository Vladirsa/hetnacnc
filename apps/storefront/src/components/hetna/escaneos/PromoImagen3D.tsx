// Publicidad y SEO de "Imagen a 3D": vitrina con ejemplos REALES (la foto y el
// modelo que generó la IA, hechos con la cuenta de HETNA; ver
// GET /store/hetna-muestras-3d), para qué sirve, cómo funciona y preguntas.
// Va debajo del estudio y en la portada para quien no ha entrado.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

type Muestra = { id: string; titulo: string; foto: string; modelo: string }

async function muestras(): Promise<Muestra[]> {
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-muestras-3d`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 900 },
    })
    if (!r.ok) return []
    return ((await r.json()) as { muestras?: Muestra[] }).muestras || []
  } catch {
    return []
  }
}

const USOS = [
  ["Figuras para imprimir", "Una mascota, un personaje o un trofeo: de la foto a una figura lista para tu impresora 3D."],
  ["Productos para tu tienda", "Muestra tus piezas en 3D en tu tienda o en redes, con color y textura, sin estudio de fotografía."],
  ["Prototipos rápidos", "Ten una base 3D de una idea o de un boceto para ajustarla en tu CAD."],
  ["Regalos personalizados", "Bustos, adornos y recuerdos a partir de una foto del cliente."],
  ["Relieves para router", "Usa el modelo como base para tallar en madera con tu router CNC."],
  ["Maquetas y exhibición", "Piezas para aparadores, maquetas y presentaciones con clientes."],
]

const PASOS = [
  ["Sube una foto", "La pieza completa, con buena luz y fondo liso. Puedes agregar vistas de los lados."],
  ["La IA crea el modelo", "En 3 a 5 minutos tienes el modelo 3D con textura y color."],
  ["Descárgalo o fabrícalo", "GLB con color, STL para imprimir o maquinar, o mándalo a un taller de HETNA."],
]

export const FAQ_IMAGEN_3D = [
  {
    p: "¿Cómo convierto una imagen en un modelo 3D?",
    r: "Sube una foto en Imagen a 3D de HETNA. La inteligencia artificial reconstruye la forma y la textura en 3 a 5 minutos, y descargas el modelo en GLB (con color) y en STL para impresión 3D o router CNC.",
  },
  {
    p: "¿Es gratis?",
    r: "Sí, el primer modelo de cada mes es gratis. Después cada modelo cuesta créditos HETNA, que compras en paquetes desde tu cuenta.",
  },
  {
    p: "¿Qué foto da mejores resultados?",
    r: "Una sola pieza completa, centrada, con fondo liso de otro color y buena luz, mejor de tres cuartos que de frente. Con vistas extra (lados y atrás) la IA reconstruye mejor lo que no se ve.",
  },
  {
    p: "¿El modelo tiene medidas reales?",
    r: "No: la IA reconstruye la forma a partir de la foto, no la mide. El STL sale a 100 mm por su lado más largo y lo escalas en tu programa a la medida que necesites.",
  },
  {
    p: "¿Puedo imprimirlo en 3D o maquinarlo?",
    r: "Sí. Descarga el STL para tu laminador (Cura, PrusaSlicer, Bambu Studio) o para tu CAM. Si no tienes máquina, un taller de HETNA te lo imprime o te lo maquina.",
  },
]

export async function PromoImagen3D() {
  const lista = await muestras()

  return (
    <div className="bg-[#0D1015] text-white">
      {/* Vitrina */}
      <section className="px-4 py-12 lg:px-10">
        <div className="mx-auto max-w-[1240px]">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#F59A4A]">Imagen a 3D con IA</span>
          <h2 className="m-0 mt-2 text-[28px] font-extrabold leading-tight lg:text-[38px]">De una foto a un modelo 3D en minutos</h2>
          <p className="m-0 mt-2 max-w-[720px] text-[15.5px] leading-relaxed text-white/65">
            Sube la foto de una figura, una pieza o un producto y la IA crea el modelo con textura. Descárgalo para imprimir, maquinar o
            mostrarlo en tu tienda.
          </p>

          {lista.length > 0 ? (
            <ul className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((m) => (
                <li key={m.id} className="overflow-hidden rounded-[18px] border border-white/10 bg-[#141922]">
                  <div className="grid grid-cols-2">
                    <figure className="relative m-0 aspect-square bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.foto} alt={`Foto original: ${m.titulo}`} loading="lazy" className="h-full w-full object-contain" />
                      <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold">Foto</figcaption>
                    </figure>
                    <figure
                      className="relative m-0 aspect-square"
                      style={{ background: "radial-gradient(circle at 50% 45%, rgba(240,122,26,0.28), #0F151E 70%)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.modelo} alt={`Modelo 3D generado: ${m.titulo}`} loading="lazy" className="h-full w-full object-contain" />
                      <figcaption className="absolute left-2 top-2 rounded-full bg-[#F07A1A] px-2 py-0.5 text-[11px] font-semibold">Modelo 3D</figcaption>
                    </figure>
                  </div>
                  <p className="m-0 truncate px-4 py-3 text-[14px] font-semibold text-white/85">{m.titulo}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 grid items-center gap-4 rounded-[18px] border border-white/10 bg-[#141922] p-6 sm:grid-cols-[1fr_auto_1fr]">
              <div className="grid aspect-[4/3] place-items-center rounded-[12px] bg-white/[0.04] text-center text-[14px] text-white/60">
                <span>
                  <svg viewBox="0 0 24 24" className="mx-auto mb-2 h-10 w-10 text-white/40" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <path d="M21 16l-5-5-8 8" />
                  </svg>
                  Tu foto
                </span>
              </div>
              <span className="text-center text-[28px] text-[#F07A1A]">→</span>
              <div
                className="grid aspect-[4/3] place-items-center rounded-[12px] text-center text-[14px] text-white/70"
                style={{ background: "radial-gradient(circle at 50% 45%, rgba(240,122,26,0.25), transparent 70%)" }}
              >
                <span>
                  <svg viewBox="0 0 64 64" className="mx-auto mb-2 h-12 w-12 text-[#F07A1A]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M32 6 56 19v26L32 58 8 45V19L32 6Z" />
                    <path d="M8 19l24 13 24-13M32 32v26" />
                  </svg>
                  Tu modelo 3D con textura
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Usos */}
      <section className="border-t border-white/10 px-4 py-12 lg:px-10">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="m-0 text-[24px] font-extrabold lg:text-[30px]">¿Para qué sirve?</h2>
          <ul className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {USOS.map(([t, d]) => (
              <li key={t} className="rounded-[14px] border border-white/10 bg-white/[0.03] p-5">
                <p className="m-0 text-[16px] font-bold">{t}</p>
                <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-white/60">{d}</p>
              </li>
            ))}
          </ul>

          <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-3">
            {PASOS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F07A1A] text-[15px] font-extrabold">{i + 1}</span>
                <span>
                  <span className="block text-[16px] font-bold">{t}</span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-white/60">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Preguntas */}
      <section className="border-t border-white/10 px-4 py-12 lg:px-10">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="m-0 text-[24px] font-extrabold">Preguntas frecuentes</h2>
            <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-white/60">
              Convierte imágenes a 3D gratis, en español y desde tu navegador. Descarga STL y GLB.
            </p>
          </div>
          <div className="divide-y divide-white/10 rounded-[14px] border border-white/10">
            {FAQ_IMAGEN_3D.map((f) => (
              <details key={f.p} className="group px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold">
                  {f.p}
                  <span className="text-[18px] text-[#F07A1A] transition group-open:rotate-45">+</span>
                </summary>
                <p className="m-0 mt-2 text-[14px] leading-relaxed text-white/65">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_IMAGEN_3D.map((f) => ({ "@type": "Question", name: f.p, acceptedAnswer: { "@type": "Answer", text: f.r } })),
          }),
        }}
      />
    </div>
  )
}
