// Contenido del Aviso de privacidad integral de HETNA CNC, en español y en inglés.
//
// Por qué vive aquí y no escrito directo en la página: es un texto legal largo
// que se actualiza con cuidado. Tenerlo como datos permite mantener las dos
// versiones (es/en) lado a lado, sección por sección, y que la página solo las
// dibuje. Al cambiar algo: cambia AMBOS idiomas, sube `privacidadVersion` y
// `privacidadVigencia` en src/lib/hetna/empresa.ts y anota el cambio en
// HISTORIAL (abajo).
//
// Marco legal que cubre (investigado el 28 oct 2026; revisar con abogado):
//   - México: Ley Federal de Protección de Datos Personales en Posesión de los
//     Particulares (DOF 20-mar-2025), arts. 7-9 (consentimiento), 15-16 (contenido
//     del aviso), 18-20 (seguridad), 28-34 (derechos ARCO y plazos), 35-36
//     (transferencias). Autoridad: Secretaría Anticorrupción y Buen Gobierno.
//     Ley Federal de Protección al Consumidor, art. 76 bis (comercio electrónico).
//   - EE. UU.: California Online Privacy Protection Act (CalOPPA), leyes estatales
//     de privacidad (derechos de acceso, corrección, borrado y exclusión de
//     publicidad dirigida), señales Global Privacy Control / Do Not Track, COPPA.
//   - Brasil: LGPD (Lei 13.709/2018). Colombia: Ley 1581 de 2012 y Decreto 1377
//     de 2013 (contenido mínimo de la política de tratamiento). Chile: Ley 21.719
//     (vigente desde el 1 de diciembre de 2026). Argentina: Ley 25.326.
//     Perú: Ley 29733 y su Reglamento (D.S. 016-2024-JUS). Ecuador: LOPDP.

export type Bloque =
  | { p: string }
  | { ul: string[] }
  | { tabla: { cab: string[]; filas: string[][] } }
  | { nota: string }
  | { preferenciasCookies: true }

export type Seccion = { id: string; titulo: string; bloques: Bloque[] }

export type Datos = {
  responsable: string
  domicilio: string
  rfc: string
  correo: string // vacío si aún no hay correo de privacidad
  whatsapp: string
  telefono: string
}

const contactoEs = (d: Datos) =>
  d.correo ? `el correo ${d.correo}, WhatsApp ${d.whatsapp} o el teléfono ${d.telefono}` : `WhatsApp ${d.whatsapp} o el teléfono ${d.telefono}`
const contactoEn = (d: Datos) =>
  d.correo ? `email ${d.correo}, WhatsApp ${d.whatsapp} or phone ${d.telefono}` : `WhatsApp ${d.whatsapp} or phone ${d.telefono}`

// ---------------------------------------------------------------- ESPAÑOL

