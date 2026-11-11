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
          className="inline-flex items-center gap-2 rounded-lg border border-[#25D366] px-3 py-2 text-sm font-bold text-[#128C4A] hover:bg-[#25D366]/10"
        >
          Compártelo por WhatsApp
        </a>
        <a href={medida} className="inline-flex items-center gap-2 rounded-lg border border-[#C2560A] px-3 py-2 text-sm font-bold text-[#C2560A] hover:bg-[#C2560A]/10">
          ¿Lo necesitas a la medida? Cotízalo con talleres
        </a>
      </div>
    </div>
  )
}

// El video vertical que la Fábrica hizo de este producto para redes (si existe).
export function VideoProducto({ url, titulo }: { url: string; titulo: string }) {
  return (
    <section className="mt-6" aria-label={`Video de ${titulo}`} data-testid="product-video">
      <h2 className="mb-3 text-lg font-extrabold text-[#142033]">Míralo en video</h2>
      <video src={url} controls playsInline muted preload="none" className="mx-auto block max-h-[640px] w-full max-w-[360px] rounded-xl bg-black" />
    </section>
  )
}
