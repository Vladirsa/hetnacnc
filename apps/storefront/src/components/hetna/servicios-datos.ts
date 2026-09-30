// Contenido de los servicios de HETNA CNC.
// Para cambiar un texto de un servicio, editalo aqui.
export type Paso = { titulo: string; texto: string }
export type Servicio = {
  slug: string
  padre: string | null
  numero: string
  icono: string
  nombre: string
  resumen: string
  titulo: string
  subtitulo: string
  incluye: string[]
  pasos: Paso[]
  formatos: string[]
  proximo: string | null
  whatsapp: string
  boton: string
}

export const SERVICIOS: Servicio[] = [
  {
    "slug": "generador-2d-3d",
    "padre": null,
    "numero": "1",
    "icono": "generador",
    "nombre": "Generador 2D y 3D",
    "resumen": "Convierte tu idea, foto o boceto en un archivo listo para cortar o maquinar.",
    "titulo": "Tu idea convertida en archivo CNC",
    "subtitulo": "Envíanos una foto, un boceto o una medida y te entregamos el archivo 2D o 3D listo para tu router, láser o plasma.",
    "incluye": [
      "Vectorizado de logotipos, letreros y nombres",
      "Piezas 2D con medidas exactas para corte",
      "Relieves y modelos 3D para router",
      "Revisión del archivo para que corte sin errores"
    ],
    "pasos": [
      {
        "titulo": "Envíanos tu idea",
        "texto": "Foto, boceto, medidas o el archivo que ya tengas."
      },
      {
        "titulo": "Te mostramos la vista previa",
        "texto": "Revisas el diseño antes de pagar."
      },
      {
        "titulo": "Recibe tu archivo",
        "texto": "Te lo enviamos en el formato de tu máquina."
      },
      {
        "titulo": "¿Lo quieres cortado?",
        "texto": "También te lo maquilamos y te lo enviamos."
      }
    ],
    "formatos": [
      "DXF",
      "SVG",
      "STL",
      "STEP"
    ],
    "proximo": "Ya disponibles gratis: cajas con juntas de dedo y plantillas de empaque. Muy pronto: letreros y nombres.",
    "whatsapp": "Hola HETNA CNC, quiero un diseño 2D/3D.",
    "boton": "Pedir mi diseño"
  },
  {
    "slug": "generador-2d-3d/caja-con-juntas",
    "padre": "generador-2d-3d",
    "numero": "1.1",
    "icono": "caja",
    "nombre": "Caja con juntas de dedo (gratis)",
    "resumen": "Escribe medidas y espesor, y descarga tu caja en DXF, SVG o PDF.",
    "titulo": "Generador de caja con juntas de dedo",
    "subtitulo": "Descarga el archivo listo para láser o router CNC.",
    "incluye": [],
    "pasos": [],
    "formatos": [
      "DXF",
      "SVG",
      "PDF"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero cotizar el corte de una caja.",
    "boton": "Cotizar el corte"
  },
  {
    "slug": "generador-2d-3d/plantillas-empaque",
    "padre": "generador-2d-3d",
    "numero": "1.2",
    "icono": "empaque",
    "nombre": "Plantillas de empaque (gratis)",
    "resumen": "Cajas, pirámides, conos, sobres y bolsas a tu medida, listas para imprimir o cortar.",
    "titulo": "Generador de plantillas de empaque",
    "subtitulo": "Descarga la plantilla en DXF, SVG o PDF.",
    "incluye": [],
    "pasos": [],
    "formatos": [
      "DXF",
      "SVG",
      "PDF"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero cotizar una plantilla de empaque.",
    "boton": "Cotizar el corte"
  },
  {
    "slug": "generador-2d-3d/diseno-desde-cero",
    "padre": "generador-2d-3d",
    "numero": "1.3",
    "icono": "generador",
    "nombre": "Diseño desde cero",
    "resumen": "De tu idea, foto o boceto a un archivo CNC hecho a la medida.",
    "titulo": "Diseñamos tu pieza desde cero",
    "subtitulo": "Nos cuentas qué necesitas y lo dibujamos con medidas reales, listo para tu máquina.",
    "incluye": [
      "Piezas 2D para corte láser, plasma y router",
      "Modelos 3D y relieves para router e impresión 3D",
      "Letreros, logotipos, muebles y piezas técnicas",
      "Vista previa antes de entregar el archivo"
    ],
    "pasos": [
      {
        "titulo": "Cuéntanos tu idea",
        "texto": "Foto, boceto, medidas o una pieza de muestra."
      },
      {
        "titulo": "Te cotizamos",
        "texto": "Precio y tiempo de entrega antes de empezar."
      },
      {
        "titulo": "Revisas la vista previa",
        "texto": "Hacemos los ajustes que necesites."
      },
      {
        "titulo": "Recibe tu archivo",
        "texto": "En el formato de tu máquina, o te lo maquilamos."
      }
    ],
    "formatos": [
      "DXF",
      "SVG",
      "STL",
      "STEP"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero un diseño desde cero.",
    "boton": "Cotizar mi diseño"
  },
  {
    "slug": "generador-2d-3d/modificacion-de-archivos",
    "padre": "generador-2d-3d",
    "numero": "1.4",
    "icono": "generador",
    "nombre": "Modificación de archivos",
    "resumen": "Cambiamos medidas, textos o detalles de un archivo que ya tienes.",
    "titulo": "Modificamos tu archivo",
    "subtitulo": "Ajustamos medidas, espesores, textos y detalles para que el archivo sirva para tu proyecto.",
    "incluye": [
      "Cambio de medidas y escala",
      "Ajuste a otro espesor de material",
      "Cambio de nombres, textos y logotipos",
      "Unir, separar o agregar piezas"
    ],
    "pasos": [
      {
        "titulo": "Envíanos tu archivo",
        "texto": "DXF, SVG, STL, STEP o el formato que tengas."
      },
      {
        "titulo": "Dinos qué cambiar",
        "texto": "Medidas, material, textos o detalles."
      },
      {
        "titulo": "Te cotizamos",
        "texto": "Precio y tiempo antes de empezar."
      },
      {
        "titulo": "Recibe tu archivo",
        "texto": "Revisado y listo para cortar."
      }
    ],
    "formatos": [
      "DXF",
      "SVG",
      "STL",
      "STEP"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero modificar un archivo.",
    "boton": "Cotizar el cambio"
  },
  {
    "slug": "generador-2d-3d/vectorizacion",
    "padre": "generador-2d-3d",
    "numero": "1.5",
    "icono": "generador",
    "nombre": "Vectorización",
    "resumen": "Tu logotipo, dibujo o foto convertido en vector limpio para cortar o grabar.",
    "titulo": "Vectorizamos tu imagen",
    "subtitulo": "Convertimos imágenes en vectores limpios, con contornos cerrados, listos para láser, router o plasma.",
    "incluye": [
      "Logotipos y letreros",
      "Dibujos, siluetas y firmas",
      "Contornos cerrados y sin nodos de más",
      "Separación en capas de corte y grabado"
    ],
    "pasos": [
      {
        "titulo": "Envíanos tu imagen",
        "texto": "JPG, PNG, PDF o una foto clara."
      },
      {
        "titulo": "Te cotizamos",
        "texto": "Según el detalle de la imagen."
      },
      {
        "titulo": "Revisas la vista previa",
        "texto": "Antes de recibir el archivo final."
      },
      {
        "titulo": "Recibe tu vector",
        "texto": "En DXF, SVG o el formato de tu máquina."
      }
    ],
    "formatos": [
      "DXF",
      "SVG",
      "PDF",
      "AI"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero vectorizar una imagen.",
    "boton": "Cotizar vectorización"
  },
  {
    "slug": "generador-2d-3d/conversion-de-formatos",
    "padre": "generador-2d-3d",
    "numero": "1.6",
    "icono": "generador",
    "nombre": "Conversión de formatos",
    "resumen": "Pasamos tu archivo al formato que acepta tu máquina o tu programa.",
    "titulo": "Convertimos tu archivo",
    "subtitulo": "Cambiamos el formato de tu archivo sin perder medidas, para que abra en tu programa o tu máquina.",
    "incluye": [
      "DXF, SVG, PDF y AI entre sí",
      "STL, OBJ y STEP para 3D",
      "Revisión de unidades (mm o pulgadas)",
      "Archivo listo para Mach3, LightBurn, VCarve o Fusion"
    ],
    "pasos": [
      {
        "titulo": "Envíanos tu archivo",
        "texto": "Y dinos a qué formato lo necesitas."
      },
      {
        "titulo": "Te cotizamos",
        "texto": "Precio y tiempo antes de empezar."
      },
      {
        "titulo": "Revisamos medidas",
        "texto": "Comprobamos que no cambie la escala."
      },
      {
        "titulo": "Recibe tu archivo",
        "texto": "En el formato que pediste."
      }
    ],
    "formatos": [
      "DXF",
      "SVG",
      "STL",
      "STEP"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero convertir un archivo de formato.",
    "boton": "Cotizar conversión"
  },
  {
    "slug": "generador-2d-3d/preparacion-para-cam",
    "padre": "generador-2d-3d",
    "numero": "1.7",
    "icono": "cam",
    "nombre": "Preparación para CAM",
    "resumen": "Limpiamos y revisamos tu archivo para que corte sin errores.",
    "titulo": "Tu archivo listo para CAM",
    "subtitulo": "Revisamos y corregimos tu archivo antes de hacer las trayectorias, para no perder material ni tiempo de máquina.",
    "incluye": [
      "Cierre de contornos abiertos",
      "Eliminación de líneas duplicadas y nodos de más",
      "Revisión de unidades, escala y origen",
      "Separación en capas por herramienta u operación"
    ],
    "pasos": [
      {
        "titulo": "Envíanos tu archivo",
        "texto": "DXF, SVG, STL o STEP."
      },
      {
        "titulo": "Lo revisamos",
        "texto": "Te decimos qué errores tiene y el precio."
      },
      {
        "titulo": "Lo corregimos",
        "texto": "Contornos, capas, unidades y origen."
      },
      {
        "titulo": "Recibe tu archivo",
        "texto": "Listo para VCarve, Fusion, Mach3 o LightBurn."
      }
    ],
    "formatos": [
      "DXF",
      "SVG",
      "STL",
      "STEP"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero preparar mi archivo para CAM.",
    "boton": "Revisar mi archivo"
  },
  {
    "slug": "laboratorio-cam",
    "padre": null,
    "numero": "2",
    "icono": "cam",
    "nombre": "Laboratorio CAM",
    "resumen": "Programamos las trayectorias y maquinamos tus piezas en 3, 4 y 5 ejes y en torno.",
    "titulo": "Laboratorio CAM",
    "subtitulo": "Del archivo a la pieza terminada: programamos, simulamos y maquinamos.",
    "incluye": [
      "Programación CAM y G-code para tu máquina",
      "Simulación antes de cortar para no perder material",
      "Maquinado en 3, 4 y 5 ejes",
      "Torneado CNC de piezas redondas"
    ],
    "pasos": [
      {
        "titulo": "Envía tu archivo o plano",
        "texto": "DXF, STEP, STL o un plano con medidas."
      },
      {
        "titulo": "Revisamos y cotizamos",
        "texto": "Material, tiempo, cantidad y precio."
      },
      {
        "titulo": "Programamos y simulamos",
        "texto": "Verificamos cada trayectoria antes de cortar."
      },
      {
        "titulo": "Maquinamos y enviamos",
        "texto": "Recibes tu pieza o tu G-code listo."
      }
    ],
    "formatos": [
      "STEP",
      "DXF",
      "STL",
      "G-code"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero cotizar un servicio del Laboratorio CAM.",
    "boton": "Cotizar mi pieza"
  },
  {
    "slug": "laboratorio-cam/maquinado-3-4-5-ejes",
    "padre": "laboratorio-cam",
    "numero": "2.1",
    "icono": "ejes",
    "nombre": "Maquinado 3, 4 y 5 ejes",
    "resumen": "Piezas planas, rotativas y de geometría compleja.",
    "titulo": "Maquinado en 3, 4 y 5 ejes",
    "subtitulo": "Elegimos el número de ejes que tu pieza necesita para que salga bien y al mejor precio.",
    "incluye": [
      "3 ejes: piezas planas, cajas, bolsillos, relieves y moldes",
      "4 ejes: piezas cilíndricas, grabado rotativo, columnas y patas",
      "5 ejes: geometrías complejas y piezas en una sola sujeción",
      "Pieza única o producción en serie"
    ],
    "pasos": [
      {
        "titulo": "Envía tu archivo",
        "texto": "STEP o STL de preferencia, o un plano con medidas."
      },
      {
        "titulo": "Te recomendamos el proceso",
        "texto": "Te decimos cuántos ejes necesita y por qué."
      },
      {
        "titulo": "Cotización con material y tiempo",
        "texto": "Sabes el precio antes de empezar."
      },
      {
        "titulo": "Maquinado y envío",
        "texto": "Recibes tu pieza terminada."
      }
    ],
    "formatos": [
      "STEP",
      "STL",
      "IGES",
      "DXF"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero cotizar maquinado en 3, 4 o 5 ejes.",
    "boton": "Cotizar maquinado"
  },
  {
    "slug": "laboratorio-cam/torno-cnc",
    "padre": "laboratorio-cam",
    "numero": "2.2",
    "icono": "torno",
    "nombre": "Torno CNC",
    "resumen": "Ejes, bujes, pernos, roscas y piezas redondas.",
    "titulo": "Torneado CNC",
    "subtitulo": "Piezas de revolución con medidas precisas, desde una sola pieza hasta series.",
    "incluye": [
      "Ejes, bujes, pernos y separadores",
      "Roscas, conos y ranuras",
      "Reposición de piezas a partir de una muestra",
      "Pieza única o producción en serie"
    ],
    "pasos": [
      {
        "titulo": "Envía plano o foto con medidas",
        "texto": "También puedes mandarnos la pieza de muestra."
      },
      {
        "titulo": "Cotizamos material y tiempo",
        "texto": "Te confirmamos precio y fecha de entrega."
      },
      {
        "titulo": "Torneamos tu pieza",
        "texto": "Revisamos medidas antes de enviarla."
      },
      {
        "titulo": "Te la enviamos",
        "texto": "A cualquier parte de la República."
      }
    ],
    "formatos": [
      "PDF",
      "DXF",
      "STEP",
      "Foto"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, quiero cotizar una pieza de torno CNC.",
    "boton": "Cotizar pieza de torno"
  },
  {
    "slug": "aprendizaje-cnc",
    "padre": null,
    "numero": "3",
    "icono": "aprender",
    "nombre": "Aprendizaje CNC",
    "resumen": "Aprende a diseñar, programar y operar tu máquina CNC.",
    "titulo": "Aprende CNC desde cero",
    "subtitulo": "Guías, cursos y asesoría para que tu máquina produzca y deje dinero.",
    "incluye": [
      "Diseño 2D y 3D para CNC",
      "Programación CAM y G-code",
      "Configuración de controladores: GRBL, FluidNC, Mach3, LinuxCNC",
      "Operación, mantenimiento y seguridad"
    ],
    "pasos": [
      {
        "titulo": "Dinos tu nivel",
        "texto": "Desde cero o con experiencia."
      },
      {
        "titulo": "Elige cómo aprender",
        "texto": "Guías gratis, cursos en video o asesoría 1 a 1."
      },
      {
        "titulo": "Practica con tu máquina",
        "texto": "Ejercicios reales con archivos de la tienda."
      },
      {
        "titulo": "Empieza a vender",
        "texto": "Publica tus piezas en HETNA CNC."
      }
    ],
    "formatos": [
      "Guías",
      "Video",
      "1 a 1",
      "Taller"
    ],
    "proximo": "Muy pronto: cursos en línea y guías gratis en esta sección.",
    "whatsapp": "Hola HETNA CNC, quiero aprender CNC.",
    "boton": "Quiero aprender"
  },
  {
    "slug": "cotizador-cnc",
    "padre": null,
    "numero": "4",
    "icono": "cotizador",
    "nombre": "Cotizador CNC",
    "resumen": "Envía tu archivo y recibe el precio de tu pieza.",
    "titulo": "Cotiza tu pieza CNC",
    "subtitulo": "Router, láser, plasma, 3, 4 y 5 ejes o torno: dinos qué necesitas y te damos precio.",
    "incluye": [
      "Corte en router, láser y plasma",
      "Maquinado en 3, 4 y 5 ejes y torno",
      "Precio por pieza y por volumen",
      "Diseño incluido si no tienes archivo"
    ],
    "pasos": [
      {
        "titulo": "Envía tu archivo",
        "texto": "DXF, SVG, STL, STEP o foto con medidas."
      },
      {
        "titulo": "Dinos material y cantidad",
        "texto": "Espesor, acabado y fecha que lo necesitas."
      },
      {
        "titulo": "Recibe tu precio",
        "texto": "Con tiempo de entrega incluido."
      },
      {
        "titulo": "Paga y lo fabricamos",
        "texto": "Seguimiento hasta que llegue a tus manos."
      }
    ],
    "formatos": [
      "DXF",
      "SVG",
      "STL",
      "STEP"
    ],
    "proximo": "Muy pronto: sube tu archivo aquí y obtén el precio al instante.",
    "whatsapp": "Hola HETNA CNC, quiero cotizar una pieza.",
    "boton": "Cotizar ahora"
  },
  {
    "slug": "copiloto-ia-cnc",
    "padre": null,
    "numero": "5",
    "icono": "calculadora",
    "nombre": "Copiloto IA CNC",
    "resumen": "Inteligencia artificial experta en CNC: parámetros, errores, G-code y costos.",
    "titulo": "Copiloto IA CNC",
    "subtitulo": "Pregunta lo que sea de tu router, láser, plasma, fibra o impresora 3D.",
    "incluye": [
      "Parámetros de corte según tu máquina",
      "Diagnóstico de problemas y errores",
      "Revisión de G-code, DXF y STL",
      "Ayuda con Mach3, GRBL, Vectric, Fusion y ArtCAM",
      "Calculadoras gratis de velocidades, tiempos y costos"
    ],
    "pasos": [
      {
        "titulo": "Registra tu máquina",
        "texto": "Spindle, RPM, avance y controlador."
      },
      {
        "titulo": "Pregunta",
        "texto": "Material, herramienta o el problema que tienes."
      },
      {
        "titulo": "Sube tu archivo o foto",
        "texto": "G-code, DXF, STL o foto del corte."
      },
      {
        "titulo": "Recibe los valores",
        "texto": "Punto de partida y qué datos faltan."
      }
    ],
    "formatos": [
      "Router",
      "Láser",
      "Plasma",
      "Fibra",
      "3D"
    ],
    "proximo": null,
    "whatsapp": "Hola HETNA CNC, tengo una duda de mi máquina CNC.",
    "boton": "Abrir el Copiloto"
  }
]

export const SERVICIOS_PRINCIPALES = SERVICIOS.filter((s) => !s.padre)
export const subServicios = (slug: string) => SERVICIOS.filter((s) => s.padre === slug)
export const buscarServicio = (slug: string) => SERVICIOS.find((s) => s.slug === slug)
