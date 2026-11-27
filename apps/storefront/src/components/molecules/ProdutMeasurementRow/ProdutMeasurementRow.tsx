import { TS } from "@/i18n/TS"
import { SingleProductMeasurement } from '@/types/product';

export const ProdutMeasurementRow = ({
  measurement,
}: {
  measurement: SingleProductMeasurement;
}) => {
  const { label, inches, cm } = measurement;
  return (
    <div className='border rounded-sm grid grid-cols-3 text-center label-md'>
      <div className='border-r py-3'><TS>{label}</TS></div>
      <div className='border-r py-3'>{inches} <TS>in</TS></div>
      <div className='py-3'>{cm} <TS>cm</TS></div>
    </div>
  );
};
