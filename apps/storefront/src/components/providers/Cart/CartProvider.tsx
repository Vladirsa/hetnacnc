'use client';

import { usePathname } from 'next/navigation';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';

import {
  addToCart as apiAddToCart,
  deleteLineItem as apiDeleteLineItem,
  updateLineItem as apiUpdateLineItem,
  retrieveCart
} from '@/lib/data/cart';
import { Cart, StoreCartLineItemOptimisticUpdate } from '@/types/cart';

import { CartContext } from './context';

interface CartProviderProps extends PropsWithChildren {
  cart: Cart | null;
}

export function CartProvider({ cart, children }: CartProviderProps) {
  const [cartState, setCartState] = useState(cart);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const [isRemovingItem, setIsRemovingItem] = useState(false);

  // Sólo si el servidor manda un carrito (/cart, /checkout). Fuera de ahí el
  // layout manda null siempre, también al refrescarse tras una acción, y eso
  // no debe borrar el carrito que ya pidió el navegador.
  useEffect(() => {
    if (cart) setCartState(cart);
  }, [cart]);

  // Al terminar una compra o cerrar sesión, el servidor borra el carrito y la
  // cookie hetna_carrito (removeCartId). Antes el layout lo limpiaba al
  // volver a mandarlo; ahora se revisa la cookie en cada cambio de página.
  const ruta = usePathname();
  useEffect(() => {
    if (!document.cookie.split('; ').some(c => c === 'hetna_carrito=1')) {
      setCartState(prev => (prev ? null : prev));
    }
  }, [ruta]);

  // El HTML ya no trae el carrito (salvo en /cart y /checkout): si la cookie
  // hetna_carrito dice que hay uno, se pide al cargar. Sin bandera no se pide
  // nada, para no sumar una llamada al servidor por cada visita.
  useEffect(() => {
    if (cart) return;
    if (!document.cookie.split('; ').some(c => c === 'hetna_carrito=1')) return;
    retrieveCart()
      .then(c => {
        if (c) setCartState(c);
        else document.cookie = 'hetna_carrito=; Max-Age=0; Path=/';
      })
      .catch(() => {});
    // Sólo al montar: después el carrito lo actualizan las propias acciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const cartData = await retrieveCart();
      setCartState(cartData);
      return cartData;
    } catch (error) {
      console.error('Error fetching cart:', error);
      return null;
    }
  }, []);

  function handleAddToCart(newItem: StoreCartLineItemOptimisticUpdate, currency_code: string) {
    setCartState(prev => {
      const currentItems = prev?.items || [];
      const isNewItemInCart = currentItems.find(
        ({ variant_id }) => variant_id === newItem.variant_id
      );

      if (isNewItemInCart) {
        const updatedItems = currentItems.map(currentItem => {
          if (currentItem.variant_id !== newItem.variant_id) {
            return currentItem;
          }

          const newQuantity = currentItem.quantity + (newItem?.quantity || 0);
          return {
            ...currentItem,
            quantity: newQuantity,
            subtotal: newQuantity * (newItem?.subtotal || 0),
            total: newQuantity * (newItem?.total || 0),
            tax_total: newQuantity * (newItem?.tax_total || 0)
          };
        }) as StoreCartLineItemOptimisticUpdate[];

        const { item_subtotal, total, tax_total } = getItemsSummaryValues(updatedItems);

        return {
          ...prev,
          items: updatedItems,
          item_subtotal,
          total,
          tax_total,
          currency_code
        } as Cart;
      }

      const updatedItems = [...currentItems, newItem] as StoreCartLineItemOptimisticUpdate[];

      const { item_subtotal, total, tax_total } = getItemsSummaryValues(updatedItems);

      return {
        ...prev,
        items: updatedItems,
        item_subtotal,
        total,
        tax_total,
        currency_code
      } as Cart;
    });
  }

  const updateCartItem = async (lineId: string, quantity: number) => {
    if (!cartState?.items) return;

    setIsUpdatingItem(true);
    setIsUpdating(true);

    const optimisticCart = {
      ...cartState,
      items: cartState.items.map(item => (item.id === lineId ? { ...item, quantity } : item))
    };

    setCartState(optimisticCart);

    try {
      await apiUpdateLineItem({ lineId, quantity });
      await refreshCart();
    } catch (error) {
      // Se vuelve a traer el carrito para deshacer el cambio optimista, y se
      // relanza el error. Antes se tragaba aquí: el número de la cantidad se
      // regresaba solo y el cliente no veía ningún aviso, así que parecía que
      // el botón no servía. Quien llama necesita enterarse para avisar.
      await refreshCart();
      throw error;
    } finally {
      setIsUpdatingItem(false);
      setIsUpdating(false);
    }
  };

  const addToCart = async ({
    offerId,
    quantity,
    countryCode
  }: {
    offerId: string;
    quantity: number;
    countryCode: string;
  }) => {
    setIsAddingItem(true);
    setIsUpdating(true);

    try {
      await apiAddToCart({
        offerId,
        quantity,
        countryCode
      });
      await refreshCart();
    } catch (error) {
      console.error('Error adding product to cart:', error);
      await refreshCart();
      throw error;
    } finally {
      setIsAddingItem(false);
      setIsUpdating(false);
    }
  };

  const removeCartItem = async (lineId: string) => {
    if (!cartState?.items) return;

    setIsRemovingItem(true);
    setIsUpdating(true);

    const optimisticCart = {
      ...cartState,
      items: cartState.items.filter(item => item.id !== lineId)
    };

    setCartState(optimisticCart);

    try {
      await apiDeleteLineItem(lineId);
      await refreshCart();
    } catch (error) {
      // Igual que arriba: se deshace el cambio optimista y se relanza, para
      // que el producto no reaparezca en silencio.
      await refreshCart();
      throw error;
    } finally {
      setIsRemovingItem(false);
      setIsUpdating(false);
    }
  };

  function getItemsSummaryValues(items: StoreCartLineItemOptimisticUpdate[]) {
    return items.reduce(
      (acc, item) => ({
        item_subtotal: (acc.item_subtotal || 0) + (item.subtotal || 0),
        total: (acc.total || 0) + (item.total || 0),
        tax_total: (acc.tax_total || 0) + (item.tax_total || 0)
      }),
      { item_subtotal: 0, total: 0, tax_total: 0 }
    );
  }

  return (
    <CartContext.Provider
      value={{
        cart: cartState,
        onAddToCart: handleAddToCart,
        addToCart,
        removeCartItem,
        updateCartItem,
        refreshCart,
        isUpdating,
        isAddingItem,
        isUpdatingItem,
        isRemovingItem
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
