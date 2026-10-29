// Lo que se le dice a un dueño de taller, en un solo lugar: lo usan el
// directorio (/talleres, sección "Para talleres") y la página completa
// (/talleres/unete). Si cambia una respuesta, cambia en las dos.

export const PASOS_TALLER: [string, string][] = [
  ["Registra tu taller", "Llena el formulario: servicios, materiales, máquinas y capacidad. Es gratis."],
  ["Recibe solicitudes", "Te llega un correo cuando un cliente pide un trabajo de tu proceso, y lo ves en tu panel."],
  ["Cotiza proyectos", "Ves material, medidas, cantidad, fecha y archivos, y mandas tu precio y tiempo. Tú eliges cuáles."],
  ["Gana más trabajos", "Si el cliente te elige y paga, fabricas, entregas y cobras. Cada trabajo suma reseñas a tu perfil."],
]

export const BENEFICIOS_TALLER: [string, string][] = [
  ["Recibe solicitudes calificadas", "Cada una llega con material, medidas, cantidad, fecha y archivo; HETNA la revisa antes de mandarla."],
  ["Consigue clientes fuera de tu zona", "Clientes de todo México, y con Envíos HETNA les entregas sin contratar paquetería por tu cuenta."],
  ["Muestra tus capacidades", "Perfil con máquinas, materiales, galería de trabajos y catálogo: tu página sin pagar sitio web."],
  ["Crea reputación", "Reseñas de clientes reales e insignia de Taller verificado."],
  ["Accede a proyectos de fabricación y producción", "Piezas únicas, prototipos, lotes, maquila y pedidos recurrentes."],
]

export const PERFILES_TALLER = [
  "CNC madera", "Metal", "Acrílico", "Prototipos", "Producción", "Láser", "Torno",
  "Plasma", "Fresadora y centro de maquinado", "4 y 5 ejes", "Impresión 3D", "Diseño CAD/CAM", "Acabados",
]

export type PreguntaTaller = { p: string; r: string; corta?: boolean }

// "corta": las que salen también en el directorio. Todas salen en /talleres/unete.
export const PREGUNTAS_TALLER: PreguntaTaller[] = [
  {
    p: "¿Tiene costo registrarse?",
    corta: true,
    r: "No. Registrarte, tener tu perfil y recibir solicitudes es gratis. HETNA sólo cobra una comisión cuando vendes o ganas un trabajo que el cliente paga dentro de la plataforma; la comisión vigente la ves en tu panel antes de vender. Hay planes opcionales que ponen tus propuestas primero.",
  },
  {
    p: "¿Cómo recibo proyectos?",
    corta: true,
    r: "Cuando un cliente pide un trabajo de tu proceso, te llega un correo y aparece en \"Solicitudes\" de tu panel. Reciben el aviso primero los talleres que trabajan ese material y los del estado del cliente. Ahí ves el trabajo, descargas los archivos del cliente y mandas tu precio y tiempo.",
  },
  {
    p: "¿Qué tipo de trabajos puedo recibir?",
    corta: true,
    r: "Corte, grabado, maquinado, torneado, impresión 3D, diseño, maquila y producción por volumen: piezas únicas, prototipos, lotes y pedidos recurrentes. Además puedes vender productos en tu tienda dentro de HETNA.",
  },
  {
    p: "¿Puedo elegir qué cotizar?",
    corta: true,
    r: "Sí. Tú decides a cuáles mandar precio. Si uno no te conviene, lo marcas como \"no tengo capacidad\", \"no trabajo ese material\" o \"necesito más información\" y deja de aparecerte; con la última, HETNA le pregunta al cliente por ti.",
  },
  {
    p: "¿Cómo me contactan?",
    corta: true,
    r: "Al registrarte, HETNA te escribe por WhatsApp o correo para darte de alta. Después, los trabajos te llegan por correo y en tu panel. Los clientes no ven tu teléfono ni tú el suyo: las preguntas, el pago y el seguimiento van por HETNA, así nadie se salta el pago. Un cliente también puede pedirte cotización directa desde tu perfil.",
  },
  {
    p: "¿Necesito facturar?",
    r: "Cada taller cumple sus obligaciones fiscales y emite sus comprobantes (CFDI). Para cobrar necesitas dar tu RFC. Cuando la ley lo pide, HETNA, como plataforma de intermediación, retiene ISR e IVA de tus pagos y te entrega la constancia de retenciones.",
  },
  {
    p: "¿Qué pasa si no tengo página web?",
    r: "No la necesitas. Tu perfil en HETNA funciona como tu página: portada, logo, galería de trabajos, máquinas, materiales, reseñas y catálogo. Lo puedes compartir por WhatsApp y redes.",
  },
  {
    p: "¿Cómo me pagan?",
    r: "El cliente paga dentro de HETNA (Mercado Pago) y tú empiezas cuando el pago está confirmado: nunca fabricas sin que esté pagado. HETNA te entrega el importe menos la comisión y las retenciones que marque la ley cuando el pedido se entrega.",
  },
  {
    p: "¿Qué pasa después de registrarme?",
    r: "Te llega un correo con tu siguiente paso: crear tu cuenta en el panel y completar tu perfil. Luego verificamos tu taller con una identificación y fotos para darte la insignia de Taller verificado, que los clientes ven en tu perfil.",
  },
]
