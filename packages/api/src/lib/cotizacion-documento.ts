// Documento de cotización con la estructura de una cotización industrial
// formal: encabezado con folio y vigencia, resumen, alcance (incluye / no
// incluye), revisión técnica, especificaciones de fabricación, tabla
// comercial, condiciones comerciales, condiciones de calidad, anexos y
// aprobación.
//
// Sale como un HTML autocontenido (sin JS, sin fuentes externas, CSS en
// línea) por dos razones: se sirve tal cual en el link público que se le manda
// al cliente, y el navegador lo imprime a PDF con @page ya configurado -- el
// mismo documento desde el celular, la web o WhatsApp, sin depender de
// Chromium en el servidor.
//
// SEGURIDAD: todo lo que escribe el taller (nombres, descripciones, notas) se
// escapa antes de entrar al HTML, porque este documento se sirve en una ruta
// pública sin sesión.

export type DocumentoPerfil = {
  nombre_comercial?: string | null
  razon_social?: string | null
  rfc?: string | null
  direccion?: string | null
  ciudad?: string | null
  estado?: string | null
  cp?: string | null
  pais?: string | null
  telefono?: string | null
  whatsapp?: string | null
  correo?: string | null
  sitio_web?: string | null
  logo_url?: string | null
  terminos_estandar?: string | null
  firma_nombre?: string | null
  firma_puesto?: string | null
}

export type DocumentoPartida = {
  posicion?: number | null
  concepto?: string | null
  descripcion?: string | null
  cantidad?: number | null
  unidad?: string | null
  precio_unitario?: number | null
  subtotal?: number | null
  material?: string | null
  proceso?: string | null
  tolerancia?: string | null
  acabado?: string | null
  setups?: number | null
  desglose?: Record<string, unknown> | null
}

export type DocumentoCotizacion = {
  folio?: string | null
  revision?: string | null
  moneda?: string | null
  fecha?: Date | string | null
  vigencia_hasta?: Date | string | null
  proyecto_referencia?: string | null
  cliente_nombre?: string | null
  cliente_empresa?: string | null
  cliente_correo?: string | null
  cliente_telefono?: string | null
  cliente_rfc?: string | null
  cliente_direccion?: string | null
  resumen_ejecutivo?: string | null
  alcance_incluye?: unknown
  alcance_no_incluye?: unknown
  supuestos?: string | null
  tecnico?: Record<string, unknown> | null
  adjuntos?: unknown
  condiciones_pago?: string | null
  anticipo_pct?: number | null
  dias_entrega?: number | null
  incoterm?: string | null
  calidad?: string | null
  subtotal?: number | null
  descuento?: number | null
  iva?: number | null
  envio?: number | null
  total?: number | null
  estatus?: string | null
}

// Etiquetas legibles para las llaves que puede traer `tecnico`. Una llave que
// no esté aquí se muestra con su nombre crudo en vez de desaparecer: más vale
// un encabezado feo que un dato técnico perdido en la cotización.
const ETIQUETAS_TECNICAS: Record<string, string> = {
  material: "Material",
  cantidad: "Cantidad",
  medidas: "Medidas",
  espesor: "Espesor",
  tolerancia_general: "Tolerancia general",
  acabado: "Acabado",
  archivo_recibido: "Archivo recibido",
  norma_aplicable: "Norma aplicable",
  uso_final: "Uso final",
  requisitos_especiales: "Requisitos especiales",
}

const ETIQUETAS_FABRICACION: Record<string, string> = {
  proceso: "Proceso de manufactura",
  maquina: "Tipo de máquina",
  sujecion: "Método de sujeción",
  herramientas: "Herramientas",
  setups: "Número de setups",
  operaciones: "Operaciones requeridas",
  inspeccion: "Inspección",
  trazabilidad: "Trazabilidad",
}

