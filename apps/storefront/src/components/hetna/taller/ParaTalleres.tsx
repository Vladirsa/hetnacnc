import FormRegistroTaller from '@/components/hetna/taller/FormRegistroTaller';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  BENEFICIOS_TALLER,
  PASOS_TALLER,
  PERFILES_TALLER,
  PREGUNTAS_TALLER
} from '@/lib/talleres/contenido';

// Las cinco cosas que un dueño de taller necesita para decidir, en orden:
// cómo funciona, qué gana, si es para él, sus dudas y el registro. Lo usa el
// directorio /talleres (debajo de la lista de talleres) y /talleres/unete.
//
// En el directorio salen sólo las preguntas cortas, con liga a las demás;
// /talleres/unete usa las piezas por separado, con todas las preguntas.

const H2 = 'text-2xl font-extrabold text-[#142033] sm:text-3xl';

export function PasosTaller() {
  return (
    <section
      id="como-funciona-taller"
      className="mt-12 scroll-mt-24"
    >
      <h2 className={H2}>Cómo funciona</h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PASOS_TALLER.map(([t, d], i) => (
          <li
            key={t}
            className="flex gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#C2560A] text-lg font-extrabold text-white">
              {i + 1}
            </span>
            <span>
              <span className="block font-bold text-[#142033]">{t}</span>
              <span className="text-sm text-[#6B675C]">{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BeneficiosTaller() {
  return (
    <section className="mt-12">
      <h2 className={H2}>Beneficios para tu taller</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {BENEFICIOS_TALLER.map(([t, d]) => (
          <div
            key={t}
            className="rounded-2xl border border-[#E7E4DC] bg-white p-4"
          >
            <p className="font-bold text-[#142033]">✓ {t}</p>
            <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PerfilesTaller() {
  return (
    <section className="mt-12 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
      <h2 className={H2}>¿Qué tipo de talleres buscamos?</h2>
      <p className="mt-1 text-[#6B675C]">Si tu taller hace alguno de estos trabajos, es para ti.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PERFILES_TALLER.map(p => (
          <span
            key={p}
            className="rounded-full border border-[#E7E4DC] bg-[#FAF9F6] px-4 py-2 text-[15px] font-semibold text-[#142033]"
          >
            {p}
          </span>
        ))}
      </div>
    </section>
  );
}

export function PreguntasTaller({ todas = false }: { todas?: boolean }) {
  const preguntas = todas ? PREGUNTAS_TALLER : PREGUNTAS_TALLER.filter(q => q.corta);
  return (
    <section className="mt-12 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
      <h2 className={H2}>Preguntas de talleres</h2>
      <div className="mt-2">
        {preguntas.map(q => (
          <details
            key={q.p}
            className="border-t border-[#E7E4DC] py-3 first:border-t-0"
          >
            <summary className="cursor-pointer font-semibold text-[#142033]">{q.p}</summary>
            <p className="mt-2 text-sm text-[#44433D]">{q.r}</p>
          </details>
        ))}
      </div>
      {!todas && (
        <LocalizedClientLink
          href="/talleres/unete"
          className="mt-2 inline-block text-sm font-semibold text-[#C2560A]"
        >
          Más preguntas y todo sobre la red de talleres →
        </LocalizedClientLink>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: preguntas.map(q => ({
              '@type': 'Question',
              name: q.p,
              acceptedAnswer: { '@type': 'Answer', text: q.r }
            }))
          }).replace(/</g, '\\u003c')
        }}
      />
    </section>
  );
}

export function RegistroTaller() {
  return (
    <section
      id="registro"
      className="mt-12 scroll-mt-24 rounded-3xl bg-[#142033] p-4 sm:p-8"
    >
      <div className="mb-5 text-white">
        <h2 className="text-2xl font-extrabold sm:text-3xl">Registra tu taller</h2>
        <p className="mt-1 max-w-2xl text-white/80">
          Toma 3 minutos. Con estos datos te mandamos los trabajos que sí puedes hacer.
        </p>
      </div>
      <FormRegistroTaller />
      <p className="mt-4 text-center text-sm text-white/70">
        ¿Ya tienes cuenta?{' '}
        <a
          href="/seller"
          className="font-semibold text-[#F2A25F] underline"
        >
          Entra a tu panel
        </a>
      </p>
    </section>
  );
}

// Las cinco juntas, en el orden en que un taller decide.
export default function ParaTalleres() {
  return (
    <>
      <PasosTaller />
      <BeneficiosTaller />
      <PerfilesTaller />
      <PreguntasTaller />
      <RegistroTaller />
    </>
  );
}
