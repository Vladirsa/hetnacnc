// Piezas del Foro CNC México que se dibujan en el servidor
// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { bloques } from "@/lib/foro/contenido"
import { OCULTO } from "@/lib/foro/filtro"
import { type Autor, TIPOS_CUENTA, TIPOS_TEMA, type TemaResumen, type TipoCuenta, type TipoTema, urlPerfil, urlTema } from "@/lib/foro/tipos"

import { VideoLigero } from "./VideoLigero"

export { AvisoSeguro } from "./AvisoSeguro"

export const COLOR_CUENTA: Record<TipoCuenta, string> = {
  taller: "#C2560A",
  proveedor: "#1D5FA8",
  marca: "#6B3FA0",
  profesional: "#16794F",
  cliente: "#4A5568",
  aficionado: "#8A6D1F",
}

const COLOR_TEMA: Record<TipoTema, [string, string]> = {
  pregunta: ["#E8F0FB", "#1D4F8C"],
  debate: ["#F3ECFB", "#5B3690"],
  trabajo: ["#E6F4EC", "#14683F"],
  video: ["#FDECEC", "#A42A2A"],
  novedad: ["#FFF3E0", "#9A4A06"],
  busco: ["#E0F2F1", "#0B6B62"],
  ofrezco: ["#FDEEE1", "#B34D07"],
  vacante: ["#EDEFFC", "#3B46A6"],
  evento: ["#E6F4EC", "#0F5C38"],
}

