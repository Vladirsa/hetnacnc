#!/usr/bin/env node
/*
 * Busca componentes de JSX usados sin estar importados ni definidos.
 *
 * Por qué existe: el 20 de octubre una conversión masiva de <img> a <Image>
 * dejó 16 archivos usando <Image> sin importarlo nunca. El sitio compiló, se
 * publicó, y la portada se cayó. Compiló por dos motivos que se tapan entre
 * ellos:
 *
 *   1. next.config trae `typescript: { ignoreBuildErrors: true }`, así que un
 *      error de tipos no detiene la publicación.
 *   2. `Image` existe como variable global del navegador (la del `new Image()`
 *      de toda la vida), así que TypeScript ni se queja: cree que es ésa. En el
 *      servidor no existe, y React recibe algo que no es un componente.
 *
 * Ni el compilador ni los tipos iban a avisar. Este guion sí.
 *
 *   node scripts/revisar-jsx.mjs
 *
 * Sale con 1 si encuentra algo, para que el despliegue se detenga.
 */
import { globSync, readFileSync } from "node:fs"
import { join } from "node:path"

const RAIZ = new URL("../apps/storefront/src/", import.meta.url).pathname

// Etiquetas con mayúscula que no son componentes nuestros.
const GLOBALES = new Set(["Fragment", "React"])

// Una etiqueta de JSX viene después de un espacio, un paréntesis, una llave o
// el principio del renglón. Un genérico de TypeScript -- Record<string>,
// useRef<Set<...>>, FC<Props> -- viene pegado a un identificador. Esa es toda
// la diferencia, y alcanza para no confundirlos.
const ETIQUETA = /(^|[\s(){}>,=])<([A-Z][A-Za-z0-9_]*)/g

const archivos = globSync("**/*.tsx", { cwd: RAIZ })
const hallazgos = []

for (const rel of archivos) {
  const texto = readFileSync(join(RAIZ, rel), "utf8")

  // Fuera comentarios y cadenas, para no leer ejemplos ni documentación.
  const limpio = texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')

  const usados = new Set()
  for (const m of limpio.matchAll(ETIQUETA)) usados.add(m[2])

  for (const nombre of usados) {
    if (GLOBALES.has(nombre)) continue

    // Un nombre que SÓLO aparece como etiqueta y en ningún otro lugar del
    // archivo es el caso que importa: nadie lo importó, nadie lo declaró y
    // nadie lo recibe como parámetro. Si aparece en otro lado -- un parámetro
    // de Storybook, un genérico <K extends ...> -- ya está atado a algo y no
    // es este problema.
    const veces = (limpio.match(new RegExp(`\\b${nombre}\\b`, "g")) || []).length
    const comoEtiqueta = (limpio.match(new RegExp(`<${nombre}\\b`, "g")) || []).length
    if (veces > comoEtiqueta) continue

    const definido =
      new RegExp(`\\b(?:const|let|var|function|class|enum)\\s+${nombre}\\b`).test(limpio) ||
      new RegExp(`\\bimport\\s+(?:type\\s+)?${nombre}\\b`).test(limpio) ||
      new RegExp(`\\{[^}]*\\b${nombre}\\b[^}]*\\}\\s*from`).test(limpio) ||
      new RegExp(`\\bas\\s+${nombre}\\b`).test(limpio)

    if (!definido) hallazgos.push(`${rel}  ->  <${nombre}>`)
  }
}

if (hallazgos.length) {
  console.error("✗ Componentes usados sin importar:")
  console.error("")
  for (const h of hallazgos) console.error("  " + h)
  console.error("")
  console.error("Eso compila, pero tumba la página al dibujarla. Agrega el import.")
  process.exit(1)
}

console.log(`✓ ${archivos.length} archivos revisados, ningún componente sin importar`)
