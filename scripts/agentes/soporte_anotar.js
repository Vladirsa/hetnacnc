// Nodo Code "Anotar respuesta" del agente de Soporte: cuenta las respuestas
// automáticas por persona (máximo 2; ver «¿Es de soporte?»).
const memoria = $getWorkflowStaticData('global');
memoria.respondidos = memoria.respondidos || {};
const de = $('¿Es de soporte?').first().json.de;
memoria.respondidos[de] = Number(memoria.respondidos[de] || 0) + 1;
return $input.all();
