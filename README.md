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
| `npm test` | Tests unitaires et tests base de données (PGlite, sans réseau) |
| `npm run test:integration` | Tests de concurrence contre le vrai projet Supabase |
| `npm run test:e2e` | Tests navigateur (Chromium mobile) sur le build de production : mode hors ligne |
| `npm run check` | Lint, types, tests et build : à lancer avant chaque commit |
| `npm run db:types` | Régénère les types TypeScript de la base (après `npx supabase login`) |

## Tests

Quatre niveaux, du plus rapide au plus réaliste.

### 1. Tests unitaires : `tests/unit/`

Ils couvrent le formatage FCFA et téléphone (+221), la recherche sans accents et par numéro, la validation des formulaires (montants, dates, modes de paiement) et la protection contre les redirections ouvertes.

### 2. Tests base de données : `tests/db/`, lancés par `npm test`

Toutes les migrations de `supabase/migrations/` sont exécutées dans **PGlite**, un PostgreSQL en WebAssembly. Ni Docker ni projet Supabase ne sont nécessaires. Le fichier [tests/db/supabase-shim.sql](tests/db/supabase-shim.sql) reproduit ce dont les migrations ont besoin : rôles `anon` et `authenticated`, `auth.users`, `auth.uid()` et privilèges par défaut de Supabase. Chaque requête est jouée avec le rôle et le JWT d'un utilisateur, comme le fait l'API Supabase.

Ils couvrent :
- création de boutique et de client ;
- dette, remboursement partiel et total, refus d'un remboursement excessif ;
- solde recalculé depuis le registre ;
- idempotence ;
- annulations, registre en ajout seul, journal d'audit ;
- permissions propriétaire et vendeur ;
- isolation entre boutiques, accès anonyme refusé ;
- indicateurs du tableau de bord.

### 3. Tests de concurrence : `tests/integration/`, lancés par `npm run test:integration`

PGlite n'a qu'une connexion. Ces tests envoient donc de vraies requêtes **simultanées** au projet Supabase :
- 10 remboursements totaux en même temps : un seul passe ;
- 6 remboursements de 300 sur une dette de 1 000 : exactement 3 passent ;
- la même dette envoyée 10 fois en parallèle n'est enregistrée qu'une fois ;
- une rafale mixte de dettes et de remboursements laisse un solde cohérent et jamais négatif.

Pour les lancer, créez `.env.test.local` (jamais versionné) avec un compte **confirmé** :

```
TEST_USER_EMAIL=...
TEST_USER_PASSWORD=...
```

Les opérations se font dans une boutique dédiée, « Boutique de test automatique », créée au premier lancement. L'application affiche la boutique la plus ancienne du compte, donc votre boutique réelle n'est pas touchée. Le registre étant en ajout seul, les clients de test sont soldés puis archivés à la fin. Sans identifiants, ces tests sont ignorés.

### 4. Tests navigateur : `tests/e2e/`, lancés par `npm run test:e2e`

Lancez d'abord `npm run build`, puis `npx playwright install chromium` la première fois. Playwright démarre le build de production et joue le scénario dans Chromium, avec un profil de téléphone Android :
- le service worker s'installe ;
- réseau coupé, n'importe quelle page affiche le mode hors ligne ;
- recherche dans les soldes du dernier chargement ;
- une saisie hors ligne est conservée après rechargement ;
- un remboursement supérieur au solde connu est bloqué ;
- le cache ne contient aucune donnée personnelle.

### Vérification manuelle avant une mise en production

1. Inscription → email de confirmation → accueil guidé (profil, boutique, premier client).
2. Ajouter une dette, puis vérifier le solde sur la fiche client et sur le tableau de bord.
3. Remboursement partiel, puis « Tout » : le solde passe à 0 et le bouton Remboursement se grise.
4. Tenter un remboursement supérieur au solde : il doit être refusé.
5. Annuler une opération (propriétaire) : elle apparaît barrée, avec une ligne « Annulation ».
6. Historique : filtres par type et par période, pagination.
7. Paramètres → Équipe → « Inviter un vendeur ». Ouvrir le lien dans un autre navigateur, créer un compte vendeur, puis rejoindre la boutique.
8. Avec ce compte vendeur : pas de bouton « Annuler », pas d'export, et boutique en lecture seule dans les paramètres. Le propriétaire peut ensuite le retirer.
9. Se déconnecter : les pages de l'application renvoient vers la connexion.

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
| `shop_invitations` | Codes d'invitation des vendeurs : usage unique, valables 7 jours, révocables |
| `customers` | Clients, archivés et jamais supprimés |
| `ledger_transactions` | Registre en **ajout seul** : `DEBT`, `REPAYMENT`, `REVERSAL` |
| `audit_log` | Journal des opérations sensibles, lisible par le propriétaire |
| vue `customer_balances` | Solde = `SUM(balance_effect)` du registre |
| fonction `shop_dashboard` | Indicateurs du tableau de bord, calculés depuis le registre (RLS appliquée) |
| fonction `shop_report` | Rapport d'une période : dettes, remboursements par mode, encours de fin de période |

