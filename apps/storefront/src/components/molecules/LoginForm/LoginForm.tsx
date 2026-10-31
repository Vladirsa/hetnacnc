'use client';

import { useState, type FormEvent } from 'react';

import { zodResolver } from '@/lib/helpers/zod-resolver';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FieldError, FieldValues, FormProvider, useForm, useFormContext } from 'react-hook-form';
import { copiarAutollenado } from '@/lib/helpers/autollenado';

import { Button } from '@/components/atoms/Button/Button'
import { Alert } from '@/components/atoms/Alert/Alert';
import { LabeledInput } from '@/components/cells/LabeledInput/LabeledInput'
import { login, reenviarConfirmacion, transferCart } from '@/lib/data/customer';
import { toast } from '@/lib/helpers/toast';

import { LoginFormData, loginFormSchema } from './schema';

// HETNA: a donde regresar despues de iniciar sesion (?volver=/mx/servicios/cotizador-cnc)
const destinoSeguro = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/user');

export const LoginForm = () => {
  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <Form />
    </FormProvider>
  );
};

const Form = () => {
  const [isAuthError, setIsAuthError] = useState(false);
  // Cuenta sin confirmar: el aviso se queda en la pantalla con botón de reenviar
  const [porConfirmar, setPorConfirmar] = useState<{ email: string; texto: string } | null>(null);
  const [reenviado, setReenviado] = useState(false);
  const {
    handleSubmit,
    register,
    getValues,
    setValue,
    formState: { errors, isSubmitting }
  } = useFormContext();
  // Correo y contraseña que rellenó el navegador sin avisar (ver copiarAutollenado)
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    copiarAutollenado(e.currentTarget, getValues, setValue);
    return handleSubmit(submit)(e);
  };
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSessionExpired = searchParams.get('sessionExpired') === 'true';
  const isSessionRequired = searchParams.get('sessionRequired') === 'true';
  const volver = searchParams.get('volver');
  const destino = destinoSeguro(volver);

  const submit = async (data: FieldValues) => {
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);

    setPorConfirmar(null);
    setReenviado(false);
    const res = await login(formData);

    if (res.success) {
      setIsAuthError(false);
      await transferCart();
      router.push(destino);
      return;
    }
    if ('verificar' in res && res.verificar) {
      setPorConfirmar({ email: String(data.email || ''), texto: res.message || '' });
      return;
    }
    setIsAuthError(true);
    toast.error({ title: res.message || 'No se pudo iniciar sesión. Intenta de nuevo.' });
  };

  const clearApiError = () => {
    isAuthError && setIsAuthError(false);
  };

  const getAuthMessage = () => {
    if (isSessionExpired) {
      return 'Tu sesión venció. Vuelve a iniciar sesión.';
    }
    if (isSessionRequired) {
      return 'Inicia sesión para continuar.';
    }
    return null;
  };

  const authMessage = getAuthMessage();

  return (
    <main
      className="container"
      data-testid="login-page"
    >
      <div className="mx-auto mt-6 w-full max-w-xl space-y-4">
        {authMessage && (
          <Alert
            title={authMessage}
            className="w-full"
            icon
            data-testid="login-auth-alert"
          />
        )}
        <div
          className="rounded-sm border p-4"
          data-testid="login-form-container"
        >
          <h1 className="heading-md mb-8 uppercase text-primary">Iniciar sesión</h1>
          {porConfirmar && (
            <div className="mb-6 rounded-sm border border-[#F2C98F] bg-[#FFF8EE] p-3 text-md text-[#5A3A12]" role="status">
              <p className="m-0">{porConfirmar.texto}</p>
              <button
                type="button"
                disabled={reenviado}
                onClick={async () => {
                  await reenviarConfirmacion(porConfirmar.email);
                  setReenviado(true);
                }}
                className="mt-2 font-semibold underline disabled:no-underline disabled:opacity-70"
              >
                {reenviado ? 'Listo, te la volvimos a mandar.' : 'Volver a mandar la liga'}
              </button>
            </div>
          )}
          <form
            onSubmit={enviar}
            data-testid="login-form"
          >
            <div className="space-y-4">
              <LabeledInput
                label="Correo electrónico"
                placeholder="Tu correo electrónico"
                error={
                  (errors.email as FieldError) ||
                  (isAuthError ? ({ message: '' } as FieldError) : undefined)
                }
                data-testid="login-email-input"
                {...register('email', {
                  onChange: clearApiError
                })}
              />
              <LabeledInput
                label="Contraseña"
                placeholder="Tu contraseña"
                type="password"
                error={
                  (errors.password as FieldError) ||
                  (isAuthError ? ({ message: '' } as FieldError) : undefined)
                }
                data-testid="login-password-input"
                {...register('password', {
                  onChange: clearApiError
                })}
              />
            </div>

            <Link
              href="/forgot-password"
              className="label-md mt-4 block text-right uppercase text-action-on-secondary"
              data-testid="login-forgot-password-link"
            >
              ¿Olvidaste tu contraseña?
            </Link>

            <Button
              className="mt-8 w-full uppercase"
              disabled={isSubmitting}
              data-testid="login-submit-button"
            >
              Iniciar sesión
            </Button>
          </form>
        </div>

        <div className="rounded-sm border p-4">
          <h2 className="heading-md mb-4 uppercase text-primary">
            ¿Aún no tienes cuenta?
          </h2>
          <Link
            href={volver ? `/register?volver=${encodeURIComponent(destino)}` : '/register'}
            data-testid="login-register-link"
          >
            <Button
              variant="tonal"
              className="mt-8 flex w-full justify-center uppercase"
            >
              Crear cuenta
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
};
