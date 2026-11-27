"use client"

import { T as Tr } from "@/components/hetna/i18n/Idioma"
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

import { APP_TALLER, PLANES_APP } from "@/lib/hetna/app-taller"

// "¿Cuánto pierdes cotizando a mano?": el taller pone sus propios números
// (cotizaciones a la semana, minutos por cotización, cuánto vale su hora) y ve
// las horas y el dinero que se le van al mes contra el precio del plan Taller.
// No hay cifras inventadas: todo sale de lo que escribe el taller.

const SEMANAS_MES = 4.33
const precioTaller = Number((PLANES_APP.find((p) => p.nombre === "Taller")?.precio || "$299").replace(/[^\d.]/g, "")) || 299

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`

function Campo({ etiqueta, valor, onCambio, min, max, paso, sufijo }: { etiqueta: string; valor: number; onCambio: (n: number) => void; min: number; max: number; paso: number; sufijo: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-[#40403A]"><T>{etiqueta}</T></span>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => onCambio(Number(e.target.value))} className="flex-1 accent-[#FF6A1A]" />
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max * 10}
            value={valor}
            onChange={(e) => onCambio(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 border border-[#E7E4DC] rounded-[8px] px-2 py-1 text-right text-[15px] font-bold text-[#1B1B18] bg-white"
          />
          <span className="text-[12px] text-[#6B6A63] w-14">{sufijo}</span>
        </span>
      </div>
    </label>
  )
}

export function CalculadoraTiempo() {
  const [porSemana, setPorSemana] = useState(10)
  const [minMano, setMinMano] = useState(30)
  const [minApp, setMinApp] = useState(5)
  const [valorHora, setValorHora] = useState(150)

  const ahorroMin = Math.max(0, minMano - minApp)
  const horasMes = (porSemana * SEMANAS_MES * ahorroMin) / 60
  const dineroMes = horasMes * valorHora
  const veces = precioTaller > 0 ? dineroMes / precioTaller : 0

  return (
    <section id="calculadora" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]"><T>¿Cuánto pierdes cotizando a mano?</T></h2>
        <p className="m-0 mt-1 text-[14px] text-[#6B6A63]"><T>Mueve los números a lo que pasa en tu taller. El cálculo es tuyo, con tus datos.</T></p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-4">
          <Campo etiqueta="Cotizaciones que haces a la semana" valor={porSemana} onCambio={setPorSemana} min={1} max={60} paso={1} sufijo="a la sem." />
          <Campo etiqueta="Minutos que te lleva cada una a mano" valor={minMano} onCambio={setMinMano} min={5} max={120} paso={5} sufijo="min" />
          <Campo etiqueta="Minutos que te llevaría en la app" valor={minApp} onCambio={setMinApp} min={1} max={30} paso={1} sufijo="min" />
          <Campo etiqueta="Lo que vale una hora de tu tiempo" valor={valorHora} onCambio={setValorHora} min={50} max={1000} paso={10} sufijo="pesos" />
        </div>
        <div className="bg-[#142033] text-white rounded-[14px] p-5 flex flex-col gap-3">
          <p className="m-0 text-[13px] text-[#B9C3D3]"><T>Cada mes se te van cotizando a mano</T></p>
          <p className="m-0 font-display text-[40px] font-extrabold leading-none">{horasMes.toLocaleString("es-MX", { maximumFractionDigits: 1 })} <T>horas</T></p>
          <p className="m-0 text-[15px]">
            <T>que valen</T> <b className="text-[#FF8A47] text-[22px]">{pesos(dineroMes)}</b> <T>al mes de tu tiempo.</T>
          </p>
          <div className="border-t border-[#2A3A55] pt-3 text-[14px] text-[#D5DCE7]">
            {dineroMes > precioTaller ? (
              <>
                <T>El plan</T> <b className="text-white"><T>Taller</T></b> <T>cuesta</T> <b className="text-white">{pesos(precioTaller)} <T>al mes</T></b><T>: tu tiempo ahorrado vale</T><Tr>{" "}</Tr>
                <b className="text-white">{veces.toLocaleString("es-MX", { maximumFractionDigits: 1 })} <T>veces</T></b> <T>eso.</T>
              </>
            ) : (
              <><T>Con tan pocas cotizaciones, el plan</T> <b className="text-white"><T>Gratis</T></b> <T>(5 al mes) te puede bastar. Empieza ahí sin pagar nada.</T></>
            )}
          </div>
          <a href={APP_TALLER.registro} className="mt-auto text-center bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold px-5 py-3 rounded-[10px] text-[15px]">
            <T>Probar 14 días gratis, sin tarjeta</T>
          </a>
        </div>
      </div>
    </section>
  )
}
