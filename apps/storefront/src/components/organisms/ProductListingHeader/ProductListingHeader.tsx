'use client';

import { usePathname, useRouter } from 'next/navigation';

import { SelectField } from '@/components/molecules/SelectField/SelectField'

const selectOptions = [
  { label: 'Más recientes', value: 'created_at' },
  { label: 'Precio: menor a mayor', value: 'price_asc' },
  { label: 'Precio: mayor a menor', value: 'price_desc' }
];

export const ProductListingHeader = ({ total }: { total: number }) => {
  const router = useRouter();
  const pathname = usePathname();

  const selectOptionHandler = (value: string) => {
    router.push(`${pathname}?sortBy=${value}`);
  };

  return (
    <div
      className="flex w-full items-center justify-between"
      data-testid="product-listing-header"
    >
      <div data-testid="product-listing-total">{total} {total === 1 ? "producto" : "productos"}</div>
    </div>
  );
};
