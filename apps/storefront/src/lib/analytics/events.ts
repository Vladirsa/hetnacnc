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

function gtagEvent(name: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, params);
  }
}

function fbqEvent(name: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', name, params);
  }
}

export function trackViewItem(item: AnalyticsItem, currency: string) {
  gtagEvent('view_item', {
    currency: currency.toUpperCase(),
    value: toGa4Amount(item.price),
    items: [{ ...item, price: toGa4Amount(item.price) }]
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
    items: [{ ...item, price: toGa4Amount(item.price) }]
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
    items: items.map((i) => ({ ...i, price: toGa4Amount(i.price) }))
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
  currency: string
) {
  // El id de la orden evita reportar la misma compra dos veces si el usuario
  // recarga la página de confirmación (ver TrackEvent.tsx).
  gtagEvent('purchase', {
    transaction_id: orderId,
    currency: currency.toUpperCase(),
    value: toGa4Amount(value),
    items: items.map((i) => ({ ...i, price: toGa4Amount(i.price) }))
  });
  fbqEvent('Purchase', {
    content_ids: items.map((i) => i.item_id),
    currency: currency.toUpperCase(),
    value: toGa4Amount(value)
  });
}
