// Favoritos del cliente, guardados en su navegador.
// (No requiere cuenta; mas adelante se pueden ligar a la cuenta del cliente.)

export type Favorito = {
  id: string
  handle: string
  title: string
  thumbnail?: string
}

const CLAVE = "hetna_favoritos"
export const EVENTO_FAVORITOS = "hetna-favoritos"

export const leerFavoritos = (): Favorito[] => {
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    const lista = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

const guardar = (lista: Favorito[]) => {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lista))
  } catch {
    // el navegador no permite guardar (modo privado): se ignora
  }
  window.dispatchEvent(new Event(EVENTO_FAVORITOS))
}

export const esFavorito = (id: string) => leerFavoritos().some((f) => f.id === id)

export const alternarFavorito = (f: Favorito): boolean => {
  const lista = leerFavoritos()
  const existe = lista.some((x) => x.id === f.id)
  guardar(existe ? lista.filter((x) => x.id !== f.id) : [f, ...lista])
  return !existe
}

export const quitarFavorito = (id: string) =>
  guardar(leerFavoritos().filter((x) => x.id !== id))
