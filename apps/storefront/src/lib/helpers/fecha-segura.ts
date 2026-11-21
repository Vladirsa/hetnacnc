// Formatea una fecha sin tronar: Intl.DateTimeFormat.format lanza
// "RangeError: Invalid time value" con una fecha vacía o mal guardada, y en una
// página del servidor eso tumba la página completa (pasó con una ficha de
// producto el 21 nov 2026). Con una fecha inválida regresa "".
export function fechaSegura(formato: Intl.DateTimeFormat, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return ""
  const d = valor instanceof Date ? valor : new Date(valor as string | number)
  return Number.isFinite(d.getTime()) ? formato.format(d) : ""
}
