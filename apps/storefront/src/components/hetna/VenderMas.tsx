import { baseSitio } from "@/lib/hetna/schema"

// Debajo del bloque de confianza: interés real de otros compradores, compartir
// por WhatsApp y la opción de mandarlo hacer a la medida con talleres de HETNA.
// Sólo datos ciertos: las vistas son aperturas reales de la ficha esta semana.
export function VenderMas({ titulo, handle, locale, vistas }: { titulo: string; handle: string; locale: string; vistas: number }) {
  const url = `${baseSitio()}/${locale}/products/${handle}`
  const whats = `https://wa.me/?text=${encodeURIComponent(`${titulo} en HETNA CNC: ${url}`)}`
  const medida = `/${locale}/cotizar?desde=producto&pieza=${encodeURIComponent(titulo.slice(0, 120))}`
  return (
    <div className="flex flex-col gap-3" data-testid="product-vender-mas">
      {vistas >= 10 && (
        <p className="m-0 text-sm text-[#40403A]">
          <span aria-hidden>👀</span> <strong className="text-[#142033]">{vistas.toLocaleString("es-MX")} visitas</strong> a este producto en los últimos 7 días
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <a
          href={whats}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#25D366] px-3 py-2 text-sm font-bold text-[#128C4A] hover:bg-[#25D366]/10"
        >
          Compártelo por WhatsApp
        </a>
        <a href={medida} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#C2560A] px-3 py-2 text-sm font-bold text-[#C2560A] hover:bg-[#C2560A]/10" data-testid="product-cotizar-similar">
          Cotizar algo similar o a tu medida
        </a>
      </div>
    </div>
  )
}

// El video vertical que la Fábrica hizo de este producto para redes (si existe).
// Pedido de Vlado (23 nov 2026): se veía como un rectángulo chato y chico
// (sin preload el navegador no sabe que es vertical). Ahora la caja ya es 9:16
// desde el inicio, se ve el primer cuadro, y en computadora va de lado con un
// texto; en celular el texto arriba y el video abajo.
export function VideoProducto({ url, titulo }: { url: string; titulo: string }) {
  return (
    <section
      className="mt-8 overflow-hidden rounded-2xl border border-[#E2E5E9] bg-white"
      aria-labelledby="titulo-video-producto"
      data-testid="product-video"
    >
      <div className="grid items-center gap-6 p-5 md:grid-cols-[minmax(0,1fr)_300px] md:gap-10 md:p-8 lg:grid-cols-[minmax(0,520px)_340px] lg:justify-center lg:gap-16">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C2560A]">Video del producto</p>
          <h2 id="titulo-video-producto" className="mt-1 text-2xl font-extrabold leading-tight text-[#142033] md:text-3xl">
            Míralo en video
          </h2>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#40403A]">
            Así se ve <strong className="text-[#142033]">{titulo}</strong> en movimiento: el acabado y los detalles que en una foto no se alcanzan a ver.
          </p>
          <ul className="mt-4 grid gap-2 text-[14px] text-[#1E2329]">
            <li className="flex gap-2"><span aria-hidden className="text-[#C2560A]">▶</span> Dale play; empieza sin sonido y lo puedes subir.</li>
            <li className="flex gap-2"><span aria-hidden className="text-[#C2560A]">⛶</span> Ábrelo en pantalla completa para verlo grande.</li>
          </ul>
        </div>
        <video
          src={`${url}#t=0.1`}
          controls
          playsInline
          muted
          preload="metadata"
          className="mx-auto block aspect-[9/16] w-full max-w-[300px] rounded-xl bg-black object-contain md:max-w-none"
        />
      </div>
    </section>
  )
}
