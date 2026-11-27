"use client"

// Desarrollo de lámina (2D Studio · Archivos): cono y reducción, transición de
// cuadrado a redondo y boca de pescado. Motor: lib/generador/lamina.ts.
import { useMemo, useState } from "react"

import { CampoNum, Datos, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { bocaDePescado, desarrolloCono, desarrolloTransicion } from "@/lib/generador/lamina"

type Pieza = "cono" | "transicion" | "boca"
const PIEZAS: { id: Pieza; nombre: string }[] = [
  { id: "cono", nombre: "Cono / reducción" },
  { id: "transicion", nombre: "Cuadrado a redondo" },
  { id: "boca", nombre: "Boca de pescado" },
]

export function GeneradorLamina({ cabecera }: { cabecera?: React.ReactNode }) {
  const [pieza, setPieza] = useState<Pieza>("cono")
  const [v, setV] = useState<Record<string, string>>({
    mayor: "300", menor: "120", alto: "200", partes: "1",
    ancho: "400", fondo: "300", diametro: "200", altoT: "250", divisiones: "6",
    tubo: "50.8", principal: "76.2", angulo: "90", largo: "60",
    espesor: "1.5",
  })
  const c = (k: string) => (x: string) => setV((s) => ({ ...s, [k]: x }))
  const n = (k: string) => numero(v[k]) || 0

  const r = useMemo(() => {
    if (pieza === "cono") return desarrolloCono({ mayor: n("mayor"), menor: n("menor"), alto: n("alto"), espesor: n("espesor"), partes: n("partes") })
    if (pieza === "transicion") return desarrolloTransicion({ ancho: n("ancho"), fondo: n("fondo"), diametro: n("diametro"), alto: n("altoT"), espesor: n("espesor"), divisiones: n("divisiones") })
    return bocaDePescado({ tubo: n("tubo"), principal: n("principal"), angulo: n("angulo"), largo: n("largo"), espesor: n("espesor") })
  }, [pieza, v]) // eslint-disable-line react-hooks/exhaustive-deps

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <Seccion titulo="Pieza">
        <div className="grid grid-cols-3 gap-1.5">
          {PIEZAS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={pieza === p.id}
              onClick={() => setPieza(p.id)}
              className={`rounded-[8px] px-1.5 py-2 text-[11.5px] font-semibold leading-tight ${pieza === p.id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#232D3D]"}`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <div className="grid grid-cols-2 gap-2">
        {pieza === "cono" && (
          <>
            <CampoNum etiqueta="Diámetro mayor" valor={v.mayor} cambiar={c("mayor")} />
            <CampoNum etiqueta="Diámetro menor (0 = punta)" valor={v.menor} cambiar={c("menor")} />
            <CampoNum etiqueta="Alto" valor={v.alto} cambiar={c("alto")} />
            <CampoNum etiqueta="En cuántas partes" valor={v.partes} cambiar={c("partes")} sufijo="pzas" />
          </>
        )}
        {pieza === "transicion" && (
          <>
            <CampoNum etiqueta="Ancho del rectángulo" valor={v.ancho} cambiar={c("ancho")} />
            <CampoNum etiqueta="Fondo del rectángulo" valor={v.fondo} cambiar={c("fondo")} />
            <CampoNum etiqueta="Diámetro del redondo" valor={v.diametro} cambiar={c("diametro")} />
            <CampoNum etiqueta="Alto" valor={v.altoT} cambiar={c("altoT")} />
            <CampoNum etiqueta="Divisiones por esquina" valor={v.divisiones} cambiar={c("divisiones")} sufijo="" />
          </>
        )}
        {pieza === "boca" && (
          <>
            <CampoNum etiqueta="Tubo que llega (Ø ext.)" valor={v.tubo} cambiar={c("tubo")} />
            <CampoNum etiqueta="Tubo principal (Ø ext.)" valor={v.principal} cambiar={c("principal")} />
            <CampoNum etiqueta="Ángulo entre tubos" valor={v.angulo} cambiar={c("angulo")} sufijo="°" />
            <CampoNum etiqueta="Largo extra de la plantilla" valor={v.largo} cambiar={c("largo")} />
          </>
        )}
        <CampoNum etiqueta="Espesor de la lámina" valor={v.espesor} cambiar={c("espesor")} />
      </div>
      {r.datos.length > 0 && <Datos filas={r.datos} />}
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">Medidas exteriores; la plantilla se traza a la fibra media según el espesor. Para plasma, compensa el kerf en tu programa.</span>
    </div>
  )

  return (
    <Estudio2D
      titulo="Desarrollo de lámina"
      acento="2D"
      subtitulo="Plantillas para pailería y plasma"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 20l4-16h8l4 16z" />
          <path d="M6 12h12" />
        </svg>
      }
      panel={panel}
      dibujo={r.errores.length ? null : r.dibujo}
      avisos={[...r.errores, ...r.avisos]}
      archivo={`lamina-${pieza}-hetna`}
      pieza={`${PIEZAS.find((p) => p.id === pieza)!.nombre} en lámina de ${v.espesor} mm`}
      material={`Lámina de ${v.espesor} mm`}
      vacio="Pon las medidas."
    />
  )
}
