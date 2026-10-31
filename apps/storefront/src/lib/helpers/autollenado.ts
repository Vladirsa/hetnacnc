import type { FieldValues, UseFormGetValues, UseFormSetValue } from "react-hook-form"

/**
 * Chrome y Edge rellenan solos el correo y la contraseña (los campos se ven con
 * fondo azul), pero a veces no le avisan a la página hasta que la persona teclea
 * algo. Entonces el formulario cree que están vacíos y el botón "no hace nada"
 * (había que poner un espacio y borrarlo para que avanzara). Antes de validar
 * copiamos lo que de verdad dice cada campo.
 */
export function copiarAutollenado<T extends FieldValues>(
  form: HTMLFormElement,
  getValues: UseFormGetValues<T>,
  setValue: UseFormSetValue<T>
) {
  for (const el of Array.from(form.elements)) {
    if (
      !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)
    )
      continue
    if (!el.name || ["checkbox", "radio", "file", "submit", "button"].includes(el.type)) continue
    const actual = getValues(el.name as any)
    if (typeof actual === "string" || actual === undefined) {
      if (actual !== el.value) setValue(el.name as any, el.value as any, { shouldDirty: true })
    }
  }
}
