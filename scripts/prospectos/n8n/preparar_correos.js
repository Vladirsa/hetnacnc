// Nodo Code "Preparar correos del día" (n8n, Run Once for All Items).
// Entrada: todas las filas de la hoja de prospectos. Salida: los correos que
// tocan hoy (máx. LIMITE), cada uno con el asunto, el HTML y los valores
// nuevos de control que se escriben de vuelta en la hoja.
//
// Secuencia: paso 1 (presentación) -> +4 días paso 2 -> +6 días paso 3
// -> pausa 60 días -> paso 4 -> desde ahí una novedad al mes (paso 5, 6, …)
// hasta que se registre, responda o pida su baja (decidido por Vlado el 19 nov
// 2026). Nunca escribe a REGISTRADO, BAJA, RESPONDIO, REBOTE, SIN_EMAIL ni ERROR.
// Los FINALIZADO de antes (paso 4) entran a las novedades 30 días después.
//
// Pruebas A/B/C: en español, el correo 1 (y el 2 de talleres) tiene varias
// versiones. A cada empresa le toca siempre la misma (según su id) y la liga
// lleva la versión en utm_campaign (vendedor_p1b…) para medir cuál funciona.
// Desde el correo 3 va la encuesta de un clic "¿por qué no se registran?"
// (flujo «Prospectos HETNA - Opinión», webhook hetna-prospectos-opinion).

const LIMITE = 40;
const SITIO = 'https://www.hetnacnc.com';
const BAJA = 'https://n8n.hetnacnc.com/webhook/hetna-prospectos-baja';
const DOMICILIO = 'HETNA CNC · Col. Centro, Apizaco, Tlaxcala, México';
const ESPERA = { 1: 4, 2: 6, 3: 60 };
const MENSUAL = 30;
const OPINION = 'https://n8n.hetnacnc.com/webhook/hetna-prospectos-opinion';
const NO_TOCAR = ['REGISTRADO', 'BAJA', 'RESPONDIO', 'REBOTE', 'SIN_EMAIL', 'ERROR'];

const hoy = $now.setZone('America/Mexico_City').startOf('day');
const HOY = hoy.toISODate();
const masDias = (n) => hoy.plus({ days: n }).toISODate();
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function segmento(tipo) {
  if (tipo === 'Instructor/Capacitación') return 'instructor';
  if (tipo === 'Cliente comprador' || tipo === 'Servicios CNC') return 'comprador';
  return 'vendedor'; // Taller (cliente y vendedor), Proveedor
}

// Ejemplos según el giro del prospecto (la búsqueda que lo encontró), para
// que el correo al comprador hable de lo que ellos fabrican.
function ejemplosComprador(r) {
  const g = String((r.segmento || '') + ' ' + (r.productos_servicios || '')).toLowerCase();
  if (/mueble|cocina|carpinter|closet/.test(g)) return { asunto: 'corte CNC de MDF y piezas para muebles con talleres de su zona', para: 'cortar tableros, frentes, celosías y piezas de muebles en MDF, triplay o acrílico', corto: 'frentes, celosías, piezas de MDF' };
  if (/arquitect|interior|construc|fachada|acabado/.test(g)) return { asunto: 'celosías, fachadas y letreros cortados en CNC', para: 'celosías, paneles decorativos, fachadas, letreros y piezas metálicas a la medida para sus obras', corto: 'celosías, paneles, letreros' };
  if (/pop|exhibidor|stand|exposici|publicidad|señal|letrero|rotul/.test(g)) return { asunto: 'exhibidores, letreros y stands con talleres CNC', para: 'exhibidores, letreros corpóreos, señalética y piezas para stands en acrílico, MDF, PVC o metal', corto: 'exhibidores, letreros, piezas de stand' };
  if (/manten|refacci|maquinaria|equipo industrial|molde|troquel/.test(g)) return { asunto: 'refacciones y piezas maquinadas en CNC a la medida', para: 'refacciones, piezas maquinadas en torno o fresadora y cortes de placa para mantenimiento y producción', corto: 'refacciones, piezas maquinadas, placas' };
  return { asunto: 'cortes láser, router y maquinados CNC con talleres verificados', para: 'piezas, letreros, prototipos y producción por lote', corto: 'piezas, letreros, prototipos' };
}

// Versión de la prueba A/B/C que le toca a esta empresa (siempre la misma)
function variante(id, n) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h % n;
}

