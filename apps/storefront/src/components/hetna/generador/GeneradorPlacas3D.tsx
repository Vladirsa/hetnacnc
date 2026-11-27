"use client"

// Etiquetas en braille y etiquetas para cajas organizadoras (módulo "Llaveros y
// placas" del 3D Studio). El motor está en lib/generador/placas3d.ts.
import { T } from "@/components/hetna/i18n/Idioma"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { strToU8, zipSync } from "fflate"

import { Aviso, Boton, CampoNum, Etiqueta, Interruptor, Seccion, TarjetaExport, descargar, numero, r1 } from "@/components/hetna/estudio3d/Controles"
import { mandarAFabricar, slugArchivo } from "@/lib/generador/aCotizador"
import { FUENTES } from "@/lib/generador/fuentes"
import { MEDIDAS_ETIQUETA, OPCIONES_BRAILLE_FABRICA as BRAILLE, OPCIONES_ETIQUETA_FABRICA as ETIQUETA, hacerBraille, hacerEtiqueta, type ResultadoPlaca } from "@/lib/generador/placas3d"
import { ICONOS_TEXTURA, type IconoTextura } from "@/lib/generador/texturizador"
import { dibujoDXF, mallaSTL } from "@/lib/generador/vectores"

import { PanelColores, TarjetaColores, useMulticolor } from "./Multicolor"
import { useFuente } from "./useFuente"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

export type ModoPlaca = "braille" | "etiqueta"
const MAX_ETIQUETAS = 60

const campo = "rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[15px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"

