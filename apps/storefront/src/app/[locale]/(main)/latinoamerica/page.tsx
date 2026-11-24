import type { Metadata } from "next"

import { FormLatam } from "@/components/hetna/latam/FormLatam"
import { PAISES_LATAM, rutaPais } from "@/components/hetna/latam/paises"
import { directorioPorPais, mismoPais } from "@/lib/hetna/directorio"
import { conteoLatam } from "@/lib/hetna/latam"

// Fase 5: HETNA llega a Latinoamérica. Pre-registro de talleres fundadores y
// clientes por país (packages/api/src/lib/latam.ts); el panel muestra cuántos
// hay en cada uno para decidir qué país abrir primero.
export const revalidate = 300

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/latinoamerica" },
  title: { absolute: "HETNA CNC llega a Latinoamérica: talleres fundadores por país" },
  description:
    "Colombia, Chile, Perú, Argentina, Guatemala y más: apunta tu taller CNC como fundador o pide que HETNA abra en tu país.",
}

const QUE_ES = [
  ["🏭", "Clientes para tu taller", "Solicitudes de fabricación de empresas y personas de tu país, con el archivo revisado y precio estimado."],
  ["📱", "Cotizador para talleres", "Cotiza desde DXF, STL o STEP con tus costos, manda PDF por WhatsApp y controla tu taller. Ya funciona en cualquier país."],
  ["🛠️", "Herramientas gratis", "Calculadora CNC, generadores de diseños para láser y router, y CAM 2D y 3D, desde hoy."],
  ["⭐", "Talleres fundadores", "Los primeros talleres de cada país entran como fundadores, con beneficios que te contamos al abrir tu país."],
]

export default async function LatinoamericaPage() {
  const [conteo, grupos] = await Promise.all([conteoLatam(), directorioPorPais()])
  const totalMundo = grupos.reduce((n, g) => n + g.empresas.length, 0)
  const ubicadas = (p: (typeof PAISES_LATAM)[number]) =>
    grupos.find((g) => mismoPais(g.pais, p.nombre) || (p.en_hoja || []).some((h) => mismoPais(h, g.pais)))?.empresas.length || 0
  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Muy pronto</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">HETNA CNC llega a Latinoamérica</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            La red de talleres CNC de México se abre a más países. Apunta tu taller como fundador o pide que abramos en tu país: abrimos primero donde más talleres y clientes se registren.
          </p>
          {totalMundo > 0 && (
            <p className="mt-4 text-sm text-white/80">
              Ya ubicamos {totalMundo.toLocaleString("es-MX")} empresas CNC en {grupos.length} países.{" "}
              <a href="/mx/talleres#directorio" className="font-semibold text-[#F2A25F] underline">Verlas en el mapa</a>
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {PAISES_LATAM.map((p) => {
              // EUA y España aparecen aquí también, cada uno con su página
              const c = conteo[p.clave]
              const n = c ? c.talleres + c.clientes : 0
              const u = ubicadas(p)
              return (
                <a key={p.clave} href={rutaPais(p.clave)} className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white no-underline hover:bg-white/20">
                  {p.bandera} {p.nombre}
                  {u > 0 ? ` · ${u} ${u === 1 ? "empresa" : "empresas"}` : ""}
                  {n > 0 ? ` · ${n} ${n === 1 ? "registro" : "registros"}` : ""}
                </a>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 lg:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUE_ES.map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="text-3xl">{i}</p>
              <p className="mt-2 font-bold text-[#142033]">{t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-[#E7E4DC] bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-[#142033]">Apúntate</h2>
          <p className="mb-4 mt-1 text-sm text-[#6B675C]">Sin costo. Te avisamos antes que a nadie cuando abramos tu país.</p>
          <FormLatam />
        </div>
      </section>
    </main>
  )
}