function liga(ruta, r, paso) {
  const utm = 'utm_source=correo&utm_medium=prospeccion&utm_campaign=' + segmento(r.tipo) + '_p' + paso + (r._v || '');
  return SITIO + ruta + (ruta.includes('?') ? '&' : '?') + utm;
}

function boton(url, texto) {
  return '<p style="margin:24px 0"><a href="' + url + '" style="background:#f97316;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">' + texto + '</a></p>';
}

function tablaComision(idioma) {
  const td = 'style="padding:8px;border:1px solid #e5e7eb"';
  if (idioma === 'en') {
    return '<table style="border-collapse:collapse;font-size:14px;margin:12px 0">' +
      '<tr><th ' + td + '>On a $1,000 sale</th><th ' + td + '>Marketplace fee</th></tr>' +
      '<tr><td ' + td + '>Typical marketplaces (8%–20% + monthly plan)</td><td ' + td + '>$80 – $200 + monthly fee</td></tr>' +
      '<tr><td ' + td + '><b>HETNA CNC</b> (6%, 5% on CNC machines, free listing)</td><td ' + td + '><b>$60</b></td></tr></table>';
  }
  if (idioma === 'pt') {
    return '<table style="border-collapse:collapse;font-size:14px;margin:12px 0">' +
      '<tr><th ' + td + '>Venda de R$ 1.000</th><th ' + td + '>Comissão</th></tr>' +
      '<tr><td ' + td + '>Marketplaces tradicionais (10%–20% + taxas)</td><td ' + td + '>R$ 100 – R$ 200 + taxas</td></tr>' +
      '<tr><td ' + td + '><b>HETNA CNC</b> (6%, 5% em máquinas, anúncio grátis)</td><td ' + td + '><b>R$ 60</b></td></tr></table>';
  }
  return '<table style="border-collapse:collapse;font-size:14px;margin:12px 0">' +
    '<tr><th ' + td + '>Venta de $10,000 MXN</th><th ' + td + '>Te cobran aprox.</th></tr>' +
    '<tr><td ' + td + '>Mercado Libre (Premium: 12.5%–20.5% según categoría)</td><td ' + td + '>$1,250 – $2,050</td></tr>' +
    '<tr><td ' + td + '>Amazon (8%–20% + $600/mes del plan profesional)</td><td ' + td + '>$1,400 – $2,600</td></tr>' +
    '<tr><td ' + td + '><b>HETNA CNC</b> (6%; 5% en máquinas CNC; publicar es gratis)</td><td ' + td + '><b>$600</b></td></tr></table>' +
    '<p style="font-size:12px;color:#6b7280">Comisiones de referencia publicadas por cada plataforma; varían por categoría y pueden cambiar.</p>';
}

