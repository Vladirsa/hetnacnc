import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import { Suspense } from 'react';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TrackEvent } from '@/components/analytics/TrackEvent';
import PaymentWrapper from '@/components/organisms/PaymentContainer/PaymentWrapper';
import { CartAddressSection } from '@/components/sections/CartAddressSection/CartAddressSection';
import CartPaymentSection from '@/components/sections/CartPaymentSection/CartPaymentSection';
import { CartItems as CheckoutItems } from '@/components/sections/CartReview/CartItems';
import { CuponCompra, PagarCompra, ResumenCompra } from '@/components/sections/CartReview/CartReview';
import CartShippingMethodsSection from '@/components/sections/CartShippingMethodsSection/CartShippingMethodsSection';
import { retrieveCart } from '@/lib/data/cart';
import { retrieveCustomer } from '@/lib/data/customer';
import { listCartShippingMethods } from '@/lib/data/fulfillment';
import { listCartPaymentMethods } from '@/lib/data/payment';
import { carritoSoloDigital } from '@/lib/hetna/tipo-ficha';
import { isPaypal } from '@/lib/constants';

const metadataEs: Metadata = {
  title: 'Finalizar compra',
  description: 'Mi carrito - Finalizar compra',
  robots: { index: false, follow: false }
};

export default async function CheckoutPage({}) {
  return (
    <Suspense
      fallback={<div className="container flex items-center justify-center" data-testid="checkout-page-loading"><TS>Cargando...</TS></div>}
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

  // En paralelo: antes iban una tras otra y el cliente veía "Cargando..." más tiempo
  const [shippingMethods, paymentMethods, customer] = await Promise.all([
    listCartShippingMethods(cart.id, false),
    listCartPaymentMethods(cart.region?.id ?? ''),
    retrieveCustomer(),
  ]);
  // Sólo archivos o servicios: compra en un paso, sin dirección ni envío (tarea 4)
  const soloDigital = carritoSoloDigital(cart.items as any);
  // Logos de pago: sólo los que esta pasarela ofrece
  const conPaypal = (paymentMethods ?? []).some((m: { id: string }) => isPaypal(m.id));

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
        {/* Izquierda: sólo lo que compras. Derecha: resumen con miniaturas,
            cupón, tus datos, envío, forma de pago y el botón de pagar, en ese
            orden (pedido de Vlado, nov 2026). */}
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <section className="lg:col-span-7" data-testid="checkout-items-container" aria-labelledby="titulo-productos">
            <h2 id="titulo-productos" className="mb-3 text-[20px] font-extrabold text-[#111]">
              <TS>Productos (</TS>{(cart.items ?? []).reduce((s: number, i: { quantity?: number }) => s + (i.quantity || 0), 0)})
            </h2>
            <CheckoutItems cart={cart} />
          </section>

          <div className="flex flex-col gap-4 lg:col-span-5" data-testid="checkout-steps-container">
            <ResumenCompra cart={cart} soloDigital={soloDigital} />
            <CuponCompra cart={cart} />
            <CartAddressSection
              cart={cart}
              customer={customer}
              soloDigital={soloDigital}
            />
            <CartShippingMethodsSection
              cart={cart}
              availableShippingMethods={shippingMethods as any}
              soloDigital={soloDigital}
            />
            <CartPaymentSection
              soloDigital={soloDigital}
              cart={cart}
              availablePaymentMethods={paymentMethods}
            />
            <div data-testid="checkout-review-container">
              <PagarCompra cart={cart} conPaypal={conPaypal} soloDigital={soloDigital} />
            </div>
          </div>
        </div>
      </main>
    </PaymentWrapper>
  );
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
