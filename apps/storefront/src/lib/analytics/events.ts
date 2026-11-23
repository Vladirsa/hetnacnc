'use client';

// Puente delgado hacia GA4 (gtag) y Meta Pixel (fbq). Ambos scripts se inyectan
// en components/analytics/Analytics.tsx solo si sus variables de entorno están
// configuradas; si no existen en window, estas funciones no hacen nada.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    // Eventos de Meta que llegaron antes de que cargara el Pixel (ver fbqEvent)
    __hetnaFbqPendientes?: unknown[][];
  }
}

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
};

function toGa4Amount(amount: number) {
  // Medusa entrega montos ya en la unidad de la moneda (no en centavos) en la mayoría
  // de los campos del storefront (calculated_price, totals, etc.).
  return Math.round(amount * 100) / 100;
}

// Google Ads (remarketing dinámico y conversiones). Opcionales: si no están,
// sólo se usa GA4.
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const ADS_LABEL_COMPRA = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;

// Cada producto lleva su id también como `id` y el giro "retail": así Google
// Ads cruza las visitas con el catálogo de Merchant Center (/feeds/google.xml)
// para el remarketing dinámico. item_id = id del producto, el mismo del catálogo.
const paraGoogle = (i: AnalyticsItem) => ({
  ...i,
  price: toGa4Amount(i.price),
  id: i.item_id,
  google_business_vertical: 'retail'
});

function gtagEvent(name: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, params);
  }
}

// Tienda (/mx/tienda): qué stock conseguir primero. "Avísame" en una
// categoría sin productos y cotizar algo que la búsqueda no encontró. Además
// se guardan en HETNA (/api/tienda-interes → /admin/hetna-interes-tienda).
export function trackAvisameCategoria(categoria: string) {
  gtagEvent('avisame_categoria', { categoria });
}
export function trackCotizarBusqueda(termino: string) {
  gtagEvent('cotizar_desde_busqueda', { search_term: termino });
}

// Interés en la app para talleres (Cotizador): clic en "Empezar gratis",
// "Probar 14 días" o "Abrir la app" en /servicios/cotizador-cnc. Es la
// conversión de las campañas de Google Ads para talleres.
const ADS_LABEL_COTIZADOR = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_COTIZADOR;
const VALOR_LEAD_COTIZADOR = 100; // MXN de referencia por interesado

export function trackLeadCotizador(boton: string) {
  gtagEvent('generate_lead', { lead_source: 'cotizador', boton, currency: 'MXN', value: VALOR_LEAD_COTIZADOR });
  if (ADS_ID && ADS_LABEL_COTIZADOR && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: `${ADS_ID}/${ADS_LABEL_COTIZADOR}`,
      value: VALOR_LEAD_COTIZADOR,
      currency: 'MXN'
    });
  }
  fbqEvent('Lead', { content_name: 'Cotizador', value: VALOR_LEAD_COTIZADOR, currency: 'MXN' });
}

// Conversión principal de HETNA: alguien pide fabricar (solicitud con folio) o
// ve su estimado al instante (calculadoras). Sin valor en pesos: no hay precio
// todavía. El servidor manda el mismo evento por la API de conversiones con el
// mismo event_id (lib/analytics/meta-lead.ts).
export function trackSolicitudFabricacion(folio: string, servicio?: string) {
  gtagEvent('generate_lead', { lead_source: 'solicitud', servicio: servicio || '' });
  fbqEvent('Lead', { content_name: 'Solicitud de fabricación', content_category: servicio || '' }, folio ? `sol_${folio}` : undefined);
}

export function trackEstimadoInstantaneo(servicio: string, eventId: string) {
  gtagEvent('generate_lead', { lead_source: 'calculadora', servicio });
  fbqEvent('Lead', { content_name: 'Estimado al instante', content_category: servicio }, eventId);
}

// Estimado visto en el cotizador de /cotizar (se calcula en el navegador, sin
// correo): no es Lead, es el paso de en medio. Evento propio en Meta para
// crear públicos ("vio su precio y no pidió propuestas").
export function trackEstimadoVisto(servicio: string, conArchivo: boolean) {
  gtagEvent('ver_estimado', { servicio, con_archivo: conArchivo });
  if (typeof window !== 'undefined' && window.fbq) window.fbq('trackCustom', 'EstimadoVisto', { servicio, con_archivo: conArchivo });
}

// Un taller se registró en /talleres/unete: la conversión de la campaña de talleres
export function trackRegistroTaller(eventId: string, servicios: string[]) {
  gtagEvent('sign_up', { method: 'registro_taller', servicios: servicios.join(',') });
  fbqEvent('CompleteRegistration', { content_name: 'Registro de taller', status: true }, eventId);
}

