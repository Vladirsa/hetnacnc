// Aviso de seguridad: los tratos dentro de HETNA
export const AvisoSeguro = ({ compacto = false }: { compacto?: boolean }) => (
  <div className="bg-[#EEF4FB] border border-[#C9DBF0] rounded-[12px] px-4 py-3.5 flex gap-3 text-[13.5px] text-[#1E3A5F] leading-relaxed">
    <span className="text-[#1D5FA8] shrink-0 mt-0.5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /></svg>
    </span>
    <div>
      <strong className="block text-[#142033]">Compra y contrata dentro de HETNA</strong>
      {compacto ? (
        <span>Si pagas o tratas por fuera, HETNA no puede protegerte ni responder por fraudes.</span>
      ) : (
        <span>
          Así tu pago queda protegido y las calificaciones cuentan. Nunca deposites a cuentas personales. HETNA no se hace
          responsable de tratos, pagos ni fraudes hechos fuera de la página. Si alguien te pide seguir por WhatsApp para
          pagar, repórtalo.
        </span>
      )}
    </div>
  </div>
)
