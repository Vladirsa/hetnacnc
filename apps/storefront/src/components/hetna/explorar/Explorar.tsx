// Vista de /categories con pestañas y filtros (opción C, 23 nov 2026).
// Los datos y los conteos salen de lib/hetna/explorar.ts; aquí sólo se dibuja.
// Todos los filtros son enlaces normales: la página llega completa desde el
// servidor, se puede compartir filtrada y funciona aunque no cargue JavaScript.
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ProductCard } from "@/components/organisms/ProductCard/ProductCard"
import { ProductsPagination } from "@/components/organisms/ProductsPagination/ProductsPagination"
import ProductListingNoResultsView from "@/components/molecules/ProductListingNoResultsView/ProductListingNoResultsView"
import { paraTarjeta } from "@/lib/helpers/tarjeta-producto"
import { nombreTipoMaquina, type Taller } from "@/lib/hetna/talleres"
import { estadoMx } from "@/lib/hetna/directorio"
import { PESTANAS, aPestana, conOpcion, sinFiltros, type Grupo, type ResultadoExplorar } from "@/lib/hetna/explorar"

import { OrdenarExplorar, PanelFiltros } from "./PanelFiltros"

const MAX_OPCIONES = 8

function GrupoFiltro({ g, sp, base }: { g: Grupo; sp: URLSearchParams; base: string }) {
  const visibles = g.opciones.filter((o) => o.n > 0 || o.activa)
  const pocas = visibles.length <= MAX_OPCIONES
  const lista = (ops: typeof visibles) => (
    <ul className="mt-2.5 grid gap-1">
      {ops.map((o) => (
        <li key={o.valor}>
          <LocalizedClientLink
            href={`${base}${conOpcion(sp, g.clave, o.valor)}`}
            scroll={false}
            rel="nofollow"
            className="flex min-h-[34px] items-center gap-2.5 rounded-md px-1 text-[14px] text-[#1E2329] hover:bg-[#F4F5F7]"
            aria-current={o.activa ? "true" : undefined}
          >
            <span
              aria-hidden
              className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] text-[11px] text-white ${
                o.activa ? "border-[#C2560A] bg-[#C2560A]" : "border-[#B8BEC6] bg-white"
              }`}
            >
              {o.activa ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
            <span className="text-[12.5px] text-[#8A8F96]">{o.n}</span>
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  )
  return (
    <details open className="group border-b border-[#EEF0F2] py-3.5" data-testid={`filtro-${g.clave}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[#142033] [&::-webkit-details-marker]:hidden">
        {g.titulo}
        <span aria-hidden className="text-[#8A8F96] group-open:hidden">+</span>
        <span aria-hidden className="hidden text-[#8A8F96] group-open:inline">–</span>
      </summary>
      {lista(pocas ? visibles : visibles.slice(0, MAX_OPCIONES))}
      {!pocas && (
        <details className="mt-1">
          <summary className="cursor-pointer list-none px-1 text-[13px] font-bold text-[#B34D07] hover:underline [&::-webkit-details-marker]:hidden">
            Ver {visibles.length - MAX_OPCIONES} más
          </summary>
          {lista(visibles.slice(MAX_OPCIONES))}
        </details>
      )}
    </details>
  )
}

function FiltroPrecio({ sp, accion }: { sp: URLSearchParams; accion: string }) {
  // Formulario GET: conserva los demás filtros como campos ocultos
  const ocultos = [...sp.entries()].filter(([k]) => !["min_price", "max_price", "page"].includes(k))
  return (
    <div className="border-b border-[#EEF0F2] py-3.5">
      <p className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[#142033]">Precio</p>
      <form method="get" action={accion} className="mt-2.5 flex items-center gap-2">
        {ocultos.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input
          name="min_price"
          inputMode="numeric"
          defaultValue={sp.get("min_price") ?? ""}
          placeholder="$ Mín"
          aria-label="Precio mínimo"
          className="h-9 w-full min-w-0 rounded-lg border border-[#D4D9DF] bg-white px-2.5 text-[13.5px]"
        />
        <input
          name="max_price"
          inputMode="numeric"
          defaultValue={sp.get("max_price") ?? ""}
          placeholder="$ Máx"
          aria-label="Precio máximo"
          className="h-9 w-full min-w-0 rounded-lg border border-[#D4D9DF] bg-white px-2.5 text-[13.5px]"
        />
        <button type="submit" className="h-9 shrink-0 rounded-lg bg-[#142033] px-3 text-[13px] font-bold text-white">
          Ir
        </button>
      </form>
    </div>
  )
}

function TarjetaTaller({ t }: { t: Taller }) {
  const maquinas = [...new Set(t.perfil.maquinas.map((m) => nombreTipoMaquina(m.tipo) || "").filter(Boolean))]
  // El estado normalizado ("jal" → Jalisco), igual que en el filtro
  const lugar = [t.perfil.ciudad, estadoMx(t.perfil.estado, t.perfil.ciudad) || t.perfil.estado].filter(Boolean).join(", ")
  return (
    <LocalizedClientLink
      href={`/talleres/${t.handle}`}
      className="flex h-full items-start gap-3 rounded-xl border border-[#E2E5E9] bg-white p-4 transition-shadow hover:shadow-md"
      data-testid="tarjeta-taller"
    >
      {t.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.logo} alt="" width={52} height={52} loading="lazy" className="h-[52px] w-[52px] shrink-0 rounded-xl border border-[#EEF0F2] object-cover" />
      ) : (
        <span aria-hidden className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#142033] text-[20px] font-black text-white">
          {t.nombre.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-bold leading-snug text-[#142033]">{t.nombre}</span>
          {t.verificado && <span className="rounded-full bg-[#E8F5EC] px-2 py-0.5 text-[11px] font-bold text-[#1E7A3C]">✓ Verificado</span>}
        </span>
        {lugar && <span className="mt-0.5 block text-[13px] text-[#6B6A63]">📍 {lugar}</span>}
        {maquinas.length > 0 && <span className="mt-1.5 block text-[12.5px] leading-snug text-[#40403A]">{maquinas.slice(0, 4).join(" · ")}</span>}
      </span>
      <span aria-hidden className="shrink-0 self-center text-[13px] font-bold text-[#B34D07]">Ver ›</span>
    </LocalizedClientLink>
  )
}

export function Explorar({
  r,
  sp,
  sugerencias,
  locale,
  estados = [],
}: {
  locale: string
  r: ResultadoExplorar
  sp: URLSearchParams
  sugerencias?: { nombre: string; handle: string }[]
  // Páginas "Talleres CNC en <estado>" que ya existen e indexa Google
  estados?: { nombre: string; ruta: string; total: number }[]
}) {
  const base = "/categories"
  const info = PESTANAS.find((p) => p.id === r.pestana)!
  const query = sp.get("query") || ""
  const unidad = r.pestana === "talleres" ? ["taller", "talleres"] : r.pestana === "disenos" ? ["diseño", "diseños"] : ["producto", "productos"]
  const hayGrupos = r.grupos.length > 0 || r.pestana !== "talleres"

  const filtros = (
    <>
      {r.grupos.map((g) => (
        <GrupoFiltro key={g.clave} g={g} sp={sp} base={base} />
      ))}
      {r.pestana !== "talleres" && <FiltroPrecio sp={sp} accion={`/${locale}${base}`} />}
      {r.pestana === "productos" && (
        <div className="py-3.5">
          <LocalizedClientLink
            href={`${base}${conOpcion(sp, "disponible", sp.get("disponible") === "1" ? "" : "1")}`}
            scroll={false}
            rel="nofollow"
            className="flex min-h-[34px] items-center gap-2.5 px-1 text-[14px]"
          >
            <span
              aria-hidden
              className={`flex h-[17px] w-[17px] items-center justify-center rounded-[4px] border-[1.5px] text-[11px] text-white ${
                sp.get("disponible") === "1" ? "border-[#C2560A] bg-[#C2560A]" : "border-[#B8BEC6] bg-white"
              }`}
            >
              {sp.get("disponible") === "1" ? "✓" : ""}
            </span>
            Sólo con existencia
          </LocalizedClientLink>
        </div>
      )}
    </>
  )

  return (
    <div data-testid="explorar">
      <p className="mt-2 max-w-[75ch] text-[15px] leading-relaxed text-[#40403A]">{info.intro}</p>
      {query && (
        <p className="mt-2 text-[14px] text-[#40403A]">
          Resultados de «<strong className="text-[#142033]">{query}</strong>» ·{" "}
          <LocalizedClientLink href={base} className="font-bold text-[#B34D07] underline">
            Quitar búsqueda
          </LocalizedClientLink>
        </p>
      )}

      {/* Pestañas: se deslizan de lado en celular */}
      <nav aria-label="Qué buscas" className="-mx-4 mt-5 overflow-x-auto border-b border-[#E2E5E9] px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-6 sm:gap-8">
          {PESTANAS.map((p) => {
            const activa = p.id === r.pestana
            return (
              <li key={p.id}>
                <LocalizedClientLink
                  href={`${base}${aPestana(sp, p.id)}`}
                  scroll={false}
                  aria-current={activa ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-[46px] items-center gap-1.5 border-b-[3px] text-[15px] font-bold ${
                    activa ? "border-[#C2560A] text-[#C2560A]" : "border-transparent text-[#40403A] hover:text-[#142033]"
                  }`}
                >
                  {p.nombre}
                  <span className="text-[12.5px] font-medium text-[#8A8F96]">{r.totales[p.id]}</span>
                </LocalizedClientLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Atajos: categorías (o tipos de máquina en Talleres) */}
      {r.chips.length > 1 || r.chips.some((c) => c.activa) ? (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 sm:flex-wrap">
            {r.chips.map((c) => (
              <li key={c.valor} className="shrink-0">
                <LocalizedClientLink
                  href={`${base}${conOpcion(sp, r.chipsClave, c.valor)}`}
                  scroll={false}
                  rel="nofollow"
                  aria-current={c.activa ? "true" : undefined}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${
                    c.activa ? "border-[#142033] bg-[#142033] text-white" : "border-[#D4D9DF] bg-white text-[#1E2329] hover:border-[#142033]"
                  }`}
                >
                  {c.nombre}
                  <span className={c.activa ? "text-white/70" : "text-[#8A8F96]"}>{c.activa ? "✕" : c.n}</span>
                </LocalizedClientLink>
              </li>
            ))}
            {r.pestana === "disenos" && (
              <li className="shrink-0">
                <LocalizedClientLink
                  href={`${base}${sp.get("max_price") === "0" ? conOpcion(sp, "max_price", "") : conOpcion(sp, "max_price", "0")}`}
                  scroll={false}
                  rel="nofollow"
                  className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold ${
                    sp.get("max_price") === "0" ? "border-[#142033] bg-[#142033] text-white" : "border-[#D4D9DF] bg-white text-[#1E2329] hover:border-[#142033]"
                  }`}
                >
                  Gratis{sp.get("max_price") === "0" ? " ✕" : ""}
                </LocalizedClientLink>
              </li>
            )}
          </ul>
        </div>
      ) : null}

      <div className={`mt-5 grid gap-6 ${hayGrupos ? "md:grid-cols-[230px_minmax(0,1fr)] lg:gap-8" : ""}`}>
        {hayGrupos && (
          <PanelFiltros activos={r.activos.length} total={r.total} unidad={unidad[1]}>
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-bold text-[#142033]">Filtros</span>
              {r.activos.length > 0 && (
                <LocalizedClientLink href={`${base}${sinFiltros(sp)}`} scroll={false} className="text-[13px] font-bold text-[#B34D07] underline">
                  Limpiar
                </LocalizedClientLink>
              )}
            </div>
            {filtros}
          </PanelFiltros>
        )}

        <section aria-label="Resultados" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {r.activos.map((a) => (
              <LocalizedClientLink
                key={`${a.clave}-${a.valor}`}
                href={`${base}${conOpcion(sp, a.clave, a.valor)}`}
                scroll={false}
                rel="nofollow"
                className="hidden h-8 items-center gap-1.5 rounded-full bg-[#142033] px-3 text-[12.5px] font-semibold text-white md:inline-flex"
              >
                {a.nombre} <span aria-hidden className="opacity-70">✕</span>
              </LocalizedClientLink>
            ))}
            <span className="text-[13px] text-[#6B6A63]" data-testid="explorar-total">
              <strong className="text-[#142033]">{r.total}</strong> {r.total === 1 ? unidad[0] : unidad[1]}
            </span>
            {r.pestana !== "talleres" && (
              <div className="ml-auto">
                <OrdenarExplorar valor={sp.get("sortBy") || "created_at"} />
              </div>
            )}
          </div>

          {r.pestana === "talleres" ? (
            r.talleres.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {r.talleres.map((t) => (
                  <li key={t.id}>
                    <TarjetaTaller t={t} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-[#C5CCD3] bg-white p-6 text-center text-[14.5px] text-[#40403A]">
                Ningún taller cumple esos filtros.{" "}
                <LocalizedClientLink href={`${base}${sinFiltros(sp)}`} className="font-bold text-[#B34D07] underline">
                  Ver todos
                </LocalizedClientLink>
              </p>
            )
          ) : r.productos.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {r.productos.map((p, i) => (
                <li key={p.id} className="min-w-0">
                  <ProductCard product={paraTarjeta(p)} prioridad={i === 0} className="h-full w-full min-w-0 lg:w-full" />
                </li>
              ))}
            </ul>
          ) : (
            <ProductListingNoResultsView busqueda={query || undefined} sugerencias={sugerencias} />
          )}

          {r.paginas > 1 && <ProductsPagination pages={r.paginas} />}

          {/* Enlaces a las páginas por estado: ayudan a Google a encontrarlas
              y a quien busca un taller cerca */}
          {r.pestana === "talleres" && estados.length > 0 && (
            <nav aria-label="Talleres CNC por estado" className="mt-8 rounded-2xl border border-[#E2E5E9] bg-white p-5">
              <h2 className="m-0 text-[16px] font-extrabold text-[#142033]">Talleres CNC por estado</h2>
              <p className="m-0 mt-1 text-[13px] text-[#6B6A63]">Talleres de HETNA y empresas del directorio en cada estado, con qué servicios hacen.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {estados.map((e) => (
                  <li key={e.ruta}>
                    <LocalizedClientLink
                      href={e.ruta}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#D4D9DF] bg-white px-3 text-[13px] font-semibold text-[#1E2329] hover:border-[#C2560A] hover:text-[#C2560A]"
                    >
                      {e.nombre} <span className="font-medium text-[#8A8F96]">{e.total}</span>
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}
