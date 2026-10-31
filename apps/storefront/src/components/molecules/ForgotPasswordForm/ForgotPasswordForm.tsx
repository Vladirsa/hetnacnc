'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ClientError } from '@mercurjs/client';
import Link from 'next/link';
import { FieldError, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Button } from '@/components/atoms/Button/Button'
import { LabeledInput } from '@/components/cells/LabeledInput/LabeledInput'
import { sendResetPasswordEmail } from '@/lib/data/customer';
import { toast } from '@/lib/helpers/toast';

import { ForgotPasswordFormData, forgotPasswordSchema } from './schema';

export const ForgotPasswordForm = () => {
  const methods = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <Form />
    </FormProvider>
  );
};

const Form = () => {
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    reset
  } = useFormContext<ForgotPasswordFormData>();
  // Se queda a la vista (un aviso flotante se pierde y parece que no hizo nada)
  const [enviado, setEnviado] = useState<string | null>(null);

  const submit = async (data: ForgotPasswordFormData) => {
    if (!data.email) return;

    const correo = data.email.trim().toLowerCase();
    const result = await sendResetPasswordEmail(correo).catch(() => ({ success: false, error: null }));

    if (!result.success) {
      toast.error({ title: 'No se pudo enviar. Recarga la página e intenta de nuevo.' });
      return;
    }

    reset({ email: '' });
    setEnviado(correo);
  };

  return (
    <div
      className="mx-auto mt-6 w-full max-w-xl space-y-4 rounded-sm border p-4"
      data-testid="forgot-password-form-container"
    >
      <h1 className="heading-md my-0 mb-2 uppercase text-primary">¿Olvidaste tu contraseña?</h1>
      <p className="text-md">
        Escribe el correo de tu cuenta y te mandamos una liga para elegir una contraseña nueva.
      </p>
      {enviado && (
        <div className="rounded-sm border border-[#B7E0C8] bg-[#E6F4EC] p-3 text-md text-[#14683F]" role="status">
          Listo. Si <b>{enviado}</b> tiene cuenta, te llegará un correo con la liga en unos minutos. Revisa también
          spam o promociones. La liga dura <b>15 minutos</b>.
        </div>
      )}
      <form
        onSubmit={handleSubmit(submit)}
        data-testid="forgot-password-form"
      >
        <div className="space-y-4">
          <LabeledInput
            label="Correo electrónico"
            placeholder="Tu correo electrónico"
            error={errors.email as FieldError}
            data-testid="forgot-password-email-input"
            {...register('email')}
          />
        </div>

        <div className="mt-8 space-y-4">
          <Button
            className="w-full uppercase"
            disabled={isSubmitting}
            loading={isSubmitting}
            data-testid="forgot-password-submit-button"
          >
            {isSubmitting ? 'Enviando…' : 'Restablecer contraseña'}
          </Button>

          <Link
            href="/login"
            className="flex"
            data-testid="forgot-password-back-to-login-link"
          >
            <Button
              variant="tonal"
              className="flex w-full justify-center uppercase"
            >
              Volver a iniciar sesión
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
};
