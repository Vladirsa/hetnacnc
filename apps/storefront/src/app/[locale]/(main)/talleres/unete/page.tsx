import type { Metadata } from "next"

import FormRegistroTaller from "@/components/hetna/taller/FormRegistroTaller"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ligaWhatsApp } from "@/lib/hetna/empresa"
import { listarTalleres } from "@/lib/hetna/talleres"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Únete a la red de talleres CNC HETNA y recibe proyectos",
  description:
    "Registra tu taller CNC gratis y recibe solicitudes de fabricación, corte, maquila y producción de clientes de todo México. Cotiza lo que te conviene y cobra dentro de HETNA.",
}

// La página para los TALLERES (la de /talleres es el directorio para los
// clientes). Responde en orden lo que un dueño de taller pregunta: qué gano,
// cómo funciona, si es para mí, cuánto cuesta, cómo me pagan, y termina en el
// registro. Los números (talleres, trabajos esperando precio, lugares de
// fundador) salen de la base: no se inventa ninguno.

const CUPO_FUNDADORES = 30

const COMO_GANAS = [
  ["Proyectos de fabricación", "Clientes que ya decidieron fabricar y buscan quién lo haga: piezas, letreros, muebles, refacciones."],
  ["Cotizaciones", "Te llegan solicitudes con material, medidas, cantidad, fecha y archivo. Cotizas sólo las que te interesan."],
  ["Producción por volumen", "Lotes y pedidos recurrentes de empresas que buscan un proveedor fijo."],
  ["Visibilidad", "Tu perfil en el directorio de talleres de México, por servicio, material y estado."],
  ["Contacto con clientes", "Clientes de tu zona y de todo el país que no te encontrarían por tu cuenta."],
  ["Venta de servicios y productos", "Publica tus servicios y vende productos en tu propia tienda dentro de HETNA."],
]

const BENEFICIOS = [
  ["Solicitudes calificadas", "Cada solicitud llega con lo necesario para cotizar. HETNA las revisa antes de mandarlas."],
  ["No pierdas tiempo buscando clientes", "Te avisamos por correo cuando llega un trabajo de tu proceso y material."],
  ["Muestra tu portafolio", "Galería, máquinas, materiales y capacidades en tu perfil: tu mini-sitio sin pagar página web."],
  ["Proyectos locales o nacionales", "Los clientes de tu estado te ven primero; con Envíos HETNA llegas a todo México."],
  ["Construye reputación", "Reseñas de clientes reales e insignia de Taller verificado."],
  ["Cobro seguro", "El cliente paga dentro de HETNA antes de que empieces. No persigues pagos."],
]

const COMO_FUNCIONA = [
  ["Registra tu taller", "Llena el formulario de abajo y crea tu cuenta en el panel. Es gratis."],
  ["Completa tus capacidades", "Servicios, materiales, máquinas y fotos. Con eso te llegan los trabajos que sí puedes hacer."],
  ["Recibe solicitudes de proyectos", "Por correo y en tu panel, sin los datos de contacto del cliente: todo el trato va por HETNA."],
  ["Cotiza y gana trabajos", "Mandas precio y tiempo. Si te eligen y el cliente paga, fabricas, entregas y cobras."],
]

const PERFILES = [
  "Router CNC", "Láser CO2 y fibra", "Plasma", "Fresadora / centro de maquinado", "Torno CNC", "4 y 5 ejes",
  "Impresión 3D", "Carpintería CNC (madera y MDF)", "Metalmecánica", "Acrílico y señalética", "Prototipado",
  "Producción en serie", "Diseño CAD/CAM", "Acabados: pintura, anodizado, electrostática",
]

const RECIBES = [
  ["Piezas únicas", "Refacciones, regalos, piezas a la medida."],
  ["Prototipos", "Una o pocas piezas para probar una idea."],
  ["Lotes", "De decenas a miles de piezas iguales."],
  ["Maquila", "Marcas que te mandan su diseño para que tú lo fabriques."],
  ["Producción recurrente", "Pedidos que se repiten cada mes."],
  ["Diseño", "Clientes sin plano que necesitan que se los dibujen."],
]

