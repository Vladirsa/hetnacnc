'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/helpers/zod-resolver';
import { z } from 'zod';
import { Button } from '@/components/atoms/Button/Button'
import { Textarea } from '@/components/atoms/Textarea/Textarea'
import { SelectField } from '../SelectField/SelectField';
import { cn } from '@/lib/utils';

const reasonOptions = [
  { label: '', value: '', hidden: true },
  {
    label: 'Violación de marca o derechos de autor',
    value: 'Violación de marca o derechos de autor',
  },
];

const formSchema = z.object({
  reason: z.string().nonempty('Please select reason'),
  comment: z.string().nonempty('Please add comment'),
});

type FormData = z.infer<typeof formSchema>;

export const ReportSellerForm = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
    setValue,
    clearErrors,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
      comment: '',
    },
  });

  const onSubmit = (data: FormData) => {
    console.log('Form Data:', data);
  };

  return (
    <div>
      {!isSubmitted ? (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='px-4 pb-5'>
            <label className='label-sm'>
              <p
                className={cn(
                  errors?.reason && 'text-negative'
                )}
              >
                Motivo
              </p>
              <SelectField
                options={reasonOptions}
                {...register('reason')}
                selectOption={(value) => {
                  setValue('reason', value);
                  clearErrors('reason');
                }}
                className={cn(
                  errors?.reason && 'border-negative'
                )}
              />
              {errors?.reason && (
                <p className='label-sm text-negative'>
                  {errors.reason.message}
                </p>
              )}
            </label>

            <label className='label-sm'>
              <p
                className={cn(
                  'mt-5',
                  errors?.comment && 'text-negative'
                )}
              >
                Comentario
              </p>
              <Textarea
                rows={5}
                {...register('comment')}
                className={cn(
                  errors.comment && 'border-negative'
                )}
              />
              {errors?.comment && (
                <p className='label-sm text-negative'>
                  {errors.comment.message}
                </p>
              )}
            </label>
          </div>

          <div className='border-t px-4 pt-5'>
            <Button
              type='submit'
              className='w-full py-3 uppercase'
            >
              Reportar vendedor
            </Button>
          </div>
        </form>
      ) : (
        <div className='text-center'>
          <div className='px-4 pb-5'>
            <h4 className='heading-lg uppercase'>
              ¡Gracias!
            </h4>
            <p className='max-w-[466px] mx-auto mt-4 text-lg text-secondary'>
              We&apos;ll check the listing to see if it
              violates our guidelines and take the necessary
              action to ensure a safe shopping experience
              for everyone. Thank you for helping us
              maintain a trusted community.
            </p>
          </div>

          <div className='border-t px-4 pt-5'>
            <Button
              className='w-full py-3 uppercase'
              onClick={onClose}
            >
              Entendido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};