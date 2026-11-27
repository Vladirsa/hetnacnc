"use client"

// Costillas desde imagen (Muebles): sube una imagen y sale una pared
// paramétrica o una banca hecha de tablas paralelas cuyo canto sigue la
// imagen, con ranuras o varillas para armar y las piezas numeradas en hojas.
// El motor está en lib/generador/costillas.ts. La imagen no sale del navegador
// (salvo si se pide la profundidad con IA, que se calcula en el servidor de HETNA).
import { T } from "@/components/hetna/i18n/Idioma"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"

import { CampoNum, Interruptor, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { contextoMDF, precioMDF } from "@/lib/generador/aCotizador"
import { largoCorte } from "@/lib/generador/geo2d"
import { type Alturas, INICIO_COSTILLAS, type ModoCostillas, hacerCostillas } from "@/lib/generador/costillas"
import { type Profundidad, grisDeProfundidad, iaDisponible, pedirProfundidad } from "@/lib/generador/profundidad-ia"
import { desenfocar, gris } from "@/lib/generador/trazado"

import { trisCostillas } from "./costillas3d"
import { useImagenSubida } from "./useImagenSubida"
import { Visor3D } from "./Visor3D"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })

const LADO_IMAGEN = 600

const INICIO = INICIO_COSTILLAS

