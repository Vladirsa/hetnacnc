// Inglés de la página /herramientas-cnc y del menú "Herramientas CNC"
// (textos de src/lib/hetna/herramientas.ts). Se suma al diccionario de en.ts.
export const EN_HERRAMIENTAS: Record<string, string> = {
  // Página
  "Herramientas CNC gratis en línea": "Free online CNC tools",
  "Diseña, programa y cotiza sin instalar nada: convierte tu DXF a G-code, programa piezas en 3, 4 y 5 ejes, genera cajas, letreros y despieces de muebles, escanea una pieza o pregúntale al Copiloto IA. Casi todas son gratis y sin cuenta.":
    "Design, program and quote without installing anything: convert your DXF to G-code, program 3, 4 and 5 axis parts, generate boxes, signs and furniture cut lists, scan a part or ask the AI Copilot. Almost all are free, no account needed.",
  "Todas las herramientas": "All tools",
  "¿Prefieres que te hagamos el diseño?": "Would you rather we design it for you?",
  "De tu idea, foto o boceto a un archivo listo para tu máquina, hecho a la medida.":
    "From your idea, photo or sketch to a file ready for your machine, custom made.",
  "¿No tienes máquina?": "No machine?",
  "Corte, grabado, maquinado en 3, 4 y 5 ejes, torno e impresión 3D con talleres CNC de todo México. Subes tu archivo y recibes cotizaciones.":
    "Cutting, engraving, 3, 4 and 5 axis machining, turning and 3D printing with CNC shops across Mexico. Upload your file and get quotes.",
  "Te fabricamos tu pieza": "We make your part",
  "Preguntas frecuentes": "Frequently asked questions",
  "¿Las herramientas son gratis?": "Are the tools free?",
  "Sí. Los generadores, el DXF a G-code, el laboratorio CAM, el torno y las calculadoras se usan gratis y sin cuenta. Solo el escaneo 3D que mide de verdad se paga con créditos, y el cotizador profesional para talleres tiene planes.":
    "Yes. The generators, DXF to G-code, the CAM lab, the lathe and the calculators are free and need no account. Only the measuring 3D scan is paid with credits, and the professional quoting tool for shops has plans.",
  "¿Tengo que instalar algún programa?": "Do I need to install any software?",
  "No. Todo funciona en el navegador, en la computadora o en el celular. Descargas el archivo (DXF, SVG, PDF, STL o G-code) y lo llevas a tu máquina.":
    "No. Everything runs in the browser, on a computer or a phone. Download the file (DXF, SVG, PDF, STL or G-code) and take it to your machine.",
  "¿El G-code funciona con mi máquina?": "Will the G-code work with my machine?",
  "El laboratorio CAM genera programas para Mach3, LinuxCNC, GRBL, Fanuc y otros controladores, y el torno para Mach3 y Mach4. Antes de cortar, revisa la simulación y haz una prueba en vacío.":
    "The CAM lab generates programs for Mach3, LinuxCNC, GRBL, Fanuc and other controllers, and the lathe for Mach3 and Mach4. Before cutting, check the simulation and do a dry run.",
  "¿Y si no sé diseñar o no tengo máquina?": "What if I can't design or don't have a machine?",
  "Te hacemos el diseño a la medida o te fabricamos la pieza con talleres CNC de todo México. Abajo están las dos opciones.":
    "We can make a custom design for you or make the part with CNC shops across Mexico. Both options are below.",

  // Grupos
  "Diseñar": "Design",
  "No tengo archivo todavía": "I don't have a file yet",
  "Generadores y plantillas: pones las medidas y sale el archivo listo para cortar o grabar.":
    "Generators and templates: enter the dimensions and get a file ready to cut or engrave.",
  "Ya tengo el dibujo o el modelo": "I already have the drawing or model",
  "Del archivo al G-code: trayectorias, avances y revoluciones calculados para tu máquina.":
    "From file to G-code: toolpaths, feeds and speeds calculated for your machine.",
  "Escanear": "Scan",
  "Tengo la pieza, no el dibujo": "I have the part, not the drawing",
  "Fotos de una pieza que ya existe y te devolvemos su modelo 3D.": "Photos of an existing part and we return its 3D model.",
  "Cotizar y calcular": "Quote and calculate",
  "Quiero saber cuánto cuesta": "I want to know the price",
  "Precios al momento para tu pieza, y el cotizador profesional para tu taller.":
    "Instant prices for your part, and the professional quoting tool for your shop.",
  "Aprender y preguntar": "Learn and ask",
  "Tengo una duda": "I have a question",
  "Una IA experta en CNC, guías paso a paso y una comunidad de gente que corta todos los días.":
    "A CNC expert AI, step-by-step guides and a community of people who cut every day.",

  // Herramientas
  "Caja con juntas de dedo": "Finger joint box",
  "Medidas y espesor, y descargas la caja en DXF, SVG o PDF.": "Enter size and thickness and download the box as DXF, SVG or PDF.",
  "Letreros y nombres": "Signs and names",
  "Escribe el texto, elige la letra y descarga el DXF con las letras unidas.": "Type the text, pick a font and download the DXF with joined letters.",
  "Vectorizador de imágenes": "Image vectorizer",
  "Un logotipo o dibujo convertido en contornos DXF o SVG.": "A logo or drawing turned into DXF or SVG outlines.",
  "Despiece de muebles": "Furniture cut lists",
  "Gabinetes, closets y cocinas: piezas, acomodo en hojas, canto y herraje.": "Cabinets, closets and kitchens: parts, sheet nesting, edging and hardware.",
  "Plantillas de empaque": "Packaging templates",
  "Cajas, pirámides, conos, sobres y bolsas a tu medida.": "Boxes, pyramids, cones, envelopes and bags to your size.",
  "Foto para grabado láser": "Photo for laser engraving",
  "Tu foto tramada al tamaño y la resolución de tu láser.": "Your photo dithered to your laser's size and resolution.",
  "Litofanías y relieves 3D": "Lithophanes and 3D reliefs",
  "Tu foto convertida en STL: litofanía o relieve para tallar.": "Your photo turned into an STL: lithophane or relief for carving.",
  "Patrones radiales": "Radial patterns",
  "Mandalas y arte de pared en capas, listos para cortar.": "Layered mandalas and wall art, ready to cut.",
  "Convertidor y reescalador": "Converter and rescaler",
  "DXF a SVG y al revés, STL a OBJ, cambio de tamaño y de espesor.": "DXF to SVG and back, STL to OBJ, resize and change thickness.",
  "DXF a G-code": "DXF to G-code",
  "Sube un DXF, elige material y fresa, y descarga el G-code con las pasadas calculadas.":
    "Upload a DXF, choose material and bit, and download G-code with the passes calculated.",
  "CAM en 3, 4 y 5 ejes": "3, 4 and 5 axis CAM",
  "STL, OBJ o STEP: trayectoria con anticolisión, remoción de material y programa para tu controlador.":
    "STL, OBJ or STEP: collision-checked toolpaths, material removal and a program for your controller.",
  "Torno con eje rotativo": "Rotary axis lathe",
  "Balaustres, patas y columnas por tramos, con G-code para Mach3 o Mach4.": "Balusters, legs and columns by sections, with G-code for Mach3 or Mach4.",
  "Escaneo 3D de piezas": "3D part scanning",
  "Vista previa gratis; el escaneo que mide de verdad se paga con créditos.": "Free preview; the measuring scan is paid with credits.",
  "Calculadoras de precio": "Price calculators",
  "Router CNC, corte láser, plasma e impresión 3D: el precio de tu pieza al momento.":
    "CNC router, laser, plasma and 3D printing: your part's price instantly.",
  "Cotizador para talleres": "Quoting tool for shops",
  "Cotizaciones profesionales con costos de máquina, material y utilidad.": "Professional quotes with machine, material and profit costs.",
  "Calculadoras CNC": "CNC calculators",
  "Velocidad de corte, avance por diente, revoluciones y más.": "Cutting speed, chip load, RPM and more.",
  "Parámetros de corte, errores, G-code y costos: pregunta como a un experto.": "Cutting parameters, errors, G-code and costs: ask like you would an expert.",
  "Guías para diseñar, programar y operar tu máquina.": "Guides to design, program and run your machine.",
  "Pregunta y comparte con otros talleres y operadores.": "Ask and share with other shops and operators.",
  "Gratis, sin cuenta": "Free, no account",
  "Gratis (más con tu cuenta)": "Free (more with an account)",
  "Con créditos": "With credits",
  "Plan para talleres": "Shop plan",
  "Diseño desde cero": "Design from scratch",
  "Modificación de archivos": "File changes",
  "Vectorización": "Vectorizing",
  "Conversión de formatos": "Format conversion",
  "Preparación para CAM": "CAM preparation",
  // Espacio "Diseñar y escanear" (/disenar)
  "Diseñar y escanear": "Design and scan",
  "Generadores y plantillas, o fotos de una pieza que ya existe: sale el archivo listo para cortar, grabar o imprimir. Todo en un solo espacio de trabajo.":
    "Generators and templates, or photos of an existing part: you get a file ready to cut, engrave or print. All in one workspace.",
  "Abrir el espacio de trabajo": "Open the workspace",
  "Todas las herramientas CNC": "All CNC tools",
  "Todas": "All",
  "Generar un archivo": "Make a file",
  "De una pieza que ya existe": "From an existing part",
  "¿Ya tienes el archivo?": "Already have the file?",
  "Pásalo a G-code con el avance y las revoluciones calculados.": "Turn it into G-code with feeds and speeds calculated.",
  "Talleres CNC de todo México te cotizan la pieza.": "CNC shops across Mexico quote your part.",
  "Elige una herramienta y trabaja aquí mismo: pones las medidas o subes tu imagen y descargas el archivo listo para láser, router CNC o impresora 3D. Si la pieza ya existe, la escaneas con fotos. Cambias de herramienta desde el menú sin salir de esta página.":
    "Pick a tool and work right here: enter the dimensions or upload your image and download a file ready for a laser, CNC router or 3D printer. If the part already exists, scan it with photos. Switch tools from the menu without leaving this page.",
  "Pásalo a G-code con las pasadas, el avance y las revoluciones calculados, o mándalo a fabricar con talleres CNC de todo México.":
    "Turn it into G-code with passes, feeds and speeds calculated, or send it to be made by CNC shops across Mexico.",
  "Vista previa gratis · escaneo con créditos": "Free preview · scan with credits",
  "Sube fotos de una pieza que ya existe y recibe su archivo 3D. El resultado queda guardado en tu perfil: no se manda por correo ni por un link que caduca.":
    "Upload photos of an existing part and get its 3D file. The result is saved in your profile: it isn't emailed or sent as a link that expires.",
  "¿Ya escaneaste antes?": "Scanned before?",
  "Ver mis escaneos": "See my scans",
  "Toma las fotos": "Take the photos",
  "Alrededor de la pieza, con buena luz y sin moverla. Para la vista previa basta una.":
    "All around the part, in good light and without moving it. One is enough for the preview.",
  "Súbelas aquí": "Upload them here",
  "Elige vista previa (gratis) o escaneo con medidas reales (con créditos).": "Choose a preview (free) or a scan with real dimensions (with credits).",
  "Baja tu modelo 3D": "Download your 3D model",
  "Queda guardado en tu perfil: lo descargas las veces que quieras.": "It's saved in your profile: download it as many times as you like.",
  "Entra para escanear": "Sign in to scan",
  "El escaneo se guarda en tu cuenta, por eso necesitas entrar. Si no tienes cuenta, la creas en un minuto.":
    "The scan is saved to your account, so you need to sign in. If you don't have an account, it takes a minute to create one.",
  // Planes del Cotizador (app-taller.ts y CotizadorLanding)
  "5 cotizaciones al mes": "5 quotes per month",
  "PDF con marca de agua HETNA CNC": "PDF with HETNA CNC watermark",
  "Cotización profesional en PDF con tu logo, sin marca de agua": "Professional PDF quote with your logo, no watermark",
  "Sube DXF, SVG, STL u OBJ: plano con medidas en la cotización": "Upload DXF, SVG, STL or OBJ: dimensioned drawing in the quote",
  "Cotizaciones (5 al mes)": "Quotes (5 per month)",
}