export function cotizacionDocumentoHtml(args: {
  perfil: DocumentoPerfil
  cotizacion: DocumentoCotizacion
  partidas: DocumentoPartida[]
  mostrarDesglose?: boolean
}): string {
  const { perfil, cotizacion, partidas } = args
  const moneda = (cotizacion.moneda || "MXN").toUpperCase()
  const empresa = perfil.nombre_comercial || "Taller"

  const incluye = comoLista(cotizacion.alcance_incluye)
  const noIncluye = comoLista(cotizacion.alcance_no_incluye)
  const adjuntos = comoAdjuntos(cotizacion.adjuntos)
  const tecnico = cotizacion.tecnico || {}

  const revisionTecnica = camposDe(tecnico, ETIQUETAS_TECNICAS)
  const fabricacion = camposDe(tecnico, ETIQUETAS_FABRICACION)
  const imagenes = adjuntos.filter((a) => a.tipo === "imagen" && a.url)

  let seccion = 0
  const num = () => String(++seccion).padStart(2, "0")

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cotizacion.folio || "Cotización")} — ${esc(empresa)}</title>
<style>
  @page { size: letter; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px 24px 56px;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 12px; line-height: 1.5; color: #1b1d20; background: #f4f4f3;
  }
  .hoja { max-width: 820px; margin: 0 auto; padding: 40px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  h1 { margin: 0; font-size: 21px; letter-spacing: -.01em; }
  h2 {
    margin: 0 0 10px; font-size: 10.5px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: #5d6166;
    padding-bottom: 6px; border-bottom: 1px solid #e3e4e6;
  }
  section { margin-top: 26px; }
  .cabecera { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; justify-content: space-between; padding-bottom: 20px; border-bottom: 2px solid #1b1d20; }
  .logo { max-height: 60px; max-width: 220px; }
  .meta { border-collapse: collapse; font-size: 11px; }
  .meta th { padding: 2px 10px 2px 0; text-align: left; font-weight: 400; color: #5d6166; white-space: nowrap; }
  .meta td { padding: 2px 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .partes { display: flex; flex-wrap: wrap; gap: 28px; margin-top: 22px; }
  .parte { flex: 1 1 260px; min-width: 0; }
  .parte .rol { font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: #5d6166; margin-bottom: 5px; }
  .parte .nombre { font-size: 13px; font-weight: 600; }
  .parte p { margin: 3px 0 0; color: #3f4348; }
  .dos { display: flex; flex-wrap: wrap; gap: 28px; }
  .dos > div { flex: 1 1 260px; min-width: 0; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 4px; }
  ul.no li::marker { color: #9a9ea3; }
  dl.campos { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; }
  dl.campos dt { font-size: 10px; letter-spacing: .07em; text-transform: uppercase; color: #5d6166; }
  dl.campos dd { margin: 2px 0 0; font-weight: 600; }
  table.partidas { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.partidas th { padding: 8px 8px; text-align: left; font-size: 10px; letter-spacing: .07em; text-transform: uppercase; color: #5d6166; border-bottom: 1px solid #1b1d20; }
  table.partidas td { padding: 9px 8px; border-bottom: 1px solid #ebecee; vertical-align: top; }
  table.partidas .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.partidas .desc { color: #3f4348; font-size: 11px; margin-top: 3px; }
  table.partidas .tec { color: #5d6166; font-size: 10.5px; margin-top: 3px; }
  .totales { margin-left: auto; margin-top: 14px; border-collapse: collapse; min-width: 260px; }
  .totales th { padding: 5px 16px 5px 0; text-align: left; font-weight: 400; color: #3f4348; }
  .totales td { padding: 5px 0; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .totales tr.total th, .totales tr.total td { padding-top: 10px; border-top: 2px solid #1b1d20; font-size: 15px; font-weight: 700; }
  .vence { display: inline-block; padding: 4px 10px; border: 1px solid #c8cacd; border-radius: 3px; font-size: 10.5px; color: #3f4348; }
  .figuras { display: flex; flex-wrap: wrap; gap: 14px; }
  .figuras figure { margin: 0; flex: 0 1 240px; }
  .figuras img { width: 100%; height: auto; border: 1px solid #e3e4e6; }
  .figuras figcaption { margin-top: 5px; font-size: 10.5px; color: #5d6166; }
  .firmas { display: flex; flex-wrap: wrap; gap: 40px; margin-top: 34px; }
  .firmas > div { flex: 1 1 240px; min-width: 0; }
  .linea { margin-top: 42px; padding-top: 6px; border-top: 1px solid #1b1d20; font-size: 10.5px; color: #5d6166; }
  .nota { font-size: 10.5px; line-height: 1.6; color: #5d6166; white-space: pre-line; }
  .pie { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e3e4e6; font-size: 10px; color: #80858a; }
  @media print {
    body { padding: 0; background: #fff; font-size: 10.5px; }
    .hoja { max-width: none; padding: 0; box-shadow: none; }
    section { margin-top: 18px; page-break-inside: avoid; }
    table.partidas { page-break-inside: auto; }
    table.partidas tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="hoja">

  <header class="cabecera">
    <div>
      ${perfil.logo_url ? `<img class="logo" src="${escUrl(perfil.logo_url)}" alt="${esc(empresa)}">` : `<h1>${esc(empresa)}</h1>`}
      <p style="margin: 10px 0 0; font-size: 11px; color: #3f4348">
        ${[perfil.razon_social, perfil.rfc ? `RFC ${perfil.rfc}` : null].filter(Boolean).map((t) => esc(t)).join("<br>")}
        ${perfil.razon_social || perfil.rfc ? "<br>" : ""}
        ${[direccionDe(perfil), perfil.telefono, perfil.correo, perfil.sitio_web].filter(Boolean).map((t) => esc(t)).join("<br>")}
      </p>
    </div>
    <div>
      <h1 style="margin-bottom: 10px; text-align: right">Cotización</h1>
      <table class="meta">
        <tr><th>Folio</th><td>${esc(cotizacion.folio || "—")}</td></tr>
        <tr><th>Revisión</th><td>${esc(cotizacion.revision || "A")}</td></tr>
        <tr><th>Fecha</th><td>${esc(fechaLarga(cotizacion.fecha))}</td></tr>
        <tr><th>Vigencia</th><td>${esc(fechaLarga(cotizacion.vigencia_hasta))}</td></tr>
        <tr><th>Moneda</th><td>${esc(moneda)}</td></tr>
        ${cotizacion.proyecto_referencia ? `<tr><th>Proyecto</th><td>${esc(cotizacion.proyecto_referencia)}</td></tr>` : ""}
      </table>
    </div>
  </header>

  <div class="partes">
    <div class="parte">
      <div class="rol">Cliente</div>
      <div class="nombre">${esc(cotizacion.cliente_empresa || cotizacion.cliente_nombre || "—")}</div>
      <p>${[
        cotizacion.cliente_empresa ? cotizacion.cliente_nombre : null,
        cotizacion.cliente_rfc ? `RFC ${cotizacion.cliente_rfc}` : null,
        cotizacion.cliente_direccion,
        cotizacion.cliente_telefono,
        cotizacion.cliente_correo,
      ]
        .filter(Boolean)
        .map((t) => esc(t))
        .join("<br>")}</p>
    </div>
    <div class="parte">
      <div class="rol">Contacto comercial</div>
      <div class="nombre">${esc(perfil.firma_nombre || empresa)}</div>
      <p>${[perfil.firma_puesto, perfil.telefono, perfil.whatsapp ? `WhatsApp ${perfil.whatsapp}` : null, perfil.correo]
        .filter(Boolean)
        .map((t) => esc(t))
        .join("<br>")}</p>
    </div>
  </div>

  ${
    cotizacion.resumen_ejecutivo
      ? `<section>
    <h2>${num()} · Resumen ejecutivo</h2>
    <p class="nota" style="font-size: 12px; color: #1b1d20">${esc(cotizacion.resumen_ejecutivo)}</p>
  </section>`
      : ""
  }

  ${
    incluye.length || noIncluye.length || cotizacion.supuestos
      ? `<section>
    <h2>${num()} · Alcance del trabajo</h2>
    <div class="dos">
      ${incluye.length ? `<div><div class="rol" style="font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#5d6166;margin-bottom:6px">Incluye</div><ul>${incluye.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${noIncluye.length ? `<div><div class="rol" style="font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#5d6166;margin-bottom:6px">No incluye</div><ul class="no">${noIncluye.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
    </div>
    ${cotizacion.supuestos ? `<p class="nota" style="margin-top: 14px"><strong>Supuestos:</strong> ${esc(cotizacion.supuestos)}</p>` : ""}
  </section>`
      : ""
  }

  ${
    revisionTecnica.length
      ? `<section>
    <h2>${num()} · Revisión técnica del requerimiento</h2>
    <dl class="campos">${revisionTecnica.map((c) => `<div><dt>${esc(c.etiqueta)}</dt><dd>${esc(c.valor)}</dd></div>`).join("")}</dl>
  </section>`
      : ""
  }

  ${
    imagenes.length
      ? `<section>
    <h2>${num()} · Referencia visual</h2>
    <div class="figuras">${imagenes
      .map(
        (a) =>
          `<figure><img src="${escUrl(a.url)}" alt="${esc(a.nombre || "Referencia de la pieza")}">${a.nombre ? `<figcaption>${esc(a.nombre)}</figcaption>` : ""}</figure>`
      )
      .join("")}</div>
  </section>`
      : ""
  }

  ${
    fabricacion.length
      ? `<section>
    <h2>${num()} · Especificaciones de fabricación</h2>
    <dl class="campos">${fabricacion.map((c) => `<div><dt>${esc(c.etiqueta)}</dt><dd>${esc(c.valor)}</dd></div>`).join("")}</dl>
  </section>`
      : ""
  }

  <section>
    <h2>${num()} · Detalle comercial</h2>
    <table class="partidas">
      <thead>
        <tr>
          <th style="width: 32px">#</th>
          <th>Concepto</th>
          <th class="n" style="width: 70px">Cant.</th>
          <th style="width: 54px">Unidad</th>
          <th class="n" style="width: 100px">P. unitario</th>
          <th class="n" style="width: 110px">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${partidas
          .map((p, i) => {
            const tec = [
              p.material ? `Material: ${p.material}` : null,
              p.proceso ? `Proceso: ${p.proceso}` : null,
              p.tolerancia ? `Tolerancia: ${p.tolerancia}` : null,
              p.acabado ? `Acabado: ${p.acabado}` : null,
              typeof p.setups === "number" ? `Setups: ${p.setups}` : null,
            ].filter(Boolean) as string[]
            const desglose = args.mostrarDesglose ? desgloseLegible(p.desglose) : []
            return `<tr>
          <td class="n" style="text-align:left">${esc(String(p.posicion ?? i + 1))}</td>
          <td>
            <strong>${esc(p.concepto || "—")}</strong>
            ${p.descripcion ? `<div class="desc">${esc(p.descripcion)}</div>` : ""}
            ${tec.length ? `<div class="tec">${tec.map((t) => esc(t)).join(" · ")}</div>` : ""}
            ${desglose.length ? `<div class="tec">Costos: ${desglose.map((d) => `${esc(d.etiqueta)} ${esc(dinero(d.valor, moneda))}`).join(" · ")}</div>` : ""}
          </td>
          <td class="n">${esc(numero(p.cantidad ?? 1))}</td>
          <td>${esc(p.unidad || "pza")}</td>
          <td class="n">${esc(dinero(p.precio_unitario ?? 0, moneda))}</td>
          <td class="n">${esc(dinero(p.subtotal ?? 0, moneda))}</td>
        </tr>`
          })
          .join("")}
      </tbody>
    </table>

    <table class="totales">
      <tr><th>Subtotal</th><td>${esc(dinero(cotizacion.subtotal ?? 0, moneda))}</td></tr>
      ${cotizacion.descuento ? `<tr><th>Descuento</th><td>− ${esc(dinero(cotizacion.descuento, moneda))}</td></tr>` : ""}
      ${cotizacion.envio ? `<tr><th>Envío</th><td>${esc(dinero(cotizacion.envio, moneda))}</td></tr>` : ""}
      <tr><th>IVA</th><td>${cotizacion.iva ? esc(dinero(cotizacion.iva, moneda)) : "No incluido"}</td></tr>
      <tr class="total"><th>Total ${esc(moneda)}</th><td>${esc(dinero(cotizacion.total ?? 0, moneda))}</td></tr>
    </table>
  </section>

  <section>
    <h2>${num()} · Condiciones comerciales</h2>
    <dl class="campos">
      ${cotizacion.condiciones_pago ? `<div><dt>Forma de pago</dt><dd>${esc(cotizacion.condiciones_pago)}</dd></div>` : ""}
      ${typeof cotizacion.anticipo_pct === "number" ? `<div><dt>Anticipo</dt><dd>${esc(numero(cotizacion.anticipo_pct))} %</dd></div>` : ""}
      ${typeof cotizacion.dias_entrega === "number" ? `<div><dt>Tiempo de entrega</dt><dd>${esc(numero(cotizacion.dias_entrega))} días hábiles</dd></div>` : ""}
      ${cotizacion.incoterm ? `<div><dt>Incoterm</dt><dd>${esc(cotizacion.incoterm)}</dd></div>` : ""}
      <div><dt>Vigencia de la oferta</dt><dd>${esc(fechaLarga(cotizacion.vigencia_hasta))}</dd></div>
      <div><dt>Moneda</dt><dd>${esc(moneda)}</dd></div>
    </dl>
    <p class="nota" style="margin-top: 14px">Un cambio en el diseño, el material o la cantidad puede modificar el precio y el tiempo de entrega. Los precios son firmes dentro de la vigencia indicada.</p>
  </section>

  ${
    cotizacion.calidad
      ? `<section>
    <h2>${num()} · Condiciones técnicas y de calidad</h2>
    <p class="nota" style="font-size: 12px; color: #1b1d20">${esc(cotizacion.calidad)}</p>
  </section>`
      : ""
  }

  ${
    adjuntos.length
      ? `<section>
    <h2>${num()} · Anexos</h2>
    <ul>${adjuntos.map((a) => `<li>${a.url ? `<a href="${escUrl(a.url)}">${esc(a.nombre || a.url)}</a>` : esc(a.nombre || "Anexo")}</li>`).join("")}</ul>
  </section>`
      : ""
  }

  ${
    perfil.terminos_estandar
      ? `<section>
    <h2>${num()} · Términos y condiciones</h2>
    <p class="nota">${esc(perfil.terminos_estandar)}</p>
  </section>`
      : ""
  }

  <section>
    <h2>${num()} · Aprobación</h2>
    <p class="nota">La aceptación de esta cotización implica la conformidad con el alcance, las condiciones comerciales y las condiciones técnicas descritas en este documento.</p>
    <div class="firmas">
      <div>
        <div class="linea">Por ${esc(empresa)} — ${esc(perfil.firma_nombre || "nombre y firma")}${perfil.firma_puesto ? `, ${esc(perfil.firma_puesto)}` : ""}</div>
      </div>
      <div>
        <div class="linea">Aceptación del cliente — nombre, firma y fecha</div>
      </div>
    </div>
  </section>

  <div class="pie">
    ${esc(cotizacion.folio || "")}${cotizacion.revision ? ` Rev ${esc(cotizacion.revision)}` : ""} · ${esc(empresa)} · Documento generado el ${esc(fechaLarga(new Date()))}
  </div>
</div>
</body>
</html>`
}

function direccionDe(perfil: DocumentoPerfil): string | null {
  const partes = [perfil.direccion, perfil.ciudad, perfil.estado, perfil.cp, perfil.pais].filter(Boolean)
  return partes.length ? partes.join(", ") : null
}

function comoLista(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.map((v) => String(v)).filter((v) => v.trim().length > 0)
  }
  if (typeof valor === "string" && valor.trim()) {
    return valor
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

type Adjunto = { nombre?: string; url?: string; tipo?: string }

function comoAdjuntos(valor: unknown): Adjunto[] {
  if (!Array.isArray(valor)) {
    return []
  }
  return valor
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === "object")
    .map((a) => ({
      nombre: a.nombre ? String(a.nombre) : undefined,
      url: a.url ? String(a.url) : undefined,
      tipo: a.tipo ? String(a.tipo) : undefined,
    }))
}

function camposDe(
  tecnico: Record<string, unknown>,
  etiquetas: Record<string, string>
): { etiqueta: string; valor: string }[] {
  const campos: { etiqueta: string; valor: string }[] = []
  for (const [clave, etiqueta] of Object.entries(etiquetas)) {
    const valor = tecnico[clave]
    if (valor === null || valor === undefined || valor === "") {
      continue
    }
    campos.push({ etiqueta, valor: Array.isArray(valor) ? valor.join(", ") : String(valor) })
  }
  // Llaves que el taller mandó y no están en el catálogo: se muestran igual.
  const conocidas = new Set([...Object.keys(ETIQUETAS_TECNICAS), ...Object.keys(ETIQUETAS_FABRICACION)])
  if (etiquetas === ETIQUETAS_TECNICAS) {
    for (const [clave, valor] of Object.entries(tecnico)) {
      if (conocidas.has(clave) || valor === null || valor === undefined || valor === "") {
        continue
      }
      campos.push({
        etiqueta: clave.replace(/_/g, " "),
        valor: Array.isArray(valor) ? valor.join(", ") : String(valor),
      })
    }
  }
  return campos
}

function desgloseLegible(desglose: Record<string, unknown> | null | undefined): { etiqueta: string; valor: number }[] {
  if (!desglose || typeof desglose !== "object") {
    return []
  }
  return Object.entries(desglose)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => ({ etiqueta: k, valor: v as number }))
}

function dinero(n: number, moneda: string): string {
  const valor = Number(n) || 0
  return `${valor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

function numero(n: number): string {
  const valor = Number(n) || 0
  return valor.toLocaleString("es-MX", { maximumFractionDigits: 3 })
}

function fechaLarga(d: Date | string | null | undefined): string {
  if (!d) {
    return "—"
  }
  const fecha = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(fecha.getTime())) {
    return "—"
  }
  return fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Sólo http(s) y data:image. Un logo o anexo con `javascript:` sería XSS en un
// documento que se sirve sin sesión.
function escUrl(v: unknown): string {
  const url = String(v ?? "").trim()
  if (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) {
    return esc(url)
  }
  return ""
}
