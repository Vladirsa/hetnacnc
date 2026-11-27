import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import { FormProveedorExtranjero } from "@/components/hetna/taller/FormProveedorExtranjero"

// Página en inglés para proveedores de otros países (China, Taiwán, Turquía,
// EE. UU.…) que venden en Alibaba, Made-in-China y similares (24 nov 2026).
// Modelo: envían puerta a puerta con impuestos pagados (DDP) y HETNA les paga
// por PayPal; en la tienda sus productos salen marcados «De importación».
const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/sell-in-mexico" },
  title: { absolute: "Sell CNC machines and tooling in Mexico | HETNA CNC marketplace" },
  description:
    "Sell CNC routers, laser cutters, spindles, tooling and spare parts to Mexican machine shops. No local entity needed: ship DDP door to door and get paid via PayPal. Free to list, 6% fee per sale.",
}

const PASOS = [
  ["1", "Apply and open your store", "Free. Create your seller account and upload your products in English; we help you with the Spanish listing."],
  ["2", "A Mexican shop buys", "The buyer pays HETNA in Mexican pesos (cards, Mercado Pago, PayPal). Your product shows an «Imported» label with your country and delivery time."],
  ["3", "Ship DDP door to door", "Send it with DHL, FedEx, UPS or your forwarder with import duties paid (DDP). The buyer pays nothing on delivery."],
  ["4", "Get paid via PayPal", "When the order is delivered, HETNA sends your payment minus the fee to your PayPal account."],
]

const POR_QUE = [
  ["🇲🇽", "A market that imports", "Mexico is one of the largest CNC markets in Latin America and imports most of its machines, tooling and spare parts."],
  ["💰", "Free to list, 6% per sale", "5% on CNC machines. No monthly plan, no setup fee."],
  ["📩", "Quote requests and tenders", "Mexican shops post what they need every week: machines, spindles, servo drives, end mills, laser parts."],
  ["🛡️", "Buyers trust the platform", "Payments and disputes run through HETNA, so buyers feel safe ordering from abroad."],
]

const PREGUNTAS = [
  ["Do I need a company or RFC in Mexico?", "No. You sell from your country, ship DDP and get paid via PayPal."],
  ["Who pays import duties?", "You include them in your price and ship DDP (Delivered Duty Paid). The Mexican buyer pays nothing extra on delivery. This is what buyers expect and it converts much better."],
  ["How long should delivery take?", "Most suppliers quote 10 to 20 business days door to door by express courier. You set your own range; it is shown on every product."],
  ["Can I list in English or Chinese?", "Yes, upload in English; we help translate your listings to Spanish. 我们也可以帮助您把产品资料翻译成西班牙语。"],
  ["What about returns?", "Imported products have no change-of-mind returns (except where the law requires it, with the buyer paying international return shipping). If the item never arrives, arrives damaged or differs from the listing, the buyer gets a full refund and you cover the return. Your payout is released once the order is delivered correctly."],
  ["What if the product is damaged or never arrives?", "The buyer opens a claim inside HETNA. That is why tracking numbers and good packaging matter: they protect you."],
]

export default function SellInMexicoPage() {
  return (
    <main className="w-full bg-[#FAF9F6]" lang="en">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]"><TS>For suppliers outside Mexico · 面向海外供应商</TS></p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl"><TS>Sell your CNC products to Mexican machine shops</TS></h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            <TS>HETNA CNC is a Mexican marketplace 100% focused on CNC. List your machines, tooling and spare parts, ship DDP door to door and get
            paid via PayPal. No office or company in Mexico needed.</TS>
          </p>
          <a href="#apply" className="mt-6 inline-block rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white"><TS>Apply to sell</TS></a>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 lg:px-6">
        <h2 className="text-2xl font-extrabold text-[#142033]"><TS>How it works</TS></h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="grid h-9 w-9 place-items-center rounded-full bg-[#C2560A] font-extrabold text-white">{n}</p>
              <p className="mt-3 font-bold text-[#142033]"><TS>{t}</TS></p>
              <p className="mt-1 text-sm text-[#6B675C]"><TS>{d}</TS></p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-extrabold text-[#142033]"><TS>Why sell on HETNA</TS></h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POR_QUE.map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="text-3xl">{i}</p>
              <p className="mt-2 font-bold text-[#142033]"><TS>{t}</TS></p>
              <p className="mt-1 text-sm text-[#6B675C]"><TS>{d}</TS></p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-extrabold text-[#142033]"><TS>Questions</TS></h2>
        <div className="mt-4 grid gap-3">
          {PREGUNTAS.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-[#E7E4DC] bg-white p-4">
              <summary className="cursor-pointer font-semibold text-[#142033]"><TS>{q}</TS></summary>
              <p className="mt-2 text-sm text-[#40403A]"><TS>{a}</TS></p>
            </details>
          ))}
        </div>

        <div id="apply" className="mt-12 scroll-mt-24 rounded-3xl bg-[#142033] p-5 sm:p-8">
          <h2 className="text-2xl font-extrabold text-white"><TS>Apply to sell in Mexico</TS></h2>
          <p className="mb-5 mt-1 text-white/75"><TS>Takes 2 minutes. 申请只需两分钟。</TS></p>
          <FormProveedorExtranjero />
        </div>
      </section>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