const T = {
  es: {
    hola: (e) => 'Hola, equipo de ' + e + ':',
    firma: 'Saludos,<br>Equipo HETNA CNC<br><a href="' + SITIO + '">hetnacnc.com</a> · WhatsApp +52 221 707 6014',
    pie: (u) => 'Te escribimos porque tu empresa publica este correo como contacto comercial. Si no quieres recibir más mensajes, <a href="' + u + '">date de baja aquí</a> y no volveremos a escribirte. No compartimos ni vendemos tus datos.',
    vendedor: {
      1: (r) => ({
        asunto: r.empresa + ': vende en línea pagando sólo 6% de comisión',
        cuerpo: '<p>Vimos su trabajo' + (r.productos_servicios ? ' (' + esc(r.productos_servicios) + ')' : '') + ' y creemos que encaja en <b>HETNA CNC</b>, el marketplace mexicano 100% especializado en CNC: máquinas, herramientas, refacciones, piezas, servicios, archivos y cursos.</p>' +
          '<p>Publicar es <b>gratis</b> y sólo pagan comisión cuando venden. Comparado con otros marketplaces:</p>' + tablaComision('es') +
          '<p>Además reciben <b>solicitudes de cotización y licitaciones de fabricación</b> de clientes que buscan justo lo que ustedes hacen (sin comisión).</p>' +
          '<p><b>Importante:</b> cada taller vende con su propio nombre y <b>emite su factura (CFDI) directamente a su cliente</b>.</p>' +
          boton(liga('/talleres/unete', r, 1), 'Abrir mi tienda gratis'),
      }),
      2: (r) => ({
        asunto: '¿Cuánto les queda de cada venta, ' + r.empresa + '?',
        cuerpo: '<p>Les escribí hace unos días. Un dato rápido: en una venta de $10,000 MXN, en HETNA pagan $600 de comisión; en otros marketplaces pueden pagar más de $1,500 o $2,000, más mensualidades.</p>' +
          '<p>Dar de alta su tienda toma unos minutos: suben sus productos, fijan sus precios y empiezan a recibir pedidos y cotizaciones de todo México.</p>' +
          boton(liga('/talleres/unete', r, 2), 'Ver cómo funciona'),
      }),
      3: (r) => ({
        asunto: 'Último aviso: lugares de talleres fundadores en HETNA',
        cuerpo: '<p>No quiero llenar su bandeja, así que éste es el último correo por ahora.</p>' +
          '<p>Estamos sumando talleres y proveedores fundadores por región. Si quieren vender sus productos y servicios de CNC con comisiones bajas, aquí pueden registrarse:</p>' +
          boton(liga('/talleres/fundadores', r, 3), 'Quiero ser taller fundador') +
          '<p>Si prefieren platicarlo, respondan este correo o escríbannos por WhatsApp.</p>',
      }),
      4: (r) => ({
        asunto: r.empresa + ', ¿lo retomamos?',
        cuerpo: '<p>Hace un par de meses les contamos de HETNA CNC. Desde entonces se han sumado más talleres y clientes que buscan piezas, maquinados y herramientas.</p>' +
          '<p>Si ahora es buen momento para vender en línea pagando sólo 6% de comisión, su tienda sigue siendo gratis:</p>' +
          boton(liga('/talleres/unete', r, 4), 'Abrir mi tienda gratis'),
      }),
    },
    instructor: {
      1: (r) => ({
        asunto: r.empresa + ': publica tus cursos de CNC en la Academia HETNA',
        cuerpo: '<p>Vimos tus cursos' + (r.productos_servicios ? ' (' + esc(r.productos_servicios) + ')' : '') + ' y nos encantaría tenerlos en la <b>Academia HETNA CNC</b>, donde miles de operadores, talleres y estudiantes buscan capacitación en CNC, CAD/CAM y programación.</p>' +
          '<ul><li>Publicar cursos, libros y asesorías es gratis; sólo pagas comisión cuando vendes.</li><li>Llegas a talleres de México y Latinoamérica que ya compran herramientas y máquinas en la plataforma.</li><li>Cobro en línea y tus alumnos en un solo lugar.</li></ul>' +
          '<p><b>Importante:</b> cada instructor emite su propia factura a sus alumnos.</p>' +
          boton(liga('/talleres/unete', r, 1), 'Publicar mis cursos'),
      }),
      2: (r) => ({
        asunto: 'Tus alumnos ya están buscando cursos de CNC',
        cuerpo: '<p>Te escribí hace unos días sobre la Academia HETNA. Los talleres que compran en HETNA necesitan capacitar a su gente: un curso tuyo frente a ese público puede venderse todos los meses.</p>' +
          boton(liga('/aprendizaje-cnc/cursos', r, 2), 'Ver la Academia'),
      }),
      3: (r) => ({
        asunto: 'Último correo: instructores fundadores de la Academia HETNA',
        cuerpo: '<p>Éste es el último correo por ahora. Si te interesa ser de los primeros instructores en la Academia HETNA CNC, regístrate aquí o respóndenos y te ayudamos a subir tu primer curso:</p>' +
          boton(liga('/talleres/unete', r, 3), 'Quiero publicar mis cursos'),
      }),
      4: (r) => ({
        asunto: '¿Retomamos lo de tus cursos de CNC?',
        cuerpo: '<p>Hace unos meses te invitamos a la Academia HETNA CNC. Si ahora es buen momento, publicar sigue siendo gratis:</p>' +
          boton(liga('/talleres/unete', r, 4), 'Publicar mis cursos'),
      }),
    },
    comprador: {
      1: (r) => ({
        asunto: r.empresa + ': ' + ejemplosComprador(r).asunto,
        cuerpo: '<p>Les escribo de <b>HETNA CNC</b>, la red mexicana de talleres CNC (router, láser, plasma, torno y fresadora). Pensamos que les puede servir para ' + ejemplosComprador(r).para + '.</p>' +
          '<ul><li><b>Precio aproximado al momento:</b> en la página de cotizar o mandando las medidas por WhatsApp al +52 221 707 6014.</li>' +
          '<li><b>Varias propuestas:</b> suben su plano o foto y los talleres de la red les cotizan; ustedes eligen.</li>' +
          '<li><b>Pago seguro:</b> pagan con Mercado Pago dentro de HETNA y el taller empieza cuando el pago está confirmado; cada taller les factura (CFDI).</li></ul>' +
          '<p>Pedir cotización no tiene costo para ustedes.</p>' +
          boton(liga('/cotizar', r, 1), 'Ver un precio aproximado'),
      }),
      2: (r) => ({
        asunto: '¿Tienen alguna pieza o proyecto por fabricar este mes?',
        cuerpo: '<p>Retomo mi correo anterior. Si tienen algo por fabricar (' + ejemplosComprador(r).corto + '), manden las medidas, el material y la cantidad, y les damos un precio aproximado en minutos.</p>' +
          '<p>Si les conviene, varios talleres verificados de la red les mandan su propuesta formal.</p>' +
          boton(liga('/cotizar', r, 2), 'Cotizar mi proyecto'),
      }),
      3: (r) => ({
        asunto: 'Último correo de HETNA CNC',
        cuerpo: '<p>Éste es el último correo por ahora. Cuando necesiten cortar, grabar o maquinar algo, guarden esta liga o escríbannos por WhatsApp al +52 221 707 6014:</p>' +
          boton(liga('/cotizar', r, 3), 'Guardar HETNA CNC'),
      }),
      4: (r) => ({
        asunto: r.empresa + ': novedades en HETNA CNC',
        cuerpo: '<p>Hace unos meses les presentamos HETNA CNC. Hoy tenemos más talleres, herramientas y servicios. Si tienen un proyecto, pidan su cotización:</p>' +
          boton(liga('/cotizar', r, 4), 'Pedir una cotización'),
      }),
    },
  },
  en: {
    hola: (e) => 'Hi ' + e + ' team,',
    firma: 'Best regards,<br>HETNA CNC team<br><a href="' + SITIO + '">hetnacnc.com</a> · WhatsApp +52 221 707 6014',
    pie: (u) => 'We are contacting you because your company lists this address as a business contact. If you do not want more emails, <a href="' + u + '">unsubscribe here</a> and we will not write again. We never share or sell your data.',
    vendedor: {
      1: (r) => ({
        asunto: r.empresa + ': sell CNC products into Mexico & LatAm for a 6% fee',
        cuerpo: '<p>We came across ' + esc(r.empresa) + ' and think you would be a great fit for <b>HETNA CNC</b>, a marketplace 100% focused on CNC: machines, tooling, spare parts, machined parts, services and training, with buyers across Mexico and Latin America.</p>' +
          '<p>Listing is <b>free</b> and you only pay when you sell:</p>' + tablaComision('en') +
          '<p>You also receive <b>quote requests and manufacturing tenders</b> from buyers looking for exactly what you do. Each seller sells under its own name and invoices its customers directly.</p>' +
          boton(liga('/talleres/unete', r, 1), 'Open my free store'),
      }),
      2: (r) => ({ asunto: 'Quick follow-up, ' + r.empresa, cuerpo: '<p>Following up on my last email: Mexico imports billions in CNC tooling and services every year, and HETNA connects you with those buyers for a 6% fee and no monthly plan.</p>' + boton(liga('/talleres/unete', r, 2), 'See how it works') }),
      3: (r) => ({ asunto: 'Last note from HETNA CNC', cuerpo: '<p>This is my last email for now. If you would like to reach CNC buyers in Mexico and LatAm, you can join here or simply reply:</p>' + boton(liga('/talleres/unete', r, 3), 'Join HETNA CNC') }),
      4: (r) => ({ asunto: r.empresa + ', worth another look?', cuerpo: '<p>A couple of months ago we told you about HETNA CNC. More buyers have joined since then. Your store is still free:</p>' + boton(liga('/talleres/unete', r, 4), 'Open my free store') }),
    },
    instructor: {
      1: (r) => ({ asunto: r.empresa + ': publish your CNC courses on HETNA Academy', cuerpo: '<p>We would love to feature your CNC training on the <b>HETNA CNC Academy</b>, reaching machine shops and students across Mexico and Latin America. Publishing is free; you only pay a commission when you sell, and you invoice your students directly.</p>' + boton(liga('/talleres/unete', r, 1), 'Publish my courses') }),
      2: (r) => ({ asunto: 'Shops on HETNA need trained operators', cuerpo: '<p>Following up: the shops buying on HETNA need to train their people. Your course in front of that audience can sell every month.</p>' + boton(liga('/aprendizaje-cnc/cursos', r, 2), 'See the Academy') }),
      3: (r) => ({ asunto: 'Last note: founding instructors at HETNA Academy', cuerpo: '<p>Last email for now. If you want to be one of our first instructors, sign up here or reply and we will help you upload your first course:</p>' + boton(liga('/talleres/unete', r, 3), 'Publish my courses') }),
      4: (r) => ({ asunto: 'Your CNC courses on HETNA?', cuerpo: '<p>A few months ago we invited you to the HETNA CNC Academy. Publishing is still free:</p>' + boton(liga('/talleres/unete', r, 4), 'Publish my courses') }),
    },
    comprador: {
      1: (r) => ({ asunto: r.empresa + ': CNC tooling, parts and machining in one place', cuerpo: '<p><b>HETNA CNC</b> brings together CNC shops and suppliers across Mexico: tooling, spare parts, machines, custom machining, laser/plasma cutting and training. Request quotes or post a manufacturing tender and get proposals from several shops.</p>' + boton(liga('/cotizar', r, 1), 'Request a quote') }),
      2: (r) => ({ asunto: 'Need a part machined this month?', cuerpo: '<p>Post what you need (drawings, quantities, material) and HETNA shops will send you proposals at no cost.</p>' + boton(liga('/cotizar', r, 2), 'Post my project') }),
      3: (r) => ({ asunto: 'Last note from HETNA CNC', cuerpo: '<p>Last email for now. Whenever you need CNC tooling, parts or machining, we are here:</p>' + boton(liga('/', r, 3), 'Visit HETNA CNC') }),
      4: (r) => ({ asunto: 'What is new at HETNA CNC', cuerpo: '<p>We have more shops, tooling and services than when we last wrote. Have a project? Request a quote:</p>' + boton(liga('/cotizar', r, 4), 'Request a quote') }),
    },
  },
  pt: {
    hola: (e) => 'Olá, equipe ' + e + ',',
    firma: 'Abraços,<br>Equipe HETNA CNC<br><a href="' + SITIO + '">hetnacnc.com</a> · WhatsApp +52 221 707 6014',
    pie: (u) => 'Escrevemos porque sua empresa publica este e-mail como contato comercial. Se não quiser receber mais mensagens, <a href="' + u + '">descadastre-se aqui</a> e não voltaremos a escrever. Não compartilhamos nem vendemos seus dados.',
    vendedor: {
      1: (r) => ({ asunto: r.empresa + ': venda produtos CNC na América Latina com 6% de comissão', cuerpo: '<p>Conhecemos o trabalho da ' + esc(r.empresa) + ' e achamos que combina com a <b>HETNA CNC</b>, marketplace 100% focado em CNC: máquinas, ferramentas, peças, usinagem, serviços e cursos, com compradores no México e na América Latina.</p><p>Anunciar é <b>grátis</b> e você só paga quando vende:</p>' + tablaComision('pt') + '<p>Cada vendedor vende com o próprio nome e emite a nota fiscal diretamente ao seu cliente.</p>' + boton(liga('/talleres/unete', r, 1), 'Abrir minha loja grátis') }),
      2: (r) => ({ asunto: 'Acompanhamento rápido, ' + r.empresa, cuerpo: '<p>Retomando meu último e-mail: na HETNA você paga 6% por venda, sem mensalidade, e recebe pedidos de orçamento de compradores que buscam exatamente o que você faz.</p>' + boton(liga('/talleres/unete', r, 2), 'Ver como funciona') }),
      3: (r) => ({ asunto: 'Último e-mail da HETNA CNC', cuerpo: '<p>Este é o último e-mail por enquanto. Se quiser vender para compradores de CNC no México e na América Latina, cadastre-se aqui ou responda:</p>' + boton(liga('/talleres/unete', r, 3), 'Entrar na HETNA CNC') }),
      4: (r) => ({ asunto: r.empresa + ', vamos retomar?', cuerpo: '<p>Há alguns meses falamos da HETNA CNC. Sua loja continua grátis:</p>' + boton(liga('/talleres/unete', r, 4), 'Abrir minha loja grátis') }),
    },
    instructor: {
      1: (r) => ({ asunto: r.empresa + ': publique seus cursos de CNC na Academia HETNA', cuerpo: '<p>Adoraríamos ter seus cursos na <b>Academia HETNA CNC</b>, com alunos e oficinas de toda a América Latina. Publicar é grátis; você só paga comissão quando vende e emite a nota diretamente aos alunos.</p>' + boton(liga('/talleres/unete', r, 1), 'Publicar meus cursos') }),
      2: (r) => ({ asunto: 'Oficinas precisam de operadores treinados', cuerpo: '<p>Retomando: as oficinas que compram na HETNA precisam treinar suas equipes. Seu curso pode vender todo mês.</p>' + boton(liga('/aprendizaje-cnc/cursos', r, 2), 'Ver a Academia') }),
      3: (r) => ({ asunto: 'Último e-mail: instrutores fundadores', cuerpo: '<p>Último e-mail por enquanto. Quer ser um dos primeiros instrutores? Cadastre-se ou responda e ajudamos com o primeiro curso:</p>' + boton(liga('/talleres/unete', r, 3), 'Publicar meus cursos') }),
      4: (r) => ({ asunto: 'Seus cursos de CNC na HETNA?', cuerpo: '<p>Há alguns meses convidamos você para a Academia HETNA CNC. Publicar continua grátis:</p>' + boton(liga('/talleres/unete', r, 4), 'Publicar meus cursos') }),
    },
    comprador: {
      1: (r) => ({ asunto: r.empresa + ': ferramentas, peças e usinagem CNC em um só lugar', cuerpo: '<p>A <b>HETNA CNC</b> reúne oficinas e fornecedores de CNC: ferramentas, peças, máquinas, usinagem sob medida, corte a laser/plasma e cursos. Peça orçamentos e receba propostas de várias oficinas.</p>' + boton(liga('/cotizar', r, 1), 'Pedir orçamento') }),
      2: (r) => ({ asunto: 'Precisa usinar uma peça este mês?', cuerpo: '<p>Publique o que precisa (desenhos, quantidades, material) e as oficinas da HETNA enviam propostas sem custo.</p>' + boton(liga('/cotizar', r, 2), 'Publicar meu projeto') }),
      3: (r) => ({ asunto: 'Último e-mail da HETNA CNC', cuerpo: '<p>Último e-mail por enquanto. Quando precisar de ferramentas, peças ou usinagem CNC, estamos aqui:</p>' + boton(liga('/', r, 3), 'Visitar a HETNA CNC') }),
      4: (r) => ({ asunto: 'Novidades na HETNA CNC', cuerpo: '<p>Temos mais oficinas, ferramentas e serviços. Tem um projeto? Peça orçamento:</p>' + boton(liga('/cotizar', r, 4), 'Pedir orçamento') }),
    },
  },
};

