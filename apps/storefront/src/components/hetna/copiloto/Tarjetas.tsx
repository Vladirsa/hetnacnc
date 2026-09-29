import type { Resultado } from "@/lib/copiloto/motor"

// Tarjeta con el resultado de una calculadora o el analisis de un archivo

export const TarjetaResultado = ({
  r,
  onPreguntar,
}: {
  r: Pick<Resultado, "titulo" | "filas" | "avisos"> & Partial<Pick<Resultado, "faltan" | "supuestos">>
  onPreguntar?: () => void
}) => (
  <div className="bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden">
    <div className="bg-[#142033] text-white px-4 py-2.5 flex items-center gap-2">
      <span className="text-[#F08A3C]" aria-hidden="true">▣</span>
      <span className="font-semibold text-[14px]">{r.titulo}</span>
    </div>
    {r.filas.length > 0 && (
      <dl className="m-0 grid grid-cols-1 sm:grid-cols-2">
        {r.filas.map((f, i) => (
          <div key={i} className="px-4 py-2.5 border-b border-[#F1EEE7] sm:odd:border-r flex flex-col">
            <dt className="text-[11.5px] uppercase tracking-wide text-[#6B6A63]">{f.etiqueta}</dt>
            <dd className="m-0 text-[16px] font-semibold text-[#1B1B18] font-mono">{f.valor}</dd>
            {f.nota && <span className="text-[12px] text-[#6B6A63]">{f.nota}</span>}
          </div>
        ))}
      </dl>
    )}
    {(r.avisos.length > 0 || (r.faltan && r.faltan.length > 0) || (r.supuestos && r.supuestos.length > 0)) && (
      <div className="px-4 py-3 flex flex-col gap-2 text-[13.5px]">
        {r.avisos.map((a, i) => (
          <p key={i} className="m-0 flex gap-2 text-[#7A3A06]">
            <span aria-hidden="true">⚠</span>
            <span>{a}</span>
          </p>
        ))}
        {r.faltan && r.faltan.length > 0 && (
          <p className="m-0 text-[#1B1B18]">
            <strong>Para afinarlo falta:</strong> {r.faltan.join(" · ")}
          </p>
        )}
        {r.supuestos && r.supuestos.length > 0 && (
          <details className="text-[#6B6A63]">
            <summary className="cursor-pointer">Supuestos usados</summary>
            <ul className="m-0 mt-1 pl-5 list-disc">{r.supuestos.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </details>
        )}
      </div>
    )}
    <div className="px-4 py-2 bg-[#FAF9F6] text-[11.5px] text-[#6B6A63] flex flex-wrap items-center gap-2 justify-between">
      <span>Punto de partida. Confírmalo con un corte de prueba.</span>
      {onPreguntar && (
        <button type="button" onClick={onPreguntar} className="font-semibold text-[#B34D07] hover:underline">
          Preguntar al Copiloto →
        </button>
      )}
    </div>
  </div>
)
