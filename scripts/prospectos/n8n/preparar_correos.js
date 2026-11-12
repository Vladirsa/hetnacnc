// Nodo Code "Preparar correos del día" (n8n, Run Once for All Items).
// Entrada: todas las filas de la hoja de prospectos. Salida: los correos que
// tocan hoy (máx. LIMITE), cada uno con el asunto, el HTML y los valores
// nuevos de control que se escriben de vuelta en la hoja.
//
// Secuencia: paso 1 (presentación) -> +4 días paso 2 -> +6 días paso 3
// -> pausa 60 días -> paso 4 (último recordatorio) -> FINALIZADO.
// Nunca escribe a REGISTRADO, BAJA, RESPONDIO, REBOTE, SIN_EMAIL ni FINALIZADO.

const LIMITE = 40;
const SITIO = 'https://www.hetnacnc.com';
const BAJA = 'https://n8n.hetnacnc.com/webhook/hetna-prospectos-baja';
const DOMICILIO = 'HETNA CNC · Col. Centro, Apizaco, Tlaxcala, México';
const ESPERA = { 1: 4, 2: 6, 3: 60 };
const NO_TOCAR = ['REGISTRADO', 'BAJA', 'RESPONDIO', 'REBOTE', 'SIN_EMAIL', 'FINALIZADO', 'ERROR'];

const hoy = $now.setZone('America/Mexico_City').startOf('day');
const HOY = hoy.toISODate();
const masDias = (n) => hoy.plus({ days: n }).toISODate();
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function segmento(tipo) {
  if (tipo === 'Instructor/Capacitación') return 'instructor';
  if (tipo === 'Cliente comprador' || tipo === 'Servicios CNC') return 'comprador';
  return 'vendedor'; // Taller (cliente y vendedor), Proveedor
}

function liga(ruta, r, paso) {
  const utm = 'utm_source=correo&utm_medium=prospeccion&utm_campaign=' + segmento(r.tipo) + '_p' + paso;
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
        asunto: r.empresa + ': herramientas, refacciones y maquinados CNC en un solo lugar',
        cuerpo: '<p>En <b>HETNA CNC</b> reunimos a talleres y proveedores de todo México: fresas, insertos, refacciones, máquinas, materiales, maquinados a medida, corte láser/plasma y cursos.</p>' +
          '<ul><li>Pide cotizaciones o publica una <b>licitación de fabricación</b> y recibe propuestas de varios talleres.</li><li>Compara precios y paga en línea con factura del vendedor.</li><li>Talleres verificados y reseñas reales.</li></ul>' +
          boton(liga('/cotizar', r, 1), 'Pedir una cotización') +
          '<p>Y si su empresa también vende productos o servicios de CNC, puede abrir su tienda gratis pagando sólo 6% por venta.</p>',
      }),
      2: (r) => ({
        asunto: '¿Necesitan una pieza o maquinado este mes?',
        cuerpo: '<p>Publiquen lo que necesitan (planos, cantidades, material) y los talleres de HETNA les mandan propuestas. Sin costo para ustedes.</p>' +
          boton(liga('/cotizar', r, 2), 'Publicar lo que necesito'),
      }),
      3: (r) => ({
        asunto: 'Último correo de HETNA CNC',
        cuerpo: '<p>Éste es el último correo por ahora. Cuando necesiten herramientas, refacciones o maquinados CNC, aquí estamos:</p>' +
          boton(liga('/', r, 3), 'Visitar HETNA CNC'),
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

// 1) Quién toca hoy
const filas = $input.all().map((i) => i.json);
const candidatos = [];
for (const r of filas) {
  const estatus = String(r.estatus || '').trim().toUpperCase() || 'NUEVO';
  const email = String(r.email || '').trim().toLowerCase();
  if (!r.id || !email || NO_TOCAR.includes(estatus)) continue;
  const paso = Number(r.paso || 0);
  const prox = String(r.proximo_contacto || '').slice(0, 10);
  if (estatus !== 'NUEVO' && prox && prox > HOY) continue;
  let siguiente;
  if (estatus === 'NUEVO' && paso === 0) siguiente = 1;
  else if (estatus === 'CONTACTADO' && (paso === 1 || paso === 2)) siguiente = paso + 1;
  else if (estatus === 'PAUSA' && paso === 3) siguiente = 4;
  else continue;
  candidatos.push({ r, email, siguiente });
}

// Primero los seguimientos (no dejar secuencias a medias), luego México, luego el resto.
candidatos.sort((a, b) => (b.siguiente > 1) - (a.siguiente > 1) || (b.r.pais === 'México') - (a.r.pais === 'México'));

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
  const plantilla = t[seg][c.siguiente]({ ...r, empresa });
  const urlBaja = BAJA + '?id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(r.token || '');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:600px">' +
    '<p>' + t.hola(esc(empresa)) + '</p>' + plantilla.cuerpo + '<p>' + t.firma + '</p>' +
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">' + t.pie(urlBaja) + '<br>' + DOMICILIO + '</p></div>';
  const fin = c.siguiente === 4;
  salida.push({
    json: {
      id: r.id,
      email: c.email,
      asunto: plantilla.asunto,
      html,
      paso: String(c.siguiente),
      estatus: fin ? 'FINALIZADO' : c.siguiente === 3 ? 'PAUSA' : 'CONTACTADO',
      ultimo_contacto: HOY,
      proximo_contacto: fin ? '' : masDias(ESPERA[c.siguiente]),
      notas: String(r.notas || ''),
    },
  });
}
return salida;