// Versiones B y C (español) para medir qué mensaje funciona mejor. La A es la de T.
const VARIANTES = {
  vendedor: {
    1: [
      (r) => ({
        asunto: r.empresa + ': clientes que buscan talleres en ' + (r.ciudad || 'su zona'),
        cuerpo: '<p>En <b>HETNA CNC</b> los clientes publican lo que necesitan fabricar (pieza, material, medidas y archivo) y la solicitud les llega a los talleres de su zona. Ustedes cotizan sólo lo que les conviene.</p>' +
          '<ul><li>Registrarse y publicar es gratis; sólo pagan 6% cuando venden.</li><li>Cobran protegido con Mercado Pago y facturan directo a su cliente.</li>' +
          '<li>Los primeros 30 talleres verificados quedan como <b>Taller fundador</b>: insignia para siempre y 6 meses del plan Pro gratis.</li></ul>' +
          boton(liga('/talleres/unete', r, 1), 'Quiero recibir solicitudes'),
      }),
      (r) => ({
        asunto: 'Pregunta rápida, ' + r.empresa,
        cuerpo: '<p>Soy Vladimir, de HETNA CNC, en Apizaco, Tlaxcala. Estamos armando la red de talleres CNC de México y vi su trabajo' + (r.ciudad ? ' en ' + esc(r.ciudad) : '') + '.</p>' +
          '<p>¿Les interesaría recibir solicitudes de clientes que buscan corte, maquinado o piezas a la medida? Registrarse es gratis y sólo se cobra 6% cuando venden.</p>' +
          '<p>Se dan de alta en 3 minutos aquí: <a href="' + liga('/talleres/unete', r, 1) + '">hetnacnc.com/talleres/unete</a>. O respondan este correo y les ayudo yo.</p>',
      }),
    ],
    2: [
      (r) => ({
        asunto: 'Una herramienta gratis para cotizar más rápido, ' + r.empresa,
        cuerpo: '<p>Además del marketplace, en HETNA hay un <b>Cotizador CNC</b> para talleres: calculan el precio de un corte o maquinado en segundos y mandan una cotización profesional por WhatsApp o correo.</p>' +
          '<p>Al registrarse lo prueban <b>14 días sin límite</b>; después pueden seguir gratis con 5 cotizaciones al mes.</p>' +
          boton(liga('/herramientas-cnc', r, 2), 'Probar el Cotizador'),
      }),
    ],
  },
  comprador: {
    1: [
      (r) => ({
        asunto: '¿Necesitan cortar o maquinar algo, ' + r.empresa + '?',
        cuerpo: '<p>Soy Vladimir, de HETNA CNC. Conectamos empresas con talleres CNC verificados de México (láser, router, plasma, torno y fresadora).</p>' +
          '<p>Si tienen una pieza o un proyecto (' + ejemplosComprador(r).corto + '), en la página de cotizar ven un precio aproximado al instante y varios talleres les mandan su propuesta. Pedirla no cuesta.</p>' +
          '<p><a href="' + liga('/cotizar', r, 1) + '">Ver un precio aproximado</a> · o respondan este correo con las medidas y les ayudo.</p>',
      }),
    ],
  },
};

