// Datos oficiales de HETNA CNC. Se usan en Contacto, Quiénes somos y páginas legales.
// Cambia aquí y se actualiza en todo el sitio. Los campos vacíos no se muestran.
export const EMPRESA = {
  nombreComercial: "HETNA CNC",
  // Nombre o razón social del responsable (persona física o moral). PENDIENTE de Vlado.
  razonSocial: "Roberto Rivera Sanchez",
  // Tipo de persona del responsable. Cuando se constituya la persona moral, cambiar
  // a "moral", poner su razón social arriba y su RFC.
  tipoPersona: "física" as "física" | "moral",
  // RFC: solo si se quiere publicar. PENDIENTE.
  rfc: "",
  // Correo oficial único. PENDIENTE: mientras esté vacío se usa WhatsApp.
  correo: "contacto@hetnacnc.com",
  // Correo para solicitudes de datos personales (derechos ARCO, privacidad).
  // PENDIENTE de Vlado: crear p. ej. privacidad@hetnacnc.com. Vacío = usa `correo` o WhatsApp.
  correoPrivacidad: "contacto@hetnacnc.com",
  // Domicilio a mostrar. Mínimo ciudad y estado.
  ciudad: "Apizaco",
  estado: "Tlaxcala",
  // Por seguridad no se publica calle ni número de un domicilio particular. Ver
  // "Paquete legal" (pregunta al abogado: domicilio para oír y recibir notificaciones).
  domicilioCompleto: "Col. Centro, Apizaco, Tlaxcala, México",
  whatsapp: "522461217072",
  whatsappVisible: "+52 246 121 7072",
  // Teléfono de atención (llamadas)
  telefono: "522217076014",
  telefonoVisible: "+52 221 707 6014",
  horario: "Lunes a viernes de 9:00 a 18:00 h (hora del centro de México)",
  sitio: "https://hetnacnc.com",
  redes: [
    { nombre: "Facebook", url: "https://www.facebook.com/hetna.cnc" },
    { nombre: "Instagram", url: "https://www.instagram.com/hetna_cnc/" },
    { nombre: "TikTok", url: "https://www.tiktok.com/@hetna_cnc" },
    { nombre: "X", url: "https://x.com/CncHetna" },
    { nombre: "YouTube", url: "https://www.youtube.com/channel/UCw3eWFopDZAzKa4mRIM8YoQ" },
    { nombre: "LinkedIn", url: "https://www.linkedin.com/in/roberto-vladimir-rivera-sanchez-armas-9531a117b/" },
    { nombre: "Grupo Router CNC México", url: "https://www.facebook.com/groups/routercncmexico" },
  ],
  // Política de devoluciones (borrador; confirmar con Vlado y abogado)
  diasDevolucion: 5, // días hábiles desde la entrega, productos físicos sin uso
  actualizado: "7 de octubre de 2026",
  // Aviso de privacidad: versión y fecha en que entra en vigor (cambiar ambas al modificarlo)
  privacidadVersion: "2.2",
  privacidadVigencia: { es: "1 de noviembre de 2026", en: "November 1, 2026" },
}

export const ubicacionEmpresa = () => `${EMPRESA.ciudad}, ${EMPRESA.estado}, México`

export const responsable = () =>
  EMPRESA.razonSocial ? `${EMPRESA.razonSocial} (${EMPRESA.nombreComercial})` : EMPRESA.nombreComercial

// "Roberto Rivera Sanchez, persona física, quien opera HETNA CNC"
export const responsableLegal = (idioma: "es" | "en" = "es") =>
  !EMPRESA.razonSocial
    ? EMPRESA.nombreComercial
    : EMPRESA.tipoPersona === "física"
      ? idioma === "en"
        ? `${EMPRESA.razonSocial}, an individual doing business as ${EMPRESA.nombreComercial}`
        : `${EMPRESA.razonSocial}, persona física que opera ${EMPRESA.nombreComercial}`
      : `${EMPRESA.razonSocial} (${EMPRESA.nombreComercial})`

export const medioContacto = () =>
  EMPRESA.correo
    ? `el correo ${EMPRESA.correo}, WhatsApp ${EMPRESA.whatsappVisible} o el teléfono ${EMPRESA.telefonoVisible}`
    : `WhatsApp ${EMPRESA.whatsappVisible}`

// Medio para ejercer derechos sobre datos personales
export const contactoPrivacidad = () => EMPRESA.correoPrivacidad || EMPRESA.correo || ""

export const ligaWhatsApp = (texto: string) =>
  `https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(texto)}`
