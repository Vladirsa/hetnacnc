"use client"

import { useCallback, useMemo, useState } from "react"

// Selección de renglones del carrito.
//
// En el carrito de HETNA todo lo que ya metiste se va a pagar: eso es lo que
// espera cualquiera que llegue aquí. Entonces el estado que se guarda no es
// "qué está seleccionado" sino "qué quitaste de la selección". La diferencia
// importa para dos casos que con una lista de seleccionados se rompen:
//
//   - Agregas un producto nuevo mientras estás en el carrito: entra marcado,
//     sin tener que sincronizar nada.
//   - Borras un renglón: su id sobra en el conjunto y se limpia solo, porque
//     la selección siempre se calcula contra los ids que de verdad existen.
//
// La selección vive sólo mientras la página está abierta. No se guarda en el
// navegador a propósito: que un producto quede sin marcar de una visita
// anterior, y que por eso no se cobre, es peor que volver a marcarlo.
export type Seleccion = {
  seleccionados: string[]
  estaSeleccionado: (id: string) => boolean
  alternar: (id: string) => void
  todosSeleccionados: boolean
  algunoSeleccionado: boolean
  alternarTodos: () => void
  grupoSeleccionado: (ids: string[]) => boolean
  alternarGrupo: (ids: string[]) => void
  limpiar: () => void
}

export const useSeleccion = (ids: string[]): Seleccion => {
  const [excluidos, setExcluidos] = useState<Set<string>>(() => new Set())

  const seleccionados = useMemo(
    () => ids.filter((id) => !excluidos.has(id)),
    [ids, excluidos]
  )

  const estaSeleccionado = useCallback(
    (id: string) => !excluidos.has(id),
    [excluidos]
  )

  const alternar = useCallback((id: string) => {
    setExcluidos((previos) => {
      const siguiente = new Set(previos)
      if (siguiente.has(id)) {
        siguiente.delete(id)
      } else {
        siguiente.add(id)
      }
      return siguiente
    })
  }, [])

  const todosSeleccionados = ids.length > 0 && seleccionados.length === ids.length

  const alternarTodos = useCallback(() => {
    setExcluidos((previos) => {
      const marcados = ids.filter((id) => !previos.has(id)).length
      return marcados === ids.length ? new Set(ids) : new Set()
    })
  }, [ids])

  const grupoSeleccionado = useCallback(
    (grupo: string[]) => grupo.length > 0 && grupo.every((id) => !excluidos.has(id)),
    [excluidos]
  )

  const alternarGrupo = useCallback((grupo: string[]) => {
    setExcluidos((previos) => {
      const siguiente = new Set(previos)
      const completo = grupo.every((id) => !previos.has(id))
      grupo.forEach((id) => (completo ? siguiente.add(id) : siguiente.delete(id)))
      return siguiente
    })
  }, [])

  const limpiar = useCallback(() => setExcluidos(new Set()), [])

  return {
    seleccionados,
    estaSeleccionado,
    alternar,
    todosSeleccionados,
    algunoSeleccionado: seleccionados.length > 0,
    alternarTodos,
    grupoSeleccionado,
    alternarGrupo,
    limpiar,
  }
}
