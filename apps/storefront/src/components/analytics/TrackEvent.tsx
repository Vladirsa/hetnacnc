'use client';

import { useEffect, useRef } from 'react';

import {
  AnalyticsItem,
  trackBeginCheckout,
  trackPurchase,
  trackViewItem
} from '@/lib/analytics/events';
import { reportarCompraMeta } from '@/lib/analytics/meta-capi';
import { permiteRastreo } from '@/lib/hetna/consentimiento';

type Props =
  | { event: 'view_item'; item: AnalyticsItem; currency: string }
  | { event: 'begin_checkout'; items: AnalyticsItem[]; value: number; currency: string }
  | {
      event: 'purchase';
      orderId: string;
      items: AnalyticsItem[];
      value: number;
      currency: string;
      cliente?: { email?: string | null; telefono?: string | null };
    };

// Dispara un evento de analytics una sola vez al montar. Se usa dentro de
// páginas servidor (producto, checkout, orden confirmada) que no pueden
// llamar a window.gtag/fbq directamente.
export function TrackEvent(props: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (props.event === 'view_item') {
      trackViewItem(props.item, props.currency);
      return;
    }

    if (props.event === 'begin_checkout') {
      trackBeginCheckout(props.items, props.value, props.currency);
      return;
    }

    if (props.event === 'purchase') {
      // Evita reportar la misma compra dos veces si el usuario recarga o
      // vuelve a la página de confirmación (localStorage es por navegador,
      // suficiente para no inflar el valor de conversión en GA4/Meta).
      const key = `hetna_purchase_tracked_${props.orderId}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
      } catch {
        // Si localStorage no está disponible seguimos y disparamos el evento igual.
      }
      trackPurchase(props.orderId, props.items, props.value, props.currency, props.cliente);
      // La misma compra desde el servidor (API de conversiones de Meta), sólo
      // con permiso de cookies de publicidad.
      if (permiteRastreo()) reportarCompraMeta(props.orderId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
