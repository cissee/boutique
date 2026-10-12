import { formatFCFA } from "@/lib/format/currency";

type Tone = "debt" | "repayment" | "neutral";

const toneClass: Record<Tone, string> = {
  debt: "text-debt",
  repayment: "text-repayment",
  neutral: "text-foreground",
};

/** Montant en FCFA, chiffres alignés, couleur selon le sens. */
export function Money({
  amount,
  tone = "neutral",
  sign,
  className = "",
}: {
  amount: number;
  tone?: Tone;
  sign?: "+" | "−";
  className?: string;
}) {
  return (
    <span className={`tabular whitespace-nowrap font-semibold ${toneClass[tone]} ${className}`}>
      {sign && `${sign} `}
      {formatFCFA(amount)}
    </span>
  );
}

/** Ton d'un solde client : rouge s'il doit de l'argent, vert s'il est à jour. */
export function balanceTone(balance: number): Tone {
  return balance > 0 ? "debt" : "repayment";
}