export function nuevoEventoRegistro() {
  return `reg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nuevoEventoEstimado() {
  return `est_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Fila de espera del Pixel. El script de Meta carga tarde a propósito (con la
// primera interacción o a los 8 s, y sólo con permiso de cookies; ver
// components/analytics/Analytics.tsx). Antes, los eventos que pasaban antes de
// eso se perdían: ViewContent se dispara al abrir el producto, así que Meta
// casi nunca lo recibía (avisos "Faltan eventos de coincidencia de productos",
// 22 nov 2026). Ahora esperan aquí y Analytics.tsx los manda en orden justo
// después de fbq('init') y PageView. Si la persona nunca acepta cookies, la
// fila se queda en memoria y se descarta al salir: no se manda nada a Meta.
const MAX_PENDIENTES_META = 30;

function fbqEvent(name: string, params: Record<string, unknown>, eventId?: string) {
  if (typeof window === 'undefined') return;
  // eventID: el mismo que manda el servidor por la API de conversiones, para
  // que Meta cuente la compra una sola vez (ver lib/analytics/meta-capi.ts).
  const args: unknown[] = eventId ? ['track', name, params, { eventID: eventId }] : ['track', name, params];
  if (window.fbq) {
    window.fbq(...args);
    return;
  }
  const fila = (window.__hetnaFbqPendientes ||= []);
  if (fila.length < MAX_PENDIENTES_META) fila.push(args);
}

export function trackViewItem(item: AnalyticsItem, currency: string) {
  gtagEvent('view_item', {
    currency: currency.toUpperCase(),
    value: toGa4Amount(item.price),
    items: [paraGoogle(item)]
  });
  fbqEvent('ViewContent', {
    content_ids: [item.item_id],
    content_name: item.item_name,
    content_type: 'product',
    currency: currency.toUpperCase(),
    value: toGa4Amount(item.price)
  });
}

export function trackAddToCart(item: AnalyticsItem, currency: string) {
  const value = toGa4Amount(item.price * (item.quantity || 1));
  gtagEvent('add_to_cart', {
    currency: currency.toUpperCase(),
    value,
    items: [paraGoogle(item)]
  });
  fbqEvent('AddToCart', {
    content_ids: [item.item_id],
    content_name: item.item_name,
    content_type: 'product',
    currency: currency.toUpperCase(),
    value
  });
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number, currency: string) {
  gtagEvent('begin_checkout', {
    currency: currency.toUpperCase(),
    value: toGa4Amount(value),
    items: items.map(paraGoogle)
  });
  fbqEvent('InitiateCheckout', {
    content_ids: items.map((i) => i.item_id),
    num_items: items.length,
    currency: currency.toUpperCase(),
    value: toGa4Amount(value)
  });
}

export function trackPurchase(
  orderId: string,
  items: AnalyticsItem[],
  value: number,
  currency: string,
  cliente?: { email?: string | null; telefono?: string | null }
) {
  // El id de la orden evita reportar la misma compra dos veces si el usuario
  // recarga la página de confirmación (ver TrackEvent.tsx).
  gtagEvent('purchase', {
    transaction_id: orderId,
    currency: currency.toUpperCase(),
    value: toGa4Amount(value),
    items: items.map(paraGoogle)
  });
  // Conversión de Google Ads, con los datos del cliente para las conversiones
  // mejoradas (gtag los cifra antes de mandarlos).
  if (ADS_ID && ADS_LABEL_COMPRA && typeof window !== 'undefined' && window.gtag) {
    if (cliente?.email || cliente?.telefono) {
      window.gtag('set', 'user_data', {
        ...(cliente.email ? { email: cliente.email } : {}),
        ...(cliente.telefono ? { phone_number: cliente.telefono } : {})
      });
    }
    window.gtag('event', 'conversion', {
      send_to: `${ADS_ID}/${ADS_LABEL_COMPRA}`,
      value: toGa4Amount(value),
      currency: currency.toUpperCase(),
      transaction_id: orderId
    });
  }
  fbqEvent(
    'Purchase',
    {
      content_ids: items.map((i) => i.item_id),
      contents: items.map((i) => ({ id: i.item_id, quantity: i.quantity || 1, item_price: toGa4Amount(i.price) })),
      content_type: 'product',
      num_items: items.reduce((n, i) => n + (i.quantity || 1), 0),
      currency: currency.toUpperCase(),
      value: toGa4Amount(value)
    },
    orderId
  );
}
