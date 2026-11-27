"use client"
import { T } from "@/components/hetna/i18n/Idioma"
import { Input } from "@/components/atoms/Input/Input"
import { cn } from "@/lib/utils"
import { FieldError } from "react-hook-form"

type LabeledInputProps = {
  label: string
  error?: FieldError
} & React.InputHTMLAttributes<HTMLInputElement>

export const LabeledInput = ({
  error,
  label,
  className,
  ...props
}: LabeledInputProps) => (
  <label className={cn("label-sm block", className)}>
    <p className={cn(error && "text-negative")}><T>{label}</T></p>
    <Input error={!!error} {...props} />
    {error && <p className="label-sm text-negative">{error.message}</p>}
  </label>
)
