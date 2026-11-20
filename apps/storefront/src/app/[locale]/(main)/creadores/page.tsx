import type { Metadata } from "next"

import { FormCreador } from "@/components/hetna/creador/FormCreador"

// Programa de creadores (estrategia 1.5): youtubers, tiktokers e instructores
// de CNC reciben su código y su página; su audiencia gana días de HETNA Taller
// y ellos ganan por cada taller que llega a pagar. Se administra en
// Panel → App → Creadores (packages/api/src/lib/creadores.ts).
export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/creadores" },
  title: "Programa de creadores CNC: tu código y tu página en HETNA",
  description:
    "¿Haces videos o cursos de router, láser o plasma? Únete al programa de creadores de HETNA CNC: tu audiencia recibe días gratis del Cotizador y tú ganas por cada taller que contrata.",
}

const POR_QUE = [
  ["🎁", "Un regalo real para tu audiencia", "Con tu código, cada taller nuevo recibe días de HETNA Taller gratis: cotiza desde DXF o STL, manda PDF por WhatsApp y controla su taller."],
  ["🏆", "Ganas por cada taller que paga", "Por cada taller que llega con tu código y contrata un plan, ganas meses de HETNA Taller para ti. Las condiciones exactas te llegan con tu código."],
  ["📊", "Ves tus números", "Visitas a tu página, talleres registrados con tu código y cuántos ya pagan: te los mandamos cada mes."],
  ["🔗", "Tu página propia", "hetnacnc.com/creadores/TUCODIGO, con tu nombre y tu canal, para la descripción de tus videos y tu perfil."],
]

const PASOS = [
  "Llenas el formulario con tu canal y de qué hablas.",
  "Lo revisamos y te mandamos por correo tu código (por ejemplo CNCJUAN) y tu página.",
  "Pones la liga en tus videos, tu perfil o tu curso.",
  "Tu audiencia se registra desde tu página y recibe sus días gratis; tú ves cuántos llegaron.",
]

export default function CreadoresPage() {
  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Programa de creadores HETNA</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">¿Enseñas CNC? Tu audiencia gana y tú también</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            Para quienes hacen videos, cursos o comunidad de router, láser, plasma o impresión 3D: un código propio que regala días de HETNA Taller a tus seguidores y te premia por cada taller que contrata.
          </p>
          <a href="#unirme" className="mt-6 inline-block rounded-xl bg-[#C2560A] px-7 py-3.5 text-lg font-semibold text-white no-underline hover:brightness-110">
            Quiero mi código
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 lg:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POR_QUE.map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="text-3xl">{i}</p>
              <p className="mt-2 font-bold text-[#142033]">{t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-extrabold text-[#142033]">Cómo funciona</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {PASOS.map((p, i) => (
            <li key={p} className="flex gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <span className="text-2xl font-black text-[#C2560A]">{i + 1}</span>
              <span className="text-[15px] text-[#40403A]">{p}</span>
            </li>
          ))}
        </ol>

        <div id="unirme" className="mx-auto mt-12 max-w-2xl rounded-3xl border border-[#E7E4DC] bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-[#142033]">Únete al programa</h2>
          <p className="mb-4 mt-1 text-sm text-[#6B675C]">Sin costo. Aceptamos canales de cualquier tamaño que hablen de CNC, carpintería, herrería, letreros o impresión 3D.</p>
          <FormCreador />
        </div>
      </section>
    </main>
  )
}
