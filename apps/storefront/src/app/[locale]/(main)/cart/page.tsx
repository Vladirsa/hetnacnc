import { Metadata } from 'next';
import { Suspense } from 'react';

import { Cart } from '@/components/sections';

export const metadata: Metadata = {
  title: 'Tu carrito',
  description: 'Revisa lo que vas a comprar antes de pagar.',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <main className="container grid grid-cols-12 pb-12">
      <Suspense
        fallback={
          <div className="col-span-12 py-16 text-center text-[14px] text-[#6B6A63]">
            Cargando tu carrito…
          </div>
        }
      >
        <Cart />
      </Suspense>
    </main>
  );
}
