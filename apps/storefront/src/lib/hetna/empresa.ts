// Datos oficiales de HETNA CNC. Se usan en Contacto, Quiénes somos y páginas legales.
// Cambia aquí y se actualiza en todo el sitio. Los campos vacíos no se muestran.
export const EMPRESA = {
  nombreComercial: "HETNA CNC",
  // Nombre o razón social del responsable (persona física o moral). PENDIENTE de Vlado.
  razonSocial: "",
  // RFC: solo si se quiere publicar. PENDIENTE.
  rfc: "",
  // Correo oficial único. PENDIENTE: mientras esté vacío se usa WhatsApp.
  correo: "",
  // Domicilio a mostrar. Mínimo ciudad y estado.
  ciudad: "Apizaco",
  estado: "Tlaxcala",
  domicilioCompleto: "", // PENDIENTE (requerido para el aviso de privacidad definitivo)
  whatsapp: "522461217072",
  whatsappVisible: "+52 246 121 7072",
  horario: "Lunes a viernes de 9:00 a 18:00 h (hora del centro de México)",
  sitio: "https://hetnacnc.com",
  redes: [
    { nombre: "Facebook", url: "https://www.facebook.com/hetna.cnc" },
    { nombre: "Instagram", url: "https://www.instagram.com/hetna_cnc/" },
    { nombre: "TikTok", url: "https://www.tiktok.com/@hetna_cnc" },
    { nombre: "X", url: "https://x.com/CncHetna" },
    { nombre: "YouTube", url: "https://www.youtube.com/channel/UCw3eWFopDZAzKa4mRIM8YoQ" },
  ],
  // Política de devoluciones (borrador; confirmar con Vlado y abogado)
  diasDevolucion: 5, // días hábiles desde la entrega, productos físicos sin uso
  actualizado: "7 de octubre de 2026",
}

export const ubicacionEmpresa = () => `${EMPRESA.ciudad}, ${EMPRESA.estado}, México`

export const responsable = () =>
  EMPRESA.razonSocial ? `${EMPRESA.razonSocial} (${EMPRESA.nombreComercial})` : EMPRESA.nombreComercial

export const medioContacto = () =>
  EMPRESA.correo
    ? `el correo ${EMPRESA.correo} o WhatsApp ${EMPRESA.whatsappVisible}`
    : `WhatsApp ${EMPRESA.whatsappVisible}`

export const ligaWhatsApp = (texto: string) =>
  `https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(texto)}`