export const avisoEs = (d: Datos): Seccion[] => [
  {
    id: "resumen",
    titulo: "Resumen en un minuto",
    bloques: [
      {
        ul: [
          "Usamos tus datos para que puedas comprar, vender, cotizar y recibir tus pedidos en HETNA CNC.",
          "No vendemos tus datos personales.",
          "Los datos de tu tarjeta los procesan PayPal o Mercado Pago; HETNA no los recibe ni los guarda.",
          "La identificación y las fotos que un taller sube para verificarse son privadas: no se publican y solo las revisa el equipo de HETNA.",
          "Las cookies de estadística y de publicidad solo se activan si las aceptas. Puedes cambiar tu decisión cuando quieras.",
          `Puedes pedir ver, corregir o borrar tus datos, u oponerte a su uso, escribiendo por ${contactoEs(d)}. Es gratis.`,
        ],
      },
    ],
  },
  {
    id: "responsable",
    titulo: "1. Quién es responsable de tus datos",
    bloques: [
      {
        p: `${d.responsable}, con domicilio en ${d.domicilio}${d.rfc ? ` y RFC ${d.rfc}` : ""}, es el responsable del tratamiento de tus datos personales en el sitio hetnacnc.com.`,
      },
      {
        p: `Para cualquier tema de datos personales (dudas, solicitudes de derechos, quejas) contacta al área de Datos Personales de HETNA CNC por ${contactoEs(d)}. Esta área cumple la función de encargado de protección de datos (encarregado, en Brasil; oficial de datos, en otros países).`,
      },
      {
        p: "Este aviso aplica a todo el sitio hetnacnc.com y sus servicios: tienda y marketplace, panel de talleres y vendedores, cotizador, laboratorio CAM, foro, envíos y atención por WhatsApp. Si eres cliente, visitante, taller o vendedor, este aviso te aplica.",
      },
    ],
  },
  {
    id: "datos",
    titulo: "2. Qué datos personales recabamos",
    bloques: [
      {
        tabla: {
          cab: ["Tipo de dato", "Ejemplos", "De dónde viene"],
          filas: [
            ["Identificación y contacto", "Nombre, correo electrónico, teléfono, ciudad y país", "Tú, al crear tu cuenta, comprar, cotizar o escribirnos"],
            ["Cuenta", "Usuario, contraseña (guardada cifrada), preferencias e idioma", "Tú"],
            ["Entrega y facturación", "Dirección de envío, código postal, datos fiscales si pides factura", "Tú"],
            ["Compras y pagos", "Productos, montos, estado del pago e identificador de la transacción", "Tú y PayPal o Mercado Pago (no recibimos los datos de tu tarjeta)"],
            ["Cotizaciones y trabajos", "Descripción del trabajo, medidas, materiales y archivos que compartes (DXF, SVG, STL, STEP, fotos)", "Tú"],
            ["Talleres y vendedores", "Nombre del negocio, servicios, máquinas, ubicación del taller, productos y precios", "El taller"],
            ["Datos patrimoniales del taller", "Cuenta bancaria o CLABE y datos para recibir pagos", "El taller"],
            ["Verificación del taller", "Identificación oficial (frente y reverso), fotos de la fachada y del interior del taller, comprobante de domicilio (opcional)", "El taller, de forma voluntaria"],
            ["Contenido que publicas", "Mensajes del foro, reseñas, preguntas, fotos de trabajos", "Tú"],
            ["Comunicaciones", "Mensajes por WhatsApp, correo o chat con talleres y con HETNA", "Tú"],
            ["Datos técnicos", "Dirección IP, tipo de navegador y dispositivo, páginas visitadas, cookies", "Tu navegador, de forma automática"],
          ],
        },
      },
      {
        p: "Datos sensibles: no te pedimos datos sensibles (origen étnico, salud, religión, opiniones políticas, preferencia sexual, datos genéticos). La identificación oficial que sube un taller incluye su fotografía: no hacemos reconocimiento facial ni ningún tratamiento biométrico con ella; solo la revisa una persona para confirmar que el taller es real. Aun así, le damos la protección más alta: viaja cifrada (HTTPS), se guarda en una carpeta privada sin dirección pública, solo puede descargarla con sesión iniciada el propio taller o un administrador de HETNA, y solo se trata con tu consentimiento expreso.",
      },
      {
        p: "Datos patrimoniales y financieros: los datos bancarios del taller se usan solo para pagarle lo que vende. Los pedimos con su consentimiento expreso: el formulario donde los captura incluye la autorización por escrito, y al guardarlos queda registrada la fecha en que la otorgó.",
      },
    ],
  },
  {
    id: "finalidades",
    titulo: "3. Para qué usamos tus datos",
    bloques: [
      { p: "Finalidades necesarias (sin ellas no podemos darte el servicio):" },
      {
        ul: [
          "Crear y administrar tu cuenta de cliente, taller o vendedor.",
          "Procesar compras, pagos, envíos, devoluciones, garantías y facturación.",
          "Hacer llegar tus solicitudes de cotización a los talleres y gestionar las propuestas.",
          "Pagar a los talleres y vendedores lo que venden, menos las comisiones acordadas.",
          "Verificar la identidad y existencia de los talleres que lo solicitan, y mostrar la insignia de taller verificado.",
          "Dar atención, soporte y resolver aclaraciones o quejas.",
          "Prevenir fraudes, abusos y proteger la seguridad del sitio y de los usuarios.",
          "Cumplir obligaciones legales, fiscales y requerimientos de autoridades.",
        ],
      },
      { p: "Finalidades adicionales (puedes negarte y seguirás usando el sitio igual):" },
      {
        ul: [
          "Enviarte promociones, novedades y contenido de HETNA CNC por correo o WhatsApp.",
          "Medir el uso del sitio para mejorarlo (Google Analytics), solo si aceptas las cookies de estadística.",
          "Mostrarte publicidad de HETNA en otras plataformas (Meta Pixel), solo si aceptas las cookies de publicidad.",
          "Invitarte a encuestas de satisfacción.",
        ],
      },
      {
        p: `Para negarte a las finalidades adicionales: rechaza las cookies no necesarias (botón al final de este aviso), usa el enlace para darte de baja en cada correo, o escríbenos por ${contactoEs(d)}. Negarte no afecta tus compras ni tu cuenta.`,
      },
      {
        p: "No tomamos decisiones que te afecten de forma importante basadas únicamente en tratamiento automatizado. Las calculadoras y el laboratorio solo te sugieren información; las decisiones las tomas tú.",
      },
    ],
  },
  {
    id: "bases",
    titulo: "4. Base legal del tratamiento",
    bloques: [
      { p: "Tratamos tus datos con una de estas bases, según el caso y la ley de tu país:" },
      {
        tabla: {
          cab: ["Base", "Ejemplos"],
          filas: [
            ["Cumplir el contrato contigo", "Tu cuenta, tus compras, envíos, cotizaciones, pagos a talleres"],
            ["Tu consentimiento", "Promociones, cookies de estadística y publicidad, verificación con identificación, datos bancarios del taller"],
            ["Obligación legal", "Facturación, conservación de registros fiscales, requerimientos de autoridad"],
            ["Interés legítimo", "Seguridad del sitio, prevención de fraude, mejoras básicas del servicio"],
          ],
        },
      },
      {
        p: "En México, al usar el sitio después de conocer este aviso, consientes el tratamiento para las finalidades necesarias (consentimiento tácito). Para los datos patrimoniales y para la identificación de verificación te pedimos tu consentimiento expreso.",
      },
    ],
  },
  {
    id: "compartir",
    titulo: "5. Con quién compartimos tus datos",
    bloques: [
      { p: "No vendemos tus datos personales ni los rentamos. Solo los compartimos en estos casos:" },
      {
        tabla: {
          cab: ["Con quién", "Para qué", "¿Necesita tu consentimiento?"],
          filas: [
            ["El taller o vendedor de tu pedido o cotización", "Fabricar, preparar y enviar lo que compraste o pediste", "No: es necesario para cumplir la compra que solicitaste"],
            ["PayPal y Mercado Pago", "Procesar tus pagos y prevenir fraude", "No: es necesario para la compra"],
            ["Paqueterías (a través de Envíos HETNA / Skydropx)", "Generar la guía y entregar tu pedido", "No: es necesario para la entrega"],
            ["Autoridades competentes", "Cumplir la ley o una orden de autoridad", "No"],
            ["Plataformas de publicidad y estadística (Meta, Google)", "Medir visitas y mostrar anuncios de HETNA", "Sí: solo si aceptas esas cookies"],
          ],
        },
      },
      {
        p: "También usamos proveedores que tratan datos solo por cuenta de HETNA y bajo nuestras instrucciones (encargados): alojamiento del sitio y servidores (Hostinger), seguridad y entrega del sitio (Cloudflare), respaldos cifrados (Backblaze), envío de correos (Resend), base de datos del cotizador y del foro (Supabase), chat entre clientes y talleres (TalkJS) y automatización de mensajes de WhatsApp (servicio de WhatsApp de Meta, operado con herramientas instaladas en nuestro propio servidor). Estos proveedores no pueden usar tus datos para fines propios.",
      },
      {
        p: "El taller o vendedor que recibe tus datos para atender tu pedido o cotización es responsable de su propio uso de esos datos y debe cumplir la ley aplicable; solo recibe lo necesario para atenderte.",
      },
      {
        p: "Los datos de verificación del taller (identificación y fotos) no se comparten con nadie: ni con clientes ni con otros talleres.",
      },
      {
        p: "Si HETNA se fusiona, se vende o cambia de dueño, tus datos pasarían al nuevo responsable, que deberá respetar este aviso. Si no manifiestas tu negativa por los medios de la sección 9, entenderemos que aceptas esta transferencia.",
      },
    ],
  },
  {
    id: "internacional",
    titulo: "6. Transferencias internacionales",
    bloques: [
      {
        p: "Algunos de nuestros proveedores guardan o procesan datos fuera de tu país, principalmente en Estados Unidos (por ejemplo, PayPal, Google, Meta, Cloudflare, Backblaze). HETNA opera desde México; nuestros servidores y proveedores pueden estar en México, Estados Unidos u otros países, así que tus datos pueden tratarse fuera de tu país. Elegimos proveedores con compromisos públicos de seguridad y confidencialidad y solo compartimos lo necesario para cada finalidad.",
      },
    ],
  },
  {
    id: "conservacion",
    titulo: "7. Cuánto tiempo guardamos tus datos",
    bloques: [
      {
        tabla: {
          cab: ["Datos", "Tiempo"],
          filas: [
            ["Cuenta de cliente o de taller", "Mientras la cuenta esté activa. Si la cancelas, la borramos o la volvemos anónima en un plazo razonable, que procuramos no exceda de 30 días, salvo lo que la ley nos obligue a conservar"],
            ["Pedidos, pagos y facturas", "El tiempo que exijan las leyes fiscales y mercantiles de México: al menos 5 años y hasta 10 años"],
            ["Documentos de verificación del taller", "Mientras el taller tenga cuenta activa. Se borran automáticamente: a los 6 meses sin cambios si la verificación se rechazó o nunca se envió, y a los 90 días si el taller se da de baja. El taller puede pedir que se borren antes"],
            ["Mensajes de soporte y WhatsApp", "El tiempo necesario para atenderte y dar seguimiento, normalmente no más de 2 años"],
            ["Foro, reseñas y contenido publicado", "Mientras esté publicado; puedes borrarlo o pedirnos que lo borremos"],
            ["Datos de estadística (Google Analytics)", "Hasta 14 meses en Google Analytics; la cookie puede durar hasta 2 años en tu navegador y puedes borrarla cuando quieras"],
            ["Respaldos cifrados del sistema", "Hasta 12 meses; después se eliminan automáticamente"],
          ],
        },
      },
    ],
  },
  {
    id: "seguridad",
    titulo: "8. Cómo protegemos tus datos",
    bloques: [
      {
        ul: [
          "Todo el sitio funciona con conexión cifrada (HTTPS).",
          "Las contraseñas se guardan cifradas; nadie en HETNA puede verlas.",
          "La base de datos y los servicios internos no son accesibles desde internet; el servidor tiene firewall.",
          "Los documentos de verificación se guardan en una carpeta privada sin dirección pública; solo pueden descargarlos, con sesión iniciada, el propio taller y administradores de HETNA.",
          "Los respaldos se cifran antes de salir del servidor.",
          "Solo las personas que lo necesitan para su trabajo tienen acceso a los datos, con obligación de confidencialidad.",
        ],
      },
      {
        p: "Si ocurre una vulneración de seguridad que afecte de forma importante tus derechos, te avisaremos de inmediato para que puedas protegerte, y avisaremos a la autoridad cuando la ley de tu país lo exija.",
      },
    ],
  },
  {
    id: "derechos",
    titulo: "9. Tus derechos y cómo ejercerlos",
    bloques: [
      {
        p: "Puedes ejercer en cualquier momento estos derechos, de forma gratuita:",
      },
      {
        ul: [
          "Acceso: saber qué datos tuyos tenemos y cómo los usamos.",
          "Rectificación: corregir datos inexactos o incompletos.",
          "Cancelación o eliminación: pedir que borremos tus datos.",
          "Oposición: pedir que dejemos de usarlos para alguna finalidad.",
          "Revocar tu consentimiento o limitar el uso y divulgación de tus datos.",
          "Portabilidad: recibir tus datos en un formato electrónico de uso común.",
          "No ser discriminado por ejercer tus derechos.",
        ],
      },
      {
        p: `Cómo pedirlo: escríbenos por ${contactoEs(d)} con: (1) tu nombre y un medio para responderte; (2) una identificación tuya o, si actúas por alguien más, la de tu representante y el documento que lo acredite; (3) qué datos y qué derecho quieres ejercer; (4) cualquier dato que nos ayude a localizarlos. Si pides una corrección, indica el cambio y adjunta el documento que lo respalde.`,
      },
      {
        p: "Plazos: te respondemos en un máximo de 20 días hábiles y, si procede, lo aplicamos en un máximo de 15 días hábiles después de responderte; cada plazo puede ampliarse una sola vez por un periodo igual si hay causa justificada, y te avisaremos. Si la ley de tu país marca un plazo menor, respetamos ese plazo (por ejemplo, en Colombia: 10 días hábiles para consultas y 15 para reclamos; en Brasil: 15 días). En Estados Unidos, las leyes estatales permiten hasta 45 días; nosotros usamos los plazos más cortos de este párrafo.",
      },
      {
        p: "Si no estás de acuerdo con nuestra respuesta, puedes pedirnos que la revisemos (apelación) por el mismo medio, y también acudir a la autoridad de tu país: en México, la Secretaría Anticorrupción y Buen Gobierno; en Brasil, la ANPD; en Colombia, la Superintendencia de Industria y Comercio; en Argentina, la Agencia de Acceso a la Información Pública; en Perú, la Autoridad Nacional de Protección de Datos Personales; en Chile, la Agencia de Protección de Datos Personales; en Ecuador, la Superintendencia de Protección de Datos Personales; en Estados Unidos, la oficina del Fiscal General (Attorney General) de tu estado.",
      },
    ],
  },
  {
    id: "limitar",
    titulo: "10. Cómo limitar el uso de tus datos",
    bloques: [
      {
        ul: [
          "Correos de promociones: usa el enlace para darte de baja que viene en cada correo.",
          "WhatsApp: responde \"BAJA\" o escríbenos para no recibir más mensajes promocionales.",
          "Cookies: elige \"Solo necesarias\" en el aviso de cookies o en el botón de abajo.",
          "En México también puedes inscribirte en el Registro Público para Evitar Publicidad (REPEP) de PROFECO.",
        ],
      },
    ],
  },
  {
    id: "cookies",
    titulo: "11. Cookies y tecnologías similares",
    bloques: [
      {
        tabla: {
          cab: ["Tipo", "Para qué", "¿Se puede rechazar?"],
          filas: [
            ["Necesarias", "Mantener tu sesión, tu carrito, tu idioma y tu decisión sobre cookies; seguridad del sitio", "No: sin ellas el sitio no funciona"],
            ["Estadística (Google Analytics)", "Saber qué páginas se visitan y cómo mejorar el sitio", "Sí"],
            ["Publicidad (Meta Pixel)", "Medir campañas y mostrar anuncios de HETNA en Facebook e Instagram", "Sí"],
          ],
        },
      },
      {
        p: "Las cookies de estadística y publicidad solo se activan si las aceptas. Si las aceptas, Google y Meta pueden recabar información sobre tu actividad en línea a lo largo del tiempo y en otros sitios. Si tu navegador envía la señal Global Privacy Control (GPC) o Do Not Track, la tomamos como rechazo y no las activamos.",
      },
      { preferenciasCookies: true },
    ],
  },
  {
    id: "menores",
    titulo: "12. Menores de edad",
    bloques: [
      {
        p: "HETNA CNC está dirigido a mayores de 18 años. No recabamos a sabiendas datos de menores. Si eres madre, padre o tutor y crees que un menor nos dio sus datos, escríbenos y los borraremos.",
      },
    ],
  },
  {
    id: "regiones",
    titulo: "13. Información adicional según tu país",
    bloques: [
      {
        p: "Estados Unidos: no vendemos tu información personal ni la compartimos para publicidad dirigida sin tu consentimiento. Si vives en un estado con ley de privacidad (por ejemplo California, Virginia, Colorado, Texas), tienes derecho a acceder, corregir y borrar tus datos, a excluirte de publicidad dirigida y a apelar nuestra decisión; ejerce estos derechos como se indica en la sección 9. No recabamos datos sensibles sin tu consentimiento.",
      },
      {
        p: "Brasil (LGPD): las bases legales están en la sección 4. Puedes pedir confirmación del tratamiento, acceso, corrección, anonimización, portabilidad, información sobre con quién compartimos tus datos y revisión de decisiones automatizadas, y que te informemos qué pasa si no das tu consentimiento. El contacto del encarregado está en la sección 1.",
      },
      {
        p: "Colombia (Ley 1581 de 2012): este aviso funciona también como nuestra política de tratamiento de la información. Las consultas se atienden en un máximo de 10 días hábiles y los reclamos en un máximo de 15 días hábiles. Las solicitudes las atiende el Área de Datos Personales (sección 1). La política está vigente desde la fecha indicada al inicio de este aviso, y las bases de datos se conservan mientras dure su finalidad y por los plazos de la sección 7.",
      },
      {
        p: "Chile (Ley 21.719, vigente desde el 1 de diciembre de 2026): tienes derecho de acceso, rectificación, supresión, oposición, portabilidad y bloqueo, y a no ser objeto de decisiones basadas solo en tratamiento automatizado.",
      },
      {
        p: "Argentina, Perú, Ecuador y otros países: te reconocemos los derechos que da la ley de protección de datos de tu país, y puedes ejercerlos como se indica en la sección 9.",
      },
    ],
  },
  {
    id: "cambios",
    titulo: "14. Cambios a este aviso",
    bloques: [
      {
        p: "Si cambiamos este aviso, publicaremos la nueva versión en esta página con su fecha de vigencia. Si el cambio es importante (por ejemplo, una finalidad nueva que requiera tu consentimiento), además te avisaremos por correo o con un mensaje en el sitio antes de aplicarlo.",
      },
    ],
  },
]

