'use client';

import { Fragment, useEffect, useRef, useState, useTransition, type FC } from 'react';

import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDown, Loader } from '@medusajs/icons';
import type { HttpTypes } from '@medusajs/types';
import { clx, Heading, Text } from '@medusajs/ui';
import clsx from 'clsx';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/atoms/Button/Button'
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { removeShippingMethod, setShippingMethod } from '@/lib/data/cart';
import { calculatePriceForShippingOption } from '@/lib/data/fulfillment';
import { convertToLocale } from '@/lib/helpers/money';

import { PasoCheckout } from '../CartAddressSection/PasoCheckout';
import { CartShippingMethodRow } from './CartShippingMethodRow';

type ExtendedStoreProduct = HttpTypes.StoreProduct & {
  seller?: {
    id: string;
    name: string;
  };
};

type CartItem = {
  product?: ExtendedStoreProduct;
};

export type StoreCardShippingMethod = HttpTypes.StoreCartShippingOption & {
  seller_id?: string;
  seller_name?: string;
  service_zone?: {
    fulfillment_set: {
      type: string;
    };
  };
};

type ShippingProps = {
  cart: Omit<HttpTypes.StoreCart, 'items'> & {
    items?: CartItem[];
  };
  availableShippingMethods:
    | (StoreCardShippingMethod &
        {
          rules: any;
          seller_id: string;
          price_type: string;
          id: string;
          amount?: number;
        }[])
    | null;
};

