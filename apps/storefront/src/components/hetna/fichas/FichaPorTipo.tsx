// Bloques de la ficha según lo que se compra (auditoría de mejoras, tarea 2).
// Plantilla A: archivo digital. Plantilla B: servicio. El producto físico
// conserva su bloque de envíos y devoluciones (ProductDetailsShipping).
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { datosDigital, datosServicio } from "@/lib/hetna/tipo-ficha"

type Meta = Record<string, unknown> | null | undefined

const Caja = ({ titulo, children, id }: { titulo: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="rounded-lg border border-[#E7E4DC] bg-white p-4" data-testid="ficha-por-tipo">
    <h2 className="m-0 text-[16px] font-bold text-[#142033]">{titulo}</h2>
    <div className="mt-3 text-[14px] leading-relaxed text-[#40403A]">{children}</div>
  </section>
)

const Lista = ({ titulo, items, marca = "✓" }: { titulo: string; items: string[]; marca?: string }) =>
  items.length ? (
    <div className="mt-3 first:mt-0">
      <p className="m-0 font-semibold text-[#142033]">{titulo}</p>
      <ul className="mt-1 space-y-1">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="shrink-0 text-[#C2560A]">{marca}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null

/** Plantilla A: qué trae el archivo y su licencia. */
export const FichaDigital = ({ metadata }: { metadata: Meta }) => {
  const d = datosDigital(metadata)
  return (
    <Caja titulo="Qué recibes">
      <p className="m-0">
        <strong>Descarga inmediata tras el pago</strong>, en{" "}
        <LocalizedClientLink href="/user/descargas" className="font-semibold text-[#B34D07] underline">
          Mi cuenta › Mis descargas
        </LocalizedClientLink>
        . No se envía nada por paquetería.
      </p>
      {d.filas.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {d.filas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-[#142033]">{k}</dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 rounded-[8px] bg-[#FAF6EF] p-3 text-[13.5px]">
        <strong>Licencia.</strong> {d.licencia}
      </p>
      <p className="mt-2 text-[13px] text-[#6B6A63]">
        Sin devolución una vez descargado, salvo que el archivo esté dañado o no corresponda a lo anunciado.{" "}
        <LocalizedClientLink href="/devoluciones" className="underline">
          Ver política
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
          <strong className="text-[#142033]">Recibes:</strong> {d.entregables.join(", ")}.
        </p>
      )}
      <p className="m-0 mt-1">
        <strong className="text-[#142033]">Plazo:</strong> {d.tiempo}
      </p>
      <a href="#detalle-servicio" className="mt-1 inline-block font-semibold text-[#B34D07] underline">
        Qué incluye y qué necesitas
      </a>
      {d.empezar && (
        <LocalizedClientLink
          href={d.empezar.href}
          className="mt-3 flex items-center justify-center rounded-sm bg-[#142033] px-4 py-3 text-center text-[14.5px] font-bold text-white hover:brightness-110"
        >
          {d.empezar.texto}
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
        <p className="m-0 font-semibold text-[#142033]">Tiempo de entrega</p>
        <p className="m-0 mt-1">{d.tiempo}</p>
      </div>
      <Lista titulo="Qué necesitas antes de pagar" items={d.necesitas} marca="•" />
      {d.pasos.length > 0 && (
        <div className="mt-3">
          <p className="m-0 font-semibold text-[#142033]">Pasos</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {d.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      )}
      <p className="mt-3 text-[13px] text-[#6B6A63]">¿Dudas antes de comprar? Usa “Preguntar al taller” arriba y te contestamos ahí.</p>
    </Caja>
  )
}
