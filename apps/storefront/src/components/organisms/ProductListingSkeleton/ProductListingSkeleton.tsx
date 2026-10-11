import { PRODUCT_LIMIT } from "@/const"

export const ProductListingSkeleton = () => {
  return (
    <div className='py-4' data-testid="product-listing-skeleton">
      <div className='lg:flex justify-between lg:h-10 items-center'>
        <div className='h-6 bg-secondary w-20 rounded-sm animate-pulse' />
        <div className='h-10 w-[200px] bg-secondary rounded-sm animate-pulse hidden lg:block' />
        <div className='flex lg:hidden gap-2 mt-4 mb-2'>
          <div className='w-1/2 h-[38px] bg-secondary rounded-sm animate-pulse' />
          <div className='w-1/2 h-[38px] bg-secondary rounded-sm animate-pulse' />
        </div>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-4 mt-6'>
        <div>
          <div className='rounded-sm bg-secondary h-80 border border-white animate-pulse' />
          <div className='rounded-sm bg-secondary h-80 border border-white animate-pulse' />
          <div className='rounded-sm bg-secondary h-80 border border-white animate-pulse' />
        </div>
        <div className='col-span-3'>
          {/* Mismas proporciones que ProductCard (imagen aspect-square + franja de texto)
              para que el cambio de skeleton a contenido real no mueva el layout (CLS). */}
          <ul className='flex flex-wrap gap-4'>
            {Array.from({ length: PRODUCT_LIMIT }).map((_, i) => (
              <li key={i} className='w-full lg:w-[calc(25%-1rem)] min-w-[250px]'>
                <div className='rounded-sm bg-secondary aspect-square border border-white animate-pulse' />
                <div className='h-[72px] mt-1 rounded-sm bg-secondary border border-white animate-pulse' />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