// Una novedad al mes después del correo 4 (paso 5, 6, … rotando)
const NOVEDADES = {
  vendedor: [
    (r) => ({
      asunto: 'Novedades de HETNA CNC para talleres',
      cuerpo: '<p>Los clientes ya pueden ver en HETNA un precio aproximado al instante y pedir propuestas a los talleres de su zona. Si quieren recibir esas solicitudes, regístrense gratis (sólo pagan 6% cuando venden):</p>' +
        boton(liga('/talleres/unete', r, r._paso), 'Recibir solicitudes'),
    }),
    (r) => ({
      asunto: 'Todavía hay lugares de Taller fundador',
      cuerpo: '<p>Los primeros 30 talleres verificados de HETNA quedan como <b>Taller fundador</b>: insignia para siempre en su perfil y <b>6 meses del plan Pro gratis</b> (sus propuestas salen primero).</p>' +
        boton(liga('/talleres/fundadores', r, r._paso), 'Ver cómo ser fundador'),
    }),
    (r) => ({
      asunto: 'Herramientas CNC gratis para su taller',
      cuerpo: '<p>En HETNA hay generadores gratis de archivos DXF (cajas con ensamble, celosías, letreros y placas), calculadoras de corte y un convertidor de archivos. Úsenlos aunque todavía no vendan con nosotros:</p>' +
        boton(liga('/disenar', r, r._paso), 'Abrir las herramientas'),
    }),
  ],
  comprador: [
    (r) => ({
      asunto: 'Cotiza tu pieza CNC al instante',
      cuerpo: '<p>En HETNA ya puedes subir tu archivo o escribir las medidas y ver un precio aproximado al momento. Si te conviene, varios talleres te mandan su propuesta.</p>' + boton(liga('/cotizar', r, r._paso), 'Ver un precio aproximado'),
    }),
    (r) => ({
      asunto: 'Talleres CNC verificados cerca de ustedes',
      cuerpo: '<p>En el directorio de HETNA encuentran talleres de corte láser, router, plasma, torno y fresadora por estado, con sus máquinas, materiales y fotos de trabajos.</p>' + boton(liga('/talleres', r, r._paso), 'Ver talleres'),
    }),
    (r) => ({
      asunto: 'Diseños listos para fabricar',
      cuerpo: '<p>Si necesitan un letrero, una caja o una celosía, en HETNA pueden generar el diseño gratis en minutos y mandarlo a fabricar con un taller.</p>' + boton(liga('/disenar', r, r._paso), 'Crear un diseño'),
    }),
  ],
  instructor: [
    (r) => ({
      asunto: 'Novedades de la Academia HETNA',
      cuerpo: '<p>Seguimos sumando talleres y operadores que buscan capacitación en CNC, CAD/CAM y programación. Publicar cursos es gratis y sólo se cobra comisión al vender:</p>' + boton(liga('/talleres/unete', r, r._paso), 'Publicar mis cursos'),
    }),
  ],
};

