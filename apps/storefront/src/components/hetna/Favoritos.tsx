"use client"

import { useEffect, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import {
  EVENTO_FAVORITOS,
  Favorito,
  alternarFavorito,
  esFavorito,
  leerFavoritos,
  quitarFavorito,
} from "./favoritos-datos"

const Corazon = ({ lleno = false, size = 20 }: { lleno?: boolean; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={lleno ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
)

const useFavoritos = () => {
  const [lista, setLista] = useState<Favorito[]>([])
  useEffect(() => {
    const leer = () => setLista(leerFavoritos())
    leer()
    window.addEventListener(EVENTO_FAVORITOS, leer)
    window.addEventListener("storage", leer)
    return () => {
      window.removeEventListener(EVENTO_FAVORITOS, leer)
      window.removeEventListener("storage", leer)
    }
  }, [])
  return lista
}

// ---------- Boton del encabezado ----------
export const FavoritosBoton = () => {
  const lista = useFavoritos()
  return (
    <LocalizedClientLink
      href="/favoritos"
      aria-label="Favoritos"
      title="Favoritos"
      className="relative flex items-center gap-1.5 p-2 -m-2 text-[#1B1B18] hover:text-[#B34D07]"
    >
      <Corazon />
      <span className="hidden lg:inline text-[13px] font-medium">Favoritos</span>
      {lista.length > 0 && (
        <span className="absolute top-0 left-5 min-w-4 h-4 px-1 rounded-full bg-[#C2560A] text-white text-[10px] font-bold flex items-center justify-center">
          {lista.length}
        </span>
      )}
    </LocalizedClientLink>
  )
}

// ---------- Boton "Mis compras" del encabezado ----------
export const MisComprasBoton = ({ isLoggedIn }: { isLoggedIn: boolean }) => (
  <LocalizedClientLink
    href={isLoggedIn ? "/user/orders" : "/login"}
    aria-label="Mis compras"
    title="Mis compras"
    className="flex items-center gap-1.5 p-2 -m-2 text-[#1B1B18] hover:text-[#B34D07]"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
    <span className="hidden lg:inline text-[13px] font-medium">Mis compras</span>
  </LocalizedClientLink>
)

// ---------- Boton "Notificaciones" del encabezado ----------
export const NotificacionesBoton = ({ isLoggedIn }: { isLoggedIn: boolean }) => (
  <LocalizedClientLink
    href={isLoggedIn ? "/user/messages" : "/login"}
    aria-label="Notificaciones"
    title="Notificaciones"
    className="flex items-center gap-1.5 p-2 -m-2 text-[#1B1B18] hover:text-[#B34D07]"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
    <span className="hidden lg:inline text-[13px] font-medium">Notificaciones</span>
  </LocalizedClientLink>
)

// ---------- Boton "Guardar en favoritos" en la ficha del producto ----------
export const BotonFavorito = ({ producto }: { producto: Favorito }) => {
  const [activo, setActivo] = useState(false)
  useEffect(() => {
    const leer = () => setActivo(esFavorito(producto.id))
    leer()
    window.addEventListener(EVENTO_FAVORITOS, leer)
    return () => window.removeEventListener(EVENTO_FAVORITOS, leer)
  }, [producto.id])

  return (
    <button
      type="button"
      onClick={() => setActivo(alternarFavorito(producto))}
      aria-pressed={activo}
      className={`w-full uppercase mb-4 py-3 flex justify-center items-center gap-2 rounded-sm font-medium border ${
        activo
          ? "bg-[#FDEEE1] border-[#C2560A] text-[#B34D07]"
          : "bg-white border-[#E7E4DC] text-[#1B1B18] hover:border-[#C2560A]"
      }`}
      data-testid="product-favorite-button"
    >
      <Corazon lleno={activo} size={18} />
      {activo ? "En tus favoritos" : "Guardar en favoritos"}
    </button>
  )
}

// ---------- Pagina /favoritos ----------
export const ListaFavoritos = () => {
  const lista = useFavoritos()
  const [listo, setListo] = useState(false)
  useEffect(() => setListo(true), [])

  if (!listo) return null

  if (lista.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <span className="text-[#C2560A]">
          <Corazon size={40} />
        </span>
        <p className="m-0 text-[16px] font-semibold">Aún no tienes favoritos</p>
        <p className="m-0 text-[14px] text-[#6B6A63] max-w-[360px]">
          Toca el corazón en cualquier producto para guardarlo aquí.
        </p>
        <LocalizedClientLink
          href="/categories"
          className="mt-2 bg-[#C2560A] hover:bg-[#A84A08] text-white px-6 py-3 rounded-[10px] text-[14.5px] font-semibold"
        >
          Explorar catálogo
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {lista.map((f) => (
        <div
          key={f.id}
          className="bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col"
        >
          <LocalizedClientLink href={`/products/${f.handle}`} className="block">
            <div className="aspect-square bg-[#F4F1EA] flex items-center justify-center overflow-hidden">
              {f.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <Image src={f.thumbnail} alt={f.title} className="w-full h-full object-cover" width={300} height={300} />
              ) : (
                <span className="text-[#6B6A63] text-[12px]">Sin imagen</span>
              )}
            </div>
            <div className="p-3 text-[13.5px] font-semibold leading-snug">{f.title}</div>
          </LocalizedClientLink>
          <button
            type="button"
            onClick={() => quitarFavorito(f.id)}
            className="mt-auto mx-3 mb-3 text-[12.5px] font-semibold text-[#B34D07] text-left hover:underline"
          >
            Quitar de favoritos
          </button>
        </div>
      ))}
    </div>
  )
}
