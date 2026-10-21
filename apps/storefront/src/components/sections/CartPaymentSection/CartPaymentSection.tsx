'use client';

import { useCallback, useEffect, useState } from 'react';

import { RadioGroup } from '@headlessui/react';
import { CreditCard } from '@medusajs/icons';
import { Container, Text } from '@medusajs/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { initiatePaymentSession } from '@/lib/data/cart';
import { iniciarMercadoPago } from '@/lib/data/mercadopago';

import {
  isMercadoPago as isMercadoPagoFunc,
  isPaypal as isPaypalFunc,
  isStripe as isStripeFunc
} from '../../../lib/constants';
import { paymentInfoMap } from '../../../lib/pagos';
import { PasoCheckout } from '../CartAddressSection/PasoCheckout';
import PaymentContainer, {
  StripeCardContainer
} from '../../organisms/PaymentContainer/PaymentContainer';

type StoreCardPaymentMethod = any & {
  service_zone?: {
    fulfillment_set: {
      type: string;
    };
  };
};

const CartPaymentSection = ({
  cart,
  availablePaymentMethods
}: {
  cart: any;
  availablePaymentMethods: StoreCardPaymentMethod[] | null;
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === 'pending'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ''
  );

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const isOpen = searchParams.get('step') === 'payment';

  const isStripe = isStripeFunc(selectedPaymentMethod);

  const setPaymentMethod = async (method: string) => {
    setError(null);
    setSelectedPaymentMethod(method);
    if (isStripeFunc(method)) {
      await initiatePaymentSession(cart, {
        provider_id: method
      });
    }
  };

  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0;

  const paymentReady = (activeSession && cart?.shipping_methods.length !== 0) || paidByGiftcard;

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(name, value);

      return params.toString();
    },
    [searchParams]
  );

  const handleEdit = () => {
    router.push(pathname + '?' + createQueryString('step', 'payment'), {
      scroll: false
    });
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const shouldInputCard = isStripeFunc(selectedPaymentMethod) && !activeSession;

      const checkActiveSession = activeSession?.provider_id === selectedPaymentMethod;

      if (isMercadoPagoFunc(selectedPaymentMethod) || isPaypalFunc(selectedPaymentMethod)) {
        // Siempre renovamos la sesión para que el monto en Mercado Pago / PayPal coincida con el carrito.
        // Al terminar de pagar, el cliente regresa a /checkout/mercadopago o /checkout/paypal.
        const locale = pathname.split('/')[1] || 'mx';
        const rutaRetorno = isPaypalFunc(selectedPaymentMethod) ? 'paypal' : 'mercadopago';
        const res = await iniciarMercadoPago(
          cart,
          selectedPaymentMethod,
          `${window.location.origin}/${locale}/checkout/${rutaRetorno}`
        );
        if (!res.ok) {
          throw new Error(res.error);
        }
      } else if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod
        });
      }

      if (!shouldInputCard) {
        return router.push(pathname + '?' + createQueryString('step', 'review'), {
          scroll: false
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const isEditEnabled = !isOpen && !!cart?.payment_collection?.payment_sessions?.length;

  // Sin método de envío elegido no se puede abrir una sesión de pago por el
  // monto correcto, así que se dice aquí en vez de dejar que el botón falle.
  const faltaEnvio = (cart?.shipping_methods?.length ?? 0) === 0

  return (
    <PasoCheckout
      numero={3}
      titulo="Forma de pago"
      listo={!isOpen && paymentReady}
      onEditar={isEditEnabled ? handleEdit : undefined}
      alerta={isOpen && faltaEnvio ? "Primero elige el envío de arriba." : undefined}
      testId="checkout-step-payment"
    >
      <div>
        <div className={isOpen ? 'block' : 'hidden'}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {availablePaymentMethods.map(paymentMethod => (
                  <div key={paymentMethod.id}>
                    {isStripeFunc(paymentMethod.id) ? (
                      <StripeCardContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setCardBrand={setCardBrand}
                        setError={setError}
                        setCardComplete={setCardComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex w-1/3 flex-col">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">Método de pago</Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Tarjeta de regalo
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            className="mt-4 px-6 py-2.5"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={
              faltaEnvio ||
              (isStripe && !cardComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
          >
            {!activeSession && isStripeFunc(selectedPaymentMethod)
              ? 'Ingresar datos de la tarjeta'
              : 'Continuar a revisión'}
          </Button>
        </div>

        <div className={isOpen ? 'hidden' : 'block'}>
          {cart && paymentReady && activeSession ? (
            <div className="flex w-full items-start gap-x-1">
              <div className="flex w-1/3 flex-col">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">Método de pago</Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[activeSession?.provider_id]?.title || activeSession?.provider_id}
                </Text>
              </div>
              <div className="flex w-1/3 flex-col">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">Datos de pago</Text>
                <div
                  className="txt-medium text-ui-fg-subtle flex items-center gap-2"
                  data-testid="payment-details-summary"
                >
                  <Container className="bg-ui-button-neutral-hover flex h-7 w-fit items-center p-2"     data-testid="payment-details-summary">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || <CreditCard />}
                  </Container>
                  <Text>
                    {isStripeFunc(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : isMercadoPagoFunc(selectedPaymentMethod)
                        ? 'Pagarás en Mercado Pago'
                        : isPaypalFunc(selectedPaymentMethod)
                          ? 'Pagarás en PayPal'
                          : 'Se confirma en el siguiente paso'}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex w-1/3 flex-col">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">Método de pago</Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Tarjeta de regalo
              </Text>
            </div>
          ) : null}
        </div>
      </div>
    </PasoCheckout>
  );
};

export default CartPaymentSection;