// ---------------------------------------------------------------- ENGLISH

export const avisoEn = (d: Datos): Seccion[] => [
  {
    id: "resumen",
    titulo: "One-minute summary",
    bloques: [
      {
        ul: [
          "We use your data so you can buy, sell, request quotes and receive your orders on HETNA CNC.",
          "We do not sell your personal information.",
          "Your card details are processed by PayPal or Mercado Pago; HETNA never receives or stores them.",
          "The ID and photos a shop uploads to get verified are private: they are never published and only the HETNA team reviews them.",
          "Analytics and advertising cookies are only turned on if you accept them. You can change your choice at any time.",
          `You can ask to see, correct or delete your data, or object to its use, by contacting us via ${contactoEn(d)}. It is free.`,
        ],
      },
    ],
  },
  {
    id: "responsable",
    titulo: "1. Who is responsible for your data",
    bloques: [
      {
        p: `${d.responsable}, located at ${d.domicilio}${d.rfc ? `, tax ID (RFC) ${d.rfc}` : ""}, is the controller of your personal data on hetnacnc.com.`,
      },
      {
        p: `For any personal-data matter (questions, rights requests, complaints) contact HETNA CNC's Personal Data team via ${contactoEn(d)}. This team acts as our data protection officer.`,
      },
      {
        p: "This notice applies to all of hetnacnc.com and its services: store and marketplace, shop and seller dashboard, quoting tool, CAM lab, forum, shipping and WhatsApp support. It applies to you whether you are a customer, visitor, shop or seller.",
      },
    ],
  },
  {
    id: "datos",
    titulo: "2. What personal data we collect",
    bloques: [
      {
        tabla: {
          cab: ["Type of data", "Examples", "Where it comes from"],
          filas: [
            ["Identity and contact", "Name, email, phone, city and country", "You, when you sign up, buy, request a quote or contact us"],
            ["Account", "Username, password (stored hashed), preferences and language", "You"],
            ["Shipping and invoicing", "Shipping address, postal code, tax details if you request an invoice", "You"],
            ["Purchases and payments", "Products, amounts, payment status and transaction ID", "You and PayPal or Mercado Pago (we never receive your card details)"],
            ["Quotes and jobs", "Job description, dimensions, materials and files you share (DXF, SVG, STL, STEP, photos)", "You"],
            ["Shops and sellers", "Business name, services, machines, shop location, products and prices", "The shop"],
            ["Shop financial data", "Bank account details to receive payouts", "The shop"],
            ["Shop verification", "Government ID (front and back), photos of the shop's storefront and interior, proof of address (optional)", "The shop, voluntarily"],
            ["Content you post", "Forum posts, reviews, questions, photos of work", "You"],
            ["Communications", "Messages via WhatsApp, email or chat with shops and with HETNA", "You"],
            ["Technical data", "IP address, browser and device type, pages visited, cookies", "Your browser, automatically"],
          ],
        },
      },
      {
        p: "Sensitive data: we do not ask for sensitive data (ethnic origin, health, religion, political opinions, sexual orientation, genetic data). The government ID a shop uploads includes a photo: we do not run facial recognition or any biometric processing on it; a person only reviews it to confirm the shop is real. Even so, we give it the highest protection: it travels encrypted (HTTPS), is stored in a private folder with no public URL, can only be downloaded by the shop itself or a HETNA administrator while signed in, and is processed only with your express consent.",
      },
      {
        p: "Financial data: a shop's bank details are used only to pay it for what it sells. We collect them with its express consent: the form where it enters them includes the written authorization, and the date it was given is recorded when they are saved.",
      },
    ],
  },
  {
    id: "finalidades",
    titulo: "3. How we use your data",
    bloques: [
      { p: "Necessary purposes (we cannot provide the service without them):" },
      {
        ul: [
          "Create and manage your customer, shop or seller account.",
          "Process purchases, payments, shipping, returns, warranties and invoicing.",
          "Deliver your quote requests to shops and manage their proposals.",
          "Pay shops and sellers for what they sell, minus the agreed fees.",
          "Verify the identity and existence of shops that ask to be verified, and show the verified-shop badge.",
          "Provide support and handle questions or complaints.",
          "Prevent fraud and abuse and keep the site and its users safe.",
          "Comply with legal and tax obligations and requests from authorities.",
        ],
      },
      { p: "Additional purposes (you can say no and keep using the site the same way):" },
      {
        ul: [
          "Send you promotions, news and HETNA CNC content by email or WhatsApp.",
          "Measure site usage to improve it (Google Analytics), only if you accept analytics cookies.",
          "Show you HETNA ads on other platforms (Meta Pixel), only if you accept advertising cookies.",
          "Invite you to satisfaction surveys.",
        ],
      },
      {
        p: `To opt out of additional purposes: reject non-essential cookies (button at the end of this notice), use the unsubscribe link in any email, or contact us via ${contactoEn(d)}. Opting out does not affect your purchases or your account.`,
      },
      {
        p: "We do not make decisions that significantly affect you based solely on automated processing. The calculators and the CAM lab only suggest information; you make the decisions.",
      },
    ],
  },
  {
    id: "bases",
    titulo: "4. Legal basis for processing",
    bloques: [
      { p: "We process your data on one of these bases, depending on the case and the law of your country:" },
      {
        tabla: {
          cab: ["Basis", "Examples"],
          filas: [
            ["Performing our contract with you", "Your account, purchases, shipping, quotes, payouts to shops"],
            ["Your consent", "Promotions, analytics and advertising cookies, ID verification, shop bank details"],
            ["Legal obligation", "Invoicing, keeping tax records, requests from authorities"],
            ["Legitimate interest", "Site security, fraud prevention, basic service improvements"],
          ],
        },
      },
      {
        p: "In Mexico, by using the site after this notice is made available to you, you consent to processing for the necessary purposes (tacit consent). For financial data and for the verification ID we ask for your express consent.",
      },
    ],
  },
  {
    id: "compartir",
    titulo: "5. Who we share your data with",
    bloques: [
      { p: "We do not sell or rent your personal information. We only share it in these cases:" },
      {
        tabla: {
          cab: ["Recipient", "Purpose", "Requires your consent?"],
          filas: [
            ["The shop or seller handling your order or quote", "Make, prepare and ship what you bought or requested", "No: it is needed to fulfill the purchase you requested"],
            ["PayPal and Mercado Pago", "Process your payments and prevent fraud", "No: it is needed for the purchase"],
            ["Carriers (through HETNA Shipping / Skydropx)", "Create the shipping label and deliver your order", "No: it is needed for delivery"],
            ["Competent authorities", "Comply with the law or a lawful order", "No"],
            ["Advertising and analytics platforms (Meta, Google)", "Measure visits and show HETNA ads", "Yes: only if you accept those cookies"],
          ],
        },
      },
      {
        p: "We also use service providers that process data only on HETNA's behalf and under our instructions: site hosting and servers (Hostinger), site security and delivery (Cloudflare), encrypted backups (Backblaze), email delivery (Resend), database for the quoting tool and forum (Supabase), customer–shop chat (TalkJS) and WhatsApp message automation (Meta's WhatsApp service, run with tools installed on our own server). These providers may not use your data for their own purposes.",
      },
      {
        p: "The shop or seller that receives your data to handle your order or quote is responsible for its own use of that data and must comply with applicable law; it only receives what it needs to serve you.",
      },
      {
        p: "Shop verification data (ID and photos) is not shared with anyone: not with customers and not with other shops.",
      },
      {
        p: "If HETNA merges, is sold or changes ownership, your data would pass to the new controller, who must respect this notice. If you do not object through the channels in section 9, we will understand that you accept this transfer.",
      },
    ],
  },
  {
    id: "internacional",
    titulo: "6. International transfers",
    bloques: [
      {
        p: "Some of our providers store or process data outside your country, mainly in the United States (for example PayPal, Google, Meta, Cloudflare, Backblaze). HETNA operates from Mexico; our servers and providers may be in Mexico, the United States or other countries, so your data may be processed outside your country. We choose providers with public security and confidentiality commitments and only share what each purpose needs.",
      },
    ],
  },
  {
    id: "conservacion",
    titulo: "7. How long we keep your data",
    bloques: [
      {
        tabla: {
          cab: ["Data", "Retention"],
          filas: [
            ["Customer or shop account", "While the account is active. If you close it, we delete or anonymize it within a reasonable time, which we aim to keep under 30 days, except what the law requires us to keep"],
            ["Orders, payments and invoices", "As long as Mexican tax and commercial laws require: at least 5 years and up to 10 years"],
            ["Shop verification documents", "While the shop's account is active. They are deleted automatically: after 6 months without changes if verification was rejected or never submitted, and 90 days after the shop leaves the platform. The shop can ask for earlier deletion"],
            ["Support and WhatsApp messages", "As long as needed to help you and follow up, usually no more than 2 years"],
            ["Forum, reviews and published content", "While published; you can delete it or ask us to delete it"],
            ["Analytics data (Google Analytics)", "Up to 14 months in Google Analytics; the cookie may last up to 2 years in your browser and you can delete it at any time"],
            ["Encrypted system backups", "Up to 12 months; then deleted automatically"],
          ],
        },
      },
    ],
  },
  {
    id: "seguridad",
    titulo: "8. How we protect your data",
    bloques: [
      {
        ul: [
          "The whole site runs over an encrypted connection (HTTPS).",
          "Passwords are stored hashed; nobody at HETNA can see them.",
          "The database and internal services cannot be reached from the internet; the server has a firewall.",
          "Verification documents are stored in a private folder with no public URL; only the shop itself and HETNA administrators can download them, while signed in.",
          "Backups are encrypted before they leave the server.",
          "Only people who need it for their work can access data, under a duty of confidentiality.",
        ],
      },
      {
        p: "If a security breach significantly affects your rights, we will notify you immediately so you can protect yourself, and we will notify the authority where the law of your country requires it.",
      },
    ],
  },
  {
    id: "derechos",
    titulo: "9. Your rights and how to exercise them",
    bloques: [
      { p: "You can exercise these rights at any time, free of charge:" },
      {
        ul: [
          "Access: know what data we hold about you and how we use it.",
          "Correction: fix inaccurate or incomplete data.",
          "Deletion: ask us to delete your data.",
          "Objection: ask us to stop using it for a given purpose.",
          "Withdraw your consent or limit the use and disclosure of your data.",
          "Portability: receive your data in a commonly used electronic format.",
          "Non-discrimination for exercising your rights.",
        ],
      },
      {
        p: `How to ask: contact us via ${contactoEn(d)} with: (1) your name and a way to reply to you; (2) a form of ID or, if you act for someone else, your representative's ID and proof of authority; (3) which data and which right you want to exercise; (4) anything that helps us find the data. For corrections, state the change and attach supporting documents.`,
      },
      {
        p: "Timing: we reply within 20 business days at most and, if your request is granted, we apply it within 15 business days after replying; each period may be extended once by an equal period for good cause, and we will tell you. If the law of your country sets a shorter period, we follow it (for example, in Colombia: 10 business days for inquiries and 15 for claims; in Brazil: 15 days). U.S. state laws allow up to 45 days; we use the shorter periods in this paragraph.",
      },
      {
        p: "If you disagree with our response, you can ask us to review it (appeal) through the same channel, and you can also contact the authority in your country: in the United States, your state Attorney General; in Mexico, the Secretaría Anticorrupción y Buen Gobierno; in Brazil, the ANPD; in Colombia, the Superintendencia de Industria y Comercio; in Argentina, the Agencia de Acceso a la Información Pública; in Peru, the Autoridad Nacional de Protección de Datos Personales; in Chile, the Agencia de Protección de Datos Personales; in Ecuador, the Superintendencia de Protección de Datos Personales.",
      },
    ],
  },
  {
    id: "limitar",
    titulo: "10. How to limit the use of your data",
    bloques: [
      {
        ul: [
          "Promotional email: use the unsubscribe link included in every email.",
          "WhatsApp: reply \"STOP\" or contact us to stop receiving promotional messages.",
          "Cookies: choose \"Only necessary\" in the cookie notice or with the button below.",
          "In Mexico you can also sign up for PROFECO's Public Registry to Avoid Advertising (REPEP).",
        ],
      },
    ],
  },
  {
    id: "cookies",
    titulo: "11. Cookies and similar technologies",
    bloques: [
      {
        tabla: {
          cab: ["Type", "Purpose", "Can you reject it?"],
          filas: [
            ["Necessary", "Keep you signed in, your cart, your language and your cookie choice; site security", "No: the site does not work without them"],
            ["Analytics (Google Analytics)", "Understand which pages are visited and how to improve the site", "Yes"],
            ["Advertising (Meta Pixel)", "Measure campaigns and show HETNA ads on Facebook and Instagram", "Yes"],
          ],
        },
      },
      {
        p: "Do Not Track and Global Privacy Control: analytics and advertising cookies are only turned on if you accept them. If you accept them, Google and Meta may collect information about your online activity over time and across other websites. If your browser sends a Global Privacy Control (GPC) or Do Not Track signal, we treat it as a rejection and do not turn them on.",
      },
      { preferenciasCookies: true },
    ],
  },
  {
    id: "menores",
    titulo: "12. Children",
    bloques: [
      {
        p: "HETNA CNC is intended for people 18 and older. We do not knowingly collect data from children, including children under 13. If you are a parent or guardian and believe a minor gave us their data, contact us and we will delete it.",
      },
    ],
  },
  {
    id: "regiones",
    titulo: "13. Additional information for your country",
    bloques: [
      {
        p: "United States: we do not sell your personal information or share it for targeted advertising without your consent. If you live in a state with a privacy law (for example California, Virginia, Colorado, Texas), you have the right to access, correct and delete your data, to opt out of targeted advertising and to appeal our decision; exercise these rights as described in section 9. We do not process sensitive data without your consent. California residents: the categories of personal information we collect are in section 2; who we share it with, in section 5; how to review or change it, in section 9; how we respond to Do Not Track and whether third parties track you, in section 11; and how we notify you of changes, in section 14.",
      },
      {
        p: "Brazil (LGPD): the legal bases are in section 4. You can request confirmation of processing, access, correction, anonymization, portability, information about who we share your data with, review of automated decisions, and information about the consequences of not giving consent. Our data protection officer contact is in section 1.",
      },
      {
        p: "Colombia (Law 1581 of 2012): this notice also serves as our data processing policy. Inquiries are answered within 10 business days and claims within 15 business days. Requests are handled by our Personal Data team (section 1). The policy is in force from the date shown at the top of this notice, and databases are kept while their purpose lasts and for the periods in section 7.",
      },
      {
        p: "Chile (Law 21.719, in force from December 1, 2026): you have the rights of access, rectification, erasure, objection, portability and blocking, and not to be subject to decisions based solely on automated processing.",
      },
      {
        p: "Argentina, Peru, Ecuador and other countries: we honor the rights granted by your country's data protection law, which you can exercise as described in section 9.",
      },
      {
        nota: "This English version is provided for convenience. For users in Mexico, the Spanish version prevails.",
      },
    ],
  },
  {
    id: "cambios",
    titulo: "14. Changes to this notice",
    bloques: [
      {
        p: "If we change this notice, we will post the new version on this page with its effective date. If the change is significant (for example, a new purpose that requires your consent), we will also let you know by email or with a notice on the site before it applies.",
      },
    ],
  },
]

