"use client"

// Letras 3D para impresora 3D (modo de la herramienta Letras 3D): de pie con
// base, para colgar (barrenos ocultos + plantilla de montaje en PDF) o huecas
// para LED. El motor está en lib/generador/letras3dImpresion.ts.
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Aviso, Boton, CampoNum, Etiqueta, Seccion, TarjetaExport, descargar, numero, r1 } from "@/components/hetna/estudio3d/Controles"
import { mandarAFabricar, slugArchivo } from "@/lib/generador/aCotizador"
import { FUENTES, cargarFuente } from "@/lib/generador/fuentes"
import { ESTILOS_IMPRESION, type EstiloImpresion, OPCIONES_IMPRESION_FABRICA as FABRICA, hacerLetrasImpresion } from "@/lib/generador/letras3dImpresion"
import type { Fuente } from "@/lib/generador/letreros"
import { mallaSTL, volumenMalla } from "@/lib/generador/vectores"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

type Props = { selector: React.ReactNode }

const MAX_TEXTO = 24

/** Lee de la liga ?texto=&estilo=&alto=&fuente=&profundidad= (catálogo de impresión: "modificar"). */
function deLaLiga() {
  const q = new URLSearchParams(window.location.search)
  // número positivo de la liga, dentro de lo que dejan los controles
  const n = (k: string, max: number) => {
    const v = Number(q.get(k))
    return q.get(k)?.trim() && Number.isFinite(v) && v > 0 ? String(Math.min(max, v)) : undefined
  }
  const e = q.get("estilo")
  return {
    texto: q.get("texto")?.slice(0, MAX_TEXTO) || undefined,
    estilo: ESTILOS_IMPRESION.some((x) => x.id === e) ? (e as EstiloImpresion) : undefined,
    fuente: FUENTES.some((f) => f.id === q.get("fuente")) ? q.get("fuente")! : undefined,
    alto: n("alto", 1000),
    profundidad: n("profundidad", 200),
  }
}

