// "Para qué sirve" de Partir modelo 3D (se ve antes de subir un modelo): usos,
// ejemplos REALES hechos con esta misma herramienta (antes → después) y por qué
// conviene. Imágenes en public/img/partir-3d (renders de la vista del generador).
import { T } from "@/components/hetna/i18n/Idioma"
const R = "/img/partir-3d"

const USOS = [
  { i: "🪖", t: "Cosplay y cascos", d: "Cascos, armaduras y props de tamaño real en una impresora chica." },
  { i: "🪴", t: "Macetas, jarrones y lámparas", d: "Decoración grande para vender o regalar." },
  { i: "📏", t: "Piezas largas", d: "Rieles, perfiles, soportes y molduras más largos que tu cama." },
  { i: "🔤", t: "Letreros y figuras", d: "Letras, logotipos y figuras de medio metro o más." },
  { i: "🏗️", t: "Maquetas y prototipos", d: "Carcasas y modelos a escala real para probar antes de fabricar." },
  { i: "🔧", t: "Refacciones", d: "Esa pieza que no cabe completa: pártela y ármala con pernos." },
]

const EJEMPLOS = [
  {
    t: "Pieza larga de 44 cm en una cama de 22",
    d: "Dos cortes y perno integrado: cada pieza trae su perno y la otra el agujero. Se arma sin pegamento.",
    antes: { img: `${R}/riel-cortes.webp`, et: "Cortes y pernos" },
    despues: { img: `${R}/riel-piezas.webp`, et: "3 piezas" },
  },
  {
    t: "Jarrón de 36 cm que se arma y se desarma",
    d: "Un corte a la mitad con huecos para imanes de 6 × 3 mm: te decimos cuántos comprar.",
    antes: { img: `${R}/jarron-imanes.webp`, et: "Huecos para 6 imanes" },
    despues: { img: `${R}/jarron-piezas.webp`, et: "2 piezas" },
  },
  {
    t: "Esfera de 30 cm con 14 pernos",
    d: "Repartida para una Ender 3 (22 × 22 cm): 8 piezas iguales y los pernos para imprimir aparte.",
    antes: { img: `${R}/esfera-pernos.webp`, et: "14 pernos en 7 uniones" },
    despues: { img: `${R}/esfera-piezas.webp`, et: "8 piezas" },
  },
  {
    t: "Maceta de 32 cm en 8 piezas",
    d: "Paredes delgadas: si no caben pernos te lo decimos y quedan caras planas para pegar.",
    antes: null,
    despues: { img: `${R}/maceta-piezas.webp`, et: "8 piezas" },
  },
]

const PORQUE = [
  ["Sin comprar otra impresora", "Lo grande se imprime en partes con la que ya tienes."],
  ["Si falla una pieza, reimprimes sólo esa", "No pierdes horas ni filamento de todo el modelo."],
  ["Encaja a la primera", "Pernos con holgura de 0.2 mm, o imanes con su medida exacta."],
  ["Todo listo para imprimir", "ZIP con cada pieza en STL, los pernos y las instrucciones."],
]

const Figura = ({ src, et, alt }: { src: string; et: string; alt: string }) => (
  <figure className="relative m-0 overflow-hidden rounded-[10px] border border-[#E7E4DC] bg-[#0F151E]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} width={800} height={600} loading="lazy" className="block h-auto w-full" />
    <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-semibold text-white">{et}</figcaption>
  </figure>
)

export function EjemplosPartir() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5">
        <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><T>¿Para qué sirve?</T></h2>
        <p className="m-0 mt-1 text-[14px] text-[#6B6A63]"><T>Para imprimir cosas más grandes que tu impresora. Tú eliges dónde cortar y cómo se unen las piezas.</T></p>
        <ul className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {USOS.map((u) => (
            <li key={u.t} className="flex gap-2.5 rounded-[10px] border border-[#E7E4DC] p-3">
              <span className="text-[22px] leading-none" aria-hidden="true">{u.i}</span>
              <span className="flex flex-col">
                <span className="text-[14px] font-semibold text-[#1B1B18]">{u.t}</span>
                <span className="text-[12.5px] text-[#6B6A63]">{u.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5">
        <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><T>Así se ven partidos</T></h2>
        <p className="m-0 mt-1 text-[14px] text-[#6B6A63]"><T>Ejemplos reales hechos con esta herramienta: los cortes y pernos que propone, y las piezas listas para imprimir.</T></p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {EJEMPLOS.map((e) => (
            <article key={e.t} className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {e.antes && <Figura src={e.antes.img} et={e.antes.et} alt={`${e.t}: cortes y uniones`} />}
                <Figura src={e.despues.img} et={e.despues.et} alt={`${e.t}: piezas partidas`} />
              </div>
              <h3 className="m-0 text-[15px] font-semibold text-[#1B1B18]">{e.t}</h3>
              <p className="m-0 text-[13px] text-[#6B6A63]">{e.d}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5">
        <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><T>Así funciona</T></h2>
        <ol className="m-0 mt-2 pl-5 list-decimal flex flex-col gap-1.5 text-[14.5px] text-[#4A4943]">
          <li><T>Sube tu STL, OBJ o STEP.</T></li>
          <li><T>Elige tu impresora: repartimos los cortes para que cada pieza quepa en la cama.</T></li>
          <li><T>Mueve o agrega cortes (con las barras o tocando el modelo) y elige pernos, perno integrado o imanes, y cuántos por unión.</T></li>
          <li><T>Descarga todo en un ZIP, ve el precio en el Cotizador o pide que un taller te lo imprima.</T></li>
        </ol>
        <ul className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
          {PORQUE.map(([t, d]) => (
            <li key={t} className="rounded-[10px] bg-[#E6F4EC] p-3">
              <span className="block text-[13.5px] font-semibold text-[#16794F]">✓ {t}</span>
              <span className="block text-[12.5px] text-[#4A4943]">{d}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-3 text-[13px] text-[#6B6A63]"><T>Gratis, sin cuenta y sin marca de agua. Tu archivo no sale de tu navegador.</T></p>
      </div>
    </div>
  )
}
