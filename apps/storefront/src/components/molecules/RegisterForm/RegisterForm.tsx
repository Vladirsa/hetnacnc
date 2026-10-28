"use client"
import {
  FieldError,
  FieldValues,
  FormProvider,
  useForm,
  useFormContext,
} from "react-hook-form"
import { Button } from "@/components/atoms"
import { zodResolver } from "@hookform/resolvers/zod"
import { LabeledInput } from "@/components/cells"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { registerFormSchema, RegisterFormData } from "./schema"
import { signup } from "@/lib/data/customer"
import { useEffect, useState } from "react"
import { Container } from "@medusajs/ui"
import Link from "next/link"
import { PasswordValidator } from "@/components/cells/PasswordValidator/PasswordValidator"
import { toast } from "@/lib/helpers/toast"

// HETNA: a donde regresar despues de crear la cuenta (?volver=/mx/servicios/cotizador-cnc)
const leerVolver = () => {
  if (typeof window === "undefined") return null
  const v = new URLSearchParams(window.location.search).get("volver")
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null
}

export const RegisterForm = () => {
  const methods = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      password: "",
    },
  })

  return (
    <FormProvider {...methods}>
      <Form />
    </FormProvider>
  )
}

const Form = () => {
  const [passwordError, setPasswordError] = useState({
    isValid: false,
    lower: false,
    upper: false,
    "8chars": false,
    symbolOrDigit: false,
  })
  const [volver, setVolver] = useState<string | null>(null)
  useEffect(() => setVolver(leerVolver()), [])

  const {
    handleSubmit,
    register,
    watch,
    formState: { errors, isSubmitting },
  } = useFormContext<RegisterFormData>()

  const submit = async (data: RegisterFormData) => {
    if (!passwordError.isValid) {
      return
    }

    const formData = new FormData()
    formData.append("email", data.email)
    formData.append("password", data.password)
    formData.append("first_name", data.firstName)
    formData.append("last_name", data.lastName)
    formData.append("phone", data.phone)

    const res = await signup(formData)

    if (res && res?.id) {
      window.location.href = leerVolver() || "/user"
      return
    }

    if (res && !res?.id) {

      // Temporary solution. Check also for status code when it's fixed by backend
      const errorMessage = res.toLowerCase().includes('error: identity with email already exists') ? 'It seems the email you entered is already associated with another account. Please log in instead.' : res
      toast.error({ title: errorMessage})
    }
  }

  return (
    <main className="container" data-testid="register-page">
      <Container className="border max-w-xl mx-auto mt-8 p-4" data-testid="register-form-container">
        <h1 className="heading-md text-primary uppercase mb-8">
          Crear cuenta
        </h1>
        <form onSubmit={handleSubmit(submit)} data-testid="register-form">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <LabeledInput
              className="md:w-1/2"
              label="Nombre"
              placeholder="Tu nombre"
              error={errors.firstName as FieldError}
              data-testid="register-first-name-input"
              {...register("firstName")}
            />
            <LabeledInput
              className="md:w-1/2"
              label="Apellidos"
              placeholder="Tus apellidos"
              error={errors.lastName as FieldError}
              data-testid="register-last-name-input"
              {...register("lastName")}
            />
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <LabeledInput
              className="md:w-1/2"
              label="Correo electrónico"
              placeholder="Tu correo electrónico"
              error={errors.email as FieldError}
              data-testid="register-email-input"
              {...register("email")}
            />
            <LabeledInput
              className="md:w-1/2"
              label="Teléfono"
              placeholder="Tu teléfono"
              error={errors.phone as FieldError}
              data-testid="register-phone-input"
              {...register("phone")}
            />
          </div>
          <div>
            <LabeledInput
              className="mb-4"
              label="Contraseña"
              placeholder="Tu contraseña"
              type="password"
              error={errors.password as FieldError}
              data-testid="register-password-input"
              {...register("password")}
            />
            <PasswordValidator
              password={watch("password")}
              setError={setPasswordError}
            />
          </div>

          <Button
            className="w-full flex justify-center mt-8 uppercase"
            disabled={isSubmitting}
            loading={isSubmitting}
            data-testid="register-submit-button"
          >
            Crear cuenta
          </Button>
          {/* Aviso de privacidad simplificado (LFPDPPP art. 16): responsable, finalidades y dónde leer el integral */}
          <p className="mt-4 text-xs leading-relaxed text-secondary">
            Al crear tu cuenta aceptas los{" "}
            <LocalizedClientLink href="/terminos-y-condiciones" className="underline">Términos y condiciones</LocalizedClientLink>.
            HETNA CNC usa tus datos para administrar tu cuenta, tus compras y cotizaciones, y para darte soporte. Consulta
            el{" "}
            <LocalizedClientLink href="/aviso-de-privacidad" className="underline">Aviso de privacidad</LocalizedClientLink>{" "}
            para conocer tus derechos y cómo negarte a recibir promociones.
          </p>
        </form>
      </Container>
      <Container className="border max-w-xl mx-auto mt-8 p-4">
        <h2 className="heading-md text-primary uppercase mb-8">
          ¿Ya tienes cuenta?
        </h2>
        <Link href={volver ? `/login?volver=${encodeURIComponent(volver)}` : "/login"} data-testid="register-login-link">
          <Button
            variant="tonal"
            className="w-full flex justify-center mt-8 uppercase"
          >
            Iniciar sesión
          </Button>
        </Link>
      </Container>
    </main>
  )
}
