"use client"

// Férulas termoformables dentro del 3D Studio: el profesional mete las medidas del
// paciente (persona o animal), elige la ventilación y las correas, y sale la pieza
// PLANA en STL para imprimir y moldear con calor. Motor: lib/generador/ferulas.ts.
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import { Aviso, Boton, CampoNum, Datos, Seccion, TarjetaExport, descargar, numero, r1 } from "@/components/hetna/estudio3d/Controles"
import { mandarAFabricar } from "@/lib/generador/aCotizador"
import { FERULAS, MEDIDAS_INICIALES, type TipoFerula, type Ventilacion, hacerFerula } from "@/lib/generador/ferulas"
import { dibujoDXF, dibujoSVG, mallaSTL } from "@/lib/generador/vectores"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

const botonSel = (activo: boolean) =>
  `rounded-[8px] px-1.5 py-2 text-[12px] font-semibold ${activo ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`

// Qué medida pide cada campo, en palabras del profesional
const ETIQUETAS: Record<TipoFerula, { circ: string[]; largos: string[] }> = {
  antebrazo: {
    circ: ["Circunferencia del antebrazo (donde termina la férula)", "Circunferencia de la muñeca", "Circunferencia de la palma (sin el pulgar)"],
    largos: ["Largo del antebrazo (de la muñeca a donde termina)", "Largo de la mano (de la muñeca a los nudillos)"],
  },
  dedo: { circ: ["Circunferencia en la base del dedo", "Circunferencia cerca de la punta"], largos: ["Largo del dedo a cubrir"] },
  pata: { circ: ["Circunferencia arriba (cerca del cuerpo)", "Circunferencia abajo"], largos: ["Largo del tramo a cubrir"] },
}

const VENTILACIONES: { id: Ventilacion; nombre: string }[] = [
  { id: "hexagonos", nombre: "Panal" },
  { id: "ovalos", nombre: "Óvalos" },
  { id: "circulos", nombre: "Círculos" },
  { id: "ninguna", nombre: "Sin huecos" },
]

