import { getMessages } from "@/i18n";
import { smsLink, whatsappLink } from "@/lib/receipt";

const t = getMessages();

/**
 * Envoi du reçu par le boutiquier, depuis son téléphone : ouvre WhatsApp ou l'application
 * SMS avec le message pré-rempli (modifiable avant l'envoi). Aucun service payant.
 */
export function ReceiptButtons({
  text,
  phone,
  compact = false,
}: {
  text: string;
  phone: string | null;
  compact?: boolean;
}) {
  const size = compact ? "min-h-9 px-3 text-sm" : "min-h-12 px-4 text-base";
  return (
    <div className="flex flex-col gap-2">
      {!compact && <p className="text-sm font-semibold">{t.receipt.sendTitle}</p>}
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappLink(phone, text)}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center rounded-xl bg-repayment font-semibold text-white ${size}`}
        >
          {compact ? t.receipt.whatsapp : `${t.receipt.whatsapp} →`}
        </a>
        <a href={smsLink(phone, text)} className={`flex items-center rounded-xl border-2 border-repayment font-semibold text-repayment ${size}`}>
          {t.receipt.sms}
        </a>
      </div>
      {!compact && !phone && <p className="text-xs text-muted">{t.receipt.noPhone}</p>}
    </div>
  );
}
