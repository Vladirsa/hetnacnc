/**
 * EstadisticasConfianza.tsx
 * Sección de Trust — Estadísticas animadas + Testimonios
 * Uso: Insertar en homepage después de Pilares o antes de Footer
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import BadgesConfianza from './BadgesConfianza'
import { Star } from 'lucide-react'

interface Stat {
  numero: number
  label: string
  icono: string
  description: string
}

interface Testimonio {
  nombre: string
  empresa: string
  cargo: string
  mensaje: string
  imagen?: string
  rating: number
}

const ESTADISTICAS: Stat[] = [
  {
    numero: 2847,
    label: 'Proyectos completados',
    icono: '✓',
    description: 'En los últimos 3 años',
  },
  {
    numero: 1205,
    label: 'Clientes activos',
    icono: '👥',
    description: 'Talleres, fabricantes y emprendedores',
  },
  {
    numero: 12,
    label: 'Años en el negocio',
    icono: '📅',
    description: 'Experiencia comprobada en CNC',
  },
  {
    numero: 98,
    label: '% Satisfacción',
    icono: '⭐',
    description: 'Según nuestros clientes',
  },
]

const TESTIMONIOS: Testimonio[] = [
  {
    nombre: 'Carlos Menéndez',
    empresa: 'Taller CNC México',
    cargo: 'Propietario',
    mensaje:
      'HETNA ha sido fundamental para conseguir clientes. La plataforma es intuitiva y el soporte es excelente. Recomendado 100%.',
    rating: 5,
  },
  {
    nombre: 'Andrea Rodríguez',
    empresa: 'Diseños Digitales SA',
    cargo: 'Gerente de Operaciones',
    mensaje:
      'Los precios son competitivos y la calidad de los trabajos es consistente. Ya vamos en 15 proyectos con ellos.',
    rating: 5,
  },
  {
    nombre: 'Miguel Reyes',
    empresa: 'Fabricación personalizada',
    cargo: 'Ingeniero',
    mensaje:
      'El proceso es transparente, los tiempos se cumplen y entienden bien las especificaciones técnicas. Perfecto para nuestras necesidades.',
    rating: 4,
  },
]

interface CounterProps {
  numero: number
  label: string
  isVisible: boolean
}

function CounterAnimado({ numero, label, isVisible }: CounterProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible) return

    const increment = Math.ceil(numero / 30) // 30 frames de animación
    let current = 0
    const interval = setInterval(() => {
      current += increment
      if (current >= numero) {
        setCount(numero)
        clearInterval(interval)
      } else {
        setCount(current)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [isVisible, numero])

  const displayNumber = count.toLocaleString('es-MX')

  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-green-600 mb-1">
        {displayNumber}
        {numero >= 100 && numero !== Math.floor(numero) && '%'}
      </div>
      <p className="text-gray-700 font-medium">{label}</p>
    </div>
  )
}

function TestimonioCard({ testimonio }: { testimonio: Testimonio }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 md:p-5 hover:shadow-lg transition-all duration-300">
      {/* Rating */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: testimonio.rating }).map((_, i) => (
          <Star
            key={i}
            size={18}
            className="fill-yellow-400 text-yellow-400"
          />
        ))}
      </div>

      {/* Mensaje */}
      <p className="text-gray-700 mb-3 leading-relaxed italic">
        "{testimonio.mensaje}"
      </p>

      {/* Autor */}
      <div className="border-t pt-4">
        <p className="font-bold text-gray-900">{testimonio.nombre}</p>
        <p className="text-sm text-gray-600">{testimonio.cargo}</p>
        <p className="text-sm text-green-600 font-medium">{testimonio.empresa}</p>
      </div>
    </div>
  )
}

export default function EstadisticasConfianza() {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={containerRef}
      className="py-8 md:py-10 bg-gradient-to-b from-white to-gray-50 px-4 md:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        {/* Sección de Estadísticas */}
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 text-center mb-6">
            Números que hablan por nosotros
          </h2>

          {/* Grid de estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {ESTADISTICAS.map((stat) => (
              <div
                key={stat.label}
                className={`text-center transition-all duration-700 ${
                  isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
              >
                <CounterAnimado
                  numero={stat.numero}
                  label={stat.label}
                  isVisible={isVisible}
                />
                <p className="text-gray-600 text-sm mt-2">{stat.description}</p>
              </div>
            ))}
          </div>

          {/* Línea divisora */}
          <div className="h-1 w-24 bg-gradient-to-r from-green-600 to-transparent mx-auto mb-6" />
        </div>

        {/* Sección de Testimonios */}
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 text-center mb-2">
            Lo que dicen nuestros clientes
          </h2>
          <p className="text-gray-600 text-center mb-4 max-w-2xl mx-auto">
            Empresas de todo México confían en HETNA para sus proyectos de fabricación.
          </p>

          {/* Grid de testimonios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIOS.map((testimonio) => (
              <TestimonioCard
                key={testimonio.nombre}
                testimonio={testimonio}
              />
            ))}
          </div>

          {/* CTA para más testimonios */}
          <div className="text-center mt-12">
            <a
              href="/testimonios"
              className="inline-block text-green-600 hover:text-green-700 font-semibold transition-colors duration-300"
            >
              Ver más testimonios y casos de éxito →
            </a>
          </div>
        </div>

        <BadgesConfianza />
      </div>
    </section>
  )
}
