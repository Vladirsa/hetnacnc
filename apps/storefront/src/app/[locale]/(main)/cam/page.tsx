import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  title: "Laboratorio CAM — HETNA CNC",
  description:
    "Cinco formas de llegar a una pieza cortada: empieza de una plantilla, sube tu DXF, escanea algo que ya existe, programa tu modelo 3D en 3, 4 y 5 ejes o tornea con tu eje rotativo.",
}

// Flujo 2 del prototipo: las tres puertas.
//
// Las tres cosas ya existían por separado y nadie las encontraba. Esta
// pantalla no agrega capacidades: agrega una entrada. Es la diferencia entre
// un montón de herramientas y un producto.
//
// El orden importa y no es alfabético: va de lo más fácil a lo más laborioso.
// Quien llega sin saber qué quiere entra por la primera; quien ya sabe se va
// directo a la suya.
const PUERTAS = [
  {
    numero: "1",
    titulo: "Empieza de una plantilla",
    para: "No tengo archivo todavía",
    texto:
      "Cajas con juntas de dedo, letreros con nombres, plantillas de empaque, despiece de muebles, litofanías. Pones las medidas y sale el archivo listo para cortar.",
    href: "/servicios/generador-2d-3d",
    boton: "Ver las plantillas",
    cuenta: false,
  },
  {
    numero: "2",
    titulo: "Sube tu archivo",
    para: "Ya tengo el dibujo",
    texto:
      "Un DXF con los contornos cerrados. Eliges material y fresa, y te damos el G-code con las pasadas, el avance y las revoluciones ya calculadas.",
    href: "/cam/subir",
    boton: "Subir mi DXF",
    cuenta: false,
  },
  {
    numero: "3",
    titulo: "Escanea una pieza",
    para: "Tengo la pieza, no el dibujo",
    texto:
      "Fotos de una pieza que ya existe y te devolvemos su modelo 3D. La vista previa es gratis; el escaneo que mide de verdad se cobra con créditos.",
    href: "/taller/escaneos/nuevo",
    boton: "Escanear una pieza",
    cuenta: true,
  },
  {
    numero: "4",
    titulo: "Programa en 3, 4 y 5 ejes",
    para: "Tengo el modelo 3D",
    texto:
      "Un STL, OBJ o STEP. Configuras tu máquina y tu herramienta, ves la trayectoria con anticolisión y la remoción de material, y pides el programa para tu controlador.",
    href: "/cam/lab",
    boton: "Abrir el laboratorio",
    cuenta: false,
    nota: "Prueba gratis, pagas el programa",
  },
  {
    numero: "5",
    titulo: "Tornea con tu eje rotativo",
    para: "Quiero hacer balaustres, patas o columnas",
    texto:
      "Arma la pieza por tramos (recto, cono, bola, cintura), mira el perfil al momento y descarga el G-code para tu router con 4to eje, de Mach3 o Mach4.",
    href: "/cam/torno",
    boton: "Abrir el torno",
    cuenta: false,
  },
]

export default function LaboratorioCamIndice() {
  return (
    <main className="w-full bg-[#FAF9F6] min-h-[70vh]">
      <div className="px-4 lg:px-16 pt-6 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">
          Inicio
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Laboratorio CAM</span>
      </div>

      <section className="px-4 lg:px-16 pt-6 pb-16">
        <h1 className="text-[30px] lg:text-[40px] font-bold text-[#1B1B18] leading-[1.1] max-w-[760px]">
          ¿Por dónde empiezas?
        </h1>
        <p className="mt-3 text-[16px] text-[#4A4943] leading-relaxed max-w-[620px]">
          Cinco caminos hacia lo mismo: una pieza cortada. Elige el que se parezca a lo que
          tienes en la mano ahorita.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-[1200px]">
          {PUERTAS.map((p) => (
            <article
              key={p.numero}
              className="flex flex-col rounded-[14px] border border-[#E7E4DC] bg-white p-6"
            >
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#B34D07]">
                {p.para}
              </span>
              <h2 className="mt-2 text-[20px] font-bold text-[#1B1B18] leading-tight">{p.titulo}</h2>
              <p className="mt-3 flex-1 text-[14px] text-[#4A4943] leading-relaxed">{p.texto}</p>

              <LocalizedClientLink
                href={p.href}
                className="mt-5 inline-flex justify-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
              >
                {p.boton}
              </LocalizedClientLink>

              <p className="mt-2.5 text-[12px] text-[#6B6A63]">
                {"nota" in p && p.nota ? p.nota : p.cuenta ? "Necesitas tu cuenta" : "Sin cuenta, gratis"}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 max-w-[760px] border-t border-[#E7E4DC] pt-8">
          <h2 className="text-[18px] font-bold text-[#1B1B18]">¿Tu pieza no entra en ninguna?</h2>
          <p className="mt-2 text-[14px] text-[#4A4943] leading-relaxed">
            Maquinado en 3, 4 y 5 ejes, torno, piezas con tolerancias cerradas: eso lo
            hacemos nosotros, no una herramienta automática.{" "}
            <LocalizedClientLink
              href="/servicios/laboratorio-cam"
              className="font-semibold text-[#B34D07] underline"
            >
              Cotiza tu pieza con nosotros
            </LocalizedClientLink>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
