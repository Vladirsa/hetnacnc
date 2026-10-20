'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useCartContext } from '@/components/providers';
import { toast } from '@/lib/helpers/toast';

export const UpdateCartItemButton = ({
  quantity,
  lineItemId
}: {
  quantity: number;
  lineItemId: string;
}) => {
  const { updateCartItem, isUpdatingItem } = useCartContext();
  const [pendingQuantity, setPendingQuantity] = useState(quantity);
  const debounceTimerRef = useRef<NodeJS.Timeout>(null);
  const router = useRouter();

  useEffect(() => {
    setPendingQuantity(quantity);
  }, [quantity]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return;

    setPendingQuantity(newQuantity);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await updateCartItem(lineItemId, newQuantity);
        router.refresh();
      } catch (error: unknown) {
        setPendingQuantity(quantity);
        const errorMessage =
          error instanceof Error
            ? error.message.replace('Error setting up the request: ', '')
            : 'Failed to update quantity';
        toast.error({
          title: 'Error al actualizar el carrito',
          description: errorMessage
        });
      }
    }, 500);
  };

  const isDecreaseDisabled = pendingQuantity === 1 || isUpdatingItem || !lineItemId;
  const isIncreaseDisabled = isUpdatingItem || !lineItemId;

  return (
    <div className="flex items-center overflow-hidden rounded-[8px] border border-[#E7E4DC]">
      <button
        type="button"
        aria-label="Quitar uno"
        className="flex h-8 w-8 items-center justify-center text-[18px] leading-none text-[#4A4943] hover:bg-[#F4F2EC] disabled:text-[#C7C4BC] disabled:hover:bg-transparent"
        disabled={isDecreaseDisabled}
        onClick={() => handleQuantityChange(pendingQuantity - 1)}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={`w-9 text-center text-[14px] font-semibold ${
          isUpdatingItem ? 'text-[#8A8780]' : 'text-[#1B1B18]'
        }`}
      >
        {pendingQuantity}
      </span>
      <button
        type="button"
        aria-label="Agregar uno"
        className="flex h-8 w-8 items-center justify-center text-[18px] leading-none text-[#4A4943] hover:bg-[#F4F2EC] disabled:text-[#C7C4BC] disabled:hover:bg-transparent"
        disabled={isIncreaseDisabled}
        onClick={() => handleQuantityChange(pendingQuantity + 1)}
      >
        +
      </button>
    </div>
  );
};
