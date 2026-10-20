import Image from 'next/image'
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres, ubicacion } from "@/lib/hetna/talleres"

// Encabezado para las categorías de Servicios. Un servicio no es un producto con
// precio fijo: el cliente pide propuestas a los talleres (licitación) o cotiza al instante.

type Info = { titulo: string; texto: string; servicio: string; coincide: string[]; calculadora?: string }

const SERVICIOS: Record<string, Info> = {
  servicios: {
    titulo: "Servicios de fabricación CNC",
    texto: "Corte, maquinado, diseño e impresión 3D con talleres de todo México. Describe tu pieza, recibe propuestas y elige la mejor.",
    servicio: "",
    coincide: [],
  },
  "diseno-2d-3d": {
    titulo: "Diseño 2D / 3D",
    texto: "Convierte tu idea, foto o boceto en un archivo DXF, SVG o STL listo para cortar o maquinar.",
    servicio: "Diseño CAD/CAM",
    coincide: ["Diseño CAD/CAM"],
  },
  "programacion-cam": {
    titulo: "Programación CAM",
    texto: "Trayectorias y G-code para tu máquina: router, fresadora, torno, láser o plasma.",
    servicio: "Diseño CAD/CAM",
    coincide: ["Diseño CAD/CAM"],
  },
  "corte-laser": {
    titulo: "Corte láser",
    texto: "Corte y grabado láser en MDF, madera, acrílico y más. Por pieza o por lote.",
    servicio: "Corte láser",
    coincide: ["Corte láser", "Grabado"],
    calculadora: "/cotizar/corte-laser",
  },
  "corte-plasma": {
    titulo: "Corte plasma",
    texto: "Corte de lámina y placa de acero, inoxidable y aluminio con plasma CNC.",
    servicio: "Corte plasma",
    coincide: ["Corte plasma"],
  },
  "maquinado-cnc": {
    titulo: "Maquinado CNC",
    texto: "Fresado de piezas en madera, plástico y metal con router o centro de maquinado.",
    servicio: "Maquinado",
    coincide: ["Maquinado", "Fresado de metal", "Fresado de madera", "Corte CNC"],
    calculadora: "/cotizar/router-cnc",
  },
  "torneado-cnc": {
    titulo: "Torneado CNC",
    texto: "Piezas cilíndricas, flechas, bujes y roscas en torno CNC.",
    servicio: "Maquinado",
    coincide: ["Maquinado", "Fresado de metal"],
  },
  "maquinado-4-y-5-ejes": {
    titulo: "Maquinado 4 y 5 ejes",
    texto: "Piezas complejas, moldes y relieves que necesitan 4.º o 5.º eje.",
    servicio: "Maquinado",
    coincide: ["Maquinado", "Fresado de metal"],
  },
  "impresion-3d": {
    titulo: "Impresión 3D",
    texto: "Prototipos y piezas funcionales en PLA, PETG, resina y más.",
    servicio: "Impresión 3D",
    coincide: ["Impresión 3D"],
  },
  prototipado: {
    titulo: "Prototipado",
    texto: "De la idea a la primera pieza: diseño, ajuste y fabricación de prototipos.",
    servicio: "Otro",
    coincide: ["Diseño CAD/CAM", "Impresión 3D", "Maquinado", "Corte CNC"],
  },
  maquila: {
    titulo: "Maquila CNC",
    texto: "Producción por lotes con talleres de la red: corte, maquinado y acabados.",
    servicio: "Corte CNC",
    coincide: ["Corte CNC", "Maquinado", "Corte láser", "Corte plasma"],
  },
}

export const esCategoriaServicio = (handle?: string | null) => Boolean(handle && SERVICIOS[handle])

export default async function ServicioCategoria({ handle }: { handle: string }) {
  const info = SERVICIOS[handle]
  if (!info) return null

  const talleres = (await listarTalleres())
    .filter((t) => !info.coincide.length || t.perfil.servicios.some((s) => info.coincide.includes(s)))
    .slice(0, 6)
  const cotizar = `/cotizar${info.servicio ? `?servicio=${encodeURIComponent(info.servicio)}` : ""}`

  return (
    <section className="mb-8 grid gap-5">
      <div className="overflow-hidden rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Servicio</p>
        <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl">{info.titulo}</h2>
        <p className="mt-2 max-w-2xl text-white/75">{info.texto}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink href={cotizar} className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110">
            Pedir propuestas a talleres
          </LocalizedClientLink>
          {info.calculadora && (
            <LocalizedClientLink href={info.calculadora} className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Precio al instante
            </LocalizedClientLink>
          )}
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Describe tu trabajo", "Material, medidas, cantidad y tus archivos."],
          ["2", "Recibe propuestas", "Los talleres te mandan precio y tiempo de entrega."],
          ["3", "Elige y paga en HETNA", "Pagas con Mercado Pago y recibes con Envíos HETNA."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF1E6] font-extrabold text-[#C2560A]">{n}</span>
            <span>
              <span className="block font-bold text-[#142033]">{t}</span>
              <span className="text-sm text-[#6B675C]">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      {talleres.length > 0 && (
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-extrabold text-[#142033]">Talleres que ofrecen {info.titulo.toLowerCase()}</h3>
            <LocalizedClientLink href="/talleres" className="text-sm font-semibold text-[#C2560A]">
              Ver todos →
            </LocalizedClientLink>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {talleres.map((t) => (
              <LocalizedClientLink
                key={t.id}
                href={`/talleres/${t.handle}`}
                className="flex items-center gap-3 rounded-xl border border-[#E7E4DC] p-3 transition hover:shadow-md"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#142033] font-extrabold text-white">
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <Image src={t.logo} alt="" className="h-full w-full object-cover" width={300} height={300} />
                  ) : (
                    t.nombre.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-[#142033]">{t.nombre}</span>
                  <span className="block truncate text-xs text-[#6B675C]">{ubicacion(t.perfil) || "México"}</span>
                </span>
              </LocalizedClientLink>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
