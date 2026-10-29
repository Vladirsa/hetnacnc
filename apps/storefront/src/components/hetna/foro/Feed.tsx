// Piezas del foro con estilo de red profesional: composer, feed, perfil lateral
// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import AnunciosEspacio from "@/components/hetna/publicidad/AnunciosEspacio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Ayudador, SesionForo } from "@/lib/foro/consultas"
import { type Autor, type Seccion, type TemaResumen, TIPOS_CUENTA, urlPerfil, urlTema } from "@/lib/foro/tipos"

import { AvisoSeguro, Avatar, COLOR_CUENTA, Ico, InsigniaCuenta, InsigniaTaller, InsigniaTema, Palomita, haceCuanto } from "./Piezas"

const TARJETA = "bg-white border border-[#E7E4DC] rounded-[12px]"
const BTN = "inline-flex items-center justify-center text-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2 rounded-full text-[14px]"

export const Composer = ({ sesion }: { sesion: SesionForo }) => {
  const p = sesion?.perfil
  const atajos: [string, string][] = [
    ["pregunta", "Pregunta"],
    ["trabajo", "Mi trabajo"],
    ["video", "Video"],
    ["novedad", "Novedad"],
  ]
  return (
    <div className={`${TARJETA} p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-3">
        {p ? <Avatar a={p} size={46} /> : <span className="w-[46px] h-[46px] rounded-full bg-[#E7E4DC] shrink-0" />}
        <LocalizedClientLink
          href="/foro-cnc/nuevo"
          className="flex-1 px-4 py-3 rounded-full border border-[#D9D4C8] text-[14.5px] text-[#6B6A63] hover:bg-[#F6F4EF]"
        >
          ¿Qué quieres compartir o preguntar?
        </LocalizedClientLink>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {atajos.map(([v, n]) => (
          <LocalizedClientLink
            key={v}
            href={`/foro-cnc/nuevo?tipo=${v}`}
            className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-[#44433D] hover:bg-[#FDEEE1] hover:text-[#B34D07]"
          >
            {n}
          </LocalizedClientLink>
        ))}
      </div>
    </div>
  )
}

export const ColIzquierda = ({ secciones, actual, sesion }: { secciones: Seccion[]; actual?: string; sesion: SesionForo }) => {
  const p = sesion?.perfil
  const color = p ? COLOR_CUENTA[p.tipo] : "#C2560A"
  return (
    <aside className="hidden lg:flex flex-col gap-3 sticky top-4 self-start">
      <div className={`${TARJETA} overflow-hidden`}>
        <div className="h-[56px]" style={{ background: `linear-gradient(120deg, ${color}, #142033)` }} />
        <div className="px-4 pb-4 -mt-8 flex flex-col gap-1">
          {p ? (
            <>
              <span className="inline-block rounded-full ring-4 ring-white w-fit">
                <Avatar a={p} size={64} />
              </span>
              <LocalizedClientLink href={urlPerfil(p.usuario)} className="font-bold text-[16px] text-[#1B1B18] hover:text-[#B34D07] truncate">
                {p.nombre}
              </LocalizedClientLink>
              <span className="text-[13px] text-[#6B6A63]">
                {TIPOS_CUENTA[p.tipo]?.nombre} · {p.reputacion} pts
              </span>
              <LocalizedClientLink href="/foro-cnc/mi-perfil" className="text-[13px] font-semibold text-[#B34D07] hover:underline mt-1">
                Editar perfil
              </LocalizedClientLink>
            </>
          ) : (
            <>
              <span className="inline-block w-16 h-16 rounded-full bg-[#E7E4DC] ring-4 ring-white" />
              <strong className="text-[15px] text-[#1B1B18] mt-1">Únete a la comunidad CNC</strong>
              <p className="m-0 text-[13px] text-[#6B6A63] leading-relaxed">Pregunta, muestra tus trabajos y date a conocer. Es gratis.</p>
              <LocalizedClientLink href={sesion ? "/foro-cnc/mi-perfil" : "/register"} className={`${BTN} mt-2`}>
                {sesion ? "Crear mi perfil" : "Crear cuenta gratis"}
              </LocalizedClientLink>
              {!sesion && (
                <LocalizedClientLink href="/login" className="text-center text-[13.5px] font-semibold text-[#B34D07] hover:underline mt-1">
                  Ya tengo cuenta
                </LocalizedClientLink>
              )}
            </>
          )}
        </div>
      </div>

      <nav className={`${TARJETA} p-2`} aria-label="Secciones del foro">
        <LocalizedClientLink
          href="/foro-cnc/blog"
          className="flex items-center justify-between gap-2 px-3 py-2 mb-1 rounded-[8px] text-[14px] font-semibold text-[#14683F] bg-[#EEF6EE] hover:bg-[#E0F0E4]"
        >
          <span>Blog y guías</span>
          <span aria-hidden="true">→</span>
        </LocalizedClientLink>
        <span className="block px-3 pt-2 pb-1 text-[12px] font-bold uppercase tracking-wide text-[#9A978C]">Secciones</span>
        <ul className="m-0 p-0 list-none">
          {secciones.map((s) => (
            <li key={s.slug}>
              <LocalizedClientLink
                href={`/foro-cnc/${s.slug}`}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] text-[14px] ${
                  actual === s.slug ? "bg-[#FDEEE1] text-[#B34D07] font-semibold" : "text-[#1B1B18] hover:bg-[#F6F4EF]"
                }`}
              >
                <span className="truncate">{s.nombre}</span>
                <span className="text-[12px] text-[#9A978C]">{s.temas}</span>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

export const ChipsSecciones = ({ secciones, actual }: { secciones: Seccion[]; actual?: string }) => (
  <nav className="lg:hidden flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" aria-label="Secciones del foro">
    <LocalizedClientLink
      href="/foro-cnc"
      className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13.5px] font-semibold border ${
        !actual ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#44433D] border-[#D9D4C8]"
      }`}
    >
      Todo
    </LocalizedClientLink>
    {secciones.map((s) => (
      <LocalizedClientLink
        key={s.slug}
        href={`/foro-cnc/${s.slug}`}
        className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13.5px] font-semibold border ${
          actual === s.slug ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#44433D] border-[#D9D4C8]"
        }`}
      >
        {s.nombre}
      </LocalizedClientLink>
    ))}
  </nav>
)

export const ColDerecha = ({ destacados, semana = [], sesion = null }: { destacados: Autor[]; semana?: Ayudador[]; sesion?: SesionForo }) => (
  <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
    <QuienesAyudan semana={semana} siempre={destacados} />
    <CaptarTaller sesion={sesion} />
    <LocalizedClientLink href="/servicios/copiloto-ia-cnc" className="bg-[#142033] text-white rounded-[12px] p-4 flex flex-col gap-1 hover:bg-[#1B2A42]">
      <strong className="text-[14.5px]">¿Prisa? Pregúntale al Copiloto IA CNC</strong>
      <span className="text-[13px] text-[#C9D2E0]">Velocidades, avances y errores de tu máquina al instante.</span>
    </LocalizedClientLink>
    {/* Publicidad del foro (no dibuja nada si no hay anuncios vigentes) */}
    <AnunciosEspacio espacio="foro_lateral" />
    <AvisoSeguro />
  </aside>
)

// "Los que más ayudan": los de esta semana si hay; si no, los de siempre.
// Cada uno con la liga a su taller, para que ayudar le traiga clientes.
export const QuienesAyudan = ({ semana, siempre }: { semana: Ayudador[]; siempre: Autor[] }) => {
  const lista: (Autor & { detalle: string })[] = semana.length
    ? semana.map((a) => ({ ...a, detalle: `${a.respuestas} ${a.respuestas === 1 ? "respuesta" : "respuestas"}${a.mejores ? ` · ${a.mejores} mejor` : ""}` }))
    : siempre.map((a) => ({ ...a, detalle: `${a.reputacion} pts` }))
  if (!lista.length) return null
  return (
    <div className="bg-white border border-[#E7E4DC] rounded-[12px] p-4 flex flex-col gap-3">
      <span className="text-[12px] font-bold uppercase tracking-wide text-[#9A978C]">
        {semana.length ? "Los que más ayudan esta semana" : "Los que más ayudan"}
      </span>
      {lista.map((a, i) => (
        <div key={a.id} className="flex items-center gap-2.5">
          <span className="w-4 text-[12px] font-bold text-[#9A978C]">{i + 1}</span>
          <LocalizedClientLink href={urlPerfil(a.usuario)} className="shrink-0">
            <Avatar a={a} size={34} />
          </LocalizedClientLink>
          <span className="flex-1 min-w-0 flex flex-col">
            <LocalizedClientLink href={urlPerfil(a.usuario)} className="text-[14px] font-semibold text-[#1B1B18] truncate hover:text-[#B34D07]">
              {a.nombre}
            </LocalizedClientLink>
            <span className="text-[12px] text-[#6B6A63] truncate">{a.detalle}</span>
          </span>
          <InsigniaTaller a={a} />
        </div>
      ))}
    </div>
  )
}

// Para quien sabe y todavía no tiene su taller en HETNA.
export const CaptarTaller = ({ sesion }: { sesion: SesionForo }) =>
  sesion?.perfil?.taller ? null : (
    <LocalizedClientLink
      href={sesion?.perfil && ["taller", "proveedor", "profesional"].includes(sesion.perfil.tipo) ? "/foro-cnc/mi-perfil#taller" : "/talleres/unete"}
      className="bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] p-4 flex flex-col gap-1 hover:border-[#C2560A]"
    >
      <strong className="text-[14.5px] text-[#1B1B18]">¿Tienes taller? Que te encuentren</strong>
      <span className="text-[13px] text-[#5A3A12]">
        Liga tu taller a tu perfil: tus respuestas llevan a tu página y recibes solicitudes de cotización.
      </span>
    </LocalizedClientLink>
  )

export const Publicacion = ({ t }: { t: TemaResumen }) => (
  <article className={`${TARJETA} overflow-hidden`}>
    <div className="p-4 pb-2 flex items-start gap-3">
      <LocalizedClientLink href={urlPerfil(t.autor.usuario)} className="shrink-0">
        <Avatar a={t.autor} size={48} />
      </LocalizedClientLink>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <LocalizedClientLink href={urlPerfil(t.autor.usuario)} className="font-semibold text-[15px] text-[#1B1B18] hover:text-[#B34D07] truncate">
            {t.autor.nombre}
          </LocalizedClientLink>
          {t.autor.verificado && <Palomita />}
          {t.autor.taller ? <InsigniaTaller a={t.autor} /> : <InsigniaCuenta tipo={t.autor.tipo} />}
        </div>
        <span className="text-[12.5px] text-[#6B6A63]">
          {t.autor.reputacion} pts · {haceCuanto(t.ultimaActividad)}
        </span>
      </div>
      {t.fijado && (
        <span className="text-[12px] font-bold text-[#6B6A63] inline-flex items-center gap-1">
          <Ico n="pin" size={13} /> Fijado
        </span>
      )}
    </div>

    <div className="px-4 pb-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <InsigniaTema tipo={t.tipo} />
        {t.resuelto && (
          <span className="text-[12px] font-bold text-[#16794F] inline-flex items-center gap-1">
            <Ico n="check" size={13} /> Resuelto
          </span>
        )}
        {t.patrocinado && <span className="text-[11px] font-bold uppercase tracking-wide text-[#9A978C]">Patrocinado</span>}
        <LocalizedClientLink href={`/foro-cnc/${t.seccion.slug}`} className="text-[12.5px] text-[#6B6A63] hover:text-[#B34D07]">
          en {t.seccion.nombre}
        </LocalizedClientLink>
      </div>
      <h3 className="m-0 text-[17px] leading-snug font-bold text-[#1B1B18]">
        <LocalizedClientLink href={urlTema(t)} className="hover:text-[#B34D07]">
          {t.titulo}
        </LocalizedClientLink>
      </h3>
      {t.extracto && <p className="m-0 text-[14.5px] text-[#44433D] leading-relaxed line-clamp-3">{t.extracto}</p>}
    </div>

    {t.foto && (
      <LocalizedClientLink href={urlTema(t)} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Image src={t.foto} alt={t.titulo} loading="lazy" decoding="async" className="w-full max-h-[420px] object-cover bg-[#F1EFEA]" width={300} height={300} />
      </LocalizedClientLink>
    )}

    <div className="px-4 py-2 flex items-center justify-between text-[12.5px] text-[#6B6A63]">
      <span className="inline-flex items-center gap-1">
        <Ico n="voto" size={13} /> {t.votos} útil
      </span>
      <span>
        {t.respuestas} {t.respuestas === 1 ? "respuesta" : "respuestas"} · {t.vistas} vistas
      </span>
    </div>
    <div className="grid grid-cols-3 border-t border-[#EFECE5] text-[13.5px] font-semibold text-[#44433D]">
      <LocalizedClientLink href={urlTema(t)} className="py-2.5 text-center hover:bg-[#F6F4EF] inline-flex items-center justify-center gap-1.5">
        <Ico n="voto" size={15} /> Útil
      </LocalizedClientLink>
      <LocalizedClientLink href={`${urlTema(t)}#respuestas`} className={`py-2.5 text-center hover:bg-[#F6F4EF] inline-flex items-center justify-center gap-1.5 ${t.respuestas === 0 ? "text-[#B34D07]" : ""}`}>
        <Ico n="respuesta" size={15} /> {t.respuestas === 0 ? "Responder" : "Comentar"}
      </LocalizedClientLink>
      <LocalizedClientLink href={urlTema(t)} className="py-2.5 text-center hover:bg-[#F6F4EF] inline-flex items-center justify-center gap-1.5">
        <Ico n="vista" size={15} /> Ver
      </LocalizedClientLink>
    </div>
  </article>
)
