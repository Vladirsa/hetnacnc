// Temas de arranque del Foro CNC, publicados desde el perfil REAL de HETNA
// (nada de usuarios inventados). Cada tema trae información útil y una
// encuesta para que la comunidad responda. Si un título ya existe con ese
// autor, no lo vuelve a publicar.
//
// Uso (desde apps/storefront, en el VPS):
//   node scripts/foro-temas-hetna.mjs <usuario-del-foro-de-hetna>
// Usa HETNA_FORO_DB (o HETNA_TALLER_DB) de .env.production / .env.local / .env
import { existsSync, readFileSync } from "node:fs"
import pg from "pg"

for (const f of [".env.production", ".env.local", ".env"]) {
  if (!existsSync(f)) continue
  for (const linea of readFileSync(f, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const url = process.env.HETNA_FORO_DB || process.env.HETNA_TALLER_DB
const usuario = (process.argv[2] || "").trim().toLowerCase()
if (!url) {
  console.error("✘ No encontré HETNA_FORO_DB ni HETNA_TALLER_DB en el .env de la tienda")
  process.exit(1)
}
if (!usuario) {
  console.error("✘ Escribe el usuario del foro de HETNA: node scripts/foro-temas-hetna.mjs hetna")
  process.exit(1)
}

const TEMAS = [
  {
    seccion: "router-cnc",
    titulo: "¿Qué RPM y avance usan para cortar MDF de 18 mm en router 1325?",
    cuerpo:
      "Para abrir la conversación, estos son los parámetros que recomienda la Calculadora CNC de HETNA para un router 1325 con spindle de 3.5 kW, fresa de 6 mm de 2 filos (espiral ascendente, carburo) en MDF de 18 mm:\n\n- RPM: 14,500\n- Avance: 8,000 mm/min\n- Profundidad por pasada: 6 mm (3 pasadas)\n- Entrada (plunge): 2,800 mm/min, mejor en rampa\n\nEs un punto de partida: cada máquina es distinta. ¿Ustedes con qué cortan? Cuenten su máquina, fresa y lo que les funciona.\n\nCalculadora gratis: https://hetnacnc.com/mx/calculadora-cnc",
    encuesta: { pregunta: "¿Qué fresa usas más para MDF?", opciones: ["Espiral ascendente (upcut)", "Compresión", "Recta de 2 filos", "Otra"] },
  },
  {
    seccion: "corte-laser",
    titulo: "Láser CO2 de 80 W: ¿a qué velocidad y potencia cortan MDF de 3 y 6 mm?",
    cuerpo:
      "Referencia para empezar con un tubo de 80 W y lente de 2\" (50.8 mm):\n\n- MDF 3 mm: 15–20 mm/s al 60–70 %\n- MDF 6 mm: 8–12 mm/s al 80–90 %, 1 pasada\n- Aire fuerte y foco en la superficie\n- No pasen de unos 26 mA en el amperímetro: más corriente acorta la vida del tubo\n\n¿Qué les funciona a ustedes? Digan potencia de su tubo y marca.\n\nCalculadora de láser: https://hetnacnc.com/mx/calculadora-cnc",
    encuesta: { pregunta: "¿Qué potencia tiene tu láser CO2?", opciones: ["40 W (K40)", "60–80 W", "100–130 W", "150 W o más"] },
  },
  {
    seccion: "precios-negocio",
    titulo: "¿Cuánto cobran por minuto de corte láser en México?",
    cuerpo:
      "Una de las preguntas que más nos hacen. Para cotizar bien hay que sumar: material (con merma de 10–15 %), minutos de máquina, diseño o preparación del archivo y un cobro mínimo por pedido.\n\nMuchos talleres cobran el minuto de láser entre $8 y $20 según la máquina y la ciudad, y ponen un mínimo de $150 a $250 por trabajo.\n\n¿Cómo cobran ustedes: por minuto, por pieza o por hoja? ¿Tienen mínimo?\n\nSi quieren sacar el precio en segundos con sus propios costos: https://hetnacnc.com/mx/herramientas-cnc#cotizador",
    encuesta: { pregunta: "¿Cómo cobras el corte láser?", opciones: ["Por minuto", "Por pieza", "Por hoja o área", "Precio cerrado por trabajo"] },
  },
  {
    seccion: "plasma",
    titulo: "Plasma CNC: ¿qué consumibles y amperaje usan para lámina de 1/4\"?",
    cuerpo:
      "Para acero al carbón de 1/4\" (6.35 mm) con un plasma de 45 A, una referencia común es:\n\n- 45 A con consumibles para 45 A (no mezclar boquillas)\n- Velocidad de 1,000 a 1,400 mm/min\n- Altura de corte 1.5 mm y de perforación 3.8 mm\n- Aire seco: el agua en la línea acaba con los electrodos\n\n¿Qué marca de plasma y qué consumibles les han durado más?",
    encuesta: { pregunta: "¿Usas control de altura (THC)?", opciones: ["Sí", "No", "Lo estoy instalando"] },
  },
  {
    seccion: "impresion-3d",
    titulo: "Litofanías: ¿con qué grosor y relleno les salen mejor?",
    cuerpo:
      "Para litofanías en PLA blanco nos funciona:\n\n- Grosor de 0.8 mm (lo más claro) a 3 mm (lo más oscuro)\n- Relleno al 100 % y altura de capa de 0.12 a 0.16 mm\n- Imprimir de pie (vertical) para que la luz pase pareja\n- Foto con buen contraste y caras de cerca\n\nPueden generarlas gratis desde una foto: https://hetnacnc.com/mx/disenar/litofania-relieve\n\nCompartan fotos de las suyas con luz atrás.",
    encuesta: { pregunta: "¿En qué material imprimes litofanías?", opciones: ["PLA blanco", "PETG", "Resina", "Otro"] },
  },
  {
    seccion: "diseno-cam",
    titulo: "¿Qué programa usan para diseñar y hacer el CAM de su router?",
    cuerpo:
      "Queremos saber qué usa la comunidad para diseñar y generar el G-code. Las opciones más comunes en México: Vectric (Aspire/VCarve), Fusion 360, ArtCAM, LightBurn para láser, y programas gratis como Inkscape y FreeCAD.\n\nSi apenas empiezas, en HETNA puedes pasar un DXF a G-code gratis desde el navegador: https://hetnacnc.com/mx/laboratorio-cam\n\n¿Cuál usan y por qué?",
    encuesta: { pregunta: "¿Qué programa usas para CAM?", opciones: ["Vectric (Aspire / VCarve)", "Fusion 360", "ArtCAM", "Otro"] },
  },
  {
    seccion: "controladores-electronica",
    titulo: "Mach3, GRBL o DSP: ¿qué controlador tiene su router?",
    cuerpo:
      "Cada controlador tiene sus mañas: Mach3 necesita PC y su postprocesador, GRBL es barato y abierto, y los DSP (como el A11 o el Ruida en láser) se manejan sin computadora.\n\n¿Cuál tienen y qué problema les ha dado más guerra? Si comparten la falla, entre todos la resolvemos.",
    encuesta: { pregunta: "¿Qué controlador tiene tu router?", opciones: ["Mach3 / Mach4", "GRBL", "DSP (A11, A18…)", "Otro"] },
  },
  {
    seccion: "materiales-herramientas",
    titulo: "¿Dónde compran MDF y acrílico para corte en su ciudad?",
    cuerpo:
      "Conseguir buen material a buen precio hace toda la diferencia. Cuéntennos en qué ciudad están, dónde compran MDF, triplay y acrílico, y si les entregan cortado a la medida.\n\nAsí armamos entre todos una lista de proveedores por ciudad para que los talleres nuevos no batallen.",
    encuesta: { pregunta: "¿Cómo compras tu material?", opciones: ["Hoja completa en maderería", "Cortado a la medida", "Por internet", "Me lo da el cliente"] },
  },
]

const db = new pg.Pool({ connectionString: url, max: 2 })
try {
  const { rows: perfiles } = await db.query(`select id, nombre, tipo from foro.perfiles where usuario = $1`, [usuario])
  const perfil = perfiles[0]
  if (!perfil) {
    console.error(`✘ No existe el perfil "${usuario}" en el foro. Créalo primero en hetnacnc.com/mx/foro-cnc con la cuenta de HETNA.`)
    process.exit(1)
  }
  console.log(`Publicando como ${perfil.nombre} (${usuario})`)
  let nuevos = 0
  for (const t of TEMAS) {
    const { rows: ya } = await db.query(`select 1 from foro.temas where autor_id = $1 and titulo = $2 limit 1`, [perfil.id, t.titulo])
    if (ya.length) {
      console.log(`· ya estaba: ${t.titulo}`)
      continue
    }
    const { rows } = await db.query(
      `select * from foro.crear_tema($1, $2, 'debate', $3, $4, '[]'::jsonb, '{}'::text[], $5::jsonb, 'publicado')`,
      [perfil.id, t.seccion, t.titulo, t.cuerpo, JSON.stringify(t.encuesta)]
    )
    nuevos++
    console.log(`✔ ${t.titulo} → /mx/foro-cnc/${rows[0].seccion}/${rows[0].slug}`)
  }
  console.log(`Listo: ${nuevos} temas nuevos.`)
} catch (e) {
  console.error("✘", e.message)
  process.exitCode = 1
} finally {
  await db.end()
}