export function GeneradorFerulas() {
  const { locale } = useParams<{ locale: string }>()
  const [tipo, setTipo] = useState<TipoFerula>("antebrazo")
  const [lado, setLado] = useState<"derecho" | "izquierdo">("derecho")
  const ini = MEDIDAS_INICIALES[tipo]
  const [circ, setCirc] = useState<string[]>(ini.circunferencias.map(String))
  const [largos, setLargos] = useState<string[]>(ini.largos.map(String))
  const [cobertura, setCobertura] = useState(String(ini.cobertura * 100))
  const [holgura, setHolgura] = useState("6")
  const [grosor, setGrosor] = useState("3")
  const [margen, setMargen] = useState(String(ini.margen))
  const [ventilacion, setVentilacion] = useState<Ventilacion>("hexagonos")
  const [hueco, setHueco] = useState(String(ini.hueco))
  const [puente, setPuente] = useState("3.5")
  const [correas, setCorreas] = useState(String(ini.correas))
  const [anchoCorrea, setAnchoCorrea] = useState(String(ini.anchoCorrea))
  const [aviso, setAviso] = useState("")

  // Al cambiar de tipo se cargan medidas de partida de ese tipo
  const cambiarTipo = (t: TipoFerula) => {
    const m = MEDIDAS_INICIALES[t]
    setTipo(t)
    setCirc(m.circunferencias.map(String))
    setLargos(m.largos.map(String))
    setCobertura(String(m.cobertura * 100))
    setMargen(String(m.margen))
    setHueco(String(m.hueco))
    setCorreas(String(m.correas))
    setAnchoCorrea(String(m.anchoCorrea))
  }

  const r = useMemo(
    () =>
      hacerFerula({
        tipo,
        lado,
        circunferencias: circ.map(numero),
        largos: largos.map(numero),
        cobertura: numero(cobertura) / 100,
        holgura: numero(holgura) || 0,
        grosor: numero(grosor),
        margen: numero(margen),
        ventilacion,
        hueco: numero(hueco),
        puente: numero(puente),
        correas: Math.max(0, Math.min(6, Math.round(numero(correas) || 0))),
        anchoCorrea: numero(anchoCorrea) || 20,
      }),
    [tipo, lado, circ, largos, cobertura, holgura, grosor, margen, ventilacion, hueco, puente, correas, anchoCorrea]
  )
  const listo = !r.errores.length && r.malla.tris.length > 0
  const nombreTipo = FERULAS.find((f) => f.id === tipo)?.nombre || "Férula"
  const archivo = `ferula-${tipo}${tipo === "antebrazo" ? `-${lado}` : ""}`
  const medidas = listo ? `${r1(r.largo)} × ${r1(r.ancho)} × ${r1(numero(grosor))} mm` : ""
  const vista2d = useMemo(() => (listo ? dibujoSVG(r.dibujo, "vista") : ""), [r, listo])

  const panel = (
    <div className="flex flex-col gap-4">
      <Aviso>
        Para uso bajo indicación de un profesional de la salud o de un veterinario. No sustituye la valoración médica ni sirve para inmovilizar una
        fractura sin supervisión.
      </Aviso>
      <Seccion titulo="Tipo de férula">
        <div className="grid grid-cols-3 gap-1.5">
          {FERULAS.map((f) => (
            <button key={f.id} type="button" onClick={() => cambiarTipo(f.id)} aria-pressed={tipo === f.id} title={f.detalle} className={botonSel(tipo === f.id)}>
              {f.nombre}
            </button>
          ))}
        </div>
        {tipo === "antebrazo" && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {(["derecho", "izquierdo"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLado(l)} aria-pressed={lado === l} className={botonSel(lado === l)}>
                Brazo {l}
              </button>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Medidas del paciente (mm)" nota="Mide con cinta métrica sobre la piel, en la postura en que se va a moldear.">
        <div className="grid grid-cols-1 gap-2">
          {ETIQUETAS[tipo].circ.map((et, i) => (
            <CampoNum key={`c${tipo}${i}`} etiqueta={et} valor={circ[i] ?? ""} cambiar={(v: string) => setCirc((a) => a.map((x, k) => (k === i ? v : x)))} />
          ))}
          {ETIQUETAS[tipo].largos.map((et, i) => (
            <CampoNum key={`l${tipo}${i}`} etiqueta={et} valor={largos[i] ?? ""} cambiar={(v: string) => setLargos((a) => a.map((x, k) => (k === i ? v : x)))} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Ajuste" nota="La cobertura es qué parte de la vuelta cubre: abierta para poder ponerla y quitarla. La holgura deja lugar al acolchado o la venda.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Cobertura (%)" valor={cobertura} cambiar={setCobertura} />
          <CampoNum etiqueta="Holgura (mm)" valor={holgura} cambiar={setHolgura} />
          <CampoNum etiqueta="Grosor (mm)" valor={grosor} cambiar={setGrosor} />
          <CampoNum etiqueta="Borde sólido (mm)" valor={margen} cambiar={setMargen} />
        </div>
      </Seccion>

      <Seccion titulo="Ventilación">
        <div className="grid grid-cols-4 gap-1.5">
          {VENTILACIONES.map((v) => (
            <button key={v.id} type="button" onClick={() => setVentilacion(v.id)} aria-pressed={ventilacion === v.id} className={botonSel(ventilacion === v.id)}>
              {v.nombre}
            </button>
          ))}
        </div>
        {ventilacion !== "ninguna" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Tamaño del hueco" valor={hueco} cambiar={setHueco} />
            <CampoNum etiqueta="Separación" valor={puente} cambiar={setPuente} />
          </div>
        )}
      </Seccion>

      <Seccion titulo="Correas de velcro" nota="Ranuras a los dos lados para pasar la correa.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Cuántas correas" valor={correas} cambiar={setCorreas} />
          <CampoNum etiqueta="Ancho del velcro (mm)" valor={anchoCorrea} cambiar={setAnchoCorrea} />
        </div>
      </Seccion>

      {r.errores.map((e) => (
        <Aviso key={e} tipo="error">
          {e}
        </Aviso>
      ))}
      {listo && r.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
    </div>
  )

  const diseno2d = (
    <div className="flex h-full flex-col gap-3 p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#8A97AB]">Revisa las medidas.</p>
      ) : (
        <>
          <Datos
            filas={[
              ["Pieza plana", medidas],
              ["Ventilación", ventilacion === "ninguna" ? "Sin huecos" : `${r.huecos} huecos`],
              ["Correas", `${r.correas} de ${r1(numero(anchoCorrea))} mm`],
              ...(tipo === "antebrazo" ? ([["Pulgar", `Brazo ${lado}`]] as [string, string][]) : []),
            ]}
          />
          <div
            className="flex min-h-[300px] flex-1 items-center justify-center rounded-[10px] bg-[#0F151E] p-6 [&>svg]:max-h-[460px] [&>svg]:w-full [&>svg]:max-w-[560px]"
            dangerouslySetInnerHTML={{ __html: vista2d }}
          />
          <p className="m-0 text-[12.5px] text-[#8A97AB]">La pieza plana, vista desde el lado que toca la piel. El extremo de abajo va hacia el cuerpo.</p>
        </>
      )}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Revisa las medidas para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold">Archivos</h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">En milímetros. La férula se imprime plana y se moldea con calor.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport titulo="Para impresión 3D" nota="PLA o PETG, plana sobre la cama, sin soportes; 3 o 4 perímetros y 30 % de relleno o más.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${archivo}.stl`, mallaSTL(r.malla), "model/stl")}>
              STL
            </Boton>
          </div>
        </TarjetaExport>
        <TarjetaExport titulo="Plantilla de corte" nota="Para cortar en láser una placa termoplástica, o imprimirla en papel y probar la medida antes.">
          <div className="flex gap-2">
            <Boton onClick={() => descargar(`${archivo}.svg`, dibujoSVG(r.dibujo), "image/svg+xml")}>SVG</Boton>
            <Boton onClick={() => descargar(`${archivo}.dxf`, dibujoDXF(r.dibujo), "application/dxf")}>DXF</Boton>
          </div>
        </TarjetaExport>
      </div>
      <Aviso>
        Cómo se moldea: se calienta la pieza en agua caliente o con pistola de calor hasta que se ablande (el PLA se ablanda alrededor de 60 °C), se
        deja enfriar unos segundos para no quemar y se moldea sobre una media o venda tubular, en la postura indicada. Al enfriarse queda rígida. Lo
        debe hacer o supervisar el profesional que indicó la férula.
      </Aviso>
      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold">¿No tienes impresora 3D?</span>
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA la imprime y te la envía lista para moldear.</span>
        <div className="flex gap-2">
          <Boton
            tipo="primario"
            onClick={() => {
              const ok = mandarAFabricar(`${archivo}.stl`, mallaSTL(r.malla), locale, {
                pieza: `Férula termoformable · ${nombreTipo}${tipo === "antebrazo" ? ` (brazo ${lado})` : ""}`,
                medidas,
                material: "PLA o PETG",
                proceso: "Impresión 3D",
              })
              if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
            }}
          >
            Imprimir en 3D
          </Boton>
        </div>
      </div>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo={nombreTipo}
      subtitulo="Férulas termoformables"
      materialInicial="naranja"
      tris={listo ? r.malla.tris : undefined}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      barra={listo ? <span>· {medidas}</span> : null}
    />
  )
}
