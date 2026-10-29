// Guías fijas del blog del foro, las de las secciones con más dudas.
//
//   npx medusa exec ./src/scripts/sembrar-guias-blog.ts
//
// Idempotente: si el slug ya existe, no lo toca (para no pisar lo que se haya
// editado después en el dashboard). Las firma "Equipo HETNA": son artículos
// de la casa, no preguntas de la comunidad.
import type { ExecArgs } from "@medusajs/framework/types"

import { servicioBlog } from "../lib/blog"

const GUIAS = [
  {
    slug: "como-pasar-pdf-o-foto-a-dxf-para-cnc",
    title: "Cómo pasar un PDF o una foto a DXF para cortar en CNC",
    categoria: "diseno-cam",
    excerpt:
      "Qué tipo de PDF sí se convierte bien, cómo vectorizar una foto o un logo, cómo revisar escala y curvas, y qué entregarle al taller para que corte a la primera.",
    seo_title: "Cómo pasar PDF o foto a DXF para CNC (guía paso a paso)",
    seo_description:
      "Convierte un PDF o una imagen a DXF para router, láser o plasma: vectorizar, revisar escala, cerrar contornos y qué archivo pedirle al taller.",
    content_html: `
<p>Casi todas las dudas de "no me abre el archivo" o "salió del tamaño equivocado" vienen de lo mismo: la máquina CNC necesita <strong>vectores</strong> (líneas y curvas con medida real), y muchos archivos que circulan son <strong>imágenes</strong>. Esta guía te dice cómo saber qué tienes y qué hacer en cada caso.</p>

<h2>1. Primero, ¿qué tipo de archivo tienes?</h2>
<ul>
<li><strong>PDF exportado desde un programa de diseño</strong> (AutoCAD, Illustrator, Inkscape, CorelDRAW, SolidWorks): normalmente trae vectores. Es el mejor caso.</li>
<li><strong>PDF escaneado o foto dentro de un PDF</strong>: es una imagen. Si haces zoom y se pixelea, no hay vectores.</li>
<li><strong>JPG, PNG o foto del celular</strong>: siempre es imagen. Hay que vectorizar o redibujar.</li>
</ul>
<p>Prueba rápida: abre el PDF y haz zoom al 800%. Si las orillas siguen nítidas, son vectores. Si se ven escalones o borroso, es imagen.</p>

<h2>2. PDF con vectores → DXF</h2>
<ol>
<li>Ábrelo en <strong>Inkscape</strong> (gratis) o Illustrator. En Inkscape, al importar elige "Importar vía Poppler/Cairo" para conservar las curvas.</li>
<li>Desagrupa todo y borra lo que no se corta: textos de cotas, marcos, sellos, líneas de centro.</li>
<li>Revisa la <strong>escala</strong>: mide una cota conocida. Si el plano dice 100 mm y mide otra cosa, escala todo hasta que coincida.</li>
<li>Guarda como <strong>DXF</strong> (en Inkscape: "DXF R14"). Usa milímetros.</li>
</ol>

<h2>3. Foto o imagen → DXF</h2>
<p>Funciona bien con logotipos, siluetas y letras de alto contraste. No funciona con fotos de piezas en 3D, sombras o perspectiva.</p>
<ol>
<li>Recorta la imagen y súbele el contraste: fondo blanco, figura negra.</li>
<li>En Inkscape usa <em>Trayecto → Vectorizar mapa de bits</em> con un solo color (umbral de brillo). Ajusta el umbral hasta que la silueta quede limpia.</li>
<li>Simplifica nodos (<em>Ctrl+L</em>) con cuidado: menos nodos cortan más suave, pero demasiado simplificado deforma las curvas.</li>
<li>Pon la medida real: selecciona todo y escribe el ancho exacto en milímetros.</li>
</ol>
<p>Si la pieza es mecánica (bridas, soportes, engranes), <strong>no la vectorices desde foto</strong>: las medidas salen mal. Mídela con vernier y dibújala, o pídele a un diseñador que la levante.</p>

<h2>4. Revisa esto antes de mandarlo a cortar</h2>
<ul>
<li><strong>Contornos cerrados</strong>: una línea abierta hace que el router o el láser corten raro o no corten.</li>
<li><strong>Sin líneas duplicadas</strong>: dos líneas encimadas hacen que la máquina pase dos veces y queme o se pase de profundidad.</li>
<li><strong>Unidades en milímetros</strong> y una cota de referencia escrita en tu mensaje.</li>
<li><strong>Detalles más grandes que la herramienta</strong>: un hueco de 2 mm no sale con una fresa de 3 mm. En láser el límite es el grosor del material.</li>
</ul>

<h2>5. Qué mandarle al taller</h2>
<p>El DXF, el material y su grosor, la cantidad, y una foto o PDF de referencia con las cotas importantes. Con eso te pueden dar precio real a la primera.</p>

<h2>¿No tienes tiempo o el archivo no queda?</h2>
<p>En HETNA puedes pedir el diseño junto con el corte: elige <em>"No tengo archivo, necesito diseño"</em> o <em>"Tengo boceto o foto"</em> y los talleres que también diseñan te cotizan las dos cosas.</p>
<p><a href="/mx/cotizar?necesidad=Dise%C3%B1o">Pedir que me hagan el diseño</a> · <a href="/mx/herramientas-cnc">Herramientas CNC gratis</a> · <a href="/mx/foro-cnc/diseno-cam">Preguntar en Diseño y CAM</a></p>
`,
  },
  {
    slug: "mdf-quemado-o-chueco-en-router-y-laser",
    title: "MDF quemado o chueco en router y láser: causas y cómo corregirlo",
    categoria: "materiales-herramientas",
    excerpt:
      "Por qué el MDF se quema, sale con orilla negra o se pandea, y qué ajustar: avance, revoluciones, fresa, sujeción, aire en el láser y cómo guardar la lámina.",
    seo_title: "MDF quemado o chueco en CNC: causas y solución",
    seo_description:
      "Soluciones para MDF quemado en router CNC y láser, orillas negras y láminas pandeadas: avance, RPM, fresas, asistencia de aire y almacenamiento.",
    content_html: `
<p>El MDF es el material más usado en talleres de router y láser en México, y también el que más dudas genera. Casi siempre el problema es uno de estos tres: <strong>calor</strong> (se quema), <strong>humedad</strong> (se pandea) o <strong>sujeción</strong> (se mueve y sale chueco).</p>

<h2>Router CNC: el MDF se quema o sale con orilla negra</h2>
<p>La fresa se calienta cuando corta poco y frota mucho. La regla: <strong>la viruta debe salir como viruta, no como polvo fino</strong>. Si sale polvo, la fresa está frotando.</p>
<ul>
<li><strong>Sube el avance o baja las RPM.</strong> Lo que importa es la carga de viruta por diente: carga = avance ÷ (RPM × número de filos). Como referencia de partida en MDF con fresa de 1/4" de 2 filos, muchos talleres trabajan entre 0.10 y 0.25 mm por diente, y de ahí ajustan con su máquina.</li>
<li><strong>No te quedes quieto en una esquina.</strong> Las pausas y las entradas verticales (plunge) queman. Usa entradas en rampa.</li>
<li><strong>Fresa afilada y para madera.</strong> Una fresa sin filo quema aunque los parámetros estén bien. Las fresas compresión sirven para dejar las dos caras limpias en tablero laminado.</li>
<li><strong>Saca la viruta.</strong> Si el canal se llena de polvo, la fresa vuelve a cortar lo mismo y calienta. Usa aspiración o aire.</li>
<li><strong>Pasadas razonables.</strong> En routers de hobby, pasadas de no más del diámetro de la fresa por pasada; en máquinas rígidas se puede más.</li>
</ul>

<h2>Láser: orilla muy negra o "flama" al cortar</h2>
<ul>
<li><strong>Asistencia de aire encendida</strong> y bien dirigida a la boquilla. Sin aire, el MDF arde.</li>
<li><strong>Más velocidad y una pasada más</strong> en lugar de una sola pasada muy lenta. El calor acumulado es lo que ennegrece.</li>
<li><strong>Enfoque correcto</strong>: con el foco mal puesto el corte se ensancha y quema más.</li>
<li><strong>Cinta de enmascarar</strong> en la cara visible evita las marcas de humo.</li>
<li>Las orillas cafés en MDF por láser son normales: es la resina quemándose. Si molestan, se lijan o se pintan.</li>
</ul>

<h2>MDF pandeado o "chueco"</h2>
<ul>
<li><strong>Guárdalo acostado</strong>, sobre una superficie plana, nunca recargado en la pared. Una lámina de pie se pandea en días.</li>
<li><strong>Déjalo aclimatar</strong> en el taller un par de días antes de cortar si llegó de una bodega húmeda.</li>
<li><strong>Sujeción</strong>: en router, tornillos o mesa de vacío en varios puntos, no sólo en las orillas. Las piezas chicas se sueltan al final del corte: usa puentes (tabs).</li>
<li>Si la lámina ya está pandeada, corta las piezas con la cara cóncava hacia abajo y sujeta al centro.</li>
</ul>

<h2>Si nada de esto funciona</h2>
<p>Cuéntalo en el foro con foto de la orilla, tu máquina, la fresa o la potencia, y los parámetros que usas. Con esos datos, otros talleres te dicen qué cambiar.</p>
<p><a href="/mx/foro-cnc/router-cnc">Preguntar en Router CNC</a> · <a href="/mx/foro-cnc/corte-laser">Preguntar en Corte láser</a> · <a href="/mx/cotizar/corte-laser">Calcular precio de corte láser en MDF</a></p>
`,
  },
  {
    slug: "cuanto-cobrar-por-un-trabajo-de-corte-cnc",
    title: "Cuánto cobrar por un trabajo de corte CNC en México: cómo armar tu precio",
    categoria: "precios-negocio",
    excerpt:
      "Un método simple para cotizar sin perder dinero: costo de hora-máquina, material con merma, diseño, acabado, mínimo por trabajo y margen. Con un ejemplo paso a paso.",
    seo_title: "Cuánto cobrar por corte CNC en México: cómo cotizar",
    seo_description:
      "Cómo calcular el precio de un trabajo de router, láser o plasma: hora-máquina, material, merma, diseño, acabado, mínimo y margen, con ejemplo.",
    content_html: `
<p>"¿Cuánto cobro por esto?" es la pregunta más común de quien empieza con su máquina. No hay un precio único: depende de tu máquina, tu zona y tus costos. Lo que sí hay es un <strong>método</strong> para no cobrar de menos.</p>

<h2>1. Calcula tu hora-máquina</h2>
<p>Es lo que te cuesta tener la máquina trabajando una hora, aunque no lo veas:</p>
<ul>
<li><strong>Depreciación</strong>: lo que costó la máquina ÷ las horas que esperas que trabaje en su vida útil.</li>
<li><strong>Luz</strong>: los kW de la máquina, el compresor y la aspiración × tu tarifa.</li>
<li><strong>Consumibles</strong>: fresas, lentes, boquillas, electrodos, gas.</li>
<li><strong>Tu tiempo</strong> mientras la máquina corta (cargar, vigilar, descargar).</li>
<li><strong>Renta y gastos fijos</strong> repartidos entre las horas que realmente trabajas al mes.</li>
</ul>
<p>Suma todo y tendrás tu costo por hora. Ese número es el piso: debajo de él, pierdes.</p>

<h2>2. Arma el precio del trabajo</h2>
<ol>
<li><strong>Tiempo de máquina</strong>: el que te da tu software CAM, más preparación (montar material, cero, cambio de herramienta).</li>
<li><strong>Material con merma</strong>: cobra la lámina que realmente usas, no sólo el área de la pieza. Una pieza puede inutilizar media hoja.</li>
<li><strong>Diseño o preparación de archivo</strong>: si el cliente no trae DXF listo, ese tiempo se cobra aparte.</li>
<li><strong>Acabado</strong>: lijado, pintura, ensamble, empaque.</li>
<li><strong>Margen</strong>: sobre todo lo anterior, la ganancia del taller.</li>
</ol>

<h2>3. Pon un mínimo por trabajo</h2>
<p>Preparar la máquina cuesta lo mismo para una pieza que para cincuenta. Un <strong>cargo mínimo</strong> evita que los trabajos chiquitos te cuesten dinero. Por eso una pieza suelta sale cara por unidad, y vale la pena explicárselo al cliente.</p>

<h2>Ejemplo (números ilustrativos)</h2>
<p>Supón que tu hora de router te cuesta $250, el trabajo lleva 40 minutos de máquina más 15 de preparación, usa media lámina de MDF de $600 y el cliente trae su DXF:</p>
<ul>
<li>Máquina: 55 min ≈ 0.92 h × $250 = $229</li>
<li>Material: ½ lámina = $300</li>
<li>Subtotal: $529</li>
<li>Margen del 35%: $185</li>
<li><strong>Precio: $714 más IVA</strong>, si estás dado de alta</li>
</ul>
<p>Cambia los números por los tuyos. Lo importante es no dejar fuera la merma, la preparación ni tu tiempo.</p>

<h2>Errores que más dinero cuestan</h2>
<ul>
<li>Cobrar sólo el "tiempo de corte" que marca el software.</li>
<li>No cobrar el diseño cuando el cliente manda una foto.</li>
<li>Bajar el precio para ganarle al de al lado, en vez de explicar qué incluye el tuyo.</li>
</ul>

<h2>Para practicar y conseguir clientes</h2>
<p>Las calculadoras de HETNA te dan un rango de referencia para láser, router, plasma e impresión 3D. Y si tienes taller, en la red te llegan solicitudes reales con material, medidas y cantidad para que cotices.</p>
<p><a href="/mx/cotizar/router-cnc">Calculadora de router CNC</a> · <a href="/mx/talleres/unete">Registrar mi taller y recibir solicitudes</a> · <a href="/mx/foro-cnc/precios-negocio">Preguntar en Precios y negocio</a></p>
`,
  },
]

export default async function sembrarGuiasBlog({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const blog = servicioBlog(container)
  let nuevas = 0
  for (const g of GUIAS) {
    const [existe] = await blog.listLearningArticles({ slug: g.slug }, { take: 1, withDeleted: true })
    if (existe) {
      logger.info(`[blog] ya existe: ${g.slug}`)
      continue
    }
    await blog.createLearningArticles({
      ...g,
      content_html: g.content_html.trim(),
      guia: true,
      autor: "Equipo HETNA",
      source: "blog",
      published_at: new Date(),
    } as any)
    nuevas += 1
    logger.info(`[blog] publicada: ${g.slug}`)
  }
  logger.info(`[blog] guías nuevas: ${nuevas}`)
}
