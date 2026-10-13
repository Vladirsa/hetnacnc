/**
 * PilaresTrabajo.tsx
 * Visualización de los 4 pilares de HETNA — Nuestro proceso
 * Uso: Insertar en homepage después del Hero
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Zap, Truck } from 'lucide-react'

const PILARES = [
  {
    id: 1,
    numero: '1',
    titulo: 'Cotización',
    descripcion: 'Sube tu archivo DXF, especificaciones y cantidad. Recibe presupuesto en 24h.',
    icono: Upload,
    color: 'from-green-500 to-green-600',
    colorBg: 'bg-green-50',
    colorText: 'text-green-600',
  },
  {
    id: 2,
    numero: '2',
    titulo: 'Orden de Trabajo',
    descripcion: 'Aprobado el presupuesto, generamos la orden de producción y programación CAM.',
    icono: FileText,
    color: 'from-blue-500 to-blue-600',
    colorBg: 'bg-blue-50',
    colorText: 'text-blue-600',
  },
  {
    id: 3,
    numero: '3',
    titulo: 'Fabricación',
    descripcion: 'Producción controlada en máquinas profesionales con verificación de calidad en cada paso.',
    icono: Zap,
    color: 'from-orange-500 to-orange-600',
    colorBg: 'bg-orange-50',
    colorText: 'text-orange-600',
  },
  {
    id: 4,
    numero: '4',
    titulo: 'Entrega',
    descripcion: 'Recibe tu producto en la puerta con embalaje profesional y seguimiento en tiempo real.',
    icono: Truck,
    color: 'from-gray-500 to-gray-600',
    colorBg: 'bg-gray-50',
    colorText: 'text-gray-600',
  },
]

interface PilarCardProps {
  pilar: (typeof PILARES)[0]
  isVisible: boolean
  delay: number
}

function PilarCard({ pilar, isVisible, delay }: PilarCardProps) {
  const IconComponent = pilar.icono
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      className={`
        transition-all duration-700 ease-out
        ${
          isVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-8'
        }
      `}
      style={{
        transitionDelay: isVisible ? `${delay}ms` : '0ms',
      }}
    >
      <div className={`${pilar.colorBg} rounded-xl p-4 h-full hover:shadow-lg transition-all duration-300 transform hover:scale-105`}>
        {/* Número y icono */}
        <div className="mb-2">
          <div
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${pilar.color} flex items-center justify-center mb-2 transform transition-transform duration-300 group-hover:scale-110`}
          >
            <span className="text-lg font-bold text-white">{pilar.numero}</span>
          </div>
          <IconComponent className={`w-8 h-8 ${pilar.colorText}`} strokeWidth={1.5} />
        </div>

        {/* Título */}
        <h3 className={`text-base font-bold ${pilar.colorText} mb-1`}>
          {pilar.titulo}
        </h3>

        {/* Descripción */}
        <p className="text-gray-700 leading-relaxed text-base">
          {pilar.descripcion}
        </p>
      </div>
    </div>
  )
}

export default function PilaresTrabajo() {
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
    <section className="py-5 md:py-6 bg-gradient-to-b from-gray-50 to-white px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-3">
          <h2 className="text-base font-bold text-gray-900 mb-1">
            Nuestro <span className="text-green-600">proceso</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Nuestro proceso es transparente, eficiente y orientado a entregar la máxima calidad en cada proyecto.
          </p>
        </div>

        {/* Grid de pilares */}
        <div
          ref={containerRef}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"
        >
          {PILARES.map((pilar, idx) => (
            <PilarCard
              key={pilar.id}
              pilar={pilar}
              isVisible={isVisible}
              delay={idx * 150}
            />
          ))}
        </div>

        {/* Línea conectora (desktop solo) */}
        <div className="hidden lg:block relative h-2 bg-gradient-to-r from-green-500 via-blue-500 via-orange-500 to-gray-500 rounded-full opacity-20 my-12" />

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-700 mb-3">
            ¿Listo para comenzar tu proyecto? Sube tu archivo ahora.
          </p>
          <a
            href="/maquila"
            className="inline-block px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
          >
            Solicitar presupuesto gratis
          </a>
        </div>
      </div>
    </section>
  )
}
