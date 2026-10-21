import type { Movimiento } from "@/lib/creditos/acciones"

// El historial del monedero. Es la única prueba que tiene el taller de que lo
// que compró entró y de en qué se fue, así que se enseña completo: lo que
// suma en verde, lo que resta en rojo, con su fecha y su motivo.
const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

export const Movimientos = ({ movimientos }: { movimientos: Movimiento[] }) => (
  <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
    <h3 className="text-[14px] font-bold text-[#1B1B18]">Movimientos</h3>

    {movimientos.length === 0 ? (
      <p className="mt-2 text-[13px] leading-relaxed text-[#6B6A63]">
        Todavía no hay movimientos. Aquí van a aparecer tus compras de créditos y lo que
        gastes en las herramientas.
      </p>
    ) : (
      <ul className="mt-2 flex flex-col divide-y divide-[#EDEAE2]">
        {movimientos.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-[13px] leading-snug text-[#1B1B18]">
                {m.descripcion || m.tipo}
              </span>
              <span className="block text-[12px] text-[#8A8780]">
                {FECHA.format(new Date(m.creado))}
              </span>
            </span>
            <span
              className={`shrink-0 text-[14px] font-bold ${
                m.cantidad >= 0 ? "text-[#1E7A52]" : "text-[#9B3225]"
              }`}
            >
              {m.cantidad >= 0 ? "+" : "−"}
              {Math.abs(m.cantidad)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
)
