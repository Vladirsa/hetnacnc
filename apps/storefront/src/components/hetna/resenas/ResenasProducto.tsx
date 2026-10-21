import { Estrellas } from "./Estrellas"
import { FormularioResena } from "./FormularioResena"
import type { Pendiente, ResenasDeProducto } from "@/lib/resenas/acciones"

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

// Las reseñas del producto: el promedio, el desglose y lo que escribió la gente.
//
// Es el módulo que faltaba para que la ficha pueda vender por algo que no sea
// el precio. Nadie compra una fresa de $600 sin ver que a otro le funcionó.
//
// Las reseñas salen del dominio Review de Mercur, que respalda cada una con la
// orden que la ganó: aquí no hay forma de escribir una sin haber comprado.
export const ResenasProducto = ({
  datos,
  productId,
  pendiente,
}: {
  datos: ResenasDeProducto
  productId: string
  pendiente?: Pendiente
}) => {
  const { promedio, total, desglose, resenas } = datos
  const maximo = Math.max(...desglose.map((d) => d.total), 1)

  return (
    <section
      className="rounded-[14px] border border-[#E7E4DC] bg-white p-4 sm:p-5"
      id="resenas"
      data-testid="product-reviews"
    >
      <h2 className="text-[17px] font-bold text-[#1B1B18]">Reseñas de este producto</h2>

      {total === 0 ? (
        <p className="mt-2 text-[14px] leading-relaxed text-[#4A4943]">
          Todavía no hay reseñas.{" "}
          {pendiente
            ? "Tú lo compraste: tu reseña sería la primera."
            : "Las escriben quienes ya lo compraron, así que las que veas aquí son de compras reales."}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
          <div className="shrink-0 text-center sm:text-left">
            <p className="flex items-baseline justify-center gap-2 sm:justify-start">
              <span className="text-[40px] font-bold leading-none text-[#1B1B18]">
                {promedio?.toFixed(1)}
              </span>
              <Estrellas valor={promedio || 0} size={18} />
            </p>
            <p className="mt-1 text-[13px] text-[#6B6A63]">
              {total} {total === 1 ? "reseña" : "reseñas"}
            </p>
          </div>

          <dl className="min-w-0 flex-1">
            {desglose.map((d) => (
              <div key={d.estrellas} className="flex items-center gap-2 py-0.5">
                <dt className="w-10 shrink-0 text-right text-[12px] text-[#6B6A63]">
                  {d.estrellas} ★
                </dt>
                <dd className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#F0EEE8]">
                    <span
                      className="block h-full rounded-full bg-[#F0A020]"
                      style={{ width: `${(d.total / maximo) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-[12px] text-[#6B6A63]">{d.total}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {pendiente && (
        <div className="mt-4 border-t border-[#EDEAE2] pt-4">
          <FormularioResena
            productId={productId}
            orderId={pendiente.order_id}
            titulo={pendiente.titulo}
          />
        </div>
      )}

      {resenas.length > 0 && (
        <ul className="mt-4 flex flex-col divide-y divide-[#EDEAE2] border-t border-[#EDEAE2]">
          {resenas.map((r) => (
            <li key={r.id} className="py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Estrellas valor={r.calificacion} />
                  <span className="rounded-full bg-[#EAF3EE] px-2 py-0.5 text-[11px] font-semibold text-[#1E7A52]">
                    Compra verificada
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-[#8A8780]">
                  {FECHA.format(new Date(r.creado))}
                </span>
              </div>

              {r.comentario && (
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#1B1B18]">
                  {r.comentario}
                </p>
              )}

              {r.respuesta_taller && (
                <div className="mt-2 rounded-[10px] border-l-[3px] border-[#C2560A] bg-[#FFF8F3] px-3 py-2">
                  <p className="text-[12px] font-bold text-[#B34D07]">Respuesta del taller</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[#4A4943]">
                    {r.respuesta_taller}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
