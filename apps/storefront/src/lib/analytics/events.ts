'use client';

// Puente delgado hacia GA4 (gtag) y Meta Pixel (fbq). Ambos scripts se inyectan
// en components/analytics/Analytics.tsx solo si sus variables de entorno están
// configuradas; si no existen en window, estas funciones no hacen nada.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
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

function fbqEvent(name: string, params: Record<string, unknown>, eventId?: string) {
  if (typeof window !== 'undefined' && window.fbq) {
    // eventID: el mismo que manda el servidor por la API de conversiones, para
    // que Meta cuente la compra una sola vez (ver lib/analytics/meta-capi.ts).
    if (eventId) window.fbq('track', name, params, { eventID: eventId });
    else window.fbq('track', name, params);
  }
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
