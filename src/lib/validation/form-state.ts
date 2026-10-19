import { z } from "zod";

/** État renvoyé par une Server Action à un formulaire (useActionState). */
export type FormState = {
  /** Message d'erreur général. */
  error?: string;
  /** Message de réussite. */
  success?: string;
  /** Erreurs par champ. */
  fieldErrors?: Record<string, string[] | undefined>;
  /** Valeurs saisies, pour réafficher le formulaire (jamais les mots de passe). */
  values?: Record<string, string>;
  /**
   * Clé d'idempotence de la prochaine opération financière. Inchangée après un échec
   * (un nouvel essai ne peut pas créer de doublon), renouvelée après un succès.
   */
  requestId?: string;
  /** Client concerné par la dernière opération réussie. */
  customerId?: string;
  /** Opération créée par la dernière action réussie, et son montant. */
  transactionId?: string;
  transactionAmount?: number;
  /** Clé d'idempotence d'une éventuelle correction de cette opération. */
  correctionRequestId?: string;
  /** Reçu prêt à envoyer au client (remboursement). */
  receipt?: { text: string; phone: string | null };
};

export const initialFormState: FormState = {};

export function invalidForm(error: z.ZodError, values?: Record<string, string>): FormState {
  return { fieldErrors: z.flattenError(error).fieldErrors as FormState["fieldErrors"], values };
}
