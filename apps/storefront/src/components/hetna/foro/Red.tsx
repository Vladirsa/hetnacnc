// Piezas de la red profesional que se dibujan en el servidor: trayectoria,
// recomendaciones, tarjetas de persona y productos de los talleres que sigues.
import { ImagenSegura as Image } from "@/components/hetna/ImagenSegura"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Taller } from "@/lib/hetna/talleres"
import type { ProductoRed } from "@/lib/foro/red"
import {
  type Autor,
  type Paso,
  RELACIONES,
  type Recomendacion,
  TIPOS_CUENTA,
  TIPOS_TRAYECTORIA,
  type TipoTrayectoria,
  objetivoPerfil,
  objetivoTaller,
  urlPerfil,
} from "@/lib/foro/tipos"

import { Avatar, InsigniaTaller, Palomita, haceCuanto } from "./Piezas"
import { BotonSeguir, DecidirRecomendacion } from "./RedCliente"

export const CAJA_RED = "bg-white border border-[#E7E4DC] rounded-[14px] p-5"

export const Abierto = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6EF] px-2.5 py-0.5 text-[12px] font-bold text-[#14683F]" title="Busca trabajo o proyectos">
    ● Abierto a trabajo
  </span>
)

export function Trayectoria({ pasos }: { pasos: Paso[] }) {
  const grupos = (Object.keys(TIPOS_TRAYECTORIA) as TipoTrayectoria[])
    .map((tipo) => ({ tipo, pasos: pasos.filter((p) => p.tipo === tipo) }))
    .filter((g) => g.pasos.length)
  if (!grupos.length) return null
  return (
    <div className="flex flex-col gap-5">
      {grupos.map((g) => (
        <div key={g.tipo}>
          <h3 className="m-0 mb-2 text-[13px] font-bold uppercase tracking-wide text-[#9A978C]">{TIPOS_TRAYECTORIA[g.tipo]}</h3>
          <ol className="m-0 flex list-none flex-col gap-3 border-l-2 border-[#E7E4DC] p-0 pl-4">
            {g.pasos.map((p, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#C2560A]" aria-hidden="true" />
                <strong className="block text-[15px] text-[#1B1B18]">{p.titulo}</strong>
                {(p.lugar || p.desde || p.hasta) && (
                  <span className="block text-[13.5px] text-[#6B6A63]">
                    {p.lugar}
                    {p.lugar && (p.desde || p.hasta) ? " · " : ""}
                    {[p.desde, p.hasta].filter(Boolean).join(" – ")}
                  </span>
                )}
                {p.detalle && <p className="m-0 mt-1 whitespace-pre-line text-[14px] leading-relaxed text-[#44433D]">{p.detalle}</p>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

export function ListaRecomendaciones({ lista, propio }: { lista: Recomendacion[]; propio: boolean }) {
  if (!lista.length) return null
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {lista.map((r) => (
        <li key={r.id} className={`rounded-[12px] border p-4 ${r.estado === "pendiente" ? "border-[#F2C98F] bg-[#FFF8EE]" : "border-[#E7E4DC] bg-white"}`}>
          <div className="flex items-center gap-2.5">
            <Avatar a={r.autor} size={36} />
            <div className="min-w-0">
              <LocalizedClientLink href={urlPerfil(r.autor.usuario)} className="block truncate text-[14.5px] font-semibold text-[#1B1B18] hover:text-[#B34D07]">
                {r.autor.nombre}
              </LocalizedClientLink>
              <span className="text-[12.5px] text-[#6B6A63]">
                {RELACIONES[r.relacion]} · {haceCuanto(r.creado)}
              </span>
            </div>
          </div>
          <p className="m-0 mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-[#23231F]">“{r.texto}”</p>
          {propio && r.estado === "pendiente" && (
            <div className="mt-3 flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-[#9A4A06]">Sólo tú la ves hasta que decidas:</span>
              <DecidirRecomendacion id={r.id} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

// Una persona en una lista (sugerencias, seguidores, siguiendo)
export function TarjetaPersona({
  a,
  sesion,
  siguiendo = false,
  detalle,
}: {
  a: Autor
  sesion: boolean
  siguiendo?: boolean
  detalle?: string
}) {
  const objetivo = objetivoPerfil({ id: a.id, vendedor: a.taller?.id })
  return (
    <div className="flex items-center gap-3">
      <Avatar a={a} size={42} />
      <div className="min-w-0 flex-1">
        <LocalizedClientLink href={urlPerfil(a.usuario)} className="flex items-center gap-1 text-[14.5px] font-semibold text-[#1B1B18] hover:text-[#B34D07]">
          <span className="truncate">{a.nombre}</span>
          {a.verificado && <Palomita />}
        </LocalizedClientLink>
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#6B6A63]">
          {a.taller ? <InsigniaTaller a={a} /> : <span>{TIPOS_CUENTA[a.tipo]?.nombre}</span>}
          {detalle && <span className="truncate">{detalle}</span>}
        </div>
      </div>
      {sesion && <BotonSeguir objetivo={objetivo} siguiendo={siguiendo} seguidores={0} conCuenta={false} chico />}
    </div>
  )
}

export function TarjetaTallerRed({ t, sesion, siguiendo = false }: { t: Taller; sesion: boolean; siguiendo?: boolean }) {
  const donde = [t.perfil.ciudad, t.perfil.estado].filter(Boolean).join(", ")
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#142033] text-[14px] font-bold text-white">
        {t.logo ? <Image src={t.logo} alt="" width={84} height={84} className="h-full w-full object-cover" /> : t.nombre.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <LocalizedClientLink href={`/talleres/${t.handle}`} className="flex items-center gap-1 text-[14.5px] font-semibold text-[#1B1B18] hover:text-[#B34D07]">
          <span className="truncate">{t.nombre}</span>
          {t.verificado && <span className="text-[12px] text-[#1E7B3A]" title="Taller verificado">✓</span>}
        </LocalizedClientLink>
        <span className="block truncate text-[12.5px] text-[#6B6A63]">{donde || t.perfil.servicios.slice(0, 2).join(" · ") || "Taller CNC"}</span>
      </div>
      {sesion && <BotonSeguir objetivo={objetivoTaller(t.id)} siguiendo={siguiendo} seguidores={0} conCuenta={false} chico />}
    </div>
  )
}

const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

export function ProductosRed({ productos }: { productos: ProductoRed[] }) {
  if (!productos.length) return null
  return (
    <section className={`${CAJA_RED} flex flex-col gap-3`}>
      <h2 className="m-0 text-[16px] font-bold text-[#1B1B18]">Nuevos productos de los talleres que sigues</h2>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {productos.map((p) => (
          <LocalizedClientLink key={p.id} href={`/products/${p.handle}`} className="w-[150px] shrink-0 snap-start rounded-[12px] border border-[#E7E4DC] bg-white hover:border-[#C2560A]">
            <span className="block aspect-square overflow-hidden rounded-t-[12px] bg-[#F3F1EA]">
              <Image src={p.foto || "/images/placeholder.svg"} alt={p.titulo} width={300} height={300} className="h-full w-full object-cover" />
            </span>
            <span className="block p-2.5">
              <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-[#1B1B18]">{p.titulo}</span>
              {p.precio !== null && <span className="mt-1 block text-[13.5px] font-bold text-[#C2560A]">{pesos.format(p.precio)}</span>}
              <span className="mt-0.5 block truncate text-[12px] text-[#6B6A63]">{p.taller.nombre}</span>
            </span>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  )
}
