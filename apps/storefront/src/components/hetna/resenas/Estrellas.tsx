// Estrellas de una calificación. Dibujadas con un degradado para poder pintar
// medias estrellas sin dos juegos de iconos.
export const Estrellas = ({
  valor,
  size = 14,
}: {
  valor: number
  size?: number
}) => {
  const llenas = Math.max(0, Math.min(5, valor))

  return (
    <span className="inline-flex items-center gap-px align-middle" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((n) => {
        const porcion = Math.max(0, Math.min(1, llenas - n))
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <span className="absolute inset-0 text-[#D9D5CC]" style={{ fontSize: size, lineHeight: 1 }}>
              ★
            </span>
            <span
              className="absolute inset-0 overflow-hidden text-[#F0A020]"
              style={{ width: `${porcion * 100}%`, fontSize: size, lineHeight: 1 }}
            >
              ★
            </span>
          </span>
        )
      })}
    </span>
  )
}
