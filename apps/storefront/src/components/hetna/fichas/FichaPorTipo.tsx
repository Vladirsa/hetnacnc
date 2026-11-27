// Bloques de la ficha según lo que se compra (auditoría de mejoras, tarea 2).
// Plantilla A: archivo digital. Plantilla B: servicio. El producto físico
// conserva su bloque de envíos y devoluciones (ProductDetailsShipping).
import { TS } from "@/i18n/TS"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { datosDigital, datosServicio } from "@/lib/hetna/tipo-ficha"
import { REGLAS_COMUNES, licenciaDe } from "@/lib/hetna/licencias"

type Meta = Record<string, unknown> | null | undefined

const Caja = ({ titulo, children, id }: { titulo: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="rounded-lg border border-[#E7E4DC] bg-white p-4" data-testid="ficha-por-tipo">
    <h2 className="m-0 text-[16px] font-bold text-[#142033]"><TS>{titulo}</TS></h2>
    <div className="mt-3 text-[14px] leading-relaxed text-[#40403A]">{children}</div>
  </section>
)

const Lista = ({ titulo, items, marca = "✓" }: { titulo: string; items: string[]; marca?: string }) =>
  items.length ? (
    <div className="mt-3 first:mt-0">
      <p className="m-0 font-semibold text-[#142033]"><TS>{titulo}</TS></p>
      <ul className="mt-1 space-y-1">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="shrink-0 text-[#C2560A]"><TS>{marca}</TS></span>
            <span><TS>{t}</TS></span>
          </li>
        ))}
      </ul>
    </div>
  ) : null

/** Qué permite la licencia de ESTE diseño, antes de comprarlo. */
export const BloqueLicencia = ({ metadata }: { metadata: Meta }) => {
  const { licencia, piezas } = licenciaDe(metadata)
  return (
    <div className="mt-3 rounded-[10px] border border-[#E7E4DC] bg-[#FAF6EF] p-3 text-[13.5px]" data-testid="bloque-licencia">
      <p className="m-0">
        <strong className="text-[#142033]"><TS>Licencia</TS> <TS>{licencia.nombre}</TS></strong>
        <TS>{piezas ? ` · hasta ${piezas.toLocaleString("es-MX")} piezas` : ""}</TS>. <TS>{licencia.resumen}</TS>
      </p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {licencia.permisos.map((p) => (
          <li key={p.que} className="flex gap-2">
            <span className={p.si ? "text-[#17803F]" : "text-[#B91C1C]"} aria-label={p.si ? "Sí" : "No"}>
              <TS>{p.si ? "✓" : "✕"}</TS>
            </span>
            <span>
              <TS>{p.que}</TS>
              {p.nota ? <span className="text-[#6B6A63]"> (<TS>{p.nota}</TS>)</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-2 text-[12.5px] text-[#6B6A63]">
        <TS>{REGLAS_COMUNES[0]}</TS><TS>{" "}</TS>
        <LocalizedClientLink href="/licencias-disenos" className="font-semibold text-[#B34D07] underline">
          <TS>Ver las tres licencias</TS>
        </LocalizedClientLink>
      </p>
    </div>
  )
}

/** Plantilla A: qué trae el archivo y su licencia. */
export const FichaDigital = ({ metadata }: { metadata: Meta }) => {
  const d = datosDigital(metadata)
  return (
    <Caja titulo="Qué recibes">
      <p className="m-0">
        <strong><TS>Descarga inmediata tras el pago</TS></strong><TS>, en</TS><TS>{" "}</TS>
        <LocalizedClientLink href="/user/descargas" className="font-semibold text-[#B34D07] underline">
          <TS>Mi cuenta › Mis descargas</TS>
        </LocalizedClientLink>
        <TS>. No se envía nada por paquetería.</TS>
      </p>
      {d.filas.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {d.filas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-[#142033]"><TS>{k}</TS></dt>
              <dd className="m-0"><TS>{v}</TS></dd>
            </div>
          ))}
        </dl>
      )}
      <BloqueLicencia metadata={metadata} />
      <p className="mt-2 text-[13px] text-[#6B6A63]">
        <TS>Sin devolución una vez descargado, salvo que el archivo esté dañado o no corresponda a lo anunciado.</TS><TS>{" "}</TS>
        <LocalizedClientLink href="/devoluciones" className="underline">
          <TS>Ver política</TS>
        </LocalizedClientLink>
      </p>
    </Caja>
  )
}

/** Resumen corto que va ANTES del botón de compra de un servicio. */
export const ResumenServicio = ({ metadata }: { metadata: Meta }) => {
  const d = datosServicio(metadata)
  return (
    <div className="mt-4 rounded-[10px] border border-[#E7E4DC] bg-[#FAF6EF] p-3 text-[13.5px] text-[#40403A]" data-testid="resumen-servicio">
      {d.entregables.length > 0 && (
        <p className="m-0">
          <strong className="text-[#142033]"><TS>Recibes:</TS></strong> <TS>{d.entregables.join(", ")}</TS>.
        </p>
      )}
      <p className="m-0 mt-1">
        <strong className="text-[#142033]"><TS>Plazo:</TS></strong> <TS>{d.tiempo}</TS>
      </p>
      <a href="#detalle-servicio" className="mt-1 inline-block font-semibold text-[#B34D07] underline">
        <TS>Qué incluye y qué necesitas</TS>
      </a>
      {d.empezar && (
        <LocalizedClientLink
          href={d.empezar.href}
          className="mt-3 flex items-center justify-center rounded-sm bg-[#142033] px-4 py-3 text-center text-[14.5px] font-bold text-white hover:brightness-110"
        >
          <TS>{d.empezar.texto}</TS>
        </LocalizedClientLink>
      )}
    </div>
  )
}

/** Plantilla B: alcance completo del servicio. */
export const FichaServicio = ({ metadata }: { metadata: Meta }) => {
  const d = datosServicio(metadata)
  return (
    <Caja titulo="Cómo funciona este servicio" id="detalle-servicio">
      <Lista titulo="Qué incluye" items={d.incluye} />
      <Lista titulo="Qué no incluye" items={d.noIncluye} marca="✕" />
      <Lista titulo="Entregables" items={d.entregables} />
      <div className="mt-3">
        <p className="m-0 font-semibold text-[#142033]"><TS>Tiempo de entrega</TS></p>
        <p className="m-0 mt-1"><TS>{d.tiempo}</TS></p>
      </div>
      <Lista titulo="Qué necesitas antes de pagar" items={d.necesitas} marca="•" />
      {d.pasos.length > 0 && (
        <div className="mt-3">
          <p className="m-0 font-semibold text-[#142033]"><TS>Pasos</TS></p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {d.pasos.map((p) => (
              <li key={p}><TS>{p}</TS></li>
            ))}
          </ol>
        </div>
      )}
      <p className="mt-3 text-[13px] text-[#6B6A63]"><TS>¿Dudas antes de comprar? Usa “Preguntar al taller” arriba y te contestamos ahí.</TS></p>
    </Caja>
  )
}
