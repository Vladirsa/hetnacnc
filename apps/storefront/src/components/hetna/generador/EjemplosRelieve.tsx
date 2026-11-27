// "Así funciona" del generador de relieves: ejemplos REALES hechos con esta misma
// herramienta (foto de HETNA → profundidad con IA → relieve 3D), y la diferencia
// contra el relieve por brillo. Imágenes en public/img/relieve-ia.
import { T } from "@/components/hetna/i18n/Idioma"
const R = "/img/relieve-ia"

const PASOS = [
  { img: `${R}/laser-foto.webp`, t: "1. Sube tu foto", d: "Una persona, una mascota, un objeto o una escena." },
  { img: `${R}/laser-profundidad.webp`, t: "2. La IA calcula la profundidad", d: "Blanco = cerca, negro = lejos. Tarda unos segundos." },
  { img: `${R}/laser-relieve-ia.webp`, t: "3. Descarga tu relieve 3D", d: "STL listo para tallar en router o imprimir, con las medidas que elijas." },
]

const Figura = ({ src, alt, etiqueta, color }: { src: string; alt: string; etiqueta: string; color: string }) => (
  <figure className="relative m-0 overflow-hidden rounded-[12px] border border-[#E7E4DC] bg-[#2A2622]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} width={720} height={404} loading="lazy" className="block h-auto w-full" />
    <figcaption className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-white ${color}`}><T>{etiqueta}</T></figcaption>
  </figure>
)

export function EjemplosRelieve({ conIA }: { conIA: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5">
        <p className="m-0 font-semibold text-[#1B1B18] text-[16px]"><T>Así funciona</T></p>
        <ol className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-3">
          {PASOS.filter((_, i) => conIA || i !== 1).map((p) => (
            <li key={p.t} className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img} alt={p.t} width={720} height={404} loading="lazy" className="block h-auto w-full rounded-[10px] border border-[#E7E4DC] bg-[#2A2622]" />
              <span className="text-[14px] font-semibold text-[#1B1B18]">{p.t}</span>
              <span className="text-[13px] text-[#6B6A63]">{p.d}</span>
            </li>
          ))}
        </ol>
      </div>
      {conIA && (
        <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5">
          <p className="m-0 font-semibold text-[#1B1B18] text-[16px]"><T>¿Por qué con IA?</T></p>
          <p className="m-0 mt-1 text-[13.5px] text-[#6B6A63]">
            <T>La misma foto con los dos métodos. Por brillo, lo oscuro se hunde aunque esté al frente. Con IA, lo cercano sale alto y el fondo queda atrás.</T>
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Figura src={`${R}/impresora-relieve-brillo.webp`} alt="Relieve por brillo de una impresora 3D" etiqueta="Por brillo" color="bg-[#6B6A63]" />
            <Figura src={`${R}/impresora-relieve-ia.webp`} alt="Relieve con profundidad con IA de una impresora 3D" etiqueta="✨ Con IA" color="bg-[#C2560A]" />
          </div>
        </div>
      )}
    </div>
  )
}
