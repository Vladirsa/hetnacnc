"use client"

import { Button } from "@/components/atoms/Button/Button"
import { Card } from "@/components/atoms/Card/Card"
import { LabeledInput } from "@/components/cells/LabeledInput/LabeledInput"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  FieldError,
  FieldValues,
  FormProvider,
  useForm,
  useFormContext,
  UseFormReturn,
} from "react-hook-form"
import { ProfilePasswordFormData, profilePasswordSchema } from "./schema"
import { useState } from "react"
import { updateCustomerPassword } from "@/lib/data/customer"
import { Heading, toast } from "@medusajs/ui"
import LocalizedClientLink from "../LocalizedLink/LocalizedLink"
import { PasswordValidator } from "@/components/cells/PasswordValidator/PasswordValidator"

export const ProfilePasswordForm = ({ token }: { token?: string }) => {
  const form = useForm<ProfilePasswordFormData>({
    resolver: zodResolver(profilePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  })

  return (
    <FormProvider {...form}>
      <Form form={form} token={token} />
    </FormProvider>
  )
}

const Form = ({
  form,
  token,
}: {
  form: UseFormReturn<ProfilePasswordFormData>
  token?: string
}) => {
  const [success, setSuccess] = useState(false)
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    FieldError | undefined
  >(undefined)
  const [newPasswordError, setNewPasswordError] = useState({
    isValid: false,
    lower: false,
    upper: false,
    "8chars": false,
    symbolOrDigit: false,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useFormContext()

  const updatePassword = async (data: FieldValues) => {
    if (form.getValues("confirmPassword") !== form.getValues("newPassword")) {
      setConfirmPasswordError({
        message: "Las contraseñas no coinciden.",
        type: "custom",
      } as FieldError)
      return
    }

    setConfirmPasswordError(undefined)

    if (newPasswordError.isValid) {
      try {
        const res = await updateCustomerPassword(data.newPassword, token!)
        if (res.success) {
          setSuccess(true)
        } else {
          toast.error(/unauthorized|invalid|expired|jwt/i.test(String(res.error)) ? "La liga ya venció o no es válida. Pide una nueva en ¿Olvidaste tu contraseña?" : "Algo salió mal. Intenta de nuevo.")
        }
      } catch (err) {
        console.log(err)
        return
      }
    }
  }

  return success ? (
    <div className="p-4">
      <Heading
        level="h1"
        className="uppercase heading-md text-primary text-center"
      >
        Contraseña actualizada
      </Heading>
      <p className="text-center my-8">
        Ya puedes iniciar sesión con tu nueva contraseña
      </p>
      <LocalizedClientLink href="/login">
        <Button
          className="uppercase py-3 px-6 !font-semibold w-full"
          size="large"
        >
          Iniciar sesión
        </Button>
      </LocalizedClientLink>
    </div>
  ) : (
    <form
      className="flex flex-col gap-4 px-4"
      onSubmit={handleSubmit(updatePassword)}
    >
      <Heading
        level="h1"
        className="uppercase heading-md text-primary"
      >
        Crear nueva contraseña
      </Heading>
      <p className="text-secondary label-md">
        Ya casi: escribe tu nueva contraseña dos veces.
      </p>
      <LabeledInput
        label="Contraseña"
        type="password"
        error={errors.newPassword as FieldError}
        {...register("newPassword")}
      />
      <PasswordValidator
        password={form.watch("newPassword")}
        setError={setNewPasswordError}
      />
      <LabeledInput
        label="Confirmar contraseña"
        type="password"
        error={(confirmPasswordError || errors.confirmPassword) as FieldError}
        {...register("confirmPassword")}
      />
      <Button className="w-full my-4 uppercase">Crear nueva contraseña</Button>
    </form>
  )
}
