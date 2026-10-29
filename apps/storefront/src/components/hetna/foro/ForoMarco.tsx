// Marco de las páginas del foro: portada, pestañas, lista y barra lateral
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Ayudador, SesionForo } from "@/lib/foro/consultas"
import type { Autor, Seccion } from "@/lib/foro/tipos"
import { urlPerfil } from "@/lib/foro/tipos"

import { AvisoSeguro } from "./AvisoSeguro"
import { CaptarTaller, QuienesAyudan } from "./Feed"
import { Avatar, Ico } from "./Piezas"

export const BotonPublicar = ({ seccion, className = "" }: { seccion?: string; className?: string }) => (
  <LocalizedClientLink
    href={`/foro-cnc/nuevo${seccion ? `?seccion=${seccion}` : ""}`}
    className={`inline-flex items-center justify-center gap-2 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px] ${className}`}
  >
    <Ico n="mas" size={16} />
    Publicar
  </LocalizedClientLink>
)

export const Buscador = ({ locale, valor = "", seccion }: { locale: string; valor?: string; seccion?: string }) => (
  <form action={`/${locale}/foro-cnc`} method="get" role="search" className="flex items-center bg-white rounded-[10px] border border-[#E0DCD2] focus-within:border-[#C2560A] overflow-hidden">
    <span className="pl-3 text-[#9A978C]">
      <Ico n="buscar" size={17} />
    </span>
    <input
      name="q"
      defaultValue={valor}
      placeholder={seccion ? "Buscar en esta sección…" : "Busca tu duda: fresa para acrílico, error de Mach3…"}
      className="flex-1 min-w-0 px-2.5 py-3 text-[15px] text-[#1B1B18] focus:outline-none"
      aria-label="Buscar en el foro"
    />
    {seccion && <input type="hidden" name="seccion" value={seccion} />}
    <button type="submit" className="px-4 py-3 text-[14px] font-semibold text-[#B34D07] hover:bg-[#FDEEE1]">
      Buscar
    </button>
  </form>
)

export const Pestanas = ({ base, actual, opciones }: { base: string; actual: string; opciones: { v: string; nombre: string }[] }) => (
  <div className="flex gap-1 overflow-x-auto border-b border-[#E7E4DC] -mx-1 px-1">
    {opciones.map((o) => (
      <LocalizedClientLink
        key={o.v}
        href={o.v === opciones[0].v ? base : `${base}${base.includes("?") ? "&" : "?"}orden=${o.v}`}
        className={`px-3.5 py-2.5 text-[14px] font-semibold whitespace-nowrap border-b-2 -mb-px ${
          actual === o.v ? "border-[#C2560A] text-[#1B1B18]" : "border-transparent text-[#6B6A63] hover:text-[#1B1B18]"
        }`}
      >
        {o.nombre}
      </LocalizedClientLink>
    ))}
  </div>
)

export const Lateral = ({ secciones, actual, sesion, destacados, semana = [] }: { secciones: Seccion[]; actual?: string; sesion: SesionForo; destacados: Autor[]; semana?: Ayudador[] }) => (
  <aside className="flex flex-col gap-5">
    {!sesion ? (
      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-3">
        <strong className="text-[15.5px] text-[#1B1B18]">Únete a la comunidad CNC de México</strong>
        <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">
          Pregunta, muestra tus trabajos y date a conocer con tu perfil de taller, proveedor o profesional. Es gratis.
        </p>
        <LocalizedClientLink href="/register" className="text-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
          Crear cuenta gratis
        </LocalizedClientLink>
        <LocalizedClientLink href="/login" className="text-center text-[14px] font-semibold text-[#B34D07] hover:underline">
          Ya tengo cuenta
        </LocalizedClientLink>
      </div>
    ) : !sesion.perfil ? (
      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-3">
        <strong className="text-[15.5px] text-[#1B1B18]">Crea tu perfil del foro</strong>
        <p className="m-0 text-[13.5px] text-[#6B6A63] leading-relaxed">Elige si eres taller, proveedor, profesional o aficionado y agrega tus redes.</p>
        <LocalizedClientLink href="/foro-cnc/mi-perfil" className="text-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
          Crear perfil
        </LocalizedClientLink>
      </div>
    ) : (
      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 flex items-center gap-3">
        <Avatar a={sesion.perfil} size={40} />
        <div className="min-w-0 flex-1">
          <LocalizedClientLink href={urlPerfil(sesion.perfil.usuario)} className="block font-semibold text-[14.5px] text-[#1B1B18] truncate hover:text-[#B34D07]">
            {sesion.perfil.nombre}
          </LocalizedClientLink>
          <span className="text-[12.5px] text-[#6B6A63]">{sesion.perfil.reputacion} pts</span>
        </div>
        <LocalizedClientLink href="/foro-cnc/mi-perfil" className="text-[13px] font-semibold text-[#B34D07] hover:underline">
          Editar
        </LocalizedClientLink>
      </div>
    )}

    <nav className="bg-white border border-[#E7E4DC] rounded-[14px] p-2" aria-label="Secciones del foro">
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

    <AvisoSeguro />

    <QuienesAyudan semana={semana} siempre={destacados} />
    <CaptarTaller sesion={sesion} />

    <LocalizedClientLink
      href="/servicios/copiloto-ia-cnc"
      className="bg-[#142033] text-white rounded-[14px] p-4 flex flex-col gap-1 hover:bg-[#1B2A42]"
    >
      <strong className="text-[14.5px]">¿Prisa? Pregúntale al Copiloto IA CNC</strong>
      <span className="text-[13px] text-[#C9D2E0]">Velocidades, avances y errores de tu máquina al instante.</span>
    </LocalizedClientLink>
  </aside>
)