export function haceCuanto(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "hace un momento"
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 86400 * 30) return `hace ${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" })
}

export const Avatar = ({ a, size = 36 }: { a: Pick<Autor, "nombre" | "foto" | "tipo">; size?: number }) =>
  a.foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <Image src={a.foto} alt="" width={size} height={size} loading="lazy" className="rounded-full object-cover shrink-0 bg-[#EEE]" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="rounded-full shrink-0 text-white font-bold flex items-center justify-center"
      style={{ width: size, height: size, background: COLOR_CUENTA[a.tipo] || "#4A5568", fontSize: size * 0.42 }}
    >
      {(a.nombre.trim()[0] || "?").toUpperCase()}
    </span>
  )

export const Palomita = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-label="Verificado" role="img" className="shrink-0">
    <circle cx="12" cy="12" r="10" fill="#1D5FA8" />
    <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const InsigniaCuenta = ({ tipo }: { tipo: TipoCuenta }) => (
  <span
    className="text-[11px] font-bold uppercase tracking-wide px-2 py-[2px] rounded-full whitespace-nowrap"
    style={{ color: COLOR_CUENTA[tipo], background: `${COLOR_CUENTA[tipo]}14` }}
  >
    {TIPOS_CUENTA[tipo]?.nombre || tipo}
  </span>
)

export const InsigniaTema = ({ tipo }: { tipo: TipoTema }) => {
  const [fondo, color] = COLOR_TEMA[tipo] || COLOR_TEMA.pregunta
  return (
    <span className="text-[11.5px] font-bold px-2 py-[2px] rounded-[6px] whitespace-nowrap" style={{ background: fondo, color }}>
      {TIPOS_TEMA[tipo]?.nombre || tipo}
    </span>
  )
}

// Taller del directorio de HETNA: lo distingue de un aficionado y lleva a su
// perfil, donde se le puede pedir cotización.
export const InsigniaTaller = ({ a }: { a: Pick<Autor, "taller"> }) =>
  a.taller ? (
    <LocalizedClientLink
      href={`/talleres/${a.taller.handle}`}
      title={a.taller.verificado ? "Taller verificado por HETNA: ver su perfil" : "Taller registrado en HETNA: ver su perfil"}
      className={`text-[11px] font-bold px-2 py-[2px] rounded-full whitespace-nowrap inline-flex items-center gap-1 ${
        a.taller.verificado ? "bg-[#E6F4EC] text-[#14683F] hover:bg-[#D3ECDD]" : "bg-[#EEF1F6] text-[#2D4A73] hover:bg-[#E0E6EF]"
      }`}
    >
      {a.taller.verificado ? "✓ Taller verificado" : "Taller HETNA"} ›
    </LocalizedClientLink>
  ) : null

export const AutorChip = ({ a, cuando, size = 36 }: { a: Autor; cuando?: string; size?: number }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <LocalizedClientLink href={urlPerfil(a.usuario)} className="shrink-0">
      <Avatar a={a} size={size} />
    </LocalizedClientLink>
    <div className="min-w-0 flex flex-col">
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        <LocalizedClientLink href={urlPerfil(a.usuario)} className="font-semibold text-[14px] text-[#1B1B18] hover:text-[#B34D07] truncate">
          {a.nombre}
        </LocalizedClientLink>
        {a.verificado && <Palomita />}
        {a.taller ? <InsigniaTaller a={a} /> : <InsigniaCuenta tipo={a.tipo} />}
      </div>
      {a.titular && <span className="text-[12.5px] text-[#44433D] truncate">{a.titular}</span>}
      <span className="text-[12.5px] text-[#6B6A63]">
        {a.reputacion} pts{cuando ? ` · ${haceCuanto(cuando)}` : ""}
      </span>
    </div>
  </div>
)

const Icono = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
export const ICONOS = {
  voto: "M12 19V5M5 12l7-7 7 7",
  respuesta: "M21 12a8 8 0 0 1-11.7 7.1L3 21l1.9-6.3A8 8 0 1 1 21 12z",
  vista: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm12 4.5 5-3v9l-5-3",
  check: "M5 12.5l4.5 4.5L19 7.5",
  pin: "M12 17v5M8 3h8l-1 6 3 3H6l3-3z",
  escudo: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  mas: "M12 5v14M5 12h14",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm5-2 5 5",
}
export const Ico = ({ n, size }: { n: keyof typeof ICONOS; size?: number }) => <Icono d={ICONOS[n]} size={size} />

export const TarjetaTema = ({ t, mostrarSeccion = true }: { t: TemaResumen; mostrarSeccion?: boolean }) => (
  <article className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 sm:p-5 flex gap-4 hover:border-[#D9C9B6] transition">
    <div className="flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <InsigniaTema tipo={t.tipo} />
        {t.fijado && (
          <span className="text-[11.5px] font-bold text-[#6B6A63] inline-flex items-center gap-1">
            <Ico n="pin" size={13} /> Fijado
          </span>
        )}
        {t.patrocinado && <span className="text-[11px] font-bold uppercase tracking-wide text-[#9A978C]">Patrocinado</span>}
        {t.resuelto && (
          <span className="text-[11.5px] font-bold text-[#16794F] inline-flex items-center gap-1">
            <Ico n="check" size={13} /> Resuelto
          </span>
        )}
        {mostrarSeccion && (
          <LocalizedClientLink href={`/foro-cnc/${t.seccion.slug}`} className="text-[12.5px] text-[#6B6A63] hover:text-[#B34D07]">
            {t.seccion.nombre}
          </LocalizedClientLink>
        )}
      </div>
      <h3 className="m-0 text-[16.5px] sm:text-[17px] leading-snug font-bold text-[#1B1B18]">
        <LocalizedClientLink href={urlTema(t)} className="hover:text-[#B34D07]">
          {t.titulo}
        </LocalizedClientLink>
      </h3>
      {t.extracto && <p className="m-0 text-[14px] text-[#55544D] leading-relaxed line-clamp-2">{t.extracto}</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <AutorChip a={t.autor} cuando={t.ultimaActividad} size={28} />
        <div className="flex items-center gap-3.5 text-[13px] text-[#6B6A63]">
          {t.video && (
            <span className="inline-flex items-center gap-1 text-[#A42A2A]" title="Tiene video">
              <Ico n="video" />
            </span>
          )}
          <span className="inline-flex items-center gap-1" title="Votos de útil">
            <Ico n="voto" /> {t.votos}
          </span>
          <span className={`inline-flex items-center gap-1 ${t.respuestas === 0 ? "text-[#B34D07] font-semibold" : ""}`} title="Respuestas">
            <Ico n="respuesta" /> {t.respuestas}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1" title="Vistas">
            <Ico n="vista" /> {t.vistas}
          </span>
        </div>
      </div>
    </div>
    {t.foto && (
      <LocalizedClientLink href={urlTema(t)} className="hidden sm:block shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Image src={t.foto} alt="" loading="lazy" className="w-[112px] h-[84px] object-cover rounded-[10px] bg-[#F1EFEA]" width={300} height={300} />
      </LocalizedClientLink>
    )}
  </article>
)

// Texto de una publicación: párrafos, ligas (con nofollow), videos y G-code
export const Cuerpo = ({ texto }: { texto: string }) => (
  <div className="flex flex-col gap-3 text-[15px] leading-[1.65] text-[#23231F] break-words">
    {bloques(texto).map((b, i) => {
      if (b.t === "video") return <VideoLigero key={i} video={b.video} />
      if (b.t === "codigo")
        return (
          <pre key={i} className="m-0 bg-[#142033] text-[#E6EDF7] text-[13px] leading-[1.55] rounded-[10px] p-4 overflow-x-auto font-mono">
            {b.v}
          </pre>
        )
      return (
        <p key={i} className="m-0">
          {b.trozos.map((z, j) =>
            z.t === "salto" ? (
              <br key={j} />
            ) : z.t === "liga" ? (
              <a key={j} href={z.v} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-[#B34D07] underline underline-offset-2 break-all">
                {z.v.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)}
                {z.v.replace(/^https?:\/\/(www\.)?/, "").length > 70 ? "…" : ""}
              </a>
            ) : (
              z.v.split(OCULTO).map((pedazo, k, arr) => (
                <span key={`${j}-${k}`}>
                  {pedazo}
                  {k < arr.length - 1 && (
                    <span className="bg-[#FFF3E0] text-[#9A4A06] text-[12.5px] font-semibold px-1.5 py-[1px] rounded" title="Los tratos se hacen dentro de HETNA para que estés protegido">
                      dato de contacto oculto
                    </span>
                  )}
                </span>
              ))
            )
          )}
        </p>
      )
    })}
  </div>
)

export const Fotos = ({ fotos }: { fotos: string[] }) =>
  fotos.length ? (
    <div className={`grid gap-2 ${fotos.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
      {fotos.map((f) => (
        <a key={f} href={f} target="_blank" rel="noopener" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image             src={f}
            alt=""
            loading="lazy"
            className={`w-full rounded-[10px] bg-[#F1EFEA] ${fotos.length === 1 ? "max-h-[520px] object-contain" : "aspect-[4/3] object-cover"}`}
          width={300} height={300} />
        </a>
      ))}
    </div>
  ) : null

