// English landing for the HETNA CNC shop app (the Cotizador), for shops in the US.
// Server component: no client JS. Features come from the real app (repo Vladirsa/Cotizador)
// and the Spanish landing (CotizadorLanding.tsx); prices in USD come from the backend
// (GET /api/cotizador-suscripcion → planes.*.usd) with the same defaults as the backend.
import { APP_TALLER } from "@/lib/hetna/app-taller"

export type PreciosUsd = { taller: number; pro: number; industrial: number; paypal: boolean }

// Same defaults as packages/api/src/lib/cotizador-suscripciones.ts (COTIZADOR_PRECIO_USD_*)
export const PRECIOS_USD_DEFAULT: PreciosUsd = { taller: 29, pro: 59, industrial: 99, paypal: true }

// Sign up with the store account, then straight into the app with a 14-day trial
export const REGISTRO_US = "/us/register?volver=%2Fapi%2Fapp%2Fentrar-cotizador"

const STEPS = [
  ["Create your shop", "Shop name and phone, done. No card needed: 14 days with every feature unlocked."],
  ["Quote from your phone", "Upload the file or type the size. The app prices it with your own costs and margin."],
  ["Send it and follow up", "A PDF with your logo, sent by WhatsApp or email, plus reminders to follow up each customer."],
]

const FEATURES = [
  { t: "Price straight from the file", d: "Upload DXF, SVG, STL or OBJ: the app measures the part, cut length, contours and holes, and prices it with your costs.", i: "📐" },
  { t: "Professional quotes", d: "Branded PDF with part numbers, material and thickness per part, tolerances, terms and every drawing attached as an annex.", i: "📄" },
  { t: "CNC cost simulator", d: "Machine time and material for router, laser, plasma, fiber and 3D printing, with three price options for your customer.", i: "⚙️" },
  { t: "Material yield", d: "How many parts fit per sheet or board, how many sheets to buy and what it costs, before you quote.", i: "🧮" },
  { t: "Customers and follow-ups", d: "Customer list, quote status, reminders and message templates so no quote goes cold.", i: "👥" },
  { t: "Shop control", d: "Job progress, expenses, inventory, machine maintenance, team users and reports in one place.", i: "📊" },
]

const FAQ = [
  ["Does it work in English and in US dollars?", "Yes. Switch the app to English in Settings and set your country to United States: quotes come out in USD with your sales tax rate."],
  ["Do I need to install anything?", "No app store needed. It runs in the browser and installs on Android, iPhone or your computer in one tap, and updates itself."],
  ["Does it work without internet?", "It needs an internet connection to save and sync your quotes, customers and inventory."],
  ["How do I pay?", "Plans are billed monthly in US dollars through PayPal, with your card or your PayPal account."],
  ["Can I cancel anytime?", "Yes. Cancel from the app and keep your plan until the end of the month you paid. The Free plan never expires."],
  ["Is my data private?", "Each shop only sees its own information. Payments are processed by PayPal; HETNA never stores card numbers."],
]

type Plan = { name: string; price: string; note: string; for: string; featured?: boolean; points: string[] }

const planes = (p: PreciosUsd): Plan[] => [
  {
    name: "Free",
    price: "$0",
    note: "forever",
    for: "Start quoting today.",
    points: ["5 quotes per month", "PDF with HETNA CNC watermark", "1 sample professional quote", "Customers, products and job progress", "Follow-up reminders", "1 user"],
  },
  {
    name: "Shop",
    price: `$${p.taller}`,
    note: "per month",
    for: "For shops that quote every day.",
    featured: true,
    points: ["Unlimited quotes", "Professional PDF with your logo, no watermark", "Price from DXF, SVG, STL or OBJ files", "Cost simulator with 3 price options", "Shop costs: overhead, machines and labor", "Real cost and profit per order", "Machine maintenance reminders", "Expenses and purchases", "2 users"],
  },
  {
    name: "Pro",
    price: `$${p.pro}`,
    note: "per month",
    for: "Grow with control and data.",
    points: ["Everything in Shop", "Inventory", "Customer segments and message templates", "Excel reports", "Profit, expenses and conversion dashboard", "Profitability per machine and per customer", "5 users"],
  },
  {
    name: "Industrial",
    price: `$${p.industrial}`,
    note: "per month",
    for: "For companies with several machines.",
    points: ["Everything in Pro", "4 and 5-axis CAM in the CAM Studio", "Unlimited users"],
  },
]