const CartShippingMethodsSection: FC<ShippingProps> = ({ cart, availableShippingMethods }) => {
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPendingDeleteRow, startTransitionDeleteRow] = useTransition();
  // Opciones que ya se eligieron automáticamente (para no repetirlo ni ciclarse)
  const autoSeleccionadas = useRef<Set<string>>(new Set());

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const isOpen = searchParams.get('step') === 'delivery';

  const _shippingMethods = availableShippingMethods?.filter(
    sm => sm.rules?.find((rule: any) => rule.attribute === 'is_return')?.value !== 'true'
  );

  // Las opciones cuyo precio hay que preguntarle al backend, como una cadena
  // estable.
  //
  // Esto no es un rodeo: `_shippingMethods` es un arreglo NUEVO en cada render,
  // así que usarlo de dependencia hacía que el efecto corriera siempre. Y
  // adentro se llama setCalculatedPricesMap, que provoca otro render, que
  // vuelve a correr el efecto. Es un ciclo infinito, y React lo corta tirando
  // "Maximum update depth exceeded" -- la pantalla de "¡Algo salió mal!".
  //
  // Antes casi no se notaba porque a este paso sólo se llegaba apretando
  // "Continuar al envío". Ahora se entra directo cuando la dirección ya está
  // guardada, así que el ciclo se dispara al abrir la pasarela.
  const idsConPrecioCalculado = (_shippingMethods ?? [])
    .filter(sm => sm.price_type === 'calculated')
    .map(sm => sm.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!idsConPrecioCalculado) return;

    let vigente = true;
    setIsLoadingPrices(true);

    Promise.allSettled(
      idsConPrecioCalculado.split(',').map(id => calculatePriceForShippingOption(id, cart.id))
    ).then(res => {
      // Si el carrito cambió mientras se consultaban los precios, los que
      // llegan ya no son de este carrito: se tiran.
      if (!vigente) return;

      const pricesMap: Record<string, number> = {};
      res
        .filter(r => r.status === 'fulfilled')
        .forEach(p => (pricesMap[p.value?.id || ''] = p.value?.amount!));

      setCalculatedPricesMap(pricesMap);
      setIsLoadingPrices(false);
    });

    return () => {
      vigente = false;
    };
  }, [idsConPrecioCalculado, cart.id]);

  const handleSubmit = () => {
    router.push(pathname + '?step=payment', { scroll: false });
  };

  const handleSetShippingMethod = async (id: string | null) => {
    if (!id) {
      return;
    }

    try {
      setError(null);
      setIsLoadingPrices(true);
      const res = await setShippingMethod({
        cartId: cart.id,
        shippingMethodId: id
      });
      if (!res.ok) {
        return setError(res.error?.message);
      }
    } catch (error: any) {
      setError(
        error?.message?.replace('Error setting up the request: ', '') || 'An error occurred'
      );
    } finally {
      setIsLoadingPrices(false);
      router.refresh();
    }
  };

  const handleRemoveShippingMethod = (methodId: string) => {
    startTransitionDeleteRow(async () => {
      await removeShippingMethod(methodId);
    });
    router.refresh();
  };

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const groupedBySellerId = _shippingMethods?.reduce((acc: any, method) => {
    const sellerId = method.seller_id!;

    if (!acc[sellerId]) {
      acc[sellerId] = [];
    }

    const amount = Number(
      method.price_type === 'flat' ? method.amount : calculatedPricesMap[method.id]
    );

    if (!isNaN(amount)) {
      acc[sellerId]?.push(method);
    }

    return acc;
  }, {});

  const handleEdit = () => {
    router.replace(pathname + '?step=delivery');
  };
  const isEditEnabled = !isOpen && !!cart?.shipping_methods?.length;

  const filteredGroupedBySellerId = Object.keys(groupedBySellerId || {}).filter(
    key => groupedBySellerId?.[key]?.[0]?.seller_name
  );

  // The shipping method a seller currently has selected in the cart, matched by
  // the option ids that belong to that seller.
  const getSelectedMethodForSeller = (key: string) => {
    const optionIds = new Set<string>(
      (groupedBySellerId?.[key] ?? []).map((o: any) => o.id)
    );
    return cart.shipping_methods?.find(
      method =>
        !!method.shipping_option_id && optionIds.has(method.shipping_option_id)
    );
  };

  // Payment is only reachable once every seller in the cart has a method.
  const allSellersHaveMethod =
    filteredGroupedBySellerId.length > 0 &&
    filteredGroupedBySellerId.every(key => !!getSelectedMethodForSeller(key));

  // Map each selected method back to its seller name for the summary rows.
  const sellerNameByOptionId = new Map<string, string | undefined>(
    (_shippingMethods ?? []).map((option: any) => [option.id, option.seller_name])
  );

  // Si un taller tiene UNA sola opción de envío (por ejemplo "Entrega digital" $0),
  // la elegimos sola para ahorrarle un paso al cliente. Una a la vez y sólo una
  // vez por opción.
  //
  // El efecto NO puede quedarse sin lista de dependencias (así estaba): correría
  // en cada render, y adentro llama a handleSetShippingMethod, que termina en
  // router.refresh(). Con el paso de envío abierto desde el principio eso es un
  // ciclo. Las claves de abajo son cadenas, no objetos, para que comparen por
  // valor y no por identidad.
  const clavesDeTalleres = filteredGroupedBySellerId.join(',');
  const enviosYaElegidos = (cart.shipping_methods ?? [])
    .map(m => m.shipping_option_id)
    .join(',');

  useEffect(() => {
    if (!isOpen || isLoadingPrices || isPendingDeleteRow) return;
    for (const key of filteredGroupedBySellerId) {
      const opciones = groupedBySellerId?.[key] ?? [];
      if (opciones.length !== 1) continue;
      const unica = opciones[0];
      if (getSelectedMethodForSeller(key) || autoSeleccionadas.current.has(unica.id)) continue;
      autoSeleccionadas.current.add(unica.id);
      handleSetShippingMethod(unica.id);
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoadingPrices, isPendingDeleteRow, clavesDeTalleres, enviosYaElegidos]);

  // Falta elegir envío: mientras eso pase, la compra no puede avanzar, así que
  // se dice aquí mismo y no sólo en el resumen de la derecha.
  const faltaElegir = !allSellersHaveMethod

  return (
    <PasoCheckout
      numero={2}
      titulo="Envío"
      listo={(cart.shipping_methods?.length ?? 0) > 0 && !isOpen}
      onEditar={isEditEnabled ? handleEdit : undefined}
      alerta={
        isOpen && faltaElegir && filteredGroupedBySellerId.length > 0
          ? filteredGroupedBySellerId.length > 1
            ? "Elige cómo te envía cada taller. Son envíos distintos porque cada pieza sale de un taller distinto."
            : "Falta elegir cómo te lo enviamos. Sin eso no se puede calcular el total ni pagar."
          : undefined
      }
    >
      {isOpen ? (
        <>
          <div className="grid">
            <div data-testid="delivery-options-container">
              <div className="pb-8 pt-2 md:pt-0">
                {filteredGroupedBySellerId.length === 0
                  ? 'Todavía no hay envíos disponibles para tu dirección. Escríbenos y lo resolvemos.'
                  : filteredGroupedBySellerId.map(key => {
                      const selectedMethod = getSelectedMethodForSeller(key);

                      return (
                      <div
                        key={key}
                        className="mb-4"
                      >
                        <Heading
                          level="h3"
                          className="mb-2"
                        >
                          {groupedBySellerId[key][0].seller_name}
                        </Heading>
                        <Listbox
                          value={selectedMethod?.shipping_option_id ?? null}
                          onChange={value => {
                            handleSetShippingMethod(value);
                          }}
                        >
                          <div className="relative">
                            <Listbox.Button
                              className={clsx(
                                'text-base-regular relative flex h-12 w-full cursor-default items-center justify-between rounded-lg border bg-component-secondary px-4 text-left focus:outline-none focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-300'
                              )}
                            >
                              {({ open }) => (
                                <>
                                  <span className="block truncate">
                                    {selectedMethod?.name ?? 'Elige cómo te lo enviamos'}
                                  </span>
                                  <ChevronUpDown
                                    className={clx('transition-rotate duration-200', {
                                      'rotate-180 transform': open
                                    })}
                                  />
                                </>
                              )}
                            </Listbox.Button>
                            <Transition
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Listbox.Options
                                className="text-small-regular border-top-0 absolute z-20 max-h-60 w-full overflow-auto rounded-lg border bg-white focus:outline-none sm:text-sm"
                                data-testid="shipping-address-options"
                              >
                                {groupedBySellerId[key].map((option: any) => (
                                  <Listbox.Option
                                    className="relative cursor-pointer select-none border-b py-4 pl-6 pr-10 hover:bg-gray-50"
                                    value={option.id}
                                    key={option.id}
                                  >
                                    {option.name}
                                    {' - '}
                                    {option.price_type === 'flat' ? (
                                      convertToLocale({
                                        amount: option.amount!,
                                        currency_code: cart?.currency_code
                                      })
                                    ) : calculatedPricesMap[option.id] ? (
                                      convertToLocale({
                                        amount: calculatedPricesMap[option.id],
                                        currency_code: cart?.currency_code
                                      })
                                    ) : isLoadingPrices ? (
                                      <Loader />
                                    ) : (
                                      '-'
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                      );
                    })}
                {!!cart?.shipping_methods?.length && (
                  <div className="flex flex-col">
                    {cart.shipping_methods?.map(method => (
                      <CartShippingMethodRow
                        key={method.id}
                        method={method}
                        sellerName={
                          method.shipping_option_id
                            ? sellerNameByOptionId.get(method.shipping_option_id)
                            : undefined
                        }
                        currency_code={cart.currency_code}
                        onRemoveShippingMethod={handleRemoveShippingMethod}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <Button
              className="px-6 py-2.5"
              onClick={handleSubmit}
              disabled={!allSellersHaveMethod || isPendingDeleteRow}
              loading={isLoadingPrices}
            >
              Continuar al pago
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
              <div className="flex flex-col">
                {cart.shipping_methods?.map(method => (
                  <div
                    key={method.id}
                    className="mb-4 rounded-md border p-4"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">Método</Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {method.name}{' '}
                      {convertToLocale({
                        amount: method.amount!,
                        currency_code: cart?.currency_code
                      })}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PasoCheckout>
  );
};

export default CartShippingMethodsSection;
