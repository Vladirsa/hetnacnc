import { Cart } from '@/components/sections';
import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Carrito',
  description: 'Mi carrito',
  robots: { index: false, follow: false },
};

export default function CartPage({}) {
  return (
    <main className='container grid grid-cols-12'>
      <Suspense fallback={<>Cargando...</>}>
        <Cart />
      </Suspense>
    </main>
  );
}