export function CotizadorLandingEn({ precios }: { precios: PreciosUsd }) {
  return (
    <main className="w-full bg-[#FAF9F6]" lang="en">
      {/* Hero */}
      <section className="px-4 lg:px-16 pt-6 pb-8">
        <div className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-10 grid lg:grid-cols-[1fr_320px] gap-8 items-center overflow-hidden">
          <div className="flex flex-col gap-4">
            <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
              Quoting app for CNC shops
            </span>
            <h1 className="font-display text-[30px] lg:text-[46px] leading-[1.06] font-bold m-0 max-w-[720px]">
              Quote CNC jobs in minutes, with your real costs
            </h1>
            <p className="m-0 text-[15.5px] lg:text-[17px] text-[#C9D2E0] max-w-[640px] leading-relaxed">
              HETNA CNC is the shop app for router, laser, plasma and 3D printing shops: upload the part file, get a price from your machine time,
              material and margin, and send a professional quote from your phone.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a href={REGISTRO_US} className="inline-flex items-center bg-[#C2560A] hover:brightness-110 text-white font-extrabold px-5 py-3 rounded-[10px] text-[15px]">
                Start your 14-day free trial
              </a>
              <a href="#pricing" className="inline-flex items-center border border-[#3A4A63] hover:border-white text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]">
                See pricing
              </a>
            </div>
            <p className="m-0 text-[13px] text-[#9FB0C8]">No credit card · Free plan after the trial · Android, iPhone and computer</p>
          </div>
          <div className="hidden lg:flex flex-col gap-2 bg-[#0F1826] rounded-[14px] p-4 border border-[#2A3A55]" aria-hidden="true">
            <span className="text-[12px] uppercase tracking-wide font-bold text-[#9FB0C8]">What your customer gets</span>
            <div className="bg-white text-[#1B1B18] rounded-[10px] p-3 text-[12.5px] flex flex-col gap-1.5">
              <span className="font-bold text-[14px]">Quote Q-0148</span>
              <span className="text-[#6B6A63]">Aluminum bracket 6061 · 1/4&quot; · 50 pcs</span>
              <div className="grid grid-cols-3 gap-1 pt-1">
                {[["Economy", "$1,240"], ["Standard", "$1,480"], ["Rush", "$1,890"]].map(([n, p]) => (
                  <div key={n} className={`rounded-[8px] border p-1.5 text-center ${n === "Standard" ? "border-[#C2560A] bg-[#FFF3EA]" : "border-[#E7E4DC]"}`}>
                    <div className="text-[10.5px] text-[#6B6A63]">{n}</div>
                    <div className="font-bold">{p}</div>
                  </div>
                ))}
              </div>
              <span className="mt-1 rounded-[8px] bg-[#16794F] text-white text-center font-semibold py-1.5">PDF with your logo and drawings</span>
            </div>
            <span className="text-[11px] text-[#7E8DA6]">Example layout, not a real customer.</span>
          </div>
        </div>
      </section>

      <div className="px-4 lg:px-16 pb-14 flex flex-col gap-12">
        {/* Who it's for */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Built for small and mid-size CNC shops</h2>
          <p className="m-0 text-[14.5px] text-[#6B6A63] max-w-[780px]">
            Router and sign shops, laser and plasma cutters, machine shops and 3D printing services that quote custom parts every day and lose time
            (and margin) building prices in spreadsheets.
          </p>
          <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
            {["CNC router", "Laser (CO₂ and fiber)", "Plasma", "Milling and turning", "3D printing", "Signs and woodwork"].map((x) => (
              <li key={x} className="text-[13px] font-semibold bg-white border border-[#E7E4DC] rounded-full px-3 py-1 text-[#142033]">{x}</li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">What it does</h2>
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((v) => (
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

        {/* How it works */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">How it works</h2>
          <ol className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-2">
                <span className="w-8 h-8 rounded-full bg-[#142033] text-white text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
                <h3 className="m-0 text-[15.5px] font-bold text-[#1B1B18]">{t}</h3>
                <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing */}
        <section id="pricing" className="flex flex-col gap-4 scroll-mt-24">
          <div>
            <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Pricing</h2>
            <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">US dollars per month. Every plan starts with a 14-day trial with everything unlocked; the Free plan never expires.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {planes(precios).map((p) => (
              <div key={p.name} className={`bg-white rounded-[14px] p-5 flex flex-col gap-3 border ${p.featured ? "border-[#C2560A] border-2" : "border-[#E7E4DC]"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="m-0 font-display text-[20px] font-bold text-[#1B1B18]">{p.name}</h3>
                  {p.featured && <span className="text-[11px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#B34D07] px-2 py-0.5 rounded-full">Most popular</span>}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-bold text-[#1B1B18]">{p.price}</span>
                  <span className="text-[13px] text-[#6B6A63]">{p.note}</span>
                </div>
                <p className="m-0 text-[13px] text-[#6B6A63]">{p.for}</p>
                <ul className="m-0 p-0 list-none flex flex-col gap-1.5 text-[13.5px] text-[#1B1B18]">
                  {p.points.map((x) => (
                    <li key={x} className="flex gap-2"><span className="text-[#16794F]" aria-hidden="true">✓</span>{x}</li>
                  ))}
                </ul>
                <a href={REGISTRO_US} className={`mt-auto text-center font-semibold px-4 py-2.5 rounded-[10px] text-[14px] ${p.featured ? "bg-[#C2560A] hover:brightness-110 text-white" : "border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18]"}`}>
                  {p.name === "Free" ? "Start free" : "Start 14-day free trial"}
                </a>
              </div>
            ))}
          </div>
          <p className="m-0 text-[13px] text-[#6B6A63]">
            {precios.paypal ? "Paid plans are billed monthly through PayPal (card or PayPal account). " : ""}Cancel anytime and keep your plan until the end of the paid month.
          </p>
        </section>

        {/* Install */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Install it from your browser</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13.5px] text-[#6B6A63] leading-relaxed">
            <p className="m-0 bg-white border border-[#E7E4DC] rounded-[14px] p-5"><strong className="text-[#1B1B18]">Android:</strong> open the app in Chrome and tap <em>Install</em>. Prefer an APK? <a href={APP_TALLER.android} className="underline">Download it here</a>.</p>
            <p className="m-0 bg-white border border-[#E7E4DC] rounded-[14px] p-5"><strong className="text-[#1B1B18]">iPhone and iPad:</strong> open the app in Safari, tap <em>Share</em> and then <em>Add to Home Screen</em>.</p>
            <p className="m-0 bg-white border border-[#E7E4DC] rounded-[14px] p-5"><strong className="text-[#1B1B18]">Computer:</strong> in Chrome or Edge, use the install icon in the address bar. Same account and data as on your phone.</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[24px] font-bold m-0 text-[#1B1B18]">Frequently asked questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3">
                <summary className="cursor-pointer text-[14.5px] font-bold text-[#1B1B18]">{q}</summary>
                <p className="m-0 mt-2 text-[13.5px] text-[#6B6A63] leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-bold m-0">Stop pricing jobs in spreadsheets</h2>
            <p className="m-0 mt-1 text-[14px] text-[#C9D2E0]">14 days with everything unlocked. No credit card.</p>
          </div>
          <a href={REGISTRO_US} className="inline-flex items-center bg-[#C2560A] hover:brightness-110 text-white font-extrabold px-5 py-3 rounded-[10px] text-[15px]">
            Start your 14-day free trial
          </a>
        </section>

        <p className="m-0 text-[13px] text-[#6B6A63]">
          ¿Hablas español? <a href="/mx/servicios/cotizador-cnc" hrefLang="es-MX" className="underline">Ver la app HETNA CNC en español</a>
        </p>
      </div>
    </main>
  )
}

export const FAQ_EN = FAQ
