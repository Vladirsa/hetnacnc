"use client"

// Diseñar → ver precio → mandar a fabricar en un paso (estrategia 2.6).
// Toma el DXF que acaba de generar la herramienta, lo revisa (revisión del
// archivo, 1.1), muestra el precio en vivo con la cantidad (1.2) y lo manda a
// la solicitud de fabricación con el archivo ya cargado.
import { T } from "@/components/hetna/i18n/Idioma"
import { useMemo, useState } from "react"
import { useParams } from "next/navigation"

import { RevisionArchivo } from "@/components/hetna/cotizar/RevisionArchivo"
import { puntosRevision } from "@/lib/cotizador/revision-archivo"
import { leerDxf, type GeoCad } from "@/lib/cotizador/archivo-cad"
import { pesos, usePrecioEnVivo } from "@/components/hetna/cotizar/usePrecioEnVivo"
import { mandarAFabricar, precioMDF, procesoDeServicio } from "@/lib/generador/aCotizador"
import { calcularHojas, SEPARACION, textoHojas } from "@/lib/cotizador/hojas"

type Props = {
  /** DXF generado (en mm) */
  dxf: string
  nombreArchivo: string
  pieza: string
  medidas?: string
  maquina: "laser" | "router"
  /** Espesor del material en mm, para elegir el material de la tarifa */
  espesorMm?: number
  /** Barra delgada debajo de la vista 3D (computadora). En el panel tapaba
   *  los controles del diseño (Vlado, 23 nov 2026). */
  barra?: boolean
}


