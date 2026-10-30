'use client';
import { usePathname } from 'next/navigation';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

const HOME = { href: '/', label: 'Inicio', d: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V11z' };
const FAV = { href: '/favoritos', label: 'Favoritos', d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z' };
const CART = { href: '/cart', label: 'Cesta', d: 'M6 6h15l-1.5 9h-12L6 6zm0 0L5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z' };
const USER = { href: '/user', label: 'Cuenta', d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' };
// La app de cotizar para talleres (Flutter, la sirve nginx en /cotizador/,
// fuera del enrutado por idioma): por eso es un <a> normal y no un enlace
// localizado. La app tiene su propio inicio de sesión: sin cuenta no entra.
// Las notificaciones siguen en la campanita del encabezado.
const COTIZADOR = { href: '/cotizador/', label: 'Cotizador', d: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01' };

const BASE = 'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium';

const Icon = ({ d }: { d: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export function MobileBottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname() || '/';
  // La primera parte de la ruta es el idioma/región: /mx/cart -> /cart
  const rest = '/' + pathname.split('/').filter(Boolean).slice(1).join('/');

  const tab = (it: typeof HOME) => {
    const active =
      it.href === '/' ? rest === '/'
      : it.href === '/user' ? rest.startsWith('/user')
      : rest.startsWith(it.href);
    return (
      <LocalizedClientLink key={it.href} href={it.href} className={`${BASE} ${active ? 'text-[#F08A3C]' : 'text-[#6B6A63]'}`}>
        {active && <span className="absolute top-0 h-0.5 w-8 bg-[#F08A3C] rounded-b" />}
        <span className="relative">
          <Icon d={it.d} />
          {it.href === '/cart' && cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#F08A3C] text-white text-[10px] leading-4 text-center">{cartCount}</span>
          )}
        </span>
        <span className={it.label.length > 10 ? 'text-[9.5px] tracking-tight whitespace-nowrap' : ''}>{it.label}</span>
      </LocalizedClientLink>
    );
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E7E4DC] grid grid-cols-5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        {tab(HOME)}
        {tab(FAV)}
        <a href={COTIZADOR.href} className={`${BASE} text-[#6B6A63]`}>
          <span className="relative">
            <Icon d={COTIZADOR.d} />
          </span>
          <span>{COTIZADOR.label}</span>
        </a>
        {tab(CART)}
        {tab(USER)}
      </nav>
    </>
  );
}
