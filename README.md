# BoutikDëkk

Application web mobile (PWA) qui remplace le cahier de dettes des boutiques de quartier au Sénégal : clients, dettes, remboursements, soldes et historique, en FCFA.

**Stack :** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS) · Vercel.

## Démarrage local

Prérequis : **Node.js 22 LTS** (ou plus récent) et npm. Node 20 n'est plus pris en charge par `@supabase/supabase-js`.

```bash
npm install
cp .env.example .env.local      # puis renseigner les valeurs Supabase
npm run dev                     # http://localhost:3000
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires et tests base de données |
| `npm run check` | Tout ce qui précède, à lancer avant chaque commit |

### Tests base de données

`npm test` exécute toutes les migrations de `supabase/migrations/` dans **PGlite**, un PostgreSQL en WebAssembly. Cela ne demande ni Docker ni projet Supabase. Le fichier [tests/db/supabase-shim.sql](tests/db/supabase-shim.sql) reproduit ce dont les migrations ont besoin : rôles `anon` et `authenticated`, `auth.users`, `auth.uid()` et privilèges par défaut de Supabase. Les tests ([tests/db/ledger.test.ts](tests/db/ledger.test.ts)) couvrent :

- création de boutique et de client ;
- dettes, remboursement partiel et total, refus d'un remboursement excessif ;
- calcul du solde, recalculé depuis le registre ;
- idempotence (pas de doublon si une requête est rejouée) ;
- annulations, registre en ajout seul, journal d'audit ;
- permissions propriétaire et vendeur ;
- isolation entre boutiques et accès anonyme refusé.

**Limite connue :** PGlite n'a qu'une seule connexion, donc la concurrence réelle (deux paiements simultanés) n'y est pas testée. La protection repose sur `SELECT … FOR UPDATE` sur la ligne client. Elle sera vérifiée contre une vraie instance Supabase.

## Mise en place de Supabase

1. Créer un projet sur [supabase.com](https://supabase.com), région la plus proche (ex. `eu-west`).
2. Récupérer l'URL et la **clé publique** (publishable/anon) dans *Project Settings → API*, puis les copier dans `.env.local`.
3. Appliquer les migrations :
   ```bash
   npx supabase login
   npx supabase link --project-ref <id-du-projet>
   npx supabase db push
   ```
4. Dans *Authentication → URL Configuration* :
   - *Site URL* : l'URL de production (ex. `https://boutikdekk.vercel.app`) ;
   - *Redirect URLs* : `http://localhost:3000/auth/callback` et `https://*.vercel.app/auth/callback`.
5. Dans *Authentication → Providers → Email*, laisser la **confirmation de l'email** activée.
6. **Envoi des emails :** le serveur d'emails intégré de Supabase n'envoie qu'aux membres de l'équipe du projet, et seulement quelques emails par heure. Avant d'ouvrir l'inscription au public, configurez un SMTP dans *Authentication → Emails → SMTP Settings* (Resend, Brevo…).
7. *(Recommandé)* Pour que les liens fonctionnent même ouverts sur un autre téléphone, remplacez dans les modèles d'email `{{ .ConfirmationURL }}` par :
   - confirmation d'inscription : `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding/profile`
   - réinitialisation du mot de passe : `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

Après une nouvelle migration, régénérer les types TypeScript : `npx supabase login` puis `npm run db:types`.

> Ne jamais placer la clé `service_role` ou une clé `sb_secret_…` dans `.env.local`, dans Vercel ou dans le code : l'application n'en a pas besoin.

## Architecture des données

| Table | Rôle |
|---|---|
| `profiles` | Profil de l'utilisateur, créé automatiquement à l'inscription |
| `shops` | Boutiques (devise `XOF`) |
| `shop_members` | Rôle de l'utilisateur dans la boutique : `owner` (propriétaire) ou `seller` (vendeur) |
| `customers` | Clients, archivés et jamais supprimés |
| `ledger_transactions` | Registre en **ajout seul** : `DEBT`, `REPAYMENT`, `REVERSAL` |
| `audit_log` | Journal des opérations sensibles, lisible par le propriétaire |
| vue `customer_balances` | Solde = `SUM(balance_effect)` du registre |

Les écritures financières passent **uniquement** par les fonctions PostgreSQL `record_debt`, `record_repayment` et `reverse_transaction`. Elles sont atomiques, idempotentes grâce à `client_request_id` et verrouillent la ligne du client. Le navigateur n'a aucun droit d'écriture directe sur le registre.

### Règles de gestion

- Montants : entiers positifs en FCFA, 1 milliard au maximum par opération.
- Un remboursement ne peut pas dépasser le solde.
- Une erreur se corrige par une **annulation** (`REVERSAL`), réservée au propriétaire et accompagnée d'un motif. L'écriture d'origine reste visible.
- Une annulation qui rendrait le solde négatif est refusée : il faut d'abord annuler le remboursement concerné.
- Un client ne peut être archivé que par le propriétaire, et seulement si son solde est nul.

## Déploiement Vercel

1. Pousser le dépôt sur GitHub.
2. Sur Vercel : *Add New → Project* → importer le dépôt. Next.js est détecté automatiquement.
3. Dans *Settings → Environment Variables*, définir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `NEXT_PUBLIC_SITE_URL` :
   - **Production** : projet Supabase de production ;
   - **Preview** et **Development** : projet Supabase de test (recommandé : un second projet).
4. Chaque push sur `main` déploie en production, et chaque pull request obtient une URL de prévisualisation.

## Langues

Les textes sont regroupés dans [src/i18n/messages/fr.ts](src/i18n/messages/fr.ts). Pour ajouter le wolof, il suffit de créer `wo.ts` du même type `Messages` (TypeScript signale les clés manquantes) puis de l'enregistrer dans [src/i18n/index.ts](src/i18n/index.ts).

## Avancement

- [x] Étape 1-2 : analyse et architecture
- [x] Étape 3 : projet Next.js, thème, navigation mobile, manifeste PWA
- [x] Étape 4 : migrations SQL, RLS, fonctions financières, audit, tests
- [x] Étape 5 : authentification, onboarding (profil → boutique → premier client), paramètres
- [x] Étape 6 : clients (liste, recherche instantanée, fiche, ajout, modification, archivage)
- [x] Étape 7 : dettes, remboursements, annulations (interface)
- [x] Étape 8 : tableau de bord
- [ ] Étape 9 : tests complémentaires et documentation
- [ ] Étape 10 : déploiement Vercel
- [ ] Ensuite : historique, rapports, PDF, export, mode hors ligne
