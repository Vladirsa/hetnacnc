---
name: thermos
description: Auditoría a fondo de los cambios de una rama o PR antes de fusionar, con dos revisores en paralelo (seguridad y fallas; calidad del código) y un informe en español. Úsala cuando pidan "thermos", "auditoría", "revisa el PR a fondo" o antes de abrir un PR grande.
---

# Thermos: auditoría antes de fusionar

Adaptación para Claude Code del plugin Thermos de Cursor (github.com/cursor/plugins,
licencia MIT, ver `LICENSE`). Las rúbricas originales están en esta carpeta:

- `rubrica-seguridad.md`: errores, cosas que se rompen sin que se note, huecos de
  seguridad, cambios que afectan cómo se corre el proyecto y funciones ocultas que
  se filtran.
- `rubrica-calidad.md`: código enredado, archivos que pasan de 1,000 líneas,
  abstracciones de más y oportunidades de simplificar.

## Cómo correrla

1. **Alcance.** Por omisión, `git diff origin/main...HEAD` de la rama actual (o el PR
   que pidan). Anota la lista de archivos cambiados.
2. **Dos revisores en paralelo.** En un solo mensaje lanza dos agentes
   (`general-purpose`, `run_in_background: true`), cada uno con:
   - la ruta de su rúbrica (`.claude/skills/thermos/rubrica-seguridad.md` o
     `rubrica-calidad.md`), que debe leer y seguir como lista de revisión;
   - el comando del diff y la lista de archivos, para que lea el contenido completo;
   - el contexto del proyecto: Medusa v2 + Mercur en `packages/api`, tienda Next.js 15
     en `apps/storefront`, paneles en `apps/vendor` y `apps/admin`;
   - la instrucción de **solo leer** (no editar, no hacer commit ni push), reportar
     sólo código agregado o modificado y verificar cada hallazgo antes de listarlo;
   - respuesta en español: lista por prioridad (Alta / Media / Baja) con
     `archivo:línea`, el escenario concreto de falla y el arreglo sugerido.
3. **Síntesis.** Cuando terminen los dos, junta los hallazgos sin repetir, da más peso
   a los que encontraron ambos y decide tú los desacuerdos. Verifica tú mismo los de
   prioridad Alta antes de presentarlos.
4. **Arreglos.** Corrige lo real en la misma rama, con las pruebas del proyecto
   (`tsc`, pruebas unitarias del API), y explica al dueño qué se corrigió y qué queda
   como decisión suya.

## Reglas

- Las rúbricas mencionan `gh`/`glab`: aquí los comentarios del PR se leen con las
  herramientas de GitHub disponibles en la sesión, no con esos comandos.
- No subir la prioridad de un hallazgo sin haberlo comprobado de punta a punta.
