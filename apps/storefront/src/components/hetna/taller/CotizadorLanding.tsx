"use client"

import { useCallback, useEffect, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { hayArchivoPendiente } from "@/lib/generador/aCotizador"
import { APP_TALLER, PLANES_APP } from "@/lib/hetna/app-taller"

import { FranjaAyuda } from "../ServicioPagina"
import { CotizadorEmbebido } from "./CotizadorEmbebido"

// Página de la app HETNA CNC para talleres (el Cotizador): explica qué hace,
// cómo se conecta con la plataforma, cómo instalarla y los planes. Todos los
// botones llevan a la app real (/cotizador/, Flutter web) o a la descarga.
// Si un generador manda un archivo (?archivo=generador) se abre el cotizador
// rápido embebido para dar el precio al instante sin cuenta.

const PASOS = [
  ["Registra tu taller", "Nombre, WhatsApp y listo. Sin tarjeta, con 14 días de prueba con todo abierto."],
  ["Cotiza desde el celular", "Sube el archivo o escribe medidas; el sistema calcula con tus costos y tu margen."],
  ["Manda y da seguimiento", "PDF con tu logo por WhatsApp y alertas para darle seguimiento a cada cliente."],
  ["Controla el taller", "Avances, clientes, gastos, inventario, equipo y reportes: todo en un lugar."],
]

const VINCULOS = [
  { t: "Precio desde el archivo", d: "Sube el DXF, SVG, STL u OBJ: la app mide la pieza, el largo de corte y las perforaciones, y calcula con tus costos.", i: "📐" },
  { t: "Envíos HETNA", d: "Genera guías con descuento y envío protegido desde la app, con la paquetería que más te convenga.", i: "📦" },
  { t: "Trabajos del marketplace", d: "Recibe solicitudes de fabricación de clientes de hetnacnc.com y licitaciones en tu zona.", i: "🏭" },
  { t: "Tienda y consumibles", d: "Compra fresas, tubos, boquillas y material de los vendedores de hetnacnc.com.", i: "🛒" },
  { t: "Herramientas CNC", d: "Calculadora CNC, Laboratorio CAM y los generadores de diseño, dentro de la misma cuenta.", i: "🛠️" },
  { t: "Foro y comunidad", d: "Pregunta y comparte con otros talleres de México desde la app.", i: "💬" },
]

const SIEMPRE_GRATIS = ["Cotizaciones (5 al mes)", "Clientes y productos", "Avances de cada trabajo", "Alertas y seguimiento por WhatsApp", "Calculadora CNC", "Envíos", "Tienda", "Foro", "Laboratorio CAM", "Licitaciones"]

const PREGUNTAS = [
  ["¿Es la misma cuenta que en hetnacnc.com?", "Sí. Entras a la app con tu cuenta de hetnacnc.com, sin otra contraseña. Si todavía no tienes, la creas al registrarte y ahí mismo se crea tu taller con 14 días de prueba."],
  ["¿Por qué no está en Play Store ni App Store?", "Porque no hace falta: se instala desde el navegador en un toque, se actualiza sola y no depende de las tiendas. Así llega a todos los celulares igual."],
  ["¿Funciona sin internet?", "Necesita conexión para guardar y sincronizar, pero puedes consultar cotizaciones y clientes que ya cargaste."],
  ["¿Puedo cancelar cuando quiera?", "Sí. Se cobra cada mes y conservas el plan hasta el fin del mes pagado. El plan Gratis no vence."],
  ["¿Mis datos están seguros?", "Cada taller ve solo su información. Los pagos los procesan Mercado Pago y PayPal; HETNA no guarda tarjetas."],
]

export const CotizadorLanding = ({ locale }: { locale: string }) => {
  const [demo, setDemo] = useState(false)
  const cerrar = useCallback(() => setDemo(false), [])

  // si viene un archivo del espacio Diseñar, se abre el cotizador rápido con ese archivo
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("archivo") === "generador" && hayArchivoPendiente()) setDemo(true)
  }, [])

  if (demo) return <CotizadorEmbebido modo="demo" locale={locale} onCerrar={cerrar} />

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">App HETNA CNC para talleres</span>
      </div>

      {/* Hero */}
      <section className="px-4 lg:px-16 pt-5 pb-8">
        <div className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-10 grid lg:grid-cols-[1fr_300px] gap-8 items-center overflow-hidden relative">
          <div className="flex flex-col gap-4">
            <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#FF6A1A] px-3 py-1 rounded-full">
              App para talleres · Se instala desde el navegador, sin tiendas
            </span>
            <h1 className="font-display text-[30px] lg:text-[46px] leading-[1.06] font-bold m-0 max-w-[720px]">
              Cotiza, cobra y controla tu taller desde el celular
            </h1>
            <p className="m-0 text-[15.5px] lg:text-[17px] text-[#C9D2E0] max-w-[640px] leading-relaxed">
              HETNA CNC es el sistema de gestión para talleres de router, láser, plasma e impresión 3D: cotizaciones con tus costos reales, clientes, avances, gastos, inventario y equipo. Gratis para empezar y conectado con todo hetnacnc.com.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a href={APP_TALLER.registro} className="inline-flex items-center bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold px-5 py-3 rounded-[10px] text-[15px]">
                Crear mi taller gratis
              </a>
              <a href={APP_TALLER.web} className="inline-flex items-center border border-[#3A4A63] hover:border-white text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]">
                Abrir la app
              </a>
              <a href="#instalar" className="inline-flex items-center gap-2 bg-white text-[#142033] hover:bg-[#F2F0EA] font-semibold px-5 py-3 rounded-[10px] text-[15px]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M12 7v7M9 11l3 3 3-3M11 18h2" /></svg>
                Instalar en mi celular
              </a>
            </div>
            <p className="m-0 text-[13px] text-[#9FB0C8]">
              14 días con todo abierto · después, plan Gratis para siempre · sin tarjeta · Android, iPhone y computadora.
            </p>
          </div>
          <div className="hidden lg:flex flex-col gap-2 bg-[#0F1826] rounded-[14px] p-4 border border-[#2A3A55]">
            <span className="text-[12px] uppercase tracking-wide font-bold text-[#9FB0C8]">Lo que ve tu cliente</span>
            <div className="bg-white text-[#1B1B18] rounded-[10px] p-3 text-[12.5px] flex flex-col gap-1.5">
              <span className="font-bold text-[14px]">Cotización COT-0148</span>
              <span className="text-[#6B6A63]">Letrero MDF 18 mm · 120 × 60 cm · 2 piezas</span>
              <div className="grid grid-cols-3 gap-1 pt-1">
                {[["Económico", "$1,850"], ["Estándar", "$2,300"], ["Express", "$2,950"]].map(([n, p]) => (
                  <div key={n} className={`rounded-[8px] border p-1.5 text-center ${n === "Estándar" ? "border-[#FF6A1A] bg-[#FFF3EA]" : "border-[#E7E4DC]"}`}>
                    <div className="text-[10.5px] text-[#6B6A63]">{n}</div>
                    <div className="font-bold">{p}</div>
                  </div>
                ))}
              </div>
              <span className="mt-1 rounded-[8px] bg-[#16794F] text-white text-center font-semibold py-1.5">Enviada por WhatsApp · PDF con tu logo</span>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 lg:px-16 pb-12 flex flex-col gap-12">
        {/* Cómo funciona */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Cómo funciona</h2>
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

        {/* Vinculado con la plataforma */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Todo conectado con hetnacnc.com</h2>
            <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63] max-w-[760px]">No es solo un cotizador: es la puerta de tu taller a la plataforma. Lo que cotizas en la app se envía, se fabrica y se vende con las herramientas de HETNA.</p>
          </div>
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {VINCULOS.map((v) => (
              <li key={v.t} className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex gap-3">
                <span className="text-[26px] leading-none" aria-hidden="true">{v.i}</span>
                <div>
                  <h3 className="m-0 text-[15.5px] font-bold text-[#1B1B18]">{v.t}</h3>
                  <p className="m-0 mt-1 text-[13.5px] text-[#6B6A63] leading-relaxed">{v.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Instalar */}
        <section id="instalar" className="flex flex-col gap-4 scroll-mt-24">
          <div>
            <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Instálala desde el navegador, sin tiendas</h2>
            <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63] max-w-[760px]">No hay que buscarla en Play Store ni App Store: se abre en hetnacnc.com/app y se instala en un toque. Las actualizaciones llegan solas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-3">
              <h3 className="m-0 text-[17px] font-bold text-[#1B1B18]">Android (Chrome, Edge, Samsung)</h3>
              <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">Abre la app y toca <strong>Instalar</strong> en el aviso que aparece abajo (o en el menú ⋮ del navegador, <em>Instalar aplicación</em>). Queda con su ícono, abre a pantalla completa y se actualiza sola.</p>
              <a href={APP_TALLER.web} className="mt-auto text-center bg-[#142033] hover:bg-[#0F1826] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">Abrir e instalar</a>
              <a href={APP_TALLER.android} className="text-[12px] text-[#9A978C] hover:text-[#B34D07] underline underline-offset-2">¿Prefieres el instalador APK? Descárgalo aquí</a>
            </div>
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-3">
              <h3 className="m-0 text-[17px] font-bold text-[#1B1B18]">iPhone y iPad (Safari)</h3>
              <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">Abre la app en Safari, toca <strong>Compartir</strong> (el cuadrito con la flecha) y luego <strong>Añadir a pantalla de inicio</strong>. Queda con su ícono como cualquier app y abre a pantalla completa.</p>
              <a href={APP_TALLER.web} className="mt-auto text-center bg-[#142033] hover:bg-[#0F1826] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">Abrir en Safari</a>
              <span className="text-[12px] text-[#9A978C]">También desde Chrome en iPhone: Compartir → Añadir a pantalla de inicio</span>
            </div>
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-3">
              <h3 className="m-0 text-[17px] font-bold text-[#1B1B18]">Computadora</h3>
              <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">En Chrome o Edge, el ícono de instalar en la barra de direcciones la deja como programa en Windows o Mac. Misma cuenta y mismos datos que en el celular; ideal para cotizaciones largas y reportes.</p>
              <a href={APP_TALLER.web} className="mt-auto text-center border border-[#142033] text-[#142033] hover:bg-[#F2F0EA] font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">Abrir en el navegador</a>
              <span className="text-[12px] text-[#9A978C]">hetnacnc.com/cotizador</span>
            </div>
          </div>
        </section>

        {/* Planes */}
        <section className="flex flex-col gap-4 scroll-mt-24" id="planes">
          <div>
            <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Planes</h2>
            <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">Precios en pesos mexicanos al mes, IVA incluido. Todos empiezan con 14 días de prueba con todo abierto; el plan Gratis no vence.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLANES_APP.map((p) => (
              <div key={p.nombre} className={`bg-white rounded-[14px] p-5 flex flex-col gap-3 border ${p.destacado ? "border-[#FF6A1A] border-2" : "border-[#E7E4DC]"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="m-0 font-display text-[20px] font-bold text-[#1B1B18]">{p.nombre}</h3>
                  {p.destacado && <span className="text-[11px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#B34D07] px-2 py-0.5 rounded-full">Más elegido</span>}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-bold text-[#1B1B18]">{p.precio}</span>
                  <span className="text-[13px] text-[#6B6A63]">{p.nota}</span>
                </div>
                <p className="m-0 text-[13px] text-[#6B6A63]">{p.para}</p>
                <ul className="m-0 p-0 list-none flex flex-col gap-1.5 text-[13.5px] text-[#1B1B18]">
                  {p.puntos.map((x) => <li key={x} className="flex gap-2"><span className="text-[#16794F]" aria-hidden="true">✓</span>{x}</li>)}
                </ul>
                <a href={APP_TALLER.registro} className={`mt-auto text-center font-semibold px-4 py-2.5 rounded-[10px] text-[14px] ${p.destacado ? "bg-[#FF6A1A] hover:bg-[#E65C12] text-white" : "border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18]"}`}>
                  {p.nombre === "Gratis" ? "Empezar gratis" : "Probar 14 días gratis"}
                </a>
              </div>
            ))}
          </div>
          <div className="bg-[#E6F4EC] border border-[#B7E0C8] rounded-[14px] px-5 py-4">
            <p className="m-0 text-[13.5px] font-bold text-[#16794F]">Siempre gratis, en todos los planes</p>
            <p className="m-0 mt-1 text-[13.5px] text-[#1B1B18]">{SIEMPRE_GRATIS.join(" · ")}</p>
          </div>
        </section>

        {/* Preguntas */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Preguntas frecuentes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PREGUNTAS.map(([p, r]) => (
              <details key={p} className="bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3">
                <summary className="cursor-pointer text-[14.5px] font-bold text-[#1B1B18]">{p}</summary>
                <p className="m-0 mt-2 text-[13.5px] text-[#6B6A63] leading-relaxed">{r}</p>
              </details>
            ))}
          </div>
        </section>

        <FranjaAyuda />
      </div>
    </main>
  )
}
