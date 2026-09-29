"use client"

import { useCallback, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { FranjaAyuda } from "../ServicioPagina"
import { CotizadorEmbebido } from "./CotizadorEmbebido"

// Pagina del Cotizador CNC para quien no ha iniciado sesion:
// explica la herramienta, muestra los planes y deja probarla sin cuenta.
// Ocupa toda la pantalla con su propia cabecera (tapa la cabecera de la tienda).

const PASOS = [
  ["Sube el archivo", "DXF, SVG, STL u OBJ desde WhatsApp, Drive o tu correo."],
  ["Elige material y cantidad", "El sistema mide la pieza: corte, perforaciones o volumen."],
  ["Precio al instante", "Tres opciones con tus propias tarifas: Económico, Estándar y Express."],
  ["Envía por WhatsApp", "Con el mensaje listo y el PDF de la cotización."],
]

const INCLUYE = [
  "Lee DXF, SVG, STL y OBJ",
  "Vista 3D y simulador de corte o impresión",
  "Tus tarifas y márgenes guardados",
  "Historial de cotizaciones",
  "PDF de la cotización",
  "Funciona desde el celular",
]

type Plan = { nombre: string; precio: string; nota: string; destacado?: boolean; puntos: string[]; pronto?: string[] }
const PLANES: Plan[] = [
  { nombre: "Gratis", precio: "$0", nota: "para siempre", puntos: ["10 cotizaciones al mes", "Visor 3D y simulador", "PDF con marca HetNa", "Historial de 30 días", "1 usuario"] },
  { nombre: "Taller", precio: "$299", nota: "al mes", destacado: true, puntos: ["Cotizaciones ilimitadas", "PDF con tu logo, sin marca", "Historial y clientes ilimitados", "2 usuarios"], pronto: ["Liga para que tu cliente acepte en línea", "Precios de materiales automáticos"] },
  { nombre: "Pro", precio: "$599", nota: "al mes", puntos: ["Todo lo del plan Taller", "5 usuarios"], pronto: ["Órdenes de trabajo: CAM → producción → calidad → entrega", "Inventario, herramientas y máquinas", "Mantenimiento y horas de máquina", "Costos, utilidad y reportes"] },
  { nombre: "Industrial", precio: "$1,199", nota: "al mes", puntos: ["Todo lo del plan Pro", "Usuarios ilimitados"], pronto: ["Facturación electrónica", "Proyectos y varias sucursales"] },
]

export const CotizadorLanding = ({ locale }: { locale: string }) => {
  const [demo, setDemo] = useState(false)
  const cerrar = useCallback(() => setDemo(false), [])
  const volver = encodeURIComponent(`/${locale}/servicios/cotizador-cnc`)

  return (
    <main className="fixed inset-0 z-[100] overflow-y-auto bg-[#FAF9F6]">
      <header className="sticky top-0 z-10 bg-[#142033] text-white px-4 lg:px-16 py-3 flex items-center gap-3">
        <LocalizedClientLink href="/" className="font-display font-bold text-[18px] tracking-wide text-white">
          HETNA <span className="text-[#F08A3C]">Taller</span>
        </LocalizedClientLink>
        <span className="hidden sm:inline text-[13px] text-[#9FB0C8]">Cotizador CNC</span>
        <div className="ml-auto flex items-center gap-2">
          <LocalizedClientLink href="/" className="text-[13px] text-[#C9D2E0] hover:text-white px-2 py-2">
            ← Tienda
          </LocalizedClientLink>
          <a href={`/${locale}/login?volver=${volver}`} className="text-[13px] font-semibold border border-[#3A4A63] hover:border-white px-3 py-2 rounded-lg">
            Entrar
          </a>
          <a href={`/${locale}/register?volver=${volver}`} className="text-[13px] font-semibold bg-[#C2560A] hover:bg-[#A84A08] px-3 py-2 rounded-lg">
            Crear cuenta
          </a>
        </div>
      </header>
      <div className="pt-2" />

      <section className="px-4 lg:px-16 pt-5 pb-8">
        <div className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-10 flex flex-col gap-4">
          <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
            Herramienta para talleres
          </span>
          <h1 className="font-display text-[30px] lg:text-[44px] leading-[1.08] font-bold m-0 max-w-[760px]">
            Cotiza en segundos, desde tu celular
          </h1>
          <p className="m-0 text-[15.5px] lg:text-[17px] text-[#C9D2E0] max-w-[640px] leading-relaxed">
            Sube el archivo de tu cliente, obtén el precio al momento con tus propias tarifas y mándalo por WhatsApp con su PDF.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href={`/${locale}/register?volver=${volver}`} className="inline-flex items-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]">
              Crear cuenta gratis
            </a>
            <a href={`/${locale}/login?volver=${volver}`} className="inline-flex items-center border border-[#3A4A63] hover:border-white text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]">
              Ya tengo cuenta
            </a>
            <button type="button" onClick={() => setDemo(true)} className="inline-flex items-center text-[#F2A65A] hover:text-white font-semibold px-2 py-3 text-[15px] underline underline-offset-4">
              Probar sin cuenta
            </button>
          </div>
          <p className="m-0 text-[13px] text-[#9FB0C8]">14 días con todo abierto · después, 10 cotizaciones gratis cada mes · sin tarjeta</p>
        </div>
      </section>

      <div className="px-4 lg:px-16 pb-12 flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">Cómo funciona</h2>
          <ol className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PASOS.map(([t, d], i) => (
              <li key={t} className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-2">
                <span className="w-8 h-8 rounded-full bg-[#142033] text-white text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
                <h3 className="m-0 text-[15.5px] font-bold text-[#1B1B18]">{t}</h3>
                <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">Qué incluye</h2>
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INCLUYE.map((x) => (
              <li key={x} className="bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3.5 flex gap-3 items-center text-[14.5px] text-[#1B1B18]">
                <span className="text-[#16794F] shrink-0" aria-hidden="true">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4" id="planes">
          <div>
            <h2 className="font-display text-[22px] font-bold m-0 text-[#1B1B18]">Planes</h2>
            <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">Precios en pesos mexicanos, IVA incluido. Todos empiezan con 14 días de prueba con todo abierto.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLANES.map((p) => (
              <div key={p.nombre} className={`bg-white rounded-[14px] p-5 flex flex-col gap-3 border ${p.destacado ? "border-[#C2560A] border-2" : "border-[#E7E4DC]"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="m-0 font-display text-[20px] font-bold text-[#1B1B18]">{p.nombre}</h3>
                  {p.destacado && <span className="text-[11px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#B34D07] px-2 py-0.5 rounded-full">Más elegido</span>}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-bold text-[#1B1B18]">{p.precio}</span>
                  <span className="text-[13px] text-[#6B6A63]">{p.nota}</span>
                </div>
                <ul className="m-0 p-0 list-none flex flex-col gap-1.5 text-[13.5px] text-[#1B1B18]">
                  {p.puntos.map((x) => <li key={x} className="flex gap-2"><span className="text-[#16794F]" aria-hidden="true">✓</span>{x}</li>)}
                  {(p.pronto || []).map((x) => <li key={x} className="flex gap-2 text-[#6B6A63]"><span aria-hidden="true">○</span><span>{x} <em className="not-italic text-[11.5px] font-semibold text-[#B34D07]">(pronto)</em></span></li>)}
                </ul>
                <a href={`/${locale}/register?volver=${volver}`} className={`mt-auto text-center font-semibold px-4 py-2.5 rounded-[10px] text-[14px] ${p.destacado ? "bg-[#C2560A] hover:bg-[#A84A08] text-white" : "border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18]"}`}>
                  {p.nombre === "Gratis" ? "Empezar gratis" : "Probar 14 días gratis"}
                </a>
              </div>
            ))}
          </div>
        </section>

        <FranjaAyuda />
      </div>

      {demo && <CotizadorEmbebido modo="demo" locale={locale} onCerrar={cerrar} />}
    </main>
  )
}