// Encuesta de un clic (desde el correo 3, en español)
const MOTIVOS = [
  ['ya_vendo', 'Ya vendo en otro lado'],
  ['sin_tiempo', 'Ahorita no tengo tiempo'],
  ['no_entiendo', 'No entiendo cómo funciona'],
  ['comision', 'La comisión'],
  ['no_confio', 'No conozco la plataforma'],
  ['no_aplica', 'No es para mi negocio'],
  ['baja', 'No me interesa'],
];
function encuesta(r) {
  const base = OPINION + '?id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(r.token || '') + '&r=';
  return '<div style="margin:20px 0;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-size:13px">' +
    '<b>¿No es para ustedes?</b> Cuéntennos por qué en un clic; nos ayuda a mejorar:<br>' +
    MOTIVOS.map((m) => '<a href="' + base + m[0] + '" style="color:#c2410c">' + m[1] + '</a>').join(' · ') + '</div>';
}

// 1) Quién toca hoy
const filas = $input.all().map((i) => i.json);
const candidatos = [];
for (const r of filas) {
  const estatus = String(r.estatus || '').trim().toUpperCase() || 'NUEVO';
  const email = String(r.email || '').trim().toLowerCase();
  if (!r.id || !email || NO_TOCAR.includes(estatus)) continue;
  const paso = Number(r.paso || 0);
  const prox = String(r.proximo_contacto || '').slice(0, 10);
  let siguiente;
  if (estatus === 'FINALIZADO') {
    // Terminaron la secuencia vieja: a los 30 días de su último correo pasan a las novedades
    const ult = String(r.ultimo_contacto || '').slice(0, 10);
    if (paso < 4 || (ult && ult > masDias(-MENSUAL))) continue;
    siguiente = paso + 1;
  } else {
    if (estatus !== 'NUEVO' && prox && prox > HOY) continue;
    if (estatus === 'NUEVO' && paso === 0) siguiente = 1;
    else if (estatus === 'CONTACTADO' && (paso === 1 || paso === 2)) siguiente = paso + 1;
    else if (estatus === 'PAUSA' && paso >= 3) siguiente = paso + 1;
    else continue;
  }
  candidatos.push({ r, email, siguiente });
}

