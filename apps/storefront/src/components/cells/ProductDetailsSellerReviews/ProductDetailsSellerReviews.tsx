import { Button } from '@/components/atoms';
import { SellerReview } from '@/components/molecules';
import { SingleProductReview } from '@/types/product';

export const ProductDetailsSellerReviews = ({
  reviews,
}: {
  reviews: SingleProductReview[];
}) => {
  return (
    <div className='p-4 border rounded-sm' data-testid="product-seller-reviews-section">
      <div className='flex justify-between items-center mb-5'>
        <h4 className='uppercase heading-sm'>
          Reseñas del vendedor
        </h4>
        <Button
          variant='tonal'
          className='uppercase label-md font-400'
          data-testid="product-seller-reviews-see-more"
        >
          Ver más
        </Button>
      </div>
      {reviews.map((review) => (
        <SellerReview key={review.id} review={review} data-testid={`product-seller-review-${review.id}`} />
      ))}
    </div>
  );
};
