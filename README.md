# SOLSTICE BANK

Application web de **banque fictive** réalisée pour le module *Full Stack JS* (EFREI, M1).
Aucun argent réel, aucune connexion à une vraie banque.

Le projet suit le sujet **C – BudgetFlow** du livret : la ressource métier contractuelle est
`/api/transactions` (revenus et dépenses en centimes). Autour de ce socle, l'équipe a construit
une banque fictive : compte bancaire avec IBAN, dépôts, retraits, virements entre clients,
historique et annuaire.

**Équipe** : Calliclès (back), Jonathan (back), Sophie (front), Jean-Jacques (front).

---

## Sommaire

1. [Fonctionnalités](#1-fonctionnalités)
2. [Stack et versions](#2-stack-et-versions)
3. [Installation](#3-installation)
4. [Variables d'environnement](#4-variables-denvironnement)
5. [MongoDB Atlas](#5-mongodb-atlas)
6. [Lancer l'application](#6-lancer-lapplication)
7. [Tests, lint et build](#7-tests-lint-et-build)
8. [Architecture](#8-architecture)
9. [API](#9-api)
10. [Choix techniques](#10-choix-techniques)
11. [Outillage : Vite, Babel, Webpack et CI](#11-outillage--vite-babel-webpack-et-ci)
12. [Limites connues](#12-limites-connues)

---

## 1. Fonctionnalités

| Fonctionnalité | Où | Détail |
| --- | --- | --- |
| Inscription / connexion | `/inscription`, `/` | JWT signé, mot de passe haché avec bcrypt |
| Mot de passe oublié | `/mot-de-passe-oublie`, `/reset-password` | Lien par email valable 30 min, à usage unique ; toutes les sessions sont fermées après la réinitialisation |
| Profil | `/profil` | Consultation et modification ; date de naissance figée ; suppression définitive du compte |
| **Carnet budgétaire (CRUD du livret)** | `/carnet` | Liste, ajout, détail, modification, suppression. **Sans effet sur le solde** |
| Compte bancaire | `/accueil` | Solde (500 € offerts à l'inscription), IBAN à copier, 5 dernières opérations |
| Dépôt / retrait | API (`/api/account/...`) | Refus si le solde est insuffisant ; protégé contre les doubles envois |
| Virement | `/transfert` | Vers un client choisi dans l'annuaire ou par IBAN ; atomique |
| Historique | `/historique` | Dépôts, retraits et virements, avec le nom de l'autre partie |
| Annuaire | Page Transfert | Recherche d'un destinataire ; seuls l'id, le prénom, le nom et le pseudo sont exposés |

Un compte créé avec l'inscription minimale du livret (`{ email, password }`) est actif mais
**sans profil** : il est invisible dans l'annuaire et n'a pas accès aux fonctions bancaires
(403) tant que le profil n'est pas complété depuis `/profil`.

## 2. Stack et versions

| Couche | Technologies |
| --- | --- |
| Front | React 19, React Router 7, TypeScript 6, Vite 8 |
| Back | Node.js, Express 5, TypeScript 6 (ES modules), Zod 4 (validation) |
| Données | MongoDB **Atlas** (replica set), Mongoose 9 |
| Authentification | bcrypt (12 tours), JWT Bearer (`jsonwebtoken`) |
| Emails | Nodemailer (SMTP) ou affichage dans le terminal |
| Qualité | ESLint 10 + typescript-eslint, Jest 29 + Supertest, Swagger UI (OpenAPI 3) |

**Prérequis** : Node.js 20 ou plus (développé avec Node 24 et npm 11), Git, et un accès à un
cluster MongoDB Atlas (voir [section 5](#5-mongodb-atlas)).

## 3. Installation

```bash
git clone https://github.com/Poco2406/SolsticeBank.git
cd SolsticeBank

# Backend
cd backend
npm install
cp .env.example .env      # puis remplir les valeurs (section 4)

# Frontend
cd ../frontend
npm install
```

Sous Windows PowerShell, remplacer `cp` par `Copy-Item .env.example .env`.

Le front n'a **pas** de fichier `.env` : en développement, Vite redirige `/api` vers
`http://localhost:3000` (voir `frontend/vite.config.ts`).

## 4. Variables d'environnement

Toutes les variables sont lues dans `backend/src/config/env.ts`, et uniquement là
(ESLint l'impose). Le serveur s'arrête avec un message clair si une variable obligatoire manque.
Le fichier `backend/.env` n'est jamais versionné ; `backend/.env.example` liste les noms avec des
valeurs fictives.

| Variable | Obligatoire | Exemple | Rôle |
| --- | --- | --- | --- |
| `PORT` | non | `3000` | Port de l'API (3000 par défaut) |
| `FRONTEND_URL` | oui | `http://localhost:5173` | Origine autorisée par CORS, et base des liens envoyés par email |
| `MONGODB_URI` | oui | `mongodb+srv://…/solstice` | Base de développement |
| `MONGODB_TEST_URI` | pour `npm test` | `mongodb+srv://…/solstice_test` | Base des tests : son nom **doit finir par `_test`** et différer de celle de `MONGODB_URI` |
| `JWT_SECRET` | oui | longue chaîne aléatoire | Clé de signature des JWT |
| `JWT_EXPIRES_IN` | oui | `1h` | Durée de validité d'un JWT |
| `MAIL_TRANSPORT` | non | `console` | `console` : les emails s'affichent dans le terminal du back ; `smtp` : envoi réel |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | si `smtp` | | Serveur d'envoi des emails |

Pour générer un `JWT_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 5. MongoDB Atlas

Le projet utilise **MongoDB Atlas** plutôt qu'un MongoDB local : un cluster Atlas est un
*replica set*, ce qui est indispensable pour les **transactions** utilisées par les virements,
dépôts, retraits, l'inscription et la suppression de compte. Un `mongod` local lancé seul ne
les accepte pas.

1. Créer un cluster gratuit (M0) sur [cloud.mongodb.com](https://cloud.mongodb.com).
2. *Database Access* : créer un utilisateur avec un mot de passe.
3. *Network Access* : autoriser son adresse IP.
4. *Connect → Drivers* : copier l'URI `mongodb+srv://…` et y ajouter le nom de la base :
   `…mongodb.net/solstice` pour `MONGODB_URI`, `…mongodb.net/solstice_test` pour `MONGODB_TEST_URI`.

Les collections et les index sont créés automatiquement au démarrage. Si un index a changé dans
le code alors que la base existe déjà, Mongoose ne le remplace pas ; pour aligner les index :

```bash
cd backend
npx tsx src/scripts/sync-indexes.ts
```

## 6. Lancer l'application

Dans deux terminaux :

```bash
# Terminal 1 : API
cd backend
npm run dev          # http://localhost:3000

# Terminal 2 : interface
cd frontend
npm run dev          # http://localhost:5173
```

| URL | Contenu |
| --- | --- |
| http://localhost:5173 | Application React |
| http://localhost:3000/api/health | Vérification : `{"status":"ok"}` |
| http://localhost:3000/api/docs | Documentation Swagger (relancer le back après une modification de `docs/openapi.yaml`) |

Parcours de démonstration : créer deux comptes avec un profil complet, se connecter avec le
premier, ajouter des lignes au carnet, faire un virement au second, consulter l'historique des
deux côtés.

Des requêtes prêtes à l'emploi se trouvent dans `backend/requests.http` (extension VS Code
*REST Client*). Les routes d'argent exigent un en-tête `Idempotency-Key` : dans Postman,
`{{$guid}}` en génère une nouvelle à chaque envoi.

En production, l'API se compile avec `npm run build` puis se lance avec `npm start`
(`node dist/server.js`).

## 7. Tests, lint et build

| Commande | Dossier | Rôle |
| --- | --- | --- |
| `npm test` | `backend/` | Suite Jest + Supertest sur la base `MONGODB_TEST_URI` (environ 2 min) |
| `npm run lint` | `backend/` et `frontend/` | ESLint |
| `npm run typecheck` | `backend/` | Vérification TypeScript sans compilation |
| `npm run build` | `backend/` | Compilation TypeScript vers `dist/` |
| `npm run build` | `frontend/` | Vérification TypeScript puis build Vite vers `dist/` |

Les tests utilisent une base séparée : ils la vident après chaque test et refusent de tourner si
son nom ne finit pas par `_test`. Ils couvrent notamment :

| Fichier | Contenu |
| --- | --- |
| `transactions.test.ts` | Exigences du livret sur `/api/transactions` : CRUD nominal, entrées invalides (400), absence de JWT ou JWT falsifié (401), objet absent (404), **isolation entre deux comptes A et B** |
| `auth.test.ts` | Inscription, connexion, email déjà utilisé (409), majorité (18 ans pile acceptée), JWT expiré, réinitialisation du mot de passe |
| `me.test.ts`, `users.test.ts`, `delete-account.test.ts` | Profil, annuaire (aucune donnée privée exposée), suppression de compte |
| `movements.test.ts`, `transfer*.test.ts` | Dépôts, retraits, virements, historique, idempotence |
| `concurrency.test.ts` | Requêtes **simultanées** sur un même solde : double dépense, mise à jour perdue, rejeu |

Le test d'isolation a été vérifié en retirant temporairement le filtre propriétaire du service :
il échoue. De même, le test de concurrence échoue si le débit atomique est remplacé par un
« lire, vérifier, écrire » naïf (10 retraits acceptés au lieu de 6).

## 8. Architecture

```
SolsticeBank/
├── frontend/                 React + Vite
│   └── src/
│       ├── api.ts            Seul point de contact avec l'API : jeton, erreurs, fonctions typées
│       ├── Pages/            Une page par écran (Accueil, Carnet, Transfert, Historique, Profil…)
│       └── components/       En-tête, fenêtre modale
└── backend/                  Express + Mongoose
    ├── docs/openapi.yaml     Contrat de l'API (Swagger)
    ├── requests.http         Requêtes de test manuel
    ├── src/
    │   ├── app.ts            createApp() : middlewares et routes, sans ouvrir de port (importable par les tests)
    │   ├── server.ts         Connexion à MongoDB puis écoute du port
    │   ├── config/           Variables d'environnement, connexion MongoDB
    │   ├── routes/           Routes HTTP : validation Zod, appel du service, code de réponse
    │   ├── services/         Règles métier (solde, virements, isolation par propriétaire…)
    │   ├── models/           Schémas Mongoose
    │   ├── middlewares/      requireAuth, requireBankingActive, validateBody, idempotence, erreurs
    │   ├── validation/       Schémas Zod partagés (dates, montants, profil)
    │   └── scripts/          Scripts de maintenance (alignement des index)
    └── tests/                Jest + Supertest, avec helpers/ (base de test, utilisateurs)
```

**Chemin d'une requête** (exemple : ajouter une ligne au carnet)

```
Page Carnet ── creerTransaction() ── fetch POST /api/transactions + Authorization: Bearer <JWT>
     (React)        (api.ts)                         │
                                                     ▼
              requireAuth ─► validateBody(Zod) ─► transaction.service ─► modèle Transaction ─► MongoDB
         (JWT vérifié → req.userId)  (400 si invalide)   (ownerId = req.userId)
                                                     │
              201 + {"id": "...", "label": ..., "amount": 12345, ...}  ◄──┘
```

Toute erreur est levée sous forme d'`AppError` et mise en forme par un gestionnaire unique :
`{"error":{"code":"INVALID_INPUT","message":"…"}}`.

## 9. API

La référence complète (schémas, exemples, codes d'erreur) est dans Swagger :
http://localhost:3000/api/docs. Toutes les routes, sauf la santé et l'authentification, exigent
`Authorization: Bearer <JWT>`.

| Méthode et route | Rôle |
| --- | --- |
| `GET /api/health` | Santé : `{"status":"ok"}` |
| `POST /api/auth/register`, `POST /api/auth/login` | Inscription (profil facultatif mais complet s'il est fourni), connexion |
| `POST /api/auth/password/forgot`, `/reset` | Mot de passe oublié |
| `GET`, `PATCH`, `DELETE /api/me` | Profil : lire, modifier, supprimer le compte |
| `GET /api/users`, `GET /api/users/:id` | Annuaire (données publiques uniquement) |
| `GET`, `POST /api/transactions` ; `GET`, `PATCH`, `DELETE /api/transactions/:id` | **Carnet budgétaire, contrat du livret** |
| `GET /api/account` | Compte bancaire : solde, IBAN |
| `POST /api/account/deposits`, `/withdrawals` | Dépôt, retrait (en-tête `Idempotency-Key`) |
| `POST /api/transfers` | Virement vers `recipientId` (annuaire) ou `recipientIban` (en-tête `Idempotency-Key`) |
| `GET /api/movements`, `GET /api/movements/:id` | Historique filtré (type, dates, montants) et paginé |

Codes d'erreur : `INVALID_INPUT` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND`
(404), `CONFLICT`, `EMAIL_ALREADY_USED`, `INSUFFICIENT_FUNDS` (409), `TOO_MANY_REQUESTS` (429).

## 10. Choix techniques

**Carnet séparé des mouvements bancaires.** `/api/transactions` respecte exactement le contrat du
livret, y compris la modification et la suppression. Si ces lignes modifiaient le solde, supprimer
une dépense « rendrait » de l'argent. Les mouvements bancaires (dépôts, retraits, virements) sont
donc des ressources distinctes et **immuables**.

**Montants en centimes entiers.** `12345` signifie 123,45 €. Aucun nombre à virgule n'est
stocké, ce qui évite les erreurs d'arrondi ; la conversion en euros se fait seulement à l'affichage.

**Isolation des comptes.** Le propriétaire (`ownerId`) vient toujours du JWT vérifié, jamais du
corps de la requête. Chaque lecture filtre par propriétaire : l'objet d'un autre compte renvoie
**404**, comme un objet absent, pour ne pas révéler son existence. Un identifiant mal formé renvoie
**400**.

**Validation stricte.** Chaque corps est validé par un schéma Zod `.strict()` : un champ inconnu,
`id` ou `ownerId` est refusé. La validation dans React aide l'utilisateur, mais c'est celle du
serveur qui protège l'API.

**Sessions.** Le JWT contient un numéro de version (`tokenVersion`). Réinitialiser son mot de
passe ou supprimer son compte incrémente ce numéro et invalide immédiatement tous les jetons émis.
Le front garde le jeton dans le `localStorage` : c'est simple et la session survit au
rechargement, mais un script injecté (XSS) pourrait le lire ; un cookie `HttpOnly` serait plus sûr.

**Concurrence et double dépense.** Deux requêtes qui touchent le même solde au même moment ne
doivent jamais dépenser deux fois le même argent. Trois protections se complètent :

1. **Débit conditionnel atomique** : la vérification et le débit se font en une seule opération
   MongoDB (`findOneAndUpdate` avec `balanceCents >= montant` et `$inc`). Une deuxième requête
   voit le solde déjà débité et reçoit `409 INSUFFICIENT_FUNDS`.
2. **Transaction** : un virement écrit cinq documents (débit, crédit, reçu, deux mouvements) ; si
   une écriture échoue, tout est annulé.
3. **Idempotence** : le client envoie une clé unique (`Idempotency-Key`). Si la même demande
   arrive deux fois (double clic, coupure réseau), elle n'est exécutée qu'une fois et le résultat
   enregistré est renvoyé ; un index unique en base départage deux envois simultanés.

**Suppression de compte.** Dans une seule transaction : coordonnées effacées, email libéré,
sessions invalidées, compte bancaire clôturé (le solde abandonné reste tracé), carnet supprimé.
Les mouvements et virements sont conservés : l'autre partie voit « un compte supprimé ».

## 11. Outillage : Vite, Babel, Webpack et CI

- **Vite** sert l'application en développement sans la regrouper (modules ES natifs, rechargement
  instantané) et produit un build optimisé pour la production (`npm run build`).
- **Babel** est un transpileur : il réécrit du JavaScript ou du JSX récent en code compris par
  tous les navigateurs. Ici, la transpilation du JSX et du TypeScript est assurée par la chaîne de
  Vite et par `tsc`.
- **Webpack** est un *bundler* plus ancien et très configurable, qui regroupe tous les modules en
  fichiers optimisés. Vite le remplace dans ce projet.
- **Intégration continue (non mise en place)** : un pipeline lancerait, à chaque pull request,
  `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (avec une base de test dédiée) et les
  deux `npm run build`, et bloquerait la fusion en cas d'échec.

## 12. Limites connues

- **Pas de limite de tentatives sur `/api/auth/login`** (elle existe sur le mot de passe oublié).
- Le **changement d'email** et le **changement de mot de passe** depuis le profil ne sont pas
  disponibles ; le mot de passe se change via « Mot de passe oublié ».
- La vérification d'email existe côté API mais n'est pas obligatoire et n'a pas d'écran dédié.
- Le **motif** saisi lors d'un virement n'est pas enregistré.
- Le jeton est stocké dans le `localStorage` (voir les choix techniques).
- Le front appelle l'API sur la même origine (`/api`) ; un déploiement séparé du front et du back
  nécessite une redirection (*rewrite*) de `/api` vers l'API.
- Les tests de l'API tournent sur Atlas : ils dépendent du réseau et prennent environ deux minutes.
- Il n'y a pas de tests automatisés côté front.