export function PrecioFabricar({ dxf, nombreArchivo, pieza, medidas, maquina, espesorMm, barra = false }: Props) {
  const { locale } = useParams<{ locale: string }>()
  const [cantidad, setCantidad] = useState(1)
  const [aviso, setAviso] = useState("")

  const geo: GeoCad | null = useMemo(() => {
    try {
      return dxf ? leerDxf(dxf) : null
    } catch {
      return null
    }
  }, [dxf])

  const { servicio, material } = precioMDF(maquina, espesorMm)
  const { precio, cargando } = usePrecioEnVivo(
    geo && geo.largo > 0 && geo.ancho > 0
      ? { servicio, material, ancho: Math.max(1, Math.round(geo.ancho) / 10), largo: Math.max(1, Math.round(geo.largo) / 10), cantidad: Math.max(1, cantidad) }
      : null,
    400,
  )

  if (!geo) return null

  const fabricar = () => {
    setAviso("")
    const ok = mandarAFabricar(`${nombreArchivo}.dxf`, dxf, locale, {
      pieza: cantidad > 1 ? `${cantidad} × ${pieza}` : pieza,
      medidas,
      material,
      proceso: procesoDeServicio(servicio),
    })
    if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
  }

  if (barra) {
    const puntos = puntosRevision(geo, { proceso: maquina, espesor_mm: espesorMm })
    const problemas = puntos.filter((p) => p.nivel === "problema").length
    const revisar = puntos.filter((p) => p.nivel === "revisar").length
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#1F2937] bg-[#121923] px-4 py-2.5 text-[#E6EBF2]" data-testid="barra-fabricar">
        <div className={`flex items-baseline gap-2 ${cargando ? "opacity-60" : ""}`}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9AA6B8]"><T>Precio aprox.</T></span>
          {precio ? (
            <>
              <b className="text-[18px] text-white">
                {pesos(precio.minimo)} – {pesos(precio.maximo)}
              </b>
              <span className="text-[12px] text-[#9AA6B8]">
                <T>+ IVA</T><T>{cantidad > 1 ? ` · ≈ ${pesos(precio.recomendado / cantidad)} c/u` : ""}</T>
              </span>
            </>
          ) : (
            <span className="text-[13px] text-[#9AA6B8]"><T>{cargando ? "Calculando…" : "Sin estimado"}</T></span>
          )}
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-[#C9D2E0]">
          <T>Cantidad</T>
          <input
            type="number"
            min={1}
            max={10000}
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Math.min(10000, Math.round(Number(e.target.value) || 1))))}
            className="h-9 w-20 rounded-[8px] border border-[#2A3546] bg-[#0F151E] px-2.5 text-[14px] text-white"
          />
        </label>
        {/* Revisión del archivo y hojas de material: se abren al tocar */}
        <details className="relative">
          <summary
            className={`cursor-pointer list-none rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
              problemas ? "border-[#7A2A22] text-[#F6B8AE]" : revisar ? "border-[#6B5A2A] text-[#F2D29B]" : "border-[#245236] text-[#9FE0B5]"
            }`}
          >
            <T>{problemas ? `⚠ ${problemas === 1 ? "1 cosa por corregir" : `${problemas} cosas por corregir`}` : revisar ? `• ${revisar} por revisar` : "✓ Archivo revisado"}</T>
          </summary>
          <div className="absolute bottom-full left-0 z-20 mb-2 flex w-[340px] flex-col gap-2 rounded-[12px] border border-[#F2C9A5] bg-[#FFF8F1] p-3 text-[#1B1B18] shadow-xl">
            {geo.largo > 0 && (
              <p className="m-0 rounded-[8px] bg-white px-3 py-2 text-[12.5px] text-[#40403A]">
                <b className="text-[#1B1B18]"><T>Material:</T></b><T>{" "}</T>
                {textoHojas(calcularHojas({ pzL: geo.largo, pzA: geo.ancho, piezas: cantidad, ...SEPARACION[servicio] }))}.
              </p>
            )}
            <RevisionArchivo geo={geo} proceso={maquina} espesor_mm={espesorMm} />
            <p className="m-0 text-[11.5px] text-[#7A776E]">
              <T>Estimado de referencia en</T> {material}<T>, sin envío. Al mandarlo, el archivo va cargado y los talleres te dan su precio final; tú eliges.</T>
            </p>
          </div>
        </details>
        <button
          type="button"
          onClick={fabricar}
          className="ml-auto flex min-h-[40px] items-center justify-center rounded-[10px] bg-[#FF6A1A] px-5 text-[14.5px] font-extrabold text-white hover:bg-[#E65C12]"
        >
          <T>Mandar a fabricar</T>
        </button>
        {aviso && <p className="m-0 w-full text-[12.5px] text-[#F6B8AE]">{aviso}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-[#F2C9A5] bg-[#FFF8F1] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-[#8A3D06]"><T>Precio para fabricarlo</T></p>
          {precio ? (
            <p className={`m-0 text-[24px] font-extrabold leading-tight text-[#1B1B18] ${cargando ? "opacity-60" : ""}`}>
              {pesos(precio.minimo)} – {pesos(precio.maximo)} <span className="text-[13px] font-semibold text-[#6B6A63]"><T>+ IVA</T></span>
            </p>
          ) : (
            <p className="m-0 text-[14px] text-[#6B6A63]"><T>{cargando ? "Calculando…" : "Sin estimado para este diseño"}</T></p>
          )}
          {precio && cantidad > 1 && (
            <p className="m-0 text-[12px] text-[#6B6A63]">≈ {pesos(precio.recomendado / cantidad)} <T>cada uno + IVA</T></p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-[#1B1B18]">
          <T>Cantidad</T>
          <input
            type="number"
            min={1}
            max={10000}
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Math.min(10000, Math.round(Number(e.target.value) || 1))))}
            className="w-24 rounded-[8px] border border-[#E7E4DC] bg-white px-3 py-2 text-[14px]"
          />
        </label>
      </div>
      {geo.largo > 0 && (
        <p className="m-0 rounded-[8px] bg-white px-3 py-2 text-[12.5px] text-[#40403A]">
          <b className="text-[#1B1B18]"><T>Material:</T></b><T>{" "}</T>
          {textoHojas(calcularHojas({ pzL: geo.largo, pzA: geo.ancho, piezas: cantidad, ...SEPARACION[servicio] }))}.
        </p>
      )}
      <RevisionArchivo geo={geo} proceso={maquina} espesor_mm={espesorMm} />
      <button
        type="button"
        onClick={fabricar}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#FF6A1A] py-3.5 text-[15px] font-extrabold text-white hover:bg-[#E65C12]"
      >
        <T>Mandar a fabricar</T>
      </button>
      {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
      <p className="m-0 text-[11.5px] text-[#7A776E]">
        <T>Estimado de referencia en</T> {material}<T>, sin envío. Al mandarlo, el archivo va cargado y los talleres te dan su precio final; tú eliges.</T>
      </p>
    </div>
  )
}
