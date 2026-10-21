import { Suspense } from 'react';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TrackEvent } from '@/components/analytics/TrackEvent';
import PaymentWrapper from '@/components/organisms/PaymentContainer/PaymentWrapper';
import { CartAddressSection } from '@/components/sections/CartAddressSection/CartAddressSection';
import CartPaymentSection from '@/components/sections/CartPaymentSection/CartPaymentSection';
import { CartItems as CheckoutItems } from '@/components/sections/CartReview/CartItems';
import CartReview from '@/components/sections/CartReview/CartReview';
import CartShippingMethodsSection from '@/components/sections/CartShippingMethodsSection/CartShippingMethodsSection';
import { retrieveCart } from '@/lib/data/cart';
import { retrieveCustomer } from '@/lib/data/customer';
import { listCartShippingMethods } from '@/lib/data/fulfillment';
import { listCartPaymentMethods } from '@/lib/data/payment';

export const metadata: Metadata = {
  title: 'Finalizar compra',
  description: 'Mi carrito - Finalizar compra',
  robots: { index: false, follow: false }
};

export default async function CheckoutPage({}) {
  return (
    <Suspense
      fallback={<div className="container flex items-center justify-center" data-testid="checkout-page-loading">Cargando...</div>}
    >
      <CheckoutPageContent />
    </Suspense>
  );
}

async function CheckoutPageContent({}) {
  const cart = await retrieveCart();

  if (!cart) {
    return notFound();
  }

  const shippingMethods = await listCartShippingMethods(cart.id, false);
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? '');
  const customer = await retrieveCustomer();

  return (
    <PaymentWrapper cart={cart}>
      <TrackEvent
        event="begin_checkout"
        currency={cart.currency_code}
        value={cart.total ?? 0}
        items={(cart.items ?? []).map((item) => ({
          item_id: item.product_id ?? item.id,
          item_name: item.product_title ?? item.title ?? '',
          price: item.unit_price ?? 0,
          quantity: item.quantity
        }))}
      />
      <main className="container" data-testid="checkout-page">
        {/* Los pasos y los productos van juntos a la izquierda, y el resumen
            queda pegado a la derecha mientras se baja. Antes los productos
            estaban en la columna del resumen, así que para ver qué se estaba
            comprando había que buscarlo junto al botón de pagar. */}
        <div className="grid gap-8 lg:grid-cols-11">
          <div className="flex flex-col gap-4 lg:col-span-7" data-testid="checkout-steps-container">
            <CartAddressSection
              cart={cart}
              customer={customer}
            />
            <CartShippingMethodsSection
              cart={cart}
              availableShippingMethods={shippingMethods as any}
            />
            <CartPaymentSection
              cart={cart}
              availablePaymentMethods={paymentMethods}
            />

            <section data-testid="checkout-items-container">
              <h2 className="mb-3 text-[18px] font-bold text-[#1B1B18]">Lo que vas a recibir</h2>
              <CheckoutItems cart={cart} />
            </section>
          </div>

          <div className="lg:col-span-4" data-testid="checkout-review-container">
            {/* El tope de alto es lo que hace que de verdad se quede pegado:
                un bloque pegajoso más alto que la pantalla no se ve pegado --
                se queda quieto hasta que ya lo pasaste de largo. */}
            <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto no-scrollbar">
              <CartReview cart={cart} />
            </div>
          </div>
        </div>
      </main>
    </PaymentWrapper>
  );
}
