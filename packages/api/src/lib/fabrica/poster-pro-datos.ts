// WhatsApp de HETNA que sale en la barra de las imágenes pro.
const crudo = (process.env.HETNA_WHATSAPP || "522217076014").replace(/\D/g, "")
const diez = crudo.slice(-10)
export const EMPRESA_WHATSAPP_TEXTO = diez.length === 10 ? `+52 ${diez.slice(0, 3)} ${diez.slice(3, 6)} ${diez.slice(6)}` : ""
