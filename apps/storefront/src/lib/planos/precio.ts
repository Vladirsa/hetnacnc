// "Cómpralo hecho": precio, peso y tiempo de entrega de un plano HETNA
// fabricado como kit (todas las piezas cortadas en router CNC y lijadas,
// listas para armar). Corre igual en el navegador (para mostrarlo) y en el
// servidor (para cobrarlo): el precio que se cobra se vuelve a calcular aquí,
// nunca se toma el que manda el navegador.
//
// Precio: el estimador de /cotizar (lib/cotizador/estimador.ts → estimarMueble)
// con los ajustes del dueño (Panel de HETNA > Precios de la calculadora).
// Peso: volumen real de cada pieza × densidad del triplay, más el empaque.
import { estimarMueble, MATERIALES, type ConfigPrecios, type MaterialRef } from "@/lib/cotizador/estimador"

import { acomodoPorMaterial, HOJA, listaCorte } from "./calculo"
import { MATERIALES_PLANO, type MaterialPlano, type Plano } from "./modelos"

/** Empaque (cartón, esquineros, playo) sobre el peso de la madera. */
const EMPAQUE = 0.08
/** Días hábiles fijos antes de entrar a máquina (programar, comprar hoja, revisar). */
export const DIAS_PREPARACION = 2
/** Horas de taller por día hábil. */
const HORAS_DIA = 6

const triplay = (mm: number) => MATERIALES.find((m) => m.clave === "triplay" && m.espesor === mm)

/**
 * El triplay de la lista del estimador; el de 9 mm no está y se toma a la
 * mitad entre el de 6 y el de 12 (precio y velocidad), igual que hace el
 * estimador con las velocidades.
 */
export function materialRef(mat: MaterialPlano, cfg?: ConfigPrecios | null): MaterialRef {
  const mm = MATERIALES_PLANO[mat].grosor
  const exacto = triplay(mm)
  if (exacto) return exacto
  const a = triplay(6)!, b = triplay(12)!
  const precio = (k: MaterialRef) => Number(cfg?.preciosMaterial?.[k.nombre]) || k.precio
  const t = (mm - 6) / 6
  return { ...a, nombre: `Triplay ${mm} mm`, espesor: mm, precio: Math.round(precio(a) + (precio(b) - precio(a)) * t) }
}

export type CotizacionPlano = {
  precio: number
  min: number
  max: number
  pesoKg: number
  hojas: number
  piezas: number
  minutosTaller: number
  diasFabricacion: number
}

export function cotizarPlano(pl: Plano, cfg?: ConfigPrecios | null): CotizacionPlano {
  const k = pl.juego?.cantidad ?? 1
  const { filas } = listaCorte(pl)
  const acs = acomodoPorMaterial(filas)
  if (acs.some((a) => a.acomodo.noCaben.length)) throw new Error("Hay piezas que no caben en una hoja de 2440 × 1220")
  const grupos = acs.map((a) => {
    const material = materialRef(a.material, cfg)
    const piezas = filas.filter((f) => f.material === a.material).map((f) => ({ largo: f.largo, ancho: f.ancho, cantidad: f.cantidad }))
    // se cobra el área que ocupan las piezas más la merma, sin pasar de las hojas reales del acomodo
    const area = piezas.reduce((s, p) => s + p.largo * p.ancho * p.cantidad, 0) / (HOJA.largo * HOJA.ancho)
    return { material, piezas, hojasReales: a.acomodo.hojas.length, hojas: Math.min(a.acomodo.hojas.length, area * (1 + material.merma / 100)) }
  })
  const e = estimarMueble(grupos, { servicio: "router", acabado: "lijado", cfg })
  const gramos = pl.piezas.reduce((s, q) => s + ((q.x1 - q.x0) * (q.y1 - q.y0) * (q.z1 - q.z0)) / 1000 * materialRef(q.material).densidad, 0) * k
  return {
    precio: e.total,
    min: e.min,
    max: e.max,
    pesoKg: Math.round((gramos / 1000) * (1 + EMPAQUE) * 10) / 10,
    hojas: grupos.reduce((s, g) => s + g.hojasReales, 0),
    piezas: filas.reduce((s, f) => s + f.cantidad, 0),
    minutosTaller: Math.round(e.minutosTotal),
    diasFabricacion: DIAS_PREPARACION + Math.ceil(e.minutosTotal / 60 / HORAS_DIA),
  }
}
