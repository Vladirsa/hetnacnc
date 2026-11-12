// Fuente única de las promesas comerciales que la tienda muestra al público:
// límites, plazos y comisiones. Una página que promete algo de esto lo lee de
// aquí, no lo escribe a mano. Así no vuelve a pasar lo de la auditoría del
// 12 de noviembre de 2026: una página decía 5 archivos de 50 MB y el
// formulario aceptaba 500 MB; otra decía que el taller recibía la solicitud
// "en el momento" cuando antes pasa por revisión.
//
// Cada valor debe coincidir con lo que el backend aplica (archivo al lado). Si
// cambia allá, se cambia aquí y todas las páginas quedan iguales.

// Archivos de una solicitud de fabricación (packages/api/src/lib/licitacion.ts
// MAX_ARCHIVOS_SOLICITUD / MAX_MB_*). Viven en lib/fabricacion/opciones.ts
// porque el formulario los usa para validar; se reexportan aquí.
export { MAX_ARCHIVOS, MAX_MB_ARCHIVO, MAX_MB_ARCHIVO_SERVIDOR } from "@/lib/fabricacion/opciones"

// Días que una solicitud recibe propuestas una vez publicada
// (api/store/solicitudes-taller/route.ts DIAS_ABIERTA, jobs/cerrar-licitaciones.ts).
export const DIAS_SOLICITUD_ABIERTA = 7

// Revisión de HETNA antes de publicar la solicitud a los talleres
// (lib/seguimiento.ts horasRevision(), LICITACION_REVISION_HORAS = 24).
export const HORAS_REVISION_SOLICITUD = 24

// Vigencia por omisión de la propuesta de un taller
// (lib/licitacion.ts vigencia_dias por omisión = 15).
export const DIAS_VIGENCIA_PROPUESTA = 15

// Comisión de HETNA en trabajos de fabricación (lib/licitacion-cobro.ts
// PCT_POR_PLAN, todo en 0 por decisión del 7 de noviembre de 2026).
export const COMISION_FABRICACION_PCT = 0

// Revisión de un anuncio antes de publicarlo (sin plazo en el código: es la
// meta del equipo, por eso se dice "normalmente").
export const HORAS_REVISION_ANUNCIO = 24

// Protección en trabajos de fabricación (política del 12 nov 2026; backend:
// packages/api/src/lib/disputa.ts y lib/seguimiento.ts DIAS_PARA_CERRAR).
// Si el cliente no confirma ni reporta nada, la solicitud se cierra sola estos
// días después de la entrega y se le paga al taller.
export const DIAS_CIERRE_AUTOMATICO = 10
// Días después de la fecha prometida sin entrega para poder cancelar con
// reembolso de lo que HETNA tenga retenido.
export const DIAS_RETRASO_CANCELACION = 7
// Plazo máximo en que HETNA decide una disputa (días hábiles).
export const DIAS_HABILES_DECISION_DISPUTA = 5

// Archivos de solicitudes de fabricación (backend: lib/conservacion-archivos.ts
// y lib/archivo-acceso.ts). Se borran estos días después del cierre o la
// cancelación; cada liga de descarga dura estos minutos y queda registrada.
export const DIAS_CONSERVACION_ARCHIVOS = 180
export const MINUTOS_LIGA_ARCHIVO = 60