export function LetrasImpresion3D({ selector }: Props) {
  const { locale } = useParams<{ locale: string }>()
  const [texto, setTexto] = useState("HOLA")
  const [fuenteId, setFuenteId] = useState("alfa-slab-one")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [errorFuente, setErrorFuente] = useState("")
  const [estilo, setEstilo] = useState<EstiloImpresion>("pie")
  const [alto, setAlto] = useState("60")
  const [espaciado, setEspaciado] = useState(String(FABRICA.espaciado))
  const [profundidad, setProfundidad] = useState("12")
  const [barreno, setBarreno] = useState(String(FABRICA.barreno))
  const [pared, setPared] = useState(String(FABRICA.pared))
  const [frente, setFrente] = useState(String(FABRICA.frente))
  const [aviso, setAviso] = useState("")
  const [armandoPdf, setArmandoPdf] = useState(false)

  useEffect(() => {
    const l = deLaLiga()
    if (l.texto) setTexto(l.texto)
    if (l.estilo) setEstilo(l.estilo)
    if (l.fuente) setFuenteId(l.fuente)
    if (l.alto) setAlto(l.alto)
    if (l.profundidad) setProfundidad(l.profundidad)
  }, [])

  useEffect(() => {
    const t = FUENTES.find((f) => f.id === fuenteId) || FUENTES[0]
    let vivo = true
    setErrorFuente("")
    cargarFuente(t)
      .then((f) => vivo && setFuente(f))
      .catch(() => vivo && setErrorFuente("No se pudo cargar la tipografía. Revisa tu conexión."))
    return () => {
      vivo = false
    }
  }, [fuenteId])

  const r = useMemo(() => {
    if (!fuente) return null
    try {
      return hacerLetrasImpresion(fuente, {
        texto,
        alto: numero(alto),
        espaciado: numero(espaciado) || 0,
        profundidad: numero(profundidad),
        estilo,
        barreno: numero(barreno) || FABRICA.barreno,
        pared: numero(pared) || FABRICA.pared,
        frente: numero(frente) || FABRICA.frente,
      })
    } catch (e) {
      console.error("[letras-3d impresión]", e)
      return null
    }
  }, [fuente, texto, alto, espaciado, profundidad, estilo, barreno, pared, frente])
  const listo = !!r && !r.errores.length

  const estiloActual = ESTILOS_IMPRESION.find((e) => e.id === estilo)
  const stl = () => mallaSTL({ tris: r!.tris, avisos: [] })

  const archivo = `letras-3d-impresion-${slugArchivo(texto, "hetna")}`
  const gramos = listo ? Math.round(Math.abs(volumenMalla(r!.tris)) * 1.24 * 0.45) : 0 // PLA, ~45 % lleno (paredes + 20 % de relleno)

  const bajarPlantilla = async () => {
    if (!listo) return
    setArmandoPdf(true)
    setAviso("")
    try {
      const { plantillaMontaje } = await import("@/lib/generador/plantillaMontaje")
      const pdf = await plantillaMontaje({ letras: r!.letras, barrenos: r!.barrenos, titulo: texto })
      descargar(`${archivo}-plantilla.pdf`, new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }), "application/pdf")
    } catch {
      setAviso("No se pudo armar la plantilla. Inténtalo otra vez.")
    } finally {
      setArmandoPdf(false)
    }
  }

  const panel = (
    <div className="flex flex-col gap-4">
      {selector}
      <label className="flex flex-col gap-1.5">
        <Etiqueta>Texto</Etiqueta>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
          className="rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[16px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <Etiqueta>Tipografía</Etiqueta>
        <select
          value={fuenteId}
          onChange={(e) => setFuenteId(e.target.value)}
          className="rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        >
          {FUENTES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
      </label>

      <Seccion titulo="Cómo las quieres">
        <div className="grid grid-cols-3 gap-1.5">
          {ESTILOS_IMPRESION.map((e) => (
            <button
              key={e.id}
              type="button"
              title={e.detalle}
              onClick={() => setEstilo(e.id)}
              aria-pressed={estilo === e.id}
              className={`rounded-[8px] px-1.5 py-2 text-[11.5px] font-semibold leading-tight ${
                estilo === e.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-[#8A97AB]">{estiloActual?.detalle}</span>
      </Seccion>

      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Alto de letra (la H)" valor={alto} cambiar={setAlto} />
        <CampoNum etiqueta="Grosor" valor={profundidad} cambiar={setProfundidad} />
        <CampoNum etiqueta="Entre letras" valor={espaciado} cambiar={setEspaciado} />
        {estilo === "pared" && <CampoNum etiqueta="Barreno (cabeza del clavo)" valor={barreno} cambiar={setBarreno} />}
        {estilo === "luz" && (
          <>
            <CampoNum etiqueta="Pared" valor={pared} cambiar={setPared} />
            <CampoNum etiqueta="Frente" valor={frente} cambiar={setFrente} />
          </>
        )}
      </div>
      {listo && (
        <span className="text-[12px] text-[#F2D29B]">
          {r1(r!.ancho)} × {r1(r!.alto)} mm · {r!.piezas} {r!.piezas === 1 ? "pieza" : "piezas"} · unos {gramos} g de PLA
        </span>
      )}
      {errorFuente && <Aviso tipo="error">{errorFuente}</Aviso>}
      {r?.errores.map((e) => (
        <Aviso key={e} tipo="error">
          {e}
        </Aviso>
      ))}
      {!r && fuente && <Aviso tipo="error">No se pudo armar ese texto con esta tipografía. Prueba con otra.</Aviso>}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Escribe un texto para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <TarjetaExport
        titulo="Para tu impresora 3D (STL)"
        nota={
          estilo === "pie"
            ? "Una sola pieza: la base va en la cama. Sin soportes."
            : estilo === "pared"
              ? "Ya vienen boca abajo y en espejo: el frente va en la cama y los barrenos quedan atrás."
              : "El frente va en la cama (imprímelo en blanco o natural para que pase la luz); atrás quedan abiertas para la tira LED."
        }
      >
        <Boton tipo="primario" onClick={() => descargar(`${archivo}.stl`, stl(), "model/stl")}>
          STL
        </Boton>
      </TarjetaExport>

      {estilo === "pared" && (
        <TarjetaExport titulo="Plantilla de montaje (PDF)" nota="A tamaño real en hojas carta: pégala en la pared, clava donde está la cruz naranja y cuelga cada letra en su lugar.">
          <Boton tipo="primario" onClick={bajarPlantilla}>
            {armandoPdf ? "Armando…" : "Bajar plantilla"}
          </Boton>
        </TarjetaExport>
      )}

      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold">¿No tienes impresora?</span>
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA te las imprime y te las envía.</span>
        <Boton
          tipo="primario"
          onClick={() => {
            const ok = mandarAFabricar(`${archivo}.stl`, stl(), locale, {
              pieza: `Letras 3D "${texto}" (${estiloActual?.nombre.toLowerCase()})`,
              medidas: `${r1(r!.ancho)} × ${r1(r!.alto)} × ${r1(numero(profundidad))} mm`,
              proceso: "Impresión 3D",
            })
            if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
          }}
        >
          Pedir que me las impriman
        </Boton>
      </div>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo={texto || "Letras"}
      subtitulo="Letras 3D para impresora"
      materialInicial="naranja"
      dePie={estilo !== "pie"}
      tris={listo ? r!.trisVista : undefined}
      panel={panel}
      exportacion={exportacion}
      avisos={listo ? r!.avisos : []}
      barra={listo ? <span>· {r1(r!.ancho)} × {r1(r!.alto)} mm · {estiloActual?.nombre}</span> : null}
    />
  )
}
