/**
 * HeroSliderOptimizado.tsx
 * Slider visual del Hero — altura reducida, auto-advance, CTA claro
 * Uso: Reemplazar HeroSlider existente en homepage
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Portada {
  id: string
  titulo: string
  texto: string
  imagen: string
  boton1_texto: string
  boton1_link: string
  boton2_texto?: string
  boton2_link?: string
  orden: number
}

const PORTADAS_DEFAULT: Portada[] = [
  {
    id: '1',
    titulo: 'Router CNC Profesional',
    texto: 'Para talleres, fabricantes y emprendedores',
    imagen: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&h=600&fit=crop',
    boton1_texto: 'Ver Router',
    boton1_link: '/store?category=router-cnc',
    boton2_texto: 'Descubrir precios',
    boton2_link: '/store?category=router-cnc',
    orden: 1,
  },
  {
    id: '2',
    titulo: 'Máquinas Láser CO2',
    texto: 'Corte y grabado profesional',
    imagen: 'https://images.unsplash.com/photo-1581092162562-40038f41dd12?w=1200&h=600&fit=crop',
    boton1_texto: 'Explorar',
    boton1_link: '/store?category=laser',
    boton2_texto: 'Contactar',
    boton2_link: '/contacto',
    orden: 2,
  },
  {
    id: '3',
    titulo: 'Impresoras 3D Industriales',
    texto: 'Precisión de prototipo a producción',
    imagen: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=1200&h=600&fit=crop',
    boton1_texto: 'Ver modelos',
    boton1_link: '/store?category=3d-printer',
    boton2_texto: 'Solicitar demo',
    boton2_link: '/contacto',
    orden: 3,
  },
  {
    id: '4',
    titulo: 'Servicios de Maquila',
    texto: 'Fabricación profesional de tus diseños',
    imagen: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&h=600&fit=crop',
    boton1_texto: 'Solicitar presupuesto',
    boton1_link: '/maquila',
    boton2_texto: 'Ver ejemplos',
    boton2_link: '/galeria',
    orden: 4,
  },
]

export default function HeroSlider() {
  const [portadas, setPortadas] = useState<Portada[]>(PORTADAS_DEFAULT)
  const [actual, setActual] = useState(0)
  const [enPausa, setEnPausa] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-advance cada 5 segundos
  useEffect(() => {
    if (enPausa) return

    timerRef.current = setInterval(() => {
      setActual((prev) => (prev + 1) % portadas.length)
    }, 5000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enPausa, portadas.length])

  // Cargar portadas del API
  useEffect(() => {
    const cargarPortadas = async () => {
      try {
        const res = await fetch('/store/hetna/portadas')
        if (res.ok) {
          const datos = await res.json()
          if (datos.length > 0) {
            setPortadas(datos.sort((a: Portada, b: Portada) => a.orden - b.orden))
          }
        }
      } catch (error) {
        console.error('Error cargando portadas:', error)
      }
    }

    cargarPortadas()
  }, [])

  const ir = (index: number) => {
    setActual((index + portadas.length) % portadas.length)
  }

  const anterior = () => ir(actual - 1)
  const siguiente = () => ir(actual + 1)

  const portadaActual = portadas[actual]

  return (
    <div
      className="relative h-[60vh] md:h-[70vh] overflow-hidden bg-gray-900"
      onMouseEnter={() => setEnPausa(true)}
      onMouseLeave={() => setEnPausa(false)}
    >
      {portadas.map((portada, idx) => (
        <div
          key={portada.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === actual ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={portada.imagen}
            alt={portada.titulo}
            fill
            className="object-cover"
            priority={idx === 0}
            quality={85}
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />

          <div className="absolute inset-0 flex flex-col items-start justify-center px-6 md:px-12 lg:px-20">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 max-w-2xl leading-tight">
              {portada.titulo}
            </h1>

            <p className="text-lg md:text-xl text-gray-100 mb-8 max-w-xl">
              {portada.texto}
            </p>

            <div className="flex flex-col md:flex-row gap-4">
              <Link
                href={portada.boton1_link}
                className="px-8 py-3 md:py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 inline-block"
              >
                {portada.boton1_texto}
              </Link>

              {portada.boton2_texto && (
                <Link
                  href={portada.boton2_link || '#'}
                  className="px-8 py-3 md:py-4 border-2 border-white text-white hover:bg-white/10 font-semibold rounded-lg transition-all duration-300 inline-block"
                >
                  {portada.boton2_texto}
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-8 flex justify-between items-center px-6 md:px-12 z-20">
        <div className="flex gap-4">
          <button
            onClick={anterior}
            className="p-2 md:p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-300 backdrop-blur-sm"
            aria-label="Portada anterior"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={siguiente}
            className="p-2 md:p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all duration-300 backdrop-blur-sm"
            aria-label="Portada siguiente"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="flex gap-2">
          {portadas.map((_, idx) => (
            <button
              key={idx}
              onClick={() => ir(idx)}
              className={`transition-all duration-300 rounded-full ${
                idx === actual
                  ? 'w-8 h-2 bg-white'
                  : 'w-2 h-2 bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Ir a portada ${idx + 1}`}
            />
          ))}
        </div>

        <div className="text-white/70 text-sm font-medium">
          {actual + 1} / {portadas.length}
        </div>
      </div>

      {enPausa && (
        <div className="absolute top-6 right-6 text-white/60 text-xs font-medium z-20">
          ⏸ Pausado
        </div>
      )}
    </div>
  )
}
