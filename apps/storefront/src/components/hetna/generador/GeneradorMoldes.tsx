"use client"

// Generador de moldes (hetnacnc.com/mx/disenar/moldes-3d): sube tu pieza en
// STL, OBJ o STEP y sale el molde para vaciar silicona, resina, yeso,
// concreto, jabón o velas: de dos partes (con llaves, bebedero y
// respiraderos), abierto, o la caja para colar silicona. El motor está en
// lib/generador/moldes.ts. Tu archivo no sale del navegador.
import { T } from "@/components/hetna/i18n/Idioma"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import { MandarDisenoCorreo } from "@/components/hetna/estudio/MandarDisenoCorreo"
import { BotonesCam } from "@/components/hetna/generador/BotonesCam"
import { SIN_ATORAR } from "@/lib/generador/desmoldeo"
import { mandarArchivosAFabricar, mandarPaqueteACotizador } from "@/lib/generador/aCotizador"
import { type Arriba, OPCIONES_MOLDE, type ResultadoMolde, type TipoMolde, hacerMolde, volteada } from "@/lib/generador/moldes"
import { leerOBJ, leerSTL, mallaSTL, type Malla } from "@/lib/generador/vectores"

const Vista = dynamic(() => import("./Partir3DVista"), { ssr: false, loading: () => <div className="h-[460px] w-full rounded-[12px] bg-[#0F151E]" /> })

const LIMITE = 60 * 1024 * 1024
const numero = (s: string) => parseFloat((s || "").replace(",", "."))

const TIPOS: { id: TipoMolde; nombre: string; nota: string }[] = [
  { id: "dos_partes", nombre: "Molde de 2 partes", nota: "Para piezas con volumen por todos lados (figuras, perillas, piezas mecánicas). Se cierra con pinzas, se vacía por el bebedero y se abre en dos." },
  { id: "abierto", nombre: "Molde abierto", nota: "Una sola pieza, abierta por arriba: jabones, velas, posavasos. Con núcleo, macetas y vasos huecos con drenaje. La cara de arriba de tu pieza queda al aire." },
  { id: "caja_silicona", nombre: "Caja para silicona", nota: "La caja con tu pieza pegada al piso: la imprimes, vacías silicona y te queda un molde flexible para hacer muchas copias." },
]
const ARRIBAS: { id: Arriba; nombre: string }[] = [
  { id: "z", nombre: "Como viene" },
  { id: "-z", nombre: "Boca abajo" },
  { id: "-y", nombre: "Frente arriba" },
  { id: "y", nombre: "Atrás arriba" },
  { id: "x", nombre: "Lado der. arriba" },
  { id: "-x", nombre: "Lado izq. arriba" },
]

