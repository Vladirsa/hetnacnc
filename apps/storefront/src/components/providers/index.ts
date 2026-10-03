import { CartProvider } from './Cart/CartProvider';
import { useCartContext } from './Cart/context';

export { CartProvider, useCartContext };

// TalkJsProvider (y el SDK de talkjs) se cargan solo donde se usan, vía
// `next/dynamic`, importando directo desde './TalkJs/TalkJsProvider'.
// No se reexporta aquí: cualquier import estático de este barril (como el
// de CartProvider en app/providers.tsx) arrastraría el SDK de chat al
// bundle inicial de toda la app.