const PREGUNTAS = [
  {
    p: "¿Tiene costo unirse?",
    r: "No. Registrarte, tener tu perfil y recibir solicitudes es gratis. HETNA sólo cobra una comisión cuando vendes o ganas un trabajo que el cliente paga dentro de la plataforma; la comisión vigente la ves en tu panel antes de vender. Hay planes opcionales que ponen tus propuestas primero.",
  },
  {
    p: "¿Cómo recibo proyectos?",
    r: "Cuando un cliente pide un trabajo de tu proceso, te llega un correo y aparece en \"Solicitudes\" de tu panel. Reciben el aviso primero los talleres que trabajan ese material y los del estado del cliente. Ahí ves el trabajo, descargas los archivos del cliente y mandas tu precio y tiempo.",
  },
  {
    p: "¿Qué tipo de trabajos puedo recibir?",
    r: "Corte, grabado, maquinado, torneado, impresión 3D, diseño, maquila y producción por volumen: piezas únicas, prototipos, lotes y pedidos recurrentes. Además puedes vender productos en tu tienda dentro de HETNA.",
  },
  {
    p: "¿Necesito facturar?",
    r: "Cada taller cumple sus obligaciones fiscales y emite sus comprobantes (CFDI). Para cobrar necesitas dar tu RFC. Cuando la ley lo pide, HETNA, como plataforma de intermediación, retiene ISR e IVA de tus pagos y te entrega la constancia de retenciones.",
  },
  {
    p: "¿Puedo elegir qué proyectos cotizar?",
    r: "Sí. Tú decides a cuáles mandar precio. Si uno no te conviene, lo marcas como \"no tengo capacidad\", \"no trabajo ese material\" o \"necesito más información\" y deja de aparecerte; con la última, HETNA le pregunta al cliente por ti.",
  },
  {
    p: "¿Qué pasa si no tengo página web?",
    r: "No la necesitas. Tu perfil en HETNA funciona como tu página: portada, logo, galería de trabajos, máquinas, materiales, reseñas y catálogo. Lo puedes compartir por WhatsApp y redes.",
  },
  {
    p: "¿Cómo me pagan?",
    r: "El cliente paga dentro de HETNA (Mercado Pago) y tú empiezas cuando el pago está confirmado: nunca fabricas sin que esté pagado. HETNA te entrega el importe menos la comisión y las retenciones que marque la ley cuando el pedido se entrega.",
  },
  {
    p: "¿El cliente ve mis datos o yo los suyos?",
    r: "Ninguno ve el teléfono ni el correo del otro: los mensajes, el pago y el seguimiento van por HETNA. Así se cuida a las dos partes y nadie se salta el pago.",
  },
  {
    p: "¿Qué pasa después de registrarme?",
    r: "Te llega un correo con tu siguiente paso: crear tu cuenta en el panel y completar tu perfil. Luego verificamos tu taller con una identificación y fotos para darte la insignia de Taller verificado, que los clientes ven en tu perfil.",
  },
]

const BTN = "inline-flex items-center justify-center rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
const H2 = "text-2xl font-extrabold text-[#142033] sm:text-3xl"

