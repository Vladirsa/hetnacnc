"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { Button } from "@/components/atoms/Button/Button"
import { Card } from "@/components/atoms/Card/Card"
import { InfoIcon } from "@/icons"
import { Divider, Heading } from "@medusajs/ui"
import { useState } from "react"
import { Modal } from "../Modal/Modal"
import { HttpTypes } from "@medusajs/types"
import { sendResetPasswordEmail } from "@/lib/data/customer"

export const ProfilePassword = ({
  user,
}: {
  user: HttpTypes.StoreCustomer
}) => {
  const [showForm, setShowForm] = useState(false)

  const handleSendResetPasswordEmail = async () => {
    const res = await sendResetPasswordEmail(user.email)
    if (res.success) {
      setShowForm(false)
    }
  }

  return (
    <>
      <Card className="bg-secondary p-4 flex justify-between items-center mt-8">
        <Heading level="h2" className="heading-sm uppercase">
          <T>Contraseña</T>
        </Heading>
        <Button
          variant="tonal"
          className="uppercase flex items-center gap-2 font-semibold"
          onClick={() => setShowForm(true)}
        >
          <T>Cambiar contraseña</T>
        </Button>
      </Card>
      <Card className="p-0">
        <div className="p-4">
          <p className="label-md text-secondary"><T>Contraseña actual</T></p>
          <p className="label-lg text-primary">****************</p>
        </div>
        <Divider />
        <div className="p-4">
          <p className="label-md text-secondary flex items-center gap-4">
            <InfoIcon size={18} className="text-secondary" />
            <T>Usa una contraseña única para proteger tu cuenta.</T>
          </p>
        </div>
      </Card>
      {showForm && (
        <Modal heading="Cambiar contraseña" onClose={() => setShowForm(false)}>
          <div className="flex p-4 justify-center">
            <Button
              className="uppercase py-3 px-6 !font-semibold"
              onClick={handleSendResetPasswordEmail}
            >
              <T>Enviar correo para restablecer contraseña</T>
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
