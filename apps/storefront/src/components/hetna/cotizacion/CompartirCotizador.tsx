"use client"

import { useState } from "react"

// Herramientas para que el taller comparta su cotizador en línea: copiar la
// liga, el código para su página web, el QR para su local (SVG o PNG) y
// mandarlo por WhatsApp o Facebook.
function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        } catch {}
      }}
      className="rounded-lg bg-[#142033] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1E2E4A]"
    >
      {ok ? "¡Copiado!" : etiqueta}
    </button>
  )
}

export function CompartirCotizador({ liga, slug, nombre, qrSvg }: { liga: string; slug: string; nombre: string; qrSvg: string }) {
  const codigoWidget = `<div data-hetna-cotizador="${slug}"></div>\n<script src="https://hetnacnc.com/widget/cotizador.js" async></script>`
  const codigoIframe = `<iframe src="https://hetnacnc.com/mx/embed/t/${slug}" title="Cotiza con ${nombre.replace(/"/g, "")}" style="width:100%;min-height:900px;border:0" loading="lazy"></iframe>`
  const textoWa = `Cotiza tu pieza en línea con ${nombre}: sube tu archivo y recibe tu precio. ${liga}`
  const bajarSvg = () => {
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([qrSvg], { type: "image/svg+xml" }))
    a.download = `qr-cotizador-${slug}.svg`
    a.click()
  }
  const bajarPng = () => {
    const img = new Image()
    img.onload = () => {
      const lado = 1200
      const c = document.createElement("canvas")
      c.width = c.height = lado
      const ctx = c.getContext("2d")
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, lado, lado)
      const a = document.createElement("a")
      a.href = c.toDataURL("image/png")
      a.download = `qr-cotizador-${slug}.png`
      a.click()
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`
  }
  const caja = "rounded-2xl border border-[#E7E4DC] bg-white p-5"
  const pre = "mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-[#F5F3EE] p-3 text-[12px] text-[#1B1B18]"
  return (
    <div className="grid gap-4">
      <section className={caja}>
        <h2 className="text-lg font-extrabold text-[#142033]">1. Tu liga</h2>
        <p className="mt-1 text-sm text-[#6B675C]">Ponla en tu WhatsApp Business, tu bio de Instagram y TikTok, y en tus cotizaciones.</p>
        <p className="mt-3 break-all rounded-lg bg-[#F5F3EE] p-3 text-[14px] font-semibold text-[#142033]">{liga}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Copiar texto={liga} etiqueta="Copiar liga" />
          <a href={`https://wa.me/?text=${encodeURIComponent(textoWa)}`} target="_blank" rel="noopener" className="rounded-lg bg-[#25D366] px-4 py-2 text-[13px] font-semibold text-white">
            Mandar por WhatsApp
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(liga)}`} target="_blank" rel="noopener" className="rounded-lg bg-[#1877F2] px-4 py-2 text-[13px] font-semibold text-white">
            Compartir en Facebook
          </a>
        </div>
      </section>

      <section className={caja}>
        <h2 className="text-lg font-extrabold text-[#142033]">2. QR para tu local y tus tarjetas</h2>
        <p className="mt-1 text-sm text-[#6B675C]">Imprímelo en el mostrador, en tu camioneta o en tus tarjetas: el cliente lo escanea y cotiza desde su celular.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="rounded-xl border border-[#E7E4DC] p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="flex flex-col gap-2">
            <button type="button" onClick={bajarPng} className="rounded-lg bg-[#142033] px-4 py-2 text-[13px] font-semibold text-white">Descargar PNG (para imprimir)</button>
            <button type="button" onClick={bajarSvg} className="rounded-lg border border-[#142033] px-4 py-2 text-[13px] font-semibold text-[#142033]">Descargar SVG (para diseño)</button>
          </div>
        </div>
      </section>

      <section className={caja}>
        <h2 className="text-lg font-extrabold text-[#142033]">3. El cotizador dentro de tu página web</h2>
        <p className="mt-1 text-sm text-[#6B675C]">
          Pega este código en tu página (WordPress, Wix, Shopify o HTML) donde quieras que aparezca. Tus clientes cotizan sin salir de tu sitio y la solicitud te llega a la app como siempre.
        </p>
        <pre className={pre}>{codigoWidget}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Copiar texto={codigoWidget} etiqueta="Copiar código" />
        </div>
        <details className="mt-3 text-sm text-[#40403A]">
          <summary className="cursor-pointer font-semibold">¿Tu página no acepta scripts? Usa este iframe</summary>
          <pre className={pre}>{codigoIframe}</pre>
          <div className="mt-2">
            <Copiar texto={codigoIframe} etiqueta="Copiar iframe" />
          </div>
        </details>
      </section>

      <section className={caja}>
        <h2 className="text-lg font-extrabold text-[#142033]">Así se ve en tu página</h2>
        <iframe src={`/mx/embed/t/${slug}`} title="Vista previa del widget" className="mt-3 h-[720px] w-full rounded-xl border border-[#E7E4DC]" loading="lazy" />
      </section>
    </div>
  )
}
