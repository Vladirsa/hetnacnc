// Genera el SQL que siembra el Foro CNC con los temas de temas-semilla.json.
//
// Un foro vacío no arranca: nadie pregunta donde no hay nadie. Esto deja de
// qué agarrarse el día que abra, y le da al Agente de respuestas del foro algo
// que contestar.
//
// Genera SQL en vez de conectarse a la base por tres razones: se corre en el
// mismo editor de Supabase donde se crea el esquema, se puede leer antes de
// ejecutarlo, y no necesita credenciales ni dependencias.
//
//   bun infra/foro/generar-siembra.mjs equipo-hetna > infra/foro/siembra.sql
//
// El argumento es el `usuario` del perfil del foro que firma. Ese perfil tiene
// que existir ya, y conviene que tenga rol admin o moderador: foro.crear_tema
// corta a los 8 temas al día cuando el rol es "usuario".
//
// Qué entra y qué no:
//
//   origen "oficial" y "cliente"  -> entran al SQL, firmados por esa cuenta.
//                                    Los de cliente dicen en el cuerpo que la
//                                    pregunta llegó de alguien más, que es la
//                                    verdad.
//   origen "fundador"             -> NO entran. Salen listados aparte para
//                                    proponérselos a cada taller fundador, que
//                                    los publica con SU cuenta.
//
// Ningún tema se publica con un perfil inventado. En el CNC mexicano todos se
// conocen, y un nombre falso descubierto cuesta el gremio entero.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const autor = process.argv[2]

if (!autor) {
  console.error("Uso: bun infra/foro/generar-siembra.mjs <usuario-del-perfil>")
  process.exit(1)
}
if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(autor)) {
  console.error(`"${autor}" no es un usuario válido del foro (minúsculas, números y guiones).`)
  process.exit(1)
}

const temas = JSON.parse(readFileSync(join(AQUI, "temas-semilla.json"), "utf8"))
const aSembrar = temas.filter((t) => t.origen === "oficial" || t.origen === "cliente")
const paraFundadores = temas.filter((t) => t.origen === "fundador")

// Texto entre comillas simples de SQL. Se usa sólo para valores cortos y
// controlados (el usuario y el slug de sección); los cuerpos van con dólares.
const txt = (s) => `'${String(s).replace(/'/g, "''")}'`

// Literal con dólares: evita tener que escapar apóstrofos y saltos de línea en
// textos largos escritos por una persona. Si el texto ya trae el delimitador,
// se busca otro.
function dolares(s) {
  let etiqueta = "tema"
  while (s.includes(`$${etiqueta}$`)) etiqueta += "x"
  return `$${etiqueta}$${s}$${etiqueta}$`
}

const lineas = []
lineas.push("-- Siembra del Foro CNC. Generado por infra/foro/generar-siembra.mjs")
lineas.push("-- NO se edita a mano: se edita temas-semilla.json y se vuelve a generar.")
lineas.push(`-- Firma: @${autor}  ·  ${aSembrar.length} temas`)
lineas.push("--")
lineas.push("-- Correr DESPUÉS del esquema del foro y de que exista ese perfil.")
lineas.push("-- Es idempotente: un tema que ya está no se duplica.")
lineas.push("")
lineas.push("do $siembra$")
lineas.push("declare")
lineas.push("  autor uuid;")
lineas.push("  puestos integer := 0;")
lineas.push("begin")
lineas.push(`  select id into autor from foro.perfiles where usuario = ${txt(autor)};`)
lineas.push("  if autor is null then")
lineas.push(
  `    raise exception 'No existe el perfil ${autor} en foro.perfiles. Créalo antes de sembrar.';`
)
lineas.push("  end if;")
lineas.push("")

for (const tema of aSembrar) {
  lineas.push(`  -- [${tema.seccion}] ${tema.por_que}`)
  lineas.push("  if not exists (")
  lineas.push(`    select 1 from foro.temas where titulo = ${txt(tema.titulo)}`)
  lineas.push("  ) then")
  lineas.push("    perform foro.crear_tema(")
  lineas.push(`      autor, ${txt(tema.seccion)}, 'pregunta',`)
  lineas.push(`      ${dolares(tema.titulo)},`)
  lineas.push(`      ${dolares(tema.cuerpo)}`)
  lineas.push("    );")
  lineas.push("    puestos := puestos + 1;")
  lineas.push("  end if;")
  lineas.push("")
}

lineas.push("  raise notice 'Temas sembrados en esta corrida: %', puestos;")
lineas.push("end $siembra$;")
lineas.push("")

if (paraFundadores.length) {
  lineas.push("-- ---------------------------------------------------------------")
  lineas.push(`-- ${paraFundadores.length} temas que NO van aquí: son para proponerle a un taller`)
  lineas.push("-- fundador, para que los publique con SU cuenta. La gracia del foro es")
  lineas.push("-- que no hable una sola voz, y eso no se finge, se consigue.")
  for (const t of paraFundadores) {
    lineas.push(`--   [${t.seccion}] ${t.titulo}`)
  }
}

process.stdout.write(lineas.join("\n") + "\n")