// Primero los seguimientos 2 y 3 (no dejar secuencias a medias), luego los nuevos,
// al final las novedades mensuales; y dentro de cada grupo, México primero.
const orden = (c) => (c.siguiente === 2 || c.siguiente === 3 ? 0 : c.siguiente === 1 ? 1 : 2);
candidatos.sort((a, b) => orden(a) - orden(b) || (b.r.pais === 'México') - (a.r.pais === 'México'));

// 2) Arma los correos sin repetir destinatario en el mismo día
const yaHoy = new Set();
const salida = [];
for (const c of candidatos) {
  if (salida.length >= LIMITE) break;
  if (yaHoy.has(c.email)) continue;
  yaHoy.add(c.email);
  const r = c.r;
  const idioma = T[r.idioma] ? r.idioma : 'es';
  const t = T[idioma];
  const seg = segmento(r.tipo);
  const empresa = String(r.empresa || '').trim() || r.dominio;
  const paso = c.siguiente;
  let plantilla;
  if (paso >= 5) {
    const lista = NOVEDADES[seg] || NOVEDADES.vendedor;
    const datos = { ...r, empresa, _paso: paso, _v: '' };
    plantilla = idioma === 'es' ? lista[(paso - 5) % lista.length](datos) : t[seg][4](datos);
  } else {
    const otras = idioma === 'es' && VARIANTES[seg] && VARIANTES[seg][paso] ? VARIANTES[seg][paso] : [];
    const v = otras.length ? variante(r.id, otras.length + 1) : 0;
    const datos = { ...r, empresa, _v: otras.length ? 'abc'.charAt(v) : '' };
    plantilla = v === 0 ? t[seg][paso](datos) : otras[v - 1](datos);
  }
  if (idioma === 'es' && paso >= 3) plantilla = { asunto: plantilla.asunto, cuerpo: plantilla.cuerpo + encuesta(r) };
  const urlBaja = BAJA + '?id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(r.token || '');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:600px">' +
    '<p>' + t.hola(esc(empresa)) + '</p>' + plantilla.cuerpo + '<p>' + t.firma + '</p>' +
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">' + t.pie(urlBaja) + '<br>' + DOMICILIO + '</p></div>';
  salida.push({
    json: {
      id: r.id,
      email: c.email,
      asunto: plantilla.asunto,
      html,
      paso: String(c.siguiente),
      estatus: paso >= 3 ? 'PAUSA' : 'CONTACTADO',
      ultimo_contacto: HOY,
      proximo_contacto: masDias(paso >= 4 ? MENSUAL : ESPERA[paso]),
      notas: String(r.notas || ''),
    },
  });
}
return salida;