export function GeneradorPlacas3D({ modo, cabecera }: { modo: ModoPlaca; cabecera: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>()
  const braille = modo === "braille"
  const [texto, setTexto] = useState(braille ? "Baño\nHombres" : "Tornillos M3\nTuercas M3\nRondanas")
  const [fuenteId, setFuenteId] = useState("montserrat")
  const { fuente, error: errorFuente } = useFuente(fuenteId)
  // braille
  const [visible, setVisible] = useState(BRAILLE.textoVisible)
  const [punto, setPunto] = useState(String(BRAILLE.punto))
  const [altoPunto, setAltoPunto] = useState(String(BRAILLE.altoPunto))
  const [barrenos, setBarrenos] = useState(BRAILLE.barrenos)
  // etiqueta
  const [ancho, setAncho] = useState(String(ETIQUETA.ancho))
  const [alto, setAlto] = useState(String(ETIQUETA.alto))
  const [icono, setIcono] = useState<IconoTextura | "">("")
  const [grosor, setGrosor] = useState(String(braille ? BRAILLE.grosor : ETIQUETA.grosor))
  const [aviso, setAviso] = useState("")

  // braille: una placa con todos los renglones; etiquetas: una por renglón
  const lista = useMemo(() => texto.replace(/\r/g, "").split("\n").map((t) => t.trim()).filter(Boolean).slice(0, MAX_ETIQUETAS), [texto])
  const hacer = (t: string): ResultadoPlaca | null => {
    try {
      if (braille) return hacerBraille(fuente, { texto: t, textoVisible: visible, punto: numero(punto) || BRAILLE.punto, altoPunto: numero(altoPunto) || BRAILLE.altoPunto, grosor: numero(grosor) || BRAILLE.grosor, barrenos })
      if (!fuente) return null
      return hacerEtiqueta(fuente, { ...ETIQUETA, texto: t, ancho: numero(ancho), alto: numero(alto), grosor: numero(grosor) || ETIQUETA.grosor, icono })
    } catch {
      return null
    }
  }
  const r = useMemo(() => hacer(braille ? lista.join("\n") : lista[0] || ""), [braille, lista, fuente, visible, punto, altoPunto, grosor, barrenos, ancho, alto, icono]) // eslint-disable-line react-hooks/exhaustive-deps
  const listo = !!r && !r.errores.length
  const mc = useMulticolor(listo ? r!.malla : null)
  const archivo = `${braille ? "braille" : "etiqueta"}-hetna-${slugArchivo(lista[0] || "texto", "texto")}`

  const bajarTodas = () => {
    const z: Record<string, Uint8Array> = {}
    lista.forEach((t, i) => {
      const x = hacer(t)
      if (x && !x.errores.length) z[`${String(i + 1).padStart(2, "0")}-${slugArchivo(t, "etiqueta")}.stl`] = new Uint8Array(mallaSTL(x.malla))
    })
    z["LEEME.txt"] = strToU8("Etiquetas de HETNA: un STL por etiqueta. Imprímelas acostadas, con el texto hacia arriba.\r\n")
    descargar(`${archivo}-${lista.length}.zip`, new Blob([zipSync(z) as BlobPart], { type: "application/zip" }), "application/zip")
  }

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <label className="flex flex-col gap-1.5">
        <Etiqueta><T>{braille ? "Texto (un renglón por línea, hasta 6)" : `Etiquetas (una por línea, hasta ${MAX_ETIQUETAS})`}</T></Etiqueta>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 2000))} rows={braille ? 3 : 5} className={campo} />
      </label>
      {braille ? (
        <>
          <Interruptor etiqueta="Texto en letras arriba (para quien ve)" activo={visible} cambiar={setVisible} />
          <Interruptor etiqueta="Dos barrenos para atornillar" activo={barrenos} cambiar={setBarrenos} />
          <div className="grid grid-cols-3 gap-2">
            <CampoNum etiqueta="Punto Ø" valor={punto} cambiar={setPunto} />
            <CampoNum etiqueta="Alto del punto" valor={altoPunto} cambiar={setAltoPunto} />
            <CampoNum etiqueta="Placa" valor={grosor} cambiar={setGrosor} />
          </div>
          <span className="text-[11.5px] text-[#8A97AB]">Braille español: signo de mayúscula, de número, acentos y ñ. Medidas estándar de los puntos (2.5 mm entre puntos, 6 mm entre letras).</span>
        </>
      ) : (
        <>
          <Seccion titulo="Medida">
            <div className="grid grid-cols-2 gap-1.5">
              {MEDIDAS_ETIQUETA.map((m) => (
                <button key={m.id} type="button" onClick={() => (setAncho(String(m.ancho)), setAlto(String(m.alto)))} className="rounded-[8px] bg-[#1C2431] px-2 py-1.5 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
                  {m.nombre}
                </button>
              ))}
            </div>
          </Seccion>
          <div className="grid grid-cols-3 gap-2">
            <CampoNum etiqueta="Ancho" valor={ancho} cambiar={setAncho} />
            <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} />
            <CampoNum etiqueta="Grosor" valor={grosor} cambiar={setGrosor} />
          </div>
          <Seccion titulo="Ícono">
            <select value={icono} onChange={(e) => setIcono(e.target.value as IconoTextura | "")} className={campo}>
              <option value="">Sin ícono</option>
              {ICONOS_TEXTURA.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </Seccion>
        </>
      )}
      {(!braille || visible) && (
        <label className="flex flex-col gap-1.5">
          <Etiqueta>Tipografía</Etiqueta>
          <select value={fuenteId} onChange={(e) => setFuenteId(e.target.value)} className={campo}>
            {FUENTES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <PanelColores mc={mc} />
      {errorFuente && <Aviso tipo="error">No se pudo cargar la tipografía. Revisa tu conexión.</Aviso>}
      {r?.errores.map((e) => (
        <Aviso key={e} tipo="error">
          {e}
        </Aviso>
      ))}
      {listo && r!.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Escribe el texto para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <TarjetaExport titulo="Para tu impresora 3D (STL)" nota={braille ? "Imprímela acostada, con los puntos hacia arriba; capas de 0.12 mm para que los puntos salgan redondos." : "Imprímela acostada, con el texto hacia arriba."}>
        <div className="flex gap-2">
          <Boton tipo="primario" onClick={() => descargar(`${archivo}.stl`, mallaSTL(r!.malla), "model/stl")}>
            STL
          </Boton>
          {!braille && lista.length > 1 && <Boton onClick={bajarTodas}>Las {lista.length} en un ZIP</Boton>}
        </div>
      </TarjetaExport>
      <TarjetaColores mc={mc} archivo={archivo} titulo={lista[0] || "Etiqueta"} nota={braille ? "La placa de un color y los puntos de otro (ayuda a quien ve poco)." : "La placa de un color y el texto de otro."} />
      {!braille && (
        <TarjetaExport titulo="Para láser (DXF)" nota="La placa en la capa CORTE y el texto en GRABADO.">
          <Boton onClick={() => descargar(`${archivo}.dxf`, dibujoDXF(r!.dibujo), "application/dxf")}>DXF</Boton>
        </TarjetaExport>
      )}
      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold">¿No tienes impresora?</span>
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA te la imprime y te la envía.</span>
        <Boton
          tipo="primario"
          onClick={() => {
            const ok = mandarAFabricar(`${archivo}.stl`, mallaSTL(r!.malla), locale, {
              pieza: braille ? `Placa en braille "${lista.join(" / ")}"` : `${lista.length} ${lista.length === 1 ? "etiqueta" : "etiquetas"} (${lista.slice(0, 3).join(", ")}${lista.length > 3 ? "…" : ""})`,
              medidas: `${r1(r!.ancho)} × ${r1(r!.alto)} mm`,
              proceso: "Impresión 3D",
            })
            if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
          }}
        >
          Pedir que me la impriman
        </Boton>
      </div>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo={lista[0] || (braille ? "Braille" : "Etiqueta")}
      subtitulo={braille ? "Etiquetas en braille" : "Etiquetas para cajas"}
      materialInicial="naranja"
      tris={listo ? r!.malla.tris : undefined}
      colores={mc.vista}
      panel={panel}
      exportacion={exportacion}
      avisos={[]}
      barra={listo ? <span>· {r1(r!.ancho)} × {r1(r!.alto)} mm</span> : null}
    />
  )
}
