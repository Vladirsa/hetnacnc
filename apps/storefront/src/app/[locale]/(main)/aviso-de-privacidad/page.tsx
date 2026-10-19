import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import { EMPRESA, medioContacto, responsable, ubicacionEmpresa } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Aviso de privacidad integral de HETNA CNC: qué datos personales recabamos, para qué los usamos y cómo ejercer tus derechos ARCO.",
}

export default function AvisoDePrivacidad() {
  return (
    <PaginaInfo etiqueta="Legal" titulo="Aviso de privacidad" resumen="Cómo tratamos tus datos personales." actualizado>
      <h2>Responsable</h2>
      <p>
        {responsable()}, con domicilio en {EMPRESA.domicilioCompleto || ubicacionEmpresa()}
        {EMPRESA.rfc ? ` y RFC ${EMPRESA.rfc}` : ""}, es responsable del tratamiento de tus datos personales conforme a la Ley
        Federal de Protección de Datos Personales en Posesión de los Particulares.
      </p>

      <h2>Datos que recabamos</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo electrónico, teléfono y ciudad.</li>
        <li>Entrega: dirección de envío y código postal.</li>
        <li>Compras y cotizaciones: productos comprados, descripción de trabajos solicitados y archivos que compartas.</li>
        <li>Para talleres y vendedores: datos del negocio, servicios, máquinas y datos para recibir pagos.</li>
        <li>Datos de navegación necesarios para que el sitio funcione.</li>
      </ul>
      <p>
        No recabamos datos personales sensibles. Los datos de tu tarjeta los procesa directamente Mercado Pago; HETNA no los
        recibe ni los guarda.
      </p>

      <h2>Para qué los usamos</h2>
      <p>Finalidades necesarias:</p>
      <ul>
        <li>Procesar tus compras, pagos, envíos, devoluciones y facturación.</li>
        <li>Atender tus solicitudes de cotización y hacerlas llegar a los talleres (sin compartir tus datos de contacto con ellos).</li>
        <li>Crear y administrar tu cuenta de cliente o de vendedor.</li>
        <li>Darte atención y soporte, y cumplir obligaciones legales.</li>
      </ul>
      <p>Finalidades adicionales (puedes negarte):</p>
      <ul>
        <li>Enviarte promociones, novedades y contenido de HETNA CNC.</li>
        <li>Hacer estadísticas para mejorar el sitio.</li>
      </ul>
      <p>Si no quieres que usemos tus datos para las finalidades adicionales, escríbenos por {medioContacto()}.</p>

      <h2>Con quién los compartimos</h2>
      <ul>
        <li>Paqueterías, a través de Envíos HETNA, para entregar tus pedidos.</li>
        <li>Mercado Pago, para procesar los pagos.</li>
        <li>El taller o vendedor que atiende tu pedido, solo con los datos necesarios para fabricarlo y enviarlo.</li>
        <li>Proveedores de servicios tecnológicos (alojamiento, correo electrónico) que nos ayudan a operar el sitio.</li>
        <li>Autoridades, cuando la ley lo requiera.</li>
      </ul>

      <h2>Derechos ARCO y revocación</h2>
      <p>
        Puedes Acceder a tus datos, Rectificarlos, Cancelarlos u Oponerte a su uso, así como revocar tu consentimiento o
        limitar su uso. Envía tu solicitud por {medioContacto()} con tu nombre, el derecho que quieres ejercer y una
        identificación. Te responderemos en un plazo máximo de 20 días hábiles.
      </p>

      <h2>Cookies</h2>
      <p>
        Usamos cookies y tecnologías similares para mantener tu sesión, tu carrito y tus preferencias. Puedes desactivarlas
        en tu navegador, aunque algunas funciones del sitio podrían dejar de funcionar.
      </p>

      <h2>Cambios a este aviso</h2>
      <p>Cualquier cambio lo publicaremos en esta misma página, con su fecha de actualización.</p>
    </PaginaInfo>
  )
}
