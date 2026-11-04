import type { Metadata } from "next"

import { ChipsSecciones, ColIzquierda, LATERAL_FIJO } from "@/components/hetna/foro/Feed"
import { Avatar, ForoCerrado, InsigniaTaller, Paginacion, Palomita } from "@/components/hetna/foro/Piezas"
import { CAJA_RED } from "@/components/hetna/foro/Red"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import { POR_PAGINA_PROFESIONALES, buscarProfesionales } from "@/lib/foro/red"
import { ESTADOS_MX, SITIO, TIPOS_CUENTA, esTipoCuenta, urlPerfil } from "@/lib/foro/tipos"

// Directorio de profesionales CNC: operadores, programadores CAM, diseñadores,
// técnicos y talleres con su currículum. Gratis para buscar y para aparecer.

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""
const BASE = "/foro-cnc/profesionales"

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await searchParams
  const estado = ESTADOS_MX.includes(uno(q.estado)) ? uno(q.estado) : ""
  const filtrado = Boolean(uno(q.q) || uno(q.tipo) || uno(q.abierto) || uno(q.pagina))
  return {
    title: { absolute: `Profesionales CNC${estado ? ` en ${estado}` : " en México"} | Foro CNC México` },
    description: `Encuentra operadores CNC, programadores CAM, diseñadores y técnicos${
      estado ? ` en ${estado}` : " en México"
    }: aptitudes avaladas, software, máquinas que manejan y proyectos. Contáctalos gratis.`,
    alternates: { canonical: `${SITIO}/mx${BASE}${estado ? `?estado=${encodeURIComponent(estado)}` : ""}` },
    // Las búsquedas con texto o filtros no se indexan; los estados sí.
    robots: filtrado ? { index: false, follow: true } : undefined,
  }
}

const TIPOS_FILTRO = ["profesional", "taller", "proveedor", "marca", "aficionado"] as const
const CAMPO = "h-11 rounded-[10px] border border-[#D9D4C8] bg-white px-3 text-[14.5px] text-[#1B1B18]"