// Historial de versiones (lo más nuevo arriba)
export const HISTORIAL = [
  {
    version: "2.2",
    fecha: "2026-11-01",
    cambio: "Se retira el Copiloto IA (y su proveedor Anthropic): ya no se recaban preguntas ni archivos para un asistente de IA.",
    cambioEn: "AI Copilot (and its provider Anthropic) removed: questions and files are no longer collected for an AI assistant.",
  },
  {
    version: "2.1",
    fecha: "2026-10-28",
    cambio: "Datos del responsable (persona física), correo y teléfono de contacto; borrado automático de documentos de verificación; consentimiento para datos bancarios de talleres; baja de correos promocionales.",
    cambioEn: "Controller details (individual), contact email and phone; automatic deletion of verification documents; consent for shop bank details; unsubscribe from promotional email.",
  },
  {
    version: "2.0",
    fecha: "2026-10-28",
    cambio: "Aviso reescrito para la nueva LFPDPPP (2025), EE. UU. y Sudamérica; verificación de talleres; cookies con consentimiento; versión en inglés.",
    cambioEn: "Notice rewritten for Mexico's new LFPDPPP (2025), the U.S. and South America; shop verification; consent-based cookies; English version.",
  },
  { version: "1.0", fecha: "2026-10-07", cambio: "Versión inicial.", cambioEn: "Initial version." },
]