export const Paginacion = ({ pagina, total, porPagina, base }: { pagina: number; total: number; porPagina: number; base: string }) => {
  const paginas = Math.ceil(total / porPagina)
  if (paginas <= 1) return null
  const liga = (n: number) => `${base}${base.includes("?") ? "&" : "?"}pagina=${n}`
  return (
    <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Páginas">
      {pagina > 1 && (
        <LocalizedClientLink href={liga(pagina - 1)} className="px-4 py-2 rounded-[10px] border border-[#E7E4DC] bg-white text-[14px] font-semibold hover:border-[#C2560A]">
          Anterior
        </LocalizedClientLink>
      )}
      <span className="text-[13.5px] text-[#6B6A63] px-2">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas && (
        <LocalizedClientLink href={liga(pagina + 1)} className="px-4 py-2 rounded-[10px] border border-[#E7E4DC] bg-white text-[14px] font-semibold hover:border-[#C2560A]">
          Siguiente
        </LocalizedClientLink>
      )}
    </nav>
  )
}

export const Migas = ({ items }: { items: { nombre: string; href?: string }[] }) => (
  <nav className="text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5" aria-label="Migas">
    {items.map((m, i) => (
      <span key={i} className="flex gap-1.5 min-w-0">
        {i > 0 && <span>/</span>}
        {m.href ? (
          <LocalizedClientLink href={m.href} className="hover:text-[#B34D07]">
            {m.nombre}
          </LocalizedClientLink>
        ) : (
          <span className="text-[#1B1B18] font-medium truncate max-w-[60vw]">{m.nombre}</span>
        )}
      </span>
    ))}
  </nav>
)

export const ForoCerrado = () => (
  <main className="w-full bg-[#FAF9F6] px-4 lg:px-16 py-16 flex flex-col items-center text-center gap-3">
    <h1 className="font-display text-[28px] font-bold m-0 text-[#1B1B18]">Foro CNC México</h1>
    <p className="m-0 text-[15.5px] text-[#6B6A63] max-w-[520px]">
      El foro abre muy pronto. Aquí podrás preguntar, mostrar tus trabajos y encontrar talleres y proveedores de CNC en todo México.
    </p>
    <LocalizedClientLink href="/servicios/aprendizaje-cnc" className="mt-2 text-[14.5px] font-semibold text-[#B34D07] hover:underline">
      Ver Aprendizaje CNC
    </LocalizedClientLink>
  </main>
)