export default async function Profesionales({ params: ruta, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([ruta, searchParams])
  const q = uno(sp.q).slice(0, 60)
  const estado = ESTADOS_MX.includes(uno(sp.estado)) ? uno(sp.estado) : ""
  const tipo = esTipoCuenta(uno(sp.tipo)) ? uno(sp.tipo) : ""
  const abierto = uno(sp.abierto) === "1"
  const pagina = Math.max(1, parseInt(uno(sp.pagina)) || 1)

  const [secs, sesion, r] = await Promise.all([secciones(), sesionForo(), buscarProfesionales({ q, estado, tipo, abierto, pagina })])
  if (!secs || !r) return <ForoCerrado />
  const p = sesion?.perfil

  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (estado) params.set("estado", estado)
  if (tipo) params.set("tipo", tipo)
  if (abierto) params.set("abierto", "1")
  const base = params.toString() ? `${BASE}?${params}` : BASE

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)_290px] lg:gap-5 lg:py-6">
        <ColIzquierda secciones={secs} sesion={sesion} />

        <div className="flex min-w-0 flex-col gap-4">
          <ChipsSecciones secciones={secs} />
          <section className="rounded-[16px] bg-[#142033] p-5 text-white sm:p-7">
            <p className="m-0 text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Red CNC de México</p>
            <h1 className="m-0 mt-1 text-[26px] font-extrabold leading-tight sm:text-[30px]">
              Profesionales CNC{estado ? ` en ${estado}` : ""}
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-[15px] text-white/80">
              Operadores, programadores CAM, diseñadores y técnicos con su currículum: aptitudes avaladas por la comunidad, software, máquinas que
              manejan y proyectos. Buscar y contactar es gratis.
            </p>
            <form action={`/${locale}${BASE}`} method="get" role="search" className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
              <input
                name="q"
                defaultValue={q}
                placeholder="Ej. Fusion 360, router, programador CAM, torno…"
                aria-label="Buscar por aptitud, software o máquina"
                className={`${CAMPO} w-full`}
              />
              <select name="estado" defaultValue={estado} aria-label="Estado" className={CAMPO}>
                <option value="">Todo México</option>
                {ESTADOS_MX.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <select name="tipo" defaultValue={tipo} aria-label="Tipo de cuenta" className={CAMPO}>
                <option value="">Todos los tipos</option>
                {TIPOS_FILTRO.map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_CUENTA[t].nombre}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[14px] text-white">
                  <input type="checkbox" name="abierto" value="1" defaultChecked={abierto} className="h-4 w-4" />
                  Sólo abiertos a trabajo
                </label>
                <button type="submit" className="ml-auto h-11 rounded-[10px] bg-[#C2560A] px-5 text-[14.5px] font-semibold text-white hover:brightness-110">
                  Buscar
                </button>
              </div>
            </form>
          </section>

          <p className="m-0 text-[14px] text-[#6B6A63]">
            {r.total === 1 ? "1 perfil" : `${r.total.toLocaleString("es-MX")} perfiles`}
            {q ? ` con “${q}”` : ""}
          </p>

          {r.perfiles.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {r.perfiles.map((a) => {
                const etiquetas = [...a.aptitudes, ...a.software].slice(0, 6)
                return (
                  <LocalizedClientLink
                    key={a.id}
                    href={urlPerfil(a.usuario)}
                    className="flex flex-col gap-2 rounded-[14px] border border-[#E2DED3] bg-white p-4 hover:border-[#C2560A]"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar a={a} size={48} />
                      <div className="min-w-0 flex-1">
                        <strong className="flex items-center gap-1 text-[15.5px] text-[#1B1B18]">
                          <span className="truncate">{a.nombre}</span>
                          {a.verificado && <Palomita />}
                        </strong>
                        <span className="block truncate text-[13px] text-[#40403A]">{a.titular || TIPOS_CUENTA[a.tipo]?.nombre}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#6B6A63]">
                          {a.taller ? <InsigniaTaller a={a} /> : <span>{TIPOS_CUENTA[a.tipo]?.nombre}</span>}
                          {(a.ciudad || a.estadoMx) && <span>· {[a.ciudad, a.estadoMx].filter(Boolean).join(", ")}</span>}
                        </span>
                      </div>
                      {a.abierto && (
                        <span className="shrink-0 rounded-full bg-[#E7F5EC] px-2.5 py-1 text-[11.5px] font-bold text-[#1E7B3A]">Abierto a trabajo</span>
                      )}
                    </div>
                    {etiquetas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {etiquetas.map((e) => (
                          <span key={e} className="rounded-full bg-[#F3F1EA] px-2.5 py-0.5 text-[12.5px] text-[#40403A]">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                    {a.maquinas.length > 0 && <span className="truncate text-[12.5px] text-[#6B6A63]">Máquinas: {a.maquinas.slice(0, 3).join(" · ")}</span>}
                    <span className="flex gap-3 text-[12.5px] text-[#6B6A63]">
                      {a.avales > 0 && <span>✓ {a.avales} {a.avales === 1 ? "aval" : "avales"}</span>}
                      {a.proyectos > 0 && <span>{a.proyectos} {a.proyectos === 1 ? "proyecto" : "proyectos"}</span>}
                      {a.reputacion > 0 && <span>★ {a.reputacion} reputación</span>}
                    </span>
                  </LocalizedClientLink>
                )
              })}
            </div>
          ) : (
            <p className="m-0 rounded-[12px] border border-dashed border-[#D9D4C8] bg-white p-6 text-center text-[14.5px] text-[#6B6A63]">
              {q || estado || tipo || abierto
                ? "No encontramos perfiles con esos filtros. Prueba con menos filtros o con otra palabra."
                : "Todavía no hay perfiles con currículum. Arma el tuyo y sé de los primeros en aparecer."}
            </p>
          )}
          <Paginacion pagina={pagina} total={r.total} porPagina={POR_PAGINA_PROFESIONALES} base={base} />
        </div>

        <aside className={`flex flex-col gap-3 ${LATERAL_FIJO}`}>
          <section className={`${CAJA_RED} flex flex-col gap-2`}>
            <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Aparece en el directorio</h2>
            <p className="m-0 text-[14px] text-[#40403A]">
              Agrega tus aptitudes, software, máquinas y proyectos con fotos. Marca “Abierto a trabajo” y los talleres te encuentran.
            </p>
            <LocalizedClientLink
              href={p ? "/foro-cnc/mi-perfil#curriculum" : "/register"}
              className="mt-1 inline-flex justify-center rounded-[10px] bg-[#C2560A] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-110"
            >
              {p ? "Armar mi currículum" : "Crear cuenta gratis"}
            </LocalizedClientLink>
          </section>
          <LocalizedClientLink href="/foro-cnc/empleos" className="flex flex-col gap-1 rounded-[12px] bg-[#1E2566] p-4 text-white hover:brightness-110">
            <strong className="text-[14.5px]">¿Tu taller busca personal?</strong>
            <span className="text-[13px] text-white/75">Publica una vacante gratis en Empleos y proyectos.</span>
          </LocalizedClientLink>
          <LocalizedClientLink href="/talleres" className="flex flex-col gap-1 rounded-[12px] bg-[#142033] p-4 text-white hover:bg-[#1B2A42]">
            <strong className="text-[14.5px]">¿Buscas un taller?</strong>
            <span className="text-[13px] text-[#C9D2E0]">Directorio de talleres CNC por máquina, tamaño y estado.</span>
          </LocalizedClientLink>
        </aside>
      </div>
    </main>
  )
}