export function GeneradorCostillas({ cabecera }: { cabecera?: React.ReactNode }) {
  const [modo, setModo] = useState<ModoCostillas>("pared")
  const [largo, setLargo] = useState(String(INICIO.pared.largo))
  const [alto, setAlto] = useState(String(INICIO.pared.alto))
  const [fondo, setFondo] = useState(String(INICIO.pared.fondo))
  const [relieve, setRelieve] = useState(String(INICIO.pared.relieve))
  const [espesor, setEspesor] = useState("18")
  const [separacion, setSeparacion] = useState("22")
  const [fresa, setFresa] = useState("6.35")
  const [holgura, setHolgura] = useState("0.3")
  const [travesanos, setTravesanos] = useState("2")
  const [anchoTravesano, setAnchoTravesano] = useState("60")
  const [grosorAsiento, setGrosorAsiento] = useState("60")
  const [pata, setPata] = useState("70")
  const [varilla, setVarilla] = useState("10")
  const [hojaAncho, setHojaAncho] = useState("1220")
  const [hojaAlto, setHojaAlto] = useState("2440")
  const [numerar, setNumerar] = useState(true)
  const [invertir, setInvertir] = useState(false)
  const [altura, setAltura] = useState<"brillo" | "ia">("brillo")
  const [iaLista, setIaLista] = useState(false)
  const [prof, setProf] = useState<{ url: string; p: Profundidad } | null>(null)
  const [estadoIA, setEstadoIA] = useState<"" | "cargando" | "error">("")
  const [errorIA, setErrorIA] = useState("")
  const [intentoIA, setIntentoIA] = useState(0)

  const { subida, error, abrir } = useImagenSubida(LADO_IMAGEN)

  useEffect(() => {
    iaDisponible().then(setIaLista)
  }, [])

  const cambiarModo = (m: ModoCostillas) => {
    setModo(m)
    setLargo(String(INICIO[m].largo))
    setAlto(String(INICIO[m].alto))
    setFondo(String(INICIO[m].fondo))
    setRelieve(String(INICIO[m].relieve))
  }

  // Con la IA prendida se pide la profundidad una vez por imagen
  useEffect(() => {
    if (altura !== "ia" || !subida || prof?.url === subida.url) return
    const control = new AbortController()
    setEstadoIA("cargando")
    setErrorIA("")
    pedirProfundidad(subida.img, control.signal)
      .then((p) => {
        setProf({ url: subida.url, p })
        setEstadoIA("")
      })
      .catch((e: Error) => {
        if (control.signal.aborted) return
        setEstadoIA("error")
        setErrorIA(e.message)
      })
    return () => control.abort()
  }, [altura, subida, intentoIA]) // eslint-disable-line react-hooks/exhaustive-deps

  // La imagen como alturas 0–1 (claro = alto, salvo que se invierta)
  const alturas = useMemo<Alturas | null>(() => {
    if (!subida) return null
    const { im } = subida
    let g: Float32Array
    if (altura === "ia") {
      if (prof?.url !== subida.url) return null // se espera a la IA
      g = grisDeProfundidad(prof.p, im.width, im.height)
    } else g = Float32Array.from(desenfocar(gris(im), im.width, im.height))
    const datos = new Float32Array(g.length)
    for (let i = 0; i < g.length; i++) datos[i] = invertir ? 1 - g[i] / 255 : g[i] / 255
    return { datos, ancho: im.width, alto: im.height }
  }, [subida, altura, prof, invertir])

  const opciones = {
    modo,
    largo: numero(largo),
    alto: numero(alto),
    fondo: numero(fondo),
    relieve: numero(relieve),
    espesor: numero(espesor),
    separacion: numero(separacion),
    fresa: numero(fresa),
    holgura: numero(holgura),
    travesanos: numero(travesanos),
    anchoTravesano: numero(anchoTravesano),
    grosorAsiento: numero(grosorAsiento),
    pata: numero(pata),
    varilla: numero(varilla),
    hoja: { ancho: numero(hojaAncho), alto: numero(hojaAlto) },
    numerar,
  }
  // Los campos responden al instante; el mueble se recalcula sin trabar la página
  const clave = JSON.stringify(opciones)
  const claveDiferida = useDeferredValue(clave)
  const alturasDiferidas = useDeferredValue(alturas)
  const r = useMemo(() => (alturasDiferidas ? hacerCostillas(alturasDiferidas, JSON.parse(claveDiferida)) : null), [alturasDiferidas, claveDiferida])
  const tris = useMemo(() => (r ? trisCostillas(r.piezas3D, r.espesor) : []), [r])

  const banca = modo === "banca"
  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="1. Qué vas a hacer">
        <Opciones<ModoCostillas>
          valor={modo}
          cambiar={cambiarModo}
          opciones={[
            { id: "pared", nombre: "Pared o cabecera" },
            { id: "banca", nombre: "Banca o mesa" },
          ]}
        />
      </Seccion>
      <Seccion
        titulo="2. Tu imagen"
        nota={
          banca
            ? "La imagen se ve desde arriba, sobre el asiento: lo claro sube. El frente de la banca es la parte de abajo de la imagen."
            : "La imagen se ve de frente: lo claro sale hacia ti. Olas, montañas, degradados y logotipos con volumen salen muy bien."
        }
      >
        <label className="flex cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-[#2A3546] px-3 py-4 text-center text-[13px] text-[#C9D2E0] hover:border-[#C2560A]">
          <T>{subida ? "Cambiar imagen" : "Subir imagen (JPG, PNG o WEBP)"}</T>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
        </label>
        {error && <p className="mt-2 text-[12.5px] text-[#F28A3C]">{error}</p>}
        {subida && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={subida.url} alt="Tu imagen" className="mt-2 max-h-40 w-full rounded-[8px] object-contain" />
        )}
        {iaLista && (
          <div className="mt-2">
            <Opciones<"brillo" | "ia">
              valor={altura}
              cambiar={setAltura}
              opciones={[
                { id: "brillo", nombre: "Por brillo" },
                { id: "ia", nombre: "✨ Profundidad con IA" },
              ]}
            />
            <p className="mt-1 text-[12px] text-[#8A97AB]">
              <T>{altura === "ia" ? "Para caras, mascotas y objetos: la IA calcula qué está cerca y qué lejos (la foto se procesa en el servidor de HETNA y no se guarda)." : "Lo claro sube y lo oscuro baja."}</T>
            </p>
            {altura === "ia" && estadoIA === "cargando" && <p className="text-[12.5px] text-[#F28A3C]"><T>La IA está calculando la profundidad… (unos segundos)</T></p>}
            {altura === "ia" && estadoIA === "error" && (
              <p className="text-[12.5px] text-[#F28A3C]">
                {errorIA}<T>{" "}</T>
                <button type="button" className="underline" onClick={() => setIntentoIA((n) => n + 1)}>
                  <T>Reintentar</T>
                </button>
              </p>
            )}
          </div>
        )}
        <Interruptor etiqueta="Invertir (lo oscuro sube)" activo={invertir} cambiar={setInvertir} />
      </Seccion>
      <Seccion titulo="3. Medidas">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta={banca ? "Largo" : "Ancho"} valor={largo} cambiar={setLargo} />
          <CampoNum etiqueta={banca ? "Altura del asiento" : "Alto"} valor={alto} cambiar={setAlto} />
          <CampoNum etiqueta={banca ? "Fondo" : "Fondo fijo (atrás)"} valor={fondo} cambiar={setFondo} />
          <CampoNum etiqueta="Relieve" valor={relieve} cambiar={setRelieve} />
        </div>
        <p className="mt-1 text-[12px] text-[#8A97AB]">
          <T>{banca ? "El relieve es cuánto baja el asiento en lo más oscuro de la imagen." : "El relieve es cuánto sale lo más claro sobre el fondo fijo."}</T>
        </p>
      </Seccion>
      <Seccion titulo="4. Material y corte" nota="Fresa 0 = láser. Con fresa, las ranuras llevan alivio en las esquinas para que entren.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Espesor" valor={espesor} cambiar={setEspesor} />
          <CampoNum etiqueta="Aire entre costillas" valor={separacion} cambiar={setSeparacion} />
          <CampoNum etiqueta="Fresa" valor={fresa} cambiar={setFresa} />
          <CampoNum etiqueta="Holgura de ranura" valor={holgura} cambiar={setHolgura} />
        </div>
      </Seccion>
      <Seccion
        titulo={banca ? "5. Patas y varillas" : "5. Travesaños de atrás"}
        nota={
          banca
            ? "Las varillas roscadas pasan por todas las costillas; entre cada par va un separador (tubo o rondana) del largo del aire."
            : "Los travesaños se ensamblan a media madera atrás de las costillas y se atornillan a la pared."
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {banca ? (
            <>
              <CampoNum etiqueta="Grosor del asiento" valor={grosorAsiento} cambiar={setGrosorAsiento} />
              <CampoNum etiqueta="Ancho de pata" valor={pata} cambiar={setPata} />
              <CampoNum etiqueta="Varilla (0 = sin)" valor={varilla} cambiar={setVarilla} />
            </>
          ) : (
            <>
              <CampoNum etiqueta="Cuántos" valor={travesanos} cambiar={setTravesanos} sufijo="" />
              <CampoNum etiqueta="Ancho" valor={anchoTravesano} cambiar={setAnchoTravesano} />
            </>
          )}
        </div>
      </Seccion>
      <Seccion titulo="6. Hoja">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Ancho" valor={hojaAncho} cambiar={setHojaAncho} />
          <CampoNum etiqueta="Alto" valor={hojaAlto} cambiar={setHojaAlto} />
        </div>
        <Interruptor etiqueta="Numerar las piezas (grabado)" activo={numerar} cambiar={setNumerar} />
      </Seccion>
    </div>
  )

  const datos: [string, string][] = []
  if (r) {
    datos.push(["Costillas", `${r.costillas} (cada ${Math.round(r.paso * 10) / 10} mm)`], ["Piezas", String(r.piezas)], ["Hojas", String(r.hojas)])
    if (!banca) datos.push(["Travesaños", String(r.travesanos)])
    else if (r.varillas) datos.push(["Varillas", `${r.varillas} de ${r.largoVarilla} mm`], ["Separadores", `${r.separadores} de ${Math.round(r.separacionReal * 10) / 10} mm`])
  }
  // Precio aproximado: por hoja de material (lo que se compra), con el corte y
  // las perforaciones repartidos; 10 mm menos por lado, que el estimador deja de orilla
  const maquina = r && r.fresa > 0 ? "router" : "laser"
  const corte = useMemo(() => (r ? r.dibujo.trazos.filter((t) => t.capa === "corte") : []), [r])
  const pedidoPrecio =
    r && r.hojas > 0
      ? {
          ...precioMDF(maquina, r.espesor),
          anchoMm: r.hoja.ancho - 20,
          largoMm: r.hoja.alto - 20,
          cantidad: r.hojas,
          unidad: "hojas" as const,
          corte_mm: largoCorte(corte) / r.hojas,
          perforaciones: Math.round(corte.length / r.hojas),
        }
      : undefined
  const m = r?.medidas
  const medida = m ? `${Math.round(m.largo)}x${Math.round(m.fondo)}x${Math.round(m.alto)}` : ""
  const nombrePieza = banca ? "Banca de costillas" : "Pared de costillas"
  return (
    <Estudio2D
      titulo="Costillas desde imagen"
      acento="2D"
      subtitulo="Pared paramétrica o banca de tablas que siguen tu imagen"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20V8c0-2 1-3 2-3s2 1 2 3v12M10 20V5c0-1 1-2 2-2s2 1 2 2v15M16 20V9c0-2 1-3 2-3s2 1 2 3v11" />
        </svg>
      }
      panel={
        <>
          {cabecera}
          {panel}
        </>
      }
      vista3D={
        r ? (
          <Visor3D oscuro alto="h-full min-h-[260px]">
            <Malla3D oscuro tris={tris} color={0xd8b98e} />
          </Visor3D>
        ) : undefined
      }
      sinAcomodo
      dibujo={r?.dibujo ?? null}
      avisos={r?.avisos ?? []}
      archivo={`costillas-${modo}-${subida?.nombre || "imagen"}-${medida}`}
      pieza={m ? `${nombrePieza} ${medida} mm, ${r.costillas} costillas de ${r.espesor} mm` : nombrePieza}
      material={r ? `MDF o triplay de ${r.espesor} mm` : undefined}
      precio={pedidoPrecio}
      cotizar={r ? { ...contextoMDF(maquina, r.espesor), nota: `${nombrePieza}: ${r.costillas} costillas, ${r.piezas} piezas en ${r.hojas} hojas.` } : undefined}
      datos={datos}
      vacio={
        <p className="text-center text-[14px] text-[#8A97AB]">
          <T>{subida && altura === "ia"
            ? estadoIA === "error"
              ? "No se pudo calcular la profundidad con IA: reintenta o usa «Por brillo»."
              : "La IA está calculando la profundidad…"
            : `Sube una imagen y aquí aparece tu ${banca ? "banca" : "pared"} de costillas, en 3D y lista para cortar.`}</T>
        </p>
      }
    />
  )
}