Les écritures financières passent **uniquement** par les fonctions PostgreSQL `record_debt`, `record_repayment` et `reverse_transaction`. Elles sont atomiques, idempotentes grâce à `client_request_id` et verrouillent la ligne du client. Le navigateur n'a aucun droit d'écriture directe sur le registre.

### Règles de gestion

- Montants : entiers positifs en FCFA, 1 milliard au maximum par opération.
- Un remboursement ne peut pas dépasser le solde.
- Une erreur se corrige par une **annulation** (`REVERSAL`), réservée au propriétaire et accompagnée d'un motif. L'écriture d'origine reste visible.
- Une annulation qui rendrait le solde négatif est refusée : il faut d'abord annuler le remboursement concerné.
- Un client ne peut être archivé que par le propriétaire, et seulement si son solde est nul.

## Mode hors ligne

Le mode hors ligne repose sur trois couches.

| Situation | Comportement |
|---|---|
| Coupure brève, application ouverte | Option `experimental.useOffline` de Next.js : la navigation ou l'enregistrement en cours attend, puis repart au retour du réseau. Le bouton affiche « En attente du réseau… » et un bandeau signale la coupure. La clé d'idempotence empêche tout doublon. |
| Application ouverte sans réseau | Le service worker ([public/sw.js](public/sw.js)) sert la page `/offline`, qui affiche les clients et les soldes du **dernier chargement** (Accueil, Clients ou Ajouter une dette), avec leur date. |
| Saisie sans réseau | Sur `/offline`, les dettes et les remboursements vont dans une **file d'attente IndexedDB** : elle survit à la fermeture de l'application et est envoyée dans l'ordre de saisie au retour d'Internet. La date réelle de l'opération est conservée. |

À la synchronisation, PostgreSQL revérifie tout. Une opération devenue impossible (remboursement supérieur au solde parce qu'un collègue a déjà encaissé, client archivé, vendeur retiré…) est **marquée « Refusée » avec son motif**. Elle reste visible jusqu'à ce que l'utilisateur la supprime : elle ne disparaît jamais en silence.

**Confidentialité :** le service worker ne met en cache que les fichiers de l'application, jamais les pages connectées. Les données locales (soldes et file d'attente) sont effacées à la déconnexion. Un avertissement s'affiche s'il reste des opérations non envoyées.

**Ce qui est testé :**
- le moteur de synchronisation (`tests/unit/offline-sync.test.ts`) ;
- le stockage IndexedDB (`tests/unit/offline-store.test.ts`) ;
- la synchronisation de bout en bout avec les vraies fonctions SQL : ordre, renvoi sans doublon après un plantage, conflits (`tests/db/offline-sync.test.ts`) ;
- le comportement dans un vrai navigateur (`tests/e2e/offline.spec.ts`).

**Pas encore testé :** la synchronisation depuis un téléphone réel vers le projet Supabase, à vérifier après le déploiement.

**Limites :**
- seules les dettes et les remboursements peuvent être saisis hors ligne (pas la création de client) ;
- les soldes affichés hors ligne sont ceux du dernier chargement, plus les opérations en attente ;
- la page `/offline` est mise à jour à chaque ouverture en ligne de l'application.

## Organisation du code

```
src/
  app/(auth)/         connexion, inscription, mot de passe
  app/(onboarding)/   accueil guidé : profil → boutique → premier client
  app/(app)/          application connectée : tableau de bord, clients, dettes,
                      remboursements, historique, paramètres
  app/auth/callback/  retour des liens envoyés par email
  proxy.ts            rafraîchit la session, redirige les visiteurs non connectés
  server/actions/     Server Actions (validation Zod → Supabase)
  server/queries/     lectures (toujours filtrées par la boutique de l'utilisateur)
  lib/auth/session.ts couche d'accès : requireUser(), requireShop()
  lib/                formatage, validation, recherche, clients Supabase
  components/         interface (formulaires, listes, navigation)
  i18n/               textes de l'interface (français, wolof à venir)
supabase/migrations/  schéma, RLS, fonctions financières, audit
tests/                unit · db (PGlite) · integration (Supabase réel)
```

Chaque page appelle `requireShop()`, qui déduit la boutique de l'utilisateur connecté côté serveur. Aucune donnée n'est lue ou écrite à partir d'un `shop_id` envoyé par le navigateur sans que la RLS ne le vérifie.

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
- [x] Étape 9 : historique filtrable, tests de concurrence, documentation
- [ ] Étape 10 : déploiement Vercel (en attente)
- [x] Étape 11 : rapports par période, export CSV (opérations, clients), relevé client PDF partageable
- [x] Étape 12 : équipe (invitations de vendeurs par code ou lien WhatsApp, retrait, départ, choix de la boutique active)
- [x] Étape 13 : mode hors ligne (service worker, consultation des soldes, file d'attente durable, synchronisation)
- [ ] Ensuite : déploiement Vercel, wolof, création de client hors ligne
