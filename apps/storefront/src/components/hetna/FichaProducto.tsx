import { VideoProducto } from "./VideoProducto"
import {
  archivos as leerArchivos,
  compatibilidad as leerCompatibilidad,
  faq as leerFaq,
  videos as leerVideos,
} from "@/lib/helpers/product-metadata"

type Meta = Record<string, unknown> | null | undefined

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-display text-[17px] font-semibold m-0 mb-3 text-[#142033]">{children}</h3>
)

const Bloque = ({ children }: { children: React.ReactNode }) => (
  <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(27,27,24,0.04)]">
    {children}
  </section>
)

// Compatibilidad, videos, archivos descargables y preguntas frecuentes de un producto.
// Todo sale de product.metadata; si el producto no trae nada, no se pinta nada.
export const FichaProducto = ({ metadata, titulo }: { metadata?: Meta; titulo: string }) => {
  const compat = leerCompatibilidad(metadata)
  const videos = leerVideos(metadata)
  const archivos = leerArchivos(metadata)
  const preguntas = leerFaq(metadata)

  if (!compat.length && !videos.length && !archivos.length && !preguntas.length) return null

  const ytVideos = videos.filter((v) => v.youtube)
  const otrosVideos = videos.filter((v) => !v.youtube)

  return (
    <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="product-ficha-extendida">
      {preguntas.length > 0 && (
        <script
          id="ld-faq-product"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: preguntas.map((p) => ({
                "@type": "Question",
                name: p.pregunta,
                acceptedAnswer: { "@type": "Answer", text: p.respuesta },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}

      {compat.length > 0 && (
        <Bloque>
          <Titulo>Compatibilidad</Titulo>
          <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
            {compat.map((c) => (
              <li
                key={c}
                className="px-3 py-1.5 rounded-full bg-[#F4F2EC] text-[13px] font-medium text-[#142033] border border-[#E7E4DC]"
              >
                {c}
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {archivos.length > 0 && (
        <Bloque>
          <Titulo>Archivos descargables</Titulo>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {archivos.map((a) => (
              <li key={a.url}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-[10px] border border-[#E7E4DC] px-3 py-2.5 text-[14px] text-[#142033] no-underline transition hover:border-[#F2A65E] hover:bg-[#FFF8F0]"
                >
                  <span className="w-8 h-8 rounded-[8px] bg-[#142033] text-[#F2A65E] flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
                    </svg>
                  </span>
                  <span className="font-medium break-words min-w-0">{a.nombre}</span>
                </a>
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {videos.length > 0 && (
        <div className="lg:col-span-2">
          <Bloque>
            <Titulo>Videos</Titulo>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ytVideos.map((v) => (
                <VideoProducto key={v.url} id={v.youtube as string} titulo={`${titulo} - video`} />
              ))}
            </div>
            {otrosVideos.length > 0 && (
              <ul className="list-none p-0 m-0 mt-3 flex flex-col gap-1.5">
                {otrosVideos.map((v) => (
                  <li key={v.url}>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-[#B34D07] hover:underline break-all">
                      Ver video →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Bloque>
        </div>
      )}

      {preguntas.length > 0 && (
        <div className="lg:col-span-2">
          <Bloque>
            <Titulo>Preguntas frecuentes</Titulo>
            <div className="flex flex-col divide-y divide-[#E7E4DC]">
              {preguntas.map((p) => (
                <details key={p.pregunta} className="group py-3">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[15px] font-semibold text-[#142033]">
                    {p.pregunta}
                    <span className="text-[#B34D07] text-[20px] leading-none transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="m-0 mt-2 text-[14px] leading-[1.6] text-[#4A4A45] whitespace-pre-line">{p.respuesta}</p>
                </details>
              ))}
            </div>
          </Bloque>
        </div>
      )}
    </div>
  )
}
