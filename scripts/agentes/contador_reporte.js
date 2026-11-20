// Nodo Code "Armar reporte" del agente Contador diario (n8n).
// Entradas: "Ayer" (/admin/hetna-control?dias=1), "Ultimos 30 dias" (?dias=30)
// y "Saldos de talleres" (/admin/hetna-saldos). Sale un item con el texto HTML
// para Telegram. Sin barras invertidas ni backticks.
const NL = String.fromCharCode(10);
const zona = 'America/Mexico_City';
const hoy = $now.setZone(zona);
const ayer = $('Ayer').first().json || {};
const mes = $('Ultimos 30 dias').first().json || {};
const saldos = $('Saldos de talleres').first().json || {};
const esc = (s) => String(s == null ? '' : s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const cambio = (a, b) => {
  a = Number(a) || 0; b = Number(b) || 0;
  if (!b) return a ? ' (nuevo)' : '';
  const p = Math.round(((a - b) / b) * 100);
  return ' (' + (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '%)';
};
const va = ayer.ventas || {};
const vm = mes.ventas || {};

// Lo que HETNA le debe a los talleres
const talleres = saldos.talleres || [];
const suma = (k) => talleres.reduce((t, x) => t + (Number(x[k]) || 0), 0);
const porPagar = talleres.filter((t) => Number(t.disponible) > 0);
const sinCuenta = porPagar.filter((t) => !t.cuenta);

// Avisos del centro de control (rojo y ambar)
const yaEnServicios = ['saldo_servicio', 'limite_servicio', 'vencimiento'];
const avisos = (ayer.avisos || []).filter((a) => (a.nivel === 'rojo' || a.nivel === 'ambar') && yaEnServicios.indexOf(a.tipo) < 0);
const icono = { rojo: '🔴', ambar: '🟠' };

// Servicios que se pagan (vigilancia: saldos y vencimientos)
const servicios = ((ayer.saldos || {}).servicios || []).filter((s) => s.estado === 'rojo' || s.estado === 'ambar');
const sky = (ayer.saldos || {}).skydropx;

const partes = [
  '<b>💰 Contador HETNA · ' + hoy.toFormat('dd/MM/yyyy') + '</b>',
  '',
  '<b>Ayer</b>',
  'Ventas: <b>' + pesos(va.ingresos) + '</b>' + cambio(va.ingresos, va.ingresos_antes) + ' · Pedidos: <b>' + (va.pedidos || 0) + '</b>',
  'Comisión HETNA: <b>' + pesos(va.comision) + '</b>' + (va.pedidos ? ' · Ticket promedio: ' + pesos(va.ticket) : ''),
  'Clientes nuevos: ' + (va.clientes_nuevos || 0) + ' · Talleres nuevos: ' + (va.talleres_nuevos || 0),
  va.carritos_abandonados ? 'Carritos abandonados: ' + va.carritos_abandonados + ' por ' + pesos(va.valor_abandonado) : '',
  '',
  '<b>Últimos 30 días</b>',
  'Ventas: <b>' + pesos(vm.ingresos) + '</b>' + cambio(vm.ingresos, vm.ingresos_antes) + ' · Pedidos: ' + (vm.pedidos || 0) + cambio(vm.pedidos, vm.pedidos_antes),
  'Comisión HETNA: <b>' + pesos(vm.comision) + '</b>' + cambio(vm.comision, vm.comision_antes),
  vm.carritos_abandonados ? 'Carritos abandonados: ' + vm.carritos_abandonados + ' por ' + pesos(vm.valor_abandonado) + ' (los recupera el agente de reactivación)' : '',
  'Clientes nuevos: ' + (vm.clientes_nuevos || 0) + cambio(vm.clientes_nuevos, vm.clientes_nuevos_antes) + ' · con cuenta: ' + (vm.clientes_total || 0) + ' · Talleres: ' + (vm.talleres_total || 0),
  (vm.talleres_top || []).length ? 'Taller que más vende: ' + esc(vm.talleres_top[0].nombre) + ' (' + pesos(vm.talleres_top[0].ingresos) + ')' : '',
  (vm.productos_top || []).length ? 'Producto que más vende: ' + esc(vm.productos_top[0].titulo || vm.productos_top[0].nombre || '') + ' (' + pesos(vm.productos_top[0].ingresos) + ')' : '',
  '',
  '<b>Dinero de los talleres</b>',
  'Por pagar ya (disponible): <b>' + pesos(suma('disponible')) + '</b> a ' + porPagar.length + ' taller(es)',
  'En espera de liberación: ' + pesos(suma('pendiente')) + ' · Pagado histórico: ' + pesos(suma('pagado')),
  sinCuenta.length ? '⚠️ Sin cuenta para SPEI: ' + sinCuenta.slice(0, 5).map((t) => esc(t.nombre)).join(', ') : '',
  porPagar.slice(0, 5).map((t) => '• ' + esc(t.nombre) + ': ' + pesos(t.disponible)).join(NL),
  '',
  sky && sky.saldo != null ? '📦 Saldo Skydropx: ' + pesos(sky.saldo) + (sky.dias_restantes != null ? ' (≈' + sky.dias_restantes + ' días)' : '') : '',
  servicios.length ? '<b>Servicios por pagar o renovar</b>' + NL + servicios.slice(0, 6).map((s) => (s.estado === 'rojo' ? '🔴 ' : '🟠 ') + esc(s.alerta || (s.nombre + ': ' + (s.valor || '')))).join(NL) : '',
  '',
  avisos.length
    ? '<b>Pendientes (' + avisos.length + ')</b>' + NL + avisos.slice(0, 8).map((a) => icono[a.nivel] + ' ' + esc(a.titulo)).join(NL)
    : '✅ Sin pendientes urgentes.',
  '',
  '<a href="https://hetnacnc.com/dashboard/control">Abrir el centro de control</a>',
];
const texto = partes.filter((x) => x !== '' && x != null).join(NL).split(NL + '<b>').join(NL + NL + '<b>').slice(0, 4000);
return [{ json: { texto } }];
