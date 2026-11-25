import { cn } from '@/lib/utils';

// Nombres de color en español (las opciones "Color" de los productos) a su
// tono; si el valor ya es un color CSS (#hex, rgb…) se usa tal cual.
const COLORES_ES: Record<string, string> = {
  negro: '#1B1B18', blanco: '#FFFFFF', gris: '#9A9A96', plata: '#C0C0C0', rojo: '#C62828', azul: '#1E5BB8',
  naranja: '#F07C1E', verde: '#2E7D32', amarillo: '#F5C518', rosa: '#E91E8C', morado: '#6A3FA0', cafe: '#6D4C41',
  dorado: '#C9A227', transparente: 'rgba(255,255,255,0.4)',
};
const tono = (v: unknown) => {
  const t = String(v ?? '').trim();
  return COLORES_ES[t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()] || t;
};

interface ChipProps {
  value?: React.ReactNode | string;
  selected?: boolean;
  disabled?: boolean;
  color?: boolean;
  onSelect?: () => void;
  className?: string;
  "data-testid"?: string;
}

export function Chip({
  value,
  selected,
  disabled,
  color,
  onSelect,
  className,
  "data-testid": dataTestId,
}: ChipProps) {
  const baseClasses = 'chip-wrapper';
  const selectedClasses = selected ? 'border-primary' : '';
  const hoverClasses =
    !disabled && !selected ? 'hover:bg-gray-200' : '';
  const disabledClasses = disabled
    ? 'bg-component border-disabled/50 hover:bg-component cursor-not-allowed text-disabled'
    : 'cursor-pointer';
  const colorClasses = color
    ? 'w-[40px] h-[40px] border'
    : '';

  return (
    <div
      data-disabled={disabled}
      className={cn(
        baseClasses,
        colorClasses,
        selectedClasses,
        hoverClasses,
        disabledClasses,
        className
      )}
      onClick={!disabled ? onSelect : undefined}
      role='button'
      tabIndex={disabled ? -1 : 0}
      data-testid={dataTestId ?? 'chip'}
    >
      {color ? (
        <span
          className={cn(
            'w-[32px] h-[32px] bg-action absolute top-[3px] left-[3px] rounded-xs',
            disabled && 'bg-disabled'
          )}
          style={{
            backgroundColor: tono(value),
          }}
          title={String(value ?? '')}
        />
      ) : (
        value
      )}
    </div>
  );
}
