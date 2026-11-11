import type { Metadata } from "next"

import { WHATSAPP_HETNA } from "@/lib/hetna/distribuidor"

// Página para distribuidores de máquinas CNC (router, láser, plasma, fibra):
// les ofrecemos un código propio para regalar meses de HETNA Taller con cada
// máquina que venden. Los códigos se crean en HETNA Panel → Distribuidores.
export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/distribuidores" },
  title: "Distribuidores de máquinas CNC: regala HETNA Taller con cada venta",
  description:
    "Si vendes routers, láser, plasma o fibra, entrega a tus clientes un código para usar HETNA Cotizador gratis: cotizan desde el primer día y tu máquina se paga más rápido.",
}

const POR_QUE = [
  ["⚡", "Tu cliente cotiza desde el primer día", "Sube un DXF o STL y obtiene tiempo de máquina, costo y precio con su margen. Ya no se queda con la máquina parada sin saber cuánto cobrar."],
  ["💰", "Su máquina se paga más rápido", "Con costos reales por hora, rentabilidad por máquina y aviso de mantenimiento, el taller gana dinero y te recomienda."],
  ["🎁", "Un regalo que no te cuesta", "Tú das el código; HETNA pone los meses de HETNA Taller. Suma valor a tu venta sin bajar el precio."],
  ["📊", "Ves cuántos lo usan", "Te decimos cuántos de tus clientes activaron tu código, para que sepas qué tanto ayuda a tus ventas."],
]

const PASOS = [
  "Nos escribes por WhatsApp con el nombre de tu empresa y qué máquinas vendes.",
  "Te damos tu código (por ejemplo TUEMPRESA90) y tu página propia en hetnacnc.com/distribuidores/TUCODIGO.",
  "Entregas el código o un QR con la página junto con cada máquina.",
  "Tu cliente entra, se registra y recibe los días de HETNA Taller al instante.",
]

export default function DistribuidoresPage() {
  const wa = `https://wa.me/${WHATSAPP_HETNA}?text=${encodeURIComponent("Hola, vendo máquinas CNC y quiero mi código de distribuidor HETNA.")}`
  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Para distribuidores de máquinas CNC</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Regala HETNA Taller con cada máquina que vendes
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            Router, láser CO₂, plasma o fibra: tu cliente recibe <strong className="text-white">hasta 3 meses del Cotizador HETNA</strong> para cotizar, controlar su taller y empezar a cobrar desde la primera semana.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href={wa} target="_blank" rel="noopener" className="rounded-xl bg-[#1FA855] px-7 py-3.5 text-lg font-semibold text-white no-underline hover:brightness-110">
              Quiero mi código de distribuidor
            </a>
            <a href="/cotizador/" className="text-white/80 underline">Ver el Cotizador</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 lg:px-6">
        <h2 className="text-2xl font-extrabold text-[#142033]">Por qué a tu cliente le sirve (y a ti también)</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {POR_QUE.map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="text-2xl">{i}</p>
              <p className="mt-2 font-bold text-[#142033]">{t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 pb-14 lg:px-6">
        <div className="grid gap-6 rounded-3xl border border-[#E7E4DC] bg-white p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-[#142033]">Cómo funciona</h2>
            <ol className="mt-4 grid gap-3 text-[#40403A]">
              {PASOS.map((p, i) => (
                <li key={i}><strong>{i + 1}.</strong> {p}</li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-[#F3F1EA] p-5 text-sm text-[#40403A]">
            <p className="font-bold text-[#142033]">Qué incluye HETNA Taller</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Simulador de costos desde DXF, SVG y STL, con receta de corte por material.</li>
              <li>Cotizaciones profesionales con dibujo y medidas, por PDF y WhatsApp.</li>
              <li>Órdenes de trabajo con QR, inventario y control de producción.</li>
              <li>Rentabilidad por máquina y mantenimiento por horas.</li>
              <li>Liga para que su cliente acepte y pague el anticipo en línea.</li>
            </ul>
            <p className="mt-3 text-[12px] text-[#6B675C]">El código vale para talleres nuevos, en sus primeros 30 días. Al terminar los días de regalo, el taller decide si sigue con un plan de pago o con el plan gratis.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
