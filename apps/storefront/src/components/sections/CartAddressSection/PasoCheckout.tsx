"use client"

// La caja de un paso de la pasarela. Los tres pasos se veían distintos entre sí
// y distintos del carrito, con el fondo gris de la librería y títulos en
// inglés. Aquí quedan iguales: tarjeta blanca, número del paso, palomita verde
// cuando ya está, y un enlace para modificar.
export const PasoCheckout = ({
  numero,
  titulo,
  listo,
  onEditar,
  alerta,
  testId,
  children,
}: {
  numero: number
  titulo: string
  listo?: boolean
  onEditar?: () => void
  alerta?: string
  testId?: string
  children: React.ReactNode
}) => (
  <section
    className="rounded-[14px] border border-[#E7E4DC] bg-white p-4"
    data-testid={testId}
  >
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-[#1B1B18]">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
            listo ? "bg-[#1E7A52] text-white" : "bg-[#C2560A] text-white"
          }`}
          aria-hidden="true"
        >
          {listo ? "✓" : numero}
        </span>
        {titulo}
      </h2>
      {onEditar && (
        <button
          type="button"
          onClick={onEditar}
          className="shrink-0 text-[13px] font-semibold text-[#B34D07] underline"
        >
          Modificar
        </button>
      )}
    </div>

    {alerta && (
      <p
        role="alert"
        className="mb-3 rounded-[10px] border border-[#E6C4BE] bg-[#FBF0EE] px-3 py-2.5 text-[13px] font-medium leading-relaxed text-[#9B3225]"
      >
        {alerta}
      </p>
    )}

    {children}
  </section>
)