function descargar(nombre: string, contenido: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const Opcion = ({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-[8px] border px-3 py-2 text-[13px] font-semibold ${activa ? "border-[#142033] bg-[#142033] text-white" : "border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#C2560A]"}`}
  >
    {children}
  </button>
)

const Numero = ({ etiqueta, valor, cambiar, sufijo = "mm" }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string }) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="text-[12px] font-semibold text-[#6B6A63]"><T>{etiqueta}</T></span>
    <span className="flex items-center rounded-[10px] border border-[#E7E4DC] bg-white focus-within:border-[#C2560A]">
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 bg-transparent px-2.5 py-2 text-[15px] text-[#1B1B18] outline-none" />
      <span className="pr-2.5 text-[12px] text-[#9A978C]"><T>{sufijo}</T></span>
    </span>
  </label>
)

const Casilla = ({ etiqueta, activa, cambiar }: { etiqueta: string; activa: boolean; cambiar: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 text-[13.5px] text-[#1B1B18]">
    <input type="checkbox" checked={activa} onChange={(e) => cambiar(e.target.checked)} className="h-4 w-4 accent-[#C2560A]" />
    <T>{etiqueta}</T>
  </label>
)

export function GeneradorMoldes() {
  const { locale } = useParams<{ locale: string }>()
  const [nombre, setNombre] = useState("")
  const [malla, setMalla] = useState<Malla | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [cargando, setCargando] = useState("")
  const [tipo, setTipo] = useState<TipoMolde>("dos_partes")
  const [arriba, setArriba] = useState<Arriba>("z")
  const [pared, setPared] = useState("10")
  const [particion, setParticion] = useState(50)
  const [llaves, setLlaves] = useState(true)
  const [diametroLlave, setDiametroLlave] = useState("8")
  const [bebedero, setBebedero] = useState(true)
  const [diametroBebedero, setDiametroBebedero] = useState("8")
  const [respiraderos, setRespiraderos] = useState("2")
  const [espacio, setEspacio] = useState("10")
  const [orejas, setOrejas] = useState(true)
  const [hueco, setHueco] = useState(false)
  const [grosorHueco, setGrosorHueco] = useState("8")
  const [drenaje, setDrenaje] = useState(true)
  const [diametroDrenaje, setDiametroDrenaje] = useState("10")
  const [res, setRes] = useState<ResultadoMolde | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [separar, setSeparar] = useState(25)
  const turno = useRef(0)
  const turnoArchivo = useRef(0)
  const arribaElegido = useRef(false)

  const cambiarTipo = (t: TipoMolde) => {
    setTipo(t)
    // la caja de silicona lleva paredes delgadas; los moldes, gruesas
    setPared(t === "caja_silicona" ? "3" : "10")
    // el molde abierto se llena por arriba: la cara plana de la pieza (casi
    // siempre la base) tiene que quedar arriba. Sólo si la persona no eligió ya.
    if (!arribaElegido.current) setArriba(t === "abierto" && !hueco ? "-z" : "z")
  }

  const abrir = async (f: File | undefined) => {
    setError("")
    setAviso("")
    if (!f) return
    const mio = ++turnoArchivo.current
    arribaElegido.current = false // pieza nueva: vuelve la orientación sugerida por tipo
    if (f.size > LIMITE) return setError("El archivo pesa más de 60 MB.")
    const ext = (f.name.split(".").pop() || "").toLowerCase()
    setCargando(ext === "step" || ext === "stp" ? "Abriendo el STEP con el motor CAD (la primera vez baja ~23 MB)..." : "Leyendo archivo...")
    try {
      let m: Malla
      if (ext === "stl") m = leerSTL(await f.arrayBuffer())
      else if (ext === "obj") m = leerOBJ(await f.text())
      else if (ext === "step" || ext === "stp") m = (await (await import("@/lib/generador/step")).leerSTEP(f, "normal")).malla
      else return setError("Formato no compatible. Sube un STL, OBJ o STEP.")
      if (mio !== turnoArchivo.current) return // ya subieron otro
      if (m.tris.length < 36) return setError("El archivo no trae un modelo 3D.")
      setNombre(f.name.replace(/\.[^.]+$/, ""))
      setRes(null)
      setMalla(m)
    } catch (e) {
      if (mio === turnoArchivo.current) setError(ext === "step" || ext === "stp" ? (e as Error).message : "No pude leer el archivo. Revisa que no esté dañado.")
    } finally {
      if (mio === turnoArchivo.current) setCargando("")
    }
  }

  // Arma el molde (con una pausa corta para no recalcular a cada tecla)
  useEffect(() => {
    if (!malla) return
    const n = ++turno.current
    setCalculando(true)
    const reloj = setTimeout(async () => {
      try {
        const r = await hacerMolde(malla, {
          tipo,
          arriba,
          pared: numero(pared),
          particion,
          llaves,
          diametroLlave: numero(diametroLlave),
          holgura: OPCIONES_MOLDE.holgura,
          bebedero,
          diametroBebedero: numero(diametroBebedero),
          respiraderos: numero(respiraderos),
          diametroRespiradero: OPCIONES_MOLDE.diametroRespiradero,
          espacio: numero(espacio),
          orejas,
          hueco,
          grosorHueco: numero(grosorHueco),
          drenaje,
          diametroDrenaje: numero(diametroDrenaje),
        })
        if (n === turno.current) { setRes(r); setError("") }
      } catch (e) {
        if (n === turno.current) { setRes(null); setError((e as Error).message || "No se pudo armar el molde.") }
      } finally {
        if (n === turno.current) setCalculando(false)
      }
    }, 400)
    return () => clearTimeout(reloj)
  }, [malla, tipo, arriba, pared, particion, llaves, diametroLlave, bebedero, diametroBebedero, respiraderos, espacio, orejas, hueco, grosorHueco, drenaje, diametroDrenaje])

  // Para la vista: arreglos estables (si no, el 3D se rehace en cada render)
  const piezasVista = useMemo(() => (res && res.piezas.length > 1 ? res.piezas.map((p) => ({ nombre: p.nombre, tris: p.malla.tris })) : null), [res])
  const cortesVista = useMemo(() => (res?.particionZ != null ? [{ eje: 2 as const, pos: res.particionZ }] : []), [res])
  const modeloVista = useMemo(() => (res ? (res.piezas.length === 1 ? res.piezas[0].malla.tris : res.modelo.tris) : malla ? malla.tris : null), [res, malla])

  // Cada pieza como se imprime (la de arriba volteada: la cara de partición hacia arriba, sin soportes)
  const archivos = () => (res ? res.piezas.map((p) => ({ nombre: `${nombre}-${p.nombre}.stl`, contenido: mallaSTL(p.voltear ? volteada(p.malla) : p.malla) })) : [])
  const leeme = () =>
    res
      ? [
          `Molde de ${nombre} - hetnacnc.com/mx/disenar/moldes-3d`,
          "",
          ...res.piezas.map((p) => `${p.nombre}: ${p.tam.join(" x ")} mm${p.voltear ? (p.cama === "tapa" ? " (ya va volteada: se imprime con la tapa sobre la cama)" : " (ya va volteada: se imprime con la cara de partición hacia arriba, sin soportes)") : ""}`),
          "",
          res.tipo === "caja_silicona" ? `Silicona necesaria: unos ${res.colado} ml.` : `Material para vaciar: unos ${res.colado} ml por pieza.`,
          res.tipo === "dos_partes" ? "Une las dos mitades con las llaves, sujétalas con pinzas de papelería en las orejas (o con ligas) y vacía por el agujero más grande (bebedero); los chicos son respiraderos." : "",
          "Usa desmoldante (vaselina, cera o spray) antes de vaciar. Para resina o silicona, imprime con 3 o más paredes y 20% de relleno o más.",
          "Si es para comida (chocolate, dulces): el plástico impreso no es apto para alimentos; úsalo para hacer un molde de silicona grado alimenticio y cuela en ese.",
        ].filter(Boolean).join("\r\n")
      : ""
  const bajarZip = async () => {
    if (!res) return
    const { zipSync } = await import("fflate")
    const z: Record<string, Uint8Array> = {}
    for (const a of archivos()) z[a.nombre] = new Uint8Array(a.contenido)
    z["LEEME.txt"] = new TextEncoder().encode(leeme())
    descargar(`${nombre}-molde.zip`, zipSync(z, { level: 6 }) as unknown as BlobPart, "application/zip")
  }
  const fabricar = async () => {
    if (!res) return
    const { zipSync } = await import("fflate")
    const z: Record<string, Uint8Array> = {}
    for (const a of archivos()) z[a.nombre] = new Uint8Array(a.contenido)
    z["LEEME.txt"] = new TextEncoder().encode(leeme())
    const ok = mandarArchivosAFabricar([{ nombre: `${nombre}-molde.zip`, contenido: new Blob([zipSync(z, { level: 6 }) as unknown as BlobPart], { type: "application/zip" }) }], locale, {
      pieza: `Molde de ${nombre} (${TIPOS.find((t) => t.id === res.tipo)?.nombre.toLowerCase()})`,
      medidas: res.piezas.map((p) => `${p.nombre} ${p.tam.join("×")} mm`).join(", "),
      proceso: "Impresión 3D",
      cantidad: `${res.piezas.length} pieza(s)`,
      nota: "Molde para vaciar: imprimir con 3 o más paredes y 20% de relleno o más. El ZIP trae cada pieza en STL y un LEEME.",
    })
    if (!ok) setAviso("El molde es muy grande para mandarlo. Descarga el ZIP y súbelo en la solicitud.")
  }
  const cotizar = () => {
    if (!res) return
    const ok = mandarPaqueteACotizador(
      { proyecto: `Molde de ${nombre}`, origen: "Generador de moldes", servicio: "impresion_3d", opciones: { materialImpresion: "pla" }, piezas: archivos().map((a) => ({ ...a, cantidad: 1 })) },
      locale,
    )
    if (!ok) setAviso("El molde es muy grande para pasarlo al Cotizador. Descarga el ZIP y súbelo ahí.")
  }

  const tipoActual = TIPOS.find((t) => t.id === tipo)!
  return (
    <main className="flex-1 bg-[#FAF9F6]">
      <section className="px-4 pb-4 pt-6 lg:px-8">
        <span className="inline-block rounded-full bg-[#E6F4EC] px-3 py-1 text-[12px] font-bold tracking-wide text-[#16794F]"><T>GRATIS · SIN MARCA DE AGUA</T></span>
        <h1 className="m-0 mt-2 font-display text-[26px] font-bold text-[#1B1B18] lg:text-[34px]"><T>Generador de moldes 3D</T></h1>
        <p className="m-0 mt-1 max-w-[760px] text-[15px] text-[#6B6A63]">
          <T>Sube tu pieza en STL, OBJ o STEP y sale el</T> <strong className="text-[#1B1B18]"><T>molde listo para imprimir</T></strong><T>: de dos partes con llaves, bebedero y respiraderos, abierto, o la caja para colar silicona. Para resina, yeso, concreto, jabón o velas. Tu archivo no sale de tu navegador.</T>
        </p>
      </section>

      <div className="grid items-start gap-5 px-4 pb-12 lg:grid-cols-[380px_1fr] lg:px-8">
        <section className="flex flex-col gap-4 rounded-[14px] border border-[#E7E4DC] bg-white p-4 lg:p-5">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[#E7E4DC] p-5 text-center hover:border-[#C2560A] hover:bg-[#FFF8F1]">
            <span className="text-[15px] font-bold text-[#1B1B18]"><T>{malla ? `Cambiar pieza (${nombre})` : "Sube tu pieza"}</T></span>
            <span className="text-[12.5px] text-[#6B6A63]"><T>STL, OBJ o STEP · hasta 60 MB</T></span>
            <input type="file" accept=".stl,.obj,.step,.stp" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
          </label>
          {cargando && <p className="m-0 text-[13px] text-[#C2560A]"><T>{cargando}</T></p>}
          {error && <p className="m-0 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[13px] text-[#8A1C1C]"><T>{error}</T></p>}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]"><T>1. Tipo de molde</T></span>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <Opcion key={t.id} activa={tipo === t.id} onClick={() => cambiarTipo(t.id)}>
                  <T>{t.nombre}</T>
                </Opcion>
              ))}
            </div>
            <span className="text-[12.5px] text-[#6B6A63]"><T>{tipoActual.nota}</T></span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]"><T>2. Qué lado va hacia arriba</T></span>
            <div className="flex flex-wrap gap-1.5">
              {ARRIBAS.map((a) => (
                <Opcion key={a.id} activa={arriba === a.id} onClick={() => { arribaElegido.current = true; setArriba(a.id) }}>
                  <T>{a.nombre}</T>
                </Opcion>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]"><T>3. Medidas</T></span>
            <div className="grid grid-cols-2 gap-2">
              <Numero etiqueta={tipo === "caja_silicona" ? "Grosor de la caja" : "Pared del molde"} valor={pared} cambiar={setPared} />
              {tipo === "caja_silicona" && <Numero etiqueta="Silicona alrededor" valor={espacio} cambiar={setEspacio} />}
            </div>
            {tipo === "dos_partes" && (
              <label className="flex flex-col gap-1 text-[13px] text-[#1B1B18]">
                <span>
                  <T>Dónde se parte:</T> <b><T>{particion}</T>%</b> <T>de la altura de la pieza</T>
                </span>
                <input type="range" min={5} max={95} value={particion} onChange={(e) => setParticion(Number(e.target.value))} className="accent-[#C2560A]" />
                <span className="text-[12px] text-[#6B6A63]"><T>Ponlo en la parte más ancha de la pieza para que salga sin atorarse.</T></span>
              </label>
            )}
          </div>

          {tipo === "abierto" && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#1B1B18]"><T>4. Pieza hueca</T></span>
              <Casilla
                etiqueta="Que salga hueca (macetas, vasos, lámparas de cemento)"
                activa={hueco}
                cambiar={(v) => {
                  setHueco(v)
                  // hueca va boca arriba (el núcleo entra por la boca); maciza, boca abajo
                  if (!arribaElegido.current) setArriba(v ? "z" : "-z")
                }}
              />
              {hueco && (
                <>
                  <span className="text-[12px] text-[#6B6A63]"><T>Sale un núcleo con tapa que se mete por la boca. La pared queda del grosor que elijas donde la pieza es más ancha y más delgada donde se angosta. La boca de la pieza va hacia arriba y plana (paso 2). Para macetas, vasos y cajas; no para piezas con asas o salientes.</T></span>
                  <Casilla etiqueta="Agujero de drenaje en el fondo" activa={drenaje} cambiar={setDrenaje} />
                  <div className="grid grid-cols-2 gap-2">
                    <Numero etiqueta="Pared de la pieza" valor={grosorHueco} cambiar={setGrosorHueco} />
                    {drenaje && <Numero etiqueta="Drenaje" valor={diametroDrenaje} cambiar={setDiametroDrenaje} />}
                  </div>
                </>
              )}
            </div>
          )}

          {tipo === "dos_partes" && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#1B1B18]"><T>4. Para vaciar y que embone</T></span>
              <Casilla etiqueta="Llaves de registro (las mitades embonan)" activa={llaves} cambiar={setLlaves} />
              <Casilla etiqueta="Bebedero con embudo" activa={bebedero} cambiar={setBebedero} />
              <Casilla etiqueta="Orejas para cerrarlo con pinzas de papelería" activa={orejas} cambiar={setOrejas} />
              <div className="grid grid-cols-3 gap-2">
                {llaves && <Numero etiqueta="Llave" valor={diametroLlave} cambiar={setDiametroLlave} />}
                {bebedero && <Numero etiqueta="Bebedero" valor={diametroBebedero} cambiar={setDiametroBebedero} />}
                <Numero etiqueta="Respiraderos" valor={respiraderos} cambiar={setRespiraderos} sufijo="" />
              </div>
            </div>
          )}

          {res && (
            <div className="flex flex-col gap-2 border-t border-[#E7E4DC] pt-3">
              <p className="m-0 text-[13.5px] text-[#1B1B18]">
                <T>{res.tipo === "caja_silicona" ? "Silicona necesaria" : "Material para vaciar"}</T>: <b>~<T>{res.colado}</T> <T>ml</T></b>
              </p>
              {res.desmoldeo?.dudoso && (
                <p className="m-0 rounded-[10px] bg-[#FFF8F1] px-3 py-2 text-[12.5px] text-[#7A4A12]" data-testid="desmoldeo">
                  <T>No pudimos revisar si la pieza se atora: el archivo tiene huecos o caras volteadas. Revísalo en tu programa o prueba la caja para silicona.</T>
                </p>
              )}
              {res.desmoldeo && !res.desmoldeo.dudoso && (res.desmoldeo.atorado <= SIN_ATORAR ? (
                <div className="rounded-[10px] bg-[#E6F4EC] px-3 py-2 text-[12.5px] text-[#16794F]" data-testid="desmoldeo">
                  <b><T>✓ La pieza sale sin atorarse.</T></b><T>{" "}</T>
                  <T>{res.tipo === "dos_partes"
                    ? "Las dos mitades también se pueden maquinar en un CNC de 3 ejes desde su cara de partición (en aluminio, MDF o cera)."
                    : "El molde también se puede maquinar en un CNC de 3 ejes desde arriba (en aluminio, MDF o cera)."}</T>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {res.piezas.map((p) => (
                      <div key={p.nombre} className="flex items-center gap-2">
                        <span className="w-[92px] shrink-0 font-semibold"><T>{p.nombre}</T></span>
                        <BotonesCam compacto nombre={`${nombre}-${p.nombre}`} stl={() => mallaSTL(p.voltear ? volteada(p.malla) : p.malla)} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[12.5px] text-[#8A1C1C]" data-testid="desmoldeo">
                  <b><T>⚠ Se va a atorar:</T></b> <T>aprox.</T> {Math.round(res.desmoldeo.atorado * 100)}<T>% de la pieza no sale al abrir el molde</T> <T>{res.desmoldeo.nucleo
                    ? "(el núcleo no sale: la boca de la pieza es más angosta que su interior; quítale lo hueco o usa la caja para silicona)."
                    : `(hay molde atrapado ${res.tipo === "dos_partes" ? "entre la pieza y la partición" : "encima de la pieza"}).`}</T>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {res.desmoldeo.particion && (
                      <button type="button" onClick={() => setParticion(res.desmoldeo!.particion!.particion)} className="rounded-[8px] bg-[#142033] px-3 py-1.5 text-[12.5px] font-semibold text-white">
                        <T>Partir al</T> <T>{res.desmoldeo.particion.particion}</T>%<T>{res.desmoldeo.particion.atorado > SIN_ATORAR ? ` (se atora ${Math.round(res.desmoldeo.particion.atorado * 100)}%)` : " (sale bien)"}</T>
                      </button>
                    )}
                    {res.desmoldeo.arriba && (
                      <button
                        type="button"
                        onClick={() => {
                          const s = res.desmoldeo!.arriba!
                          arribaElegido.current = true
                          setArriba(s.arriba)
                          if (s.particion) setParticion(s.particion)
                        }}
                        className="rounded-[8px] bg-[#142033] px-3 py-1.5 text-[12.5px] font-semibold text-white"
                      >
                        <T>Girar:</T> <T>{ARRIBAS.find((a) => a.id === res.desmoldeo!.arriba!.arriba)?.nombre}</T>
                        <T>{res.desmoldeo.arriba.particion ? ` y partir al ${res.desmoldeo.arriba.particion}%` : ""}</T>
                        <T>{res.desmoldeo.arriba.atorado > SIN_ATORAR ? ` (se atora ${Math.round(res.desmoldeo.arriba.atorado * 100)}%)` : " (sale bien)"}</T>
                      </button>
                    )}
                    {!res.desmoldeo.particion && !res.desmoldeo.arriba && (
                      <span><T>Ningún lado ni altura la deja salir completa: usa la caja para silicona (el molde flexible sí sale) o parte la pieza.</T></span>
                    )}
                  </div>
                </div>
              ))}
              {res.avisos.map((a) => (
                <p key={a} className="m-0 rounded-[10px] bg-[#FFF8F1] px-3 py-2 text-[12.5px] text-[#7A4A12]">
                  <T>{a}</T>
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={calculando} onClick={bajarZip} className="rounded-[10px] bg-[#C2560A] disabled:opacity-50 px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[#A9480A]">
                  <T>Descargar molde (ZIP)</T>
                </button>
                {res.piezas.map((p) => (
                  <button
                    key={p.nombre}
                    type="button"
                    disabled={calculando}
                    onClick={() => descargar(`${nombre}-${p.nombre}.stl`, mallaSTL(p.voltear ? volteada(p.malla) : p.malla), "model/stl")}
                    className="rounded-[10px] border border-[#E7E4DC] px-3 py-2.5 text-[13px] disabled:opacity-50 font-semibold text-[#1B1B18] hover:border-[#C2560A]"
                  >
                    <T>{p.nombre}</T><T>.stl</T>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={calculando} onClick={fabricar} className="disabled:opacity-50 rounded-[10px] bg-[#16794F] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[#12603F]">
                  <T>Fabrícamelo</T>
                </button>
                <button type="button" disabled={calculando} onClick={cotizar} className="disabled:opacity-50 rounded-[10px] border border-[#E7E4DC] px-4 py-2.5 text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A]">
                  <T>Cotizar impresión</T>
                </button>
              </div>
              {aviso && <p className="m-0 text-[12.5px] text-[#8A1C1C]"><T>{aviso}</T></p>}
              <MandarDisenoCorreo herramienta="moldes-3d" archivo={`${nombre}-molde`} servicio="Impresión 3D" />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="relative">
            {malla ? (
              <Vista modelo={modeloVista} piezas={piezasVista} cortes={cortesVista} separar={separar} />
            ) : (
              <div className="grid h-[460px] place-items-center rounded-[12px] bg-[#0F151E] px-6 text-center text-[14px] text-[#8A97AB]"><T>Sube tu pieza y aquí aparece el molde en 3D.</T></div>
            )}
            {calculando && <span className="absolute left-3 top-3 rounded-full bg-[#142033] px-3 py-1 text-[12px] text-white"><T>Armando el molde…</T></span>}
          </div>
          {piezasVista && (
            <label className="flex items-center gap-3 text-[13px] text-[#1B1B18]">
              <T>Separar</T>
              <input type="range" min={0} max={80} value={separar} onChange={(e) => setSeparar(Number(e.target.value))} className="flex-1 accent-[#C2560A]" />
            </label>
          )}
          {res && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {res.piezas.map((p) => (
                <li key={p.nombre} className="rounded-[12px] border border-[#E7E4DC] bg-white px-3 py-2.5 text-[13.5px] text-[#1B1B18]">
                  <b><T>{p.nombre}</T></b> · <T>{p.tam.join(" × ")}</T> <T>mm</T><T>{p.voltear ? (p.cama === "tapa" ? " · se descarga volteada: la tapa va sobre la cama" : " · se descarga volteada: la cara de partición va hacia arriba y la cavidad no lleva soportes") : ""}</T>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