export default async function UneteTallerPage() {
  const [talleres, abiertos] = await Promise.all([
    listarTalleres().catch(() => []),
    trabajosAbiertos({ limit: 3 }).catch(() => ({ trabajos: [], total: 0 })),
  ])
  const verificados = talleres.filter((t) => t.verificado).length
  const quedanFundador = Math.max(CUPO_FUNDADORES - talleres.filter((t) => t.fundador).length, 0)
  const estados = new Set(talleres.map((t) => t.perfil.estado).filter(Boolean)).size

  return (
    <main className="w-full bg-[#FAF9F6]">
      {/* Hero */}
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-12 sm:py-16 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Red de talleres HETNA</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Lleva tu taller a más clientes</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Únete a la red HETNA y recibe solicitudes de fabricación, corte, maquila y producción CNC de clientes de todo México.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#registro" className={BTN}>
              Registrar mi taller
            </a>
            <a href="#como-funciona" className="inline-flex items-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Ver cómo funciona
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <li>✓ Registro gratis</li>
            <li>✓ Tú eliges qué cotizar</li>
            <li>✓ Cobro seguro antes de fabricar</li>
            {abiertos.total > 0 && (
              <li className="font-semibold text-[#F2A25F]">
                {abiertos.total === 1 ? "1 trabajo esperando precio" : `${abiertos.total} trabajos esperando precio`} ahora
              </li>
            )}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 lg:px-8">
        {/* Cómo ganas dinero */}
        <section className="mt-12">
          <h2 className={H2}>Cómo gana dinero tu taller con HETNA</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMO_GANAS.map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
                <p className="font-bold text-[#142033]">$ {t}</p>
                <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Beneficios */}
        <section className="mt-12">
          <h2 className={H2}>Lo que ganas al unirte</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-5 ring-1 ring-[#E7E4DC]">
                <p className="font-bold text-[#142033]">✓ {t}</p>
                <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mt-12 scroll-mt-24">
          <h2 className={H2}>Cómo funciona</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COMO_FUNCIONA.map(([t, d], i) => (
              <li key={t} className="flex gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF1E6] font-extrabold text-[#C2560A]">{i + 1}</span>
                <span>
                  <span className="block font-bold text-[#142033]">{t}</span>
                  <span className="text-sm text-[#6B675C]">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Qué talleres buscamos + qué puedes recibir */}
        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-[#142033]">Qué talleres buscamos</h2>
            <p className="mt-1 text-sm text-[#6B675C]">Si tu taller hace alguno de estos trabajos, es para ti.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PERFILES.map((p) => (
                <span key={p} className="rounded-full bg-[#F3F1EA] px-3 py-1.5 text-sm text-[#2B2A26]">{p}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-[#142033]">Qué puedes recibir</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {RECIBES.map(([t, d]) => (
                <li key={t}>
                  <span className="block font-bold text-[#142033]">{t}</span>
                  <span className="text-sm text-[#6B675C]">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {abiertos.trabajos.length > 0 && (
          <section className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={H2}>Trabajos que están esperando precio</h2>
              <LocalizedClientLink href="/trabajos" className="text-sm font-semibold text-[#C2560A]">
                Ver los {abiertos.total} →
              </LocalizedClientLink>
            </div>
            <p className="mt-1 text-[#6B675C]">Solicitudes reales de clientes. Regístrate para cotizarlas.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {abiertos.trabajos.map((t) => (
                <TarjetaTrabajo key={t.folio} trabajo={t} />
              ))}
            </div>
          </section>
        )}

        {/* Confianza */}
        <section className="mt-12 rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Qué es HETNA y por qué unirte</h2>
          <p className="mt-3 max-w-3xl text-white/80">
            HETNA es una plataforma mexicana especializada en fabricación CNC: conecta a clientes que necesitan piezas con talleres
            que las fabrican. Los clientes llenan una solicitud estructurada (material, medidas, cantidad, fecha y archivo), HETNA la
            revisa y la manda a los talleres compatibles, y el pago y el seguimiento pasan por la plataforma.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Plataforma especializada", "Sólo fabricación CNC: tus clientes saben lo que piden."],
              ["Solicitudes estructuradas", "Material, medidas, cantidad, fecha y archivos en cada una."],
              ["Seguimiento", "Cada pedido con folio, avances, entrega y confirmación del cliente."],
              ["Visibilidad profesional", "Perfil, reseñas e insignia de Taller verificado."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="font-bold">{t}</p>
                <p className="mt-1 text-sm text-white/70">{d}</p>
              </div>
            ))}
          </div>
          {(talleres.length > 0 || abiertos.total > 0) && (
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-white/10 pt-5">
              {talleres.length > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60">Talleres en la red</dt>
                  <dd className="text-2xl font-extrabold">{talleres.length}</dd>
                </div>
              )}
              {verificados > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60">Verificados</dt>
                  <dd className="text-2xl font-extrabold">{verificados}</dd>
                </div>
              )}
              {estados > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60">Estados</dt>
                  <dd className="text-2xl font-extrabold">{estados}</dd>
                </div>
              )}
              {abiertos.total > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/60">Trabajos esperando precio</dt>
                  <dd className="text-2xl font-extrabold">{abiertos.total}</dd>
                </div>
              )}
            </dl>
          )}
          {quedanFundador > 0 && (
            <p className="mt-6 rounded-xl bg-[#C2560A] px-4 py-3 text-sm font-semibold">
              Quedan {quedanFundador} lugares de Taller fundador: insignia permanente y 6 meses de plan Pro gratis.{" "}
              <LocalizedClientLink href="/talleres/fundadores" className="underline">
                Ver detalles
              </LocalizedClientLink>
            </p>
          )}
        </section>

        {/* FAQ */}
        <section className="mt-12 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
          <h2 className="mb-2 text-xl font-extrabold text-[#142033]">Preguntas frecuentes</h2>
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="border-t border-[#E7E4DC] py-3 first:border-t-0">
              <summary className="cursor-pointer font-semibold text-[#142033]">{q.p}</summary>
              <p className="mt-2 text-sm text-[#44433D]">{q.r}</p>
            </details>
          ))}
          <p className="mt-3 text-sm text-[#6B675C]">
            Los detalles completos están en los{" "}
            <LocalizedClientLink href="/terminos-vendedores" className="font-semibold text-[#C2560A]">
              términos para vendedores
            </LocalizedClientLink>
            .
          </p>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: PREGUNTAS.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
              }).replace(/</g, "\\u003c"),
            }}
          />
        </section>

        {/* Registro */}
        <section id="registro" className="mt-12 scroll-mt-24 rounded-3xl bg-[#142033] p-4 sm:p-8">
          <div className="mb-5 text-white">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Registra tu taller</h2>
            <p className="mt-1 max-w-2xl text-white/80">
              Toma 3 minutos. Con estos datos te mandamos los trabajos que sí puedes hacer.
            </p>
          </div>
          <FormRegistroTaller />
          <p className="mt-4 text-center text-sm text-white/70">
            ¿Ya tienes cuenta?{" "}
            <a href="/seller" className="font-semibold text-[#F2A25F] underline">
              Entra a tu panel
            </a>
            {" · "}
            <a
              href={ligaWhatsApp("Hola HETNA, tengo un taller CNC y quiero unirme a la red")}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#F2A25F] underline"
            >
              Pregúntanos por WhatsApp
            </a>
          </p>
        </section>
      </div>
      <div className="h-12" />
    </main>
  )
}
