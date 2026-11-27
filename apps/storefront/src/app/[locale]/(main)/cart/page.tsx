import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import { Metadata } from 'next';
import { Suspense } from 'react';

import { Cart } from '@/components/sections/Cart/Cart'

const metadataEs: Metadata = {
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
            <TS>Cargando tu carrito…</TS>
          </div>
        }
      >
        <Cart />
      </Suspense>
    </main>
  );
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
