// Siembra el Foro CNC con preguntas frecuentes reales de la comunidad, publicadas
// abiertamente por la cuenta "Equipo HETNA" (no se hace pasar por otras personas).
// Se puede correr varias veces: no duplica temas con el mismo título.
// Uso: PG_MOD=/ruta/a/node_modules/pg node scripts/sembrar-foro.cjs
const fs = require("fs")
const path = require("path")
const os = require("os")
const { Client } = require(process.env.PG_MOD || "pg")

const leerVar = (nombre) => {
  if (process.env[nombre]) return process.env[nombre]
  const archivos = [
    "apps/storefront/.env.local", "apps/storefront/.env.production", "apps/storefront/.env",
    path.join(os.homedir(), ".env.local"), ".env.local",
  ]
  for (const a of archivos) {
    try {
      const m = fs.readFileSync(a, "utf8").match(new RegExp(`^${nombre}=(.*)$`, "m"))
      if (m) return m[1].trim().replace(/^["']|["']$/g, "")
    } catch {}
  }
  return ""
}

const URL_DB = leerVar("HETNA_FORO_DB") || leerVar("HETNA_TALLER_DB")
if (!URL_DB) { console.error("No encontré HETNA_FORO_DB"); process.exit(1) }

const INTRO = "Pregunta frecuente de la comunidad CNC en México. La dejamos aquí con una respuesta de arranque; si tienes experiencia con esto, compártela abajo.\n\n"
const CIERRE = "\n\n¿Te funcionó distinto en tu máquina? Cuéntanos qué máquina, material y herramienta usas."

const TEMAS = [
  ["router-cnc", "¿Qué velocidad y avance uso para cortar MDF de 18 mm con fresa de 6 mm?",
   "Tengo un router CNC con spindle de 2.2 kW y una fresa recta de 6 mm de 2 filos. ¿Con qué RPM, avance y profundidad por pasada empiezo en MDF de 18 mm?",
   "La forma más segura de calcularlo es con la carga de viruta (chip load):\n\nAvance (mm/min) = RPM × número de filos × carga por diente\n\nPara MDF con fresa de 6 mm y 2 filos, una carga de 0.08 a 0.12 mm por diente es un buen punto de partida. A 18,000 RPM eso da entre 2,900 y 4,300 mm/min.\n\nEn máquinas ligeras conviene empezar más abajo (1,500 a 2,500 mm/min) y subir poco a poco.\n\nProfundidad por pasada: entre 0.5 y 1 vez el diámetro (3 a 6 mm), o sea 3 a 6 pasadas para 18 mm.\n\nSeñales: si quema, sube el avance o baja las RPM; si vibra o la fresa se flexiona, baja la profundidad por pasada."],
  ["router-cnc", "Fresa compresión, upcut o downcut: ¿cuál conviene para melamina?",
   "Al cortar melamina se me astilla la cara de arriba o la de abajo. ¿Qué tipo de fresa uso?",
   "Para melamina y triplay con acabado en las dos caras, lo ideal es una fresa de compresión: la parte baja sube la viruta (upcut) y la de arriba la empuja hacia abajo (downcut), así las dos caras quedan limpias.\n\nTruco importante: la primera pasada debe ser más profunda que el tramo upcut de la fresa (suele ser de 5 a 8 mm), si no, la cara de arriba se astilla igual.\n\nUpcut: saca mejor la viruta pero astilla arriba. Downcut: deja limpio arriba pero calienta más y astilla abajo."],
  ["router-cnc", "¿Por qué mis piezas salen más chicas o más grandes que el diseño?",
   "Diseño una pieza de 100 mm y me sale de 98 o 101. ¿Qué puede ser?",
   "Revisa en este orden:\n\n1. Compensación de herramienta: ¿cortaste por fuera, por dentro o sobre la línea? Para piezas, el corte va por fuera del contorno.\n2. Diámetro real de la fresa: mide la fresa; una de 6 mm puede cortar 6.2 mm si vibra.\n3. Pasos por milímetro: corta un cuadro de 100 × 100 mm y mídelo. Si en un eje sale 99 mm, ajusta: pasos nuevos = pasos actuales × 100 / 99.\n4. Juego mecánico (backlash) en husillos o cremalleras: se nota cuando las medidas cambian según la dirección.\n5. Flexión de la fresa: con pasadas muy profundas la herramienta se dobla."],
  ["router-cnc", "¿Qué fresa usar para aluminio en un router CNC?",
   "Quiero cortar placa de aluminio de 6 mm en mi router. ¿Qué herramienta y parámetros recomiendan?",
   "Para aluminio en router lo más usado es una fresa de carburo de 1 filo (o de 2 filos con buen desalojo), pulida, especial para aluminio.\n\nClaves:\n- Pasadas poco profundas (0.3 a 1 mm en máquinas ligeras) y avance constante: el aluminio odia que la fresa \"talle\" sin cortar.\n- Lubricación o aire para que la viruta no se pegue al filo.\n- Sujeción muy firme: la placa no debe vibrar.\n\nSi se forma una bola de aluminio en la fresa, para de inmediato: casi siempre es falta de avance, de lubricación o de desalojo de viruta."],
  ["corte-laser", "¿Qué potencia de láser necesito para cortar acrílico y MDF de 3 mm?",
   "Estoy por comprar un láser y no sé si me alcanza con uno de diodo o necesito CO2.",
   "Para MDF de 3 mm: un láser de CO2 de 40 a 60 W lo corta en una sola pasada. Un diodo de 10 a 20 W de potencia óptica también, pero más lento y a veces en varias pasadas.\n\nPara acrílico: el CO2 lo corta muy bien y deja la orilla pulida. Un láser de diodo NO corta acrílico transparente (la luz lo atraviesa) y batalla con colores claros.\n\nSi vas a trabajar acrílico de forma seria, la recomendación es CO2."],
  ["corte-laser", "Las orillas del MDF salen quemadas en el corte láser, ¿cómo lo evito?",
   "Corto MDF de 3 y 6 mm y las orillas y la cara quedan con mancha café.",
   "Lo que más ayuda:\n- Asistencia de aire (air assist) bien dirigida a la boquilla.\n- Foco correcto: un foco desajustado ensancha el corte y quema más.\n- Más velocidad y la potencia justa; a veces dos pasadas rápidas queman menos que una lenta.\n- Cinta de enmascarar en la cara para que el humo no la manche.\n- Lente y espejos limpios.\n\nUn poco de tono en la orilla es normal en MDF por el pegamento que trae."],
  ["plasma", "¿Por qué el corte de plasma sale con escoria o bisel?",
   "Corto lámina de acero de 1/4 y me queda escoria abajo y el corte inclinado.",
   "Escoria de baja velocidad (gruesa y fácil de quitar): vas demasiado lento o la altura es mucha.\nEscoria de alta velocidad (fina y muy pegada): vas demasiado rápido.\n\nBisel: altura de antorcha incorrecta o consumibles gastados (boquilla y electrodo). Revisa que la boquilla tenga el orificio redondo.\n\nTambién influye el amperaje: usa la tabla de corte del fabricante para ese espesor y el control de altura (THC) si tu máquina lo tiene."],
  ["torno-fresadora", "Torno CNC: ¿cuándo usar G96 y cuándo G97?",
   "Estoy aprendiendo G-code para torno y no me queda clara la diferencia.",
   "G96 es velocidad de corte constante: el torno sube las RPM conforme baja el diámetro para mantener la misma velocidad superficial. Ideal para careado y cilindrado. Siempre limita las RPM máximas con G50 (en controles tipo Fanuc) antes de usarlo.\n\nG97 es RPM constantes: lo usas para roscado, barrenado al centro y cuando no quieres que el husillo cambie de velocidad.\n\nRegla rápida: careado y desbaste con G96 + G50; roscas y brocas con G97."],
  ["impresion-3d", "PLA o PETG para piezas funcionales, ¿cuál conviene?",
   "Quiero imprimir soportes y piezas que van a trabajar. ¿Cuál material aguanta más?",
   "PLA: fácil de imprimir, rígido y con buen acabado, pero se ablanda alrededor de 55–60 °C (por ejemplo, dentro de un carro al sol) y es más frágil.\n\nPETG: más tenaz (se dobla antes de romperse), aguanta más temperatura (cerca de 70–80 °C) y resiste mejor la humedad y algunos químicos. Es un poco más difícil: hace hilos y pide ajustar la retracción.\n\nPara piezas funcionales, en general, PETG."],
  ["diseno-cam", "¿Cómo preparo un DXF limpio para que el taller lo pueda cortar?",
   "Mandé un archivo a cortar y me dijeron que estaba \"sucio\". ¿Qué debo revisar?",
   "Antes de mandar tu DXF revisa:\n1. Escala 1:1 y en milímetros.\n2. Contornos cerrados (sin huecos entre líneas).\n3. Sin líneas duplicadas o encimadas.\n4. Textos convertidos a curvas.\n5. Una capa por operación (corte, grabado, perforación).\n6. Medidas críticas anotadas aparte (en un PDF o en la descripción).\n\nSi pides cotización en HETNA, adjunta también una imagen o PDF con el material y el espesor."],
  ["diseno-cam", "¿Qué postprocesador uso en Vectric (Aspire / VCarve) para Mach3?",
   "Ya tengo mis trayectorias pero no sé cuál postprocesador elegir para que funcione en Mach3.",
   "En Vectric el más usado para Mach3 es \"Mach2/3 Arcs (mm) (*.txt)\" si trabajas en milímetros (hay versión en pulgadas).\n\nAntes de cortar:\n- Revisa que el cero de la pieza en Vectric coincida con el que haces en la máquina (esquina o centro, arriba del material o en la cama).\n- Haz una corrida en el aire, unos centímetros arriba del material, la primera vez.\n\nSi tu máquina tiene cambio de herramienta o un controlador distinto, pide al fabricante su postprocesador."],
  ["controladores-electronica", "Mach3: los motores pierden pasos, ¿qué reviso?",
   "A mitad del trabajo la máquina se recorre y la pieza sale movida.",
   "Causas más comunes:\n1. Aceleración o velocidad máxima muy altas en Motor Tuning: bájalas 20–30 % y prueba.\n2. Corriente del driver baja para tu motor.\n3. Mecánica: algo se atora, cople flojo o husillo sin lubricar.\n4. Ruido eléctrico: cables de motor y de señal juntos, sin malla o sin tierra.\n5. Ancho de pulso (step pulse) muy corto para tus drivers.\n\nPrueba moviendo cada eje en vacío a velocidad alta: si pierde pasos sin cortar, es configuración o electrónica; si solo cortando, revisa la mecánica y los parámetros de corte."],
  ["controladores-electronica", "¿GRBL o Mach3 para mi primer router CNC?",
   "Estoy armando mi primera máquina y no sé qué control elegir.",
   "GRBL: corre en placas tipo Arduino, es barato y sencillo, se usa con programas gratuitos (por ejemplo UGS o Candle). Ideal para máquinas pequeñas y medianas.\n\nMach3: corre en una PC con Windows y necesita puerto paralelo o una tarjeta controladora USB/Ethernet. Es muy configurable y tiene mucha información en español, aunque ya es un programa viejo (su sucesor es Mach4).\n\nPara empezar con un router pequeño, GRBL; para una máquina grande o con más ejes, Mach3/Mach4 o un control dedicado."],
  ["materiales-herramientas", "¿Cuánto espacio dejo entre piezas al acomodar (anidar) en una hoja?",
   "Quiero aprovechar al máximo la hoja de MDF pero no sé cuánto separar las piezas.",
   "Como regla: separación mínima = diámetro de la fresa + 2 a 3 mm. Con fresa de 6 mm, unos 8 a 9 mm entre piezas.\n\nDeja también un margen de 10 a 15 mm a la orilla de la hoja y usa puentes (tabs) para que las piezas chicas no se suelten al final del corte.\n\nPara el láser el espacio puede ser mucho menor (2 a 3 mm)."],
  ["precios-negocio", "¿Cómo calculo cuánto cobrar por hora de router CNC?",
   "Siempre cobro \"a ojo\" y siento que pierdo dinero. ¿Cómo lo calculan ustedes?",
   "Una forma sencilla:\n\nCosto por hora = (depreciación de la máquina + luz + herramientas + renta + sueldo del operador) ÷ horas productivas al mes\n\nA eso súmale tu margen (por ejemplo 30 a 50 %).\n\nY en cada trabajo cobra aparte:\n- Material (con merma).\n- Preparación: diseño, CAM y montaje.\n- Un cobro mínimo por trabajo.\n\nEl error más común es cobrar solo el tiempo de corte. En HETNA puedes usar el cotizador para tener un precio de referencia rápido."],
  ["precios-negocio", "¿Cómo cotizar un trabajo de corte láser?",
   "Me piden cortes en MDF y acrílico y no sé si cobrar por pieza, por minuto o por hoja.",
   "Lo más justo y fácil de explicar es por minuto de máquina + material:\n\n1. Saca el tiempo estimado del programa (LightBurn, RDWorks, etc.).\n2. Multiplícalo por tu costo por minuto (incluye luz, tubo, mantenimiento y tu margen).\n3. Suma el material con merma.\n4. Suma diseño si tuviste que hacer o arreglar el archivo.\n5. Aplica un mínimo por trabajo.\n\nPara lotes grandes puedes dar precio por pieza, pero calculado con este mismo método."],
]

;(async () => {
  const c = new Client({ connectionString: URL_DB, ssl: URL_DB.includes("supabase") ? { rejectUnauthorized: false } : undefined })
  await c.connect()
  const r = await c.query(
    `insert into foro.perfiles (cliente_id, usuario, nombre, tipo, verificado, bio, ciudad, estado_mx, rol)
     values ('hetna-equipo', 'equipo-hetna', 'Equipo HETNA', 'marca', true,
       'Cuenta oficial de HETNA CNC. Respondemos dudas de CNC y publicamos guías para la comunidad.', 'Apizaco', 'Tlaxcala', 'admin')
     on conflict (cliente_id) do update set nombre = excluded.nombre
     returning id`)
  const autor = r.rows[0].id
  console.log("Base del foro:", new URL(URL_DB).hostname)
  const slug = (t) =>
    (t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)) || "tema"
  let nuevos = 0
  for (const [seccion, titulo, pregunta, respuesta] of TEMAS) {
    const ya = await c.query("select 1 from foro.temas where titulo = $1", [titulo])
    if (ya.rowCount) continue
    const s = await c.query("select id from foro.secciones where slug = $1", [seccion])
    if (!s.rowCount) { console.log("✗ no existe la sección", seccion); continue }
    let sl = slug(titulo), n = 1
    while ((await c.query("select 1 from foro.temas where seccion_id = $1 and slug = $2", [s.rows[0].id, sl])).rowCount) sl = `${slug(titulo).slice(0, 75)}-${++n}`
    await c.query("begin")
    try {
      const t = await c.query(
        "insert into foro.temas (seccion_id, autor_id, tipo, titulo, slug, cuerpo) values ($1, $2::uuid, 'pregunta', $3, $4, $5) returning id",
        [s.rows[0].id, autor, titulo, sl, INTRO + pregunta])
      const temaId = t.rows[0].id
      const resp = await c.query(
        "insert into foro.respuestas (tema_id, autor_id, cuerpo) values ($1, $2::uuid, $3) returning id",
        [temaId, autor, respuesta + CIERRE])
      await c.query(
        "update foro.temas set mejor_respuesta_id = $1, respuestas = (select count(*) from foro.respuestas where tema_id = $2 and estado = 'publicado'), ultima_actividad = now() where id = $2",
        [resp.rows[0].id, temaId])
      await c.query("commit")
    } catch (e) {
      await c.query("rollback")
      throw e
    }
    nuevos++
    console.log("✓", seccion, "-", titulo)
  }
  const tot = await c.query("select count(*)::int n from foro.temas where estado = 'publicado'")
  console.log(`Temas nuevos: ${nuevos}. Temas publicados en el foro: ${tot.rows[0].n}`)
  await c.end()
})().catch((e) => { console.error("ERROR", e.message); process.exit(1) })
