# Plan d'implémentation — CRM Studio de Beauté (République Dominicaine)

> Document destiné à Claude Code. À placer à la racine du dépôt.
> Lire ce fichier en entier avant d'écrire du code. Travailler phase par phase,
> ne pas anticiper sur les phases suivantes.

---

## 1. Contexte

Studio de beauté situé en République dominicaine (ongles, cheveux, soins, maquillage).
Utilisatrices : la propriétaire, une réceptionniste, plusieurs stylistes.
Langue de travail quotidienne : **espagnol**. La propriétaire est francophone.
L'interface doit être **entièrement bilingue FR/ES**, commutable à chaud.

Contraintes locales non négociables :
- Devise principale **RD$** (peso dominicain), affichage secondaire optionnel en US$.
- **ITBIS 18 %**.
- **NCF (Número de Comprobante Fiscal)** émis par la DGII : séquences B01 (crédito fiscal),
  B02 (consumidor final), et e-CF. Une facture sans NCF valide n'a aucune valeur légale.
- Connexion internet instable : l'application doit rester utilisable en mode dégradé.
- Usage principal sur **téléphone et tablette**, secondairement sur desktop à la caisse.

---

## 2. Stack technique

| Couche | Choix | Raison |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | SSR, API routes, un seul dépôt |
| UI | Tailwind CSS + shadcn/ui | rapide, cohérent, mobile-first |
| Base de données | **PostgreSQL** | relationnel, contraintes fortes sur les NCF |
| ORM | **Prisma** | migrations versionnées, typage |
| Auth | Auth.js (NextAuth) — credentials + rôles | pas de dépendance externe payante |
| i18n | **next-intl** | routing `/fr` `/es`, messages typés |
| État serveur | TanStack Query | cache + retry, utile en réseau instable |
| Offline | Service Worker + IndexedDB (file d'attente d'écritures) | phase 5 uniquement |
| Notifications | WhatsApp Cloud API (Meta) | canal réel des clientes en RD |
| Dates | date-fns + `America/Santo_Domingo` | pas de UTC affiché à l'utilisateur |
| Tests | Vitest (unitaire) + Playwright (E2E sur les parcours caisse et agenda) | |
| Déploiement | Docker + VPS, ou Vercel + Neon | à trancher en phase 6 |

Ne pas introduire de librairie supplémentaire sans la justifier dans le PR.

---

## 3. Règles transversales

### 3.1 Internationalisation (FR/ES)

- **Aucune chaîne de caractères en dur dans le JSX.** Tout passe par `next-intl`.
- Fichiers `messages/fr.json` et `messages/es.json`, structurés par domaine :
  `common`, `auth`, `clients`, `agenda`, `services`, `staff`, `caisse`, `stock`,
  `fidelite`, `rapports`, `errors`.
- **L'espagnol est la langue de référence.** Toute nouvelle clé est écrite d'abord en ES,
  puis traduite en FR. Les deux fichiers doivent toujours avoir exactement les mêmes clés —
  ajouter un test qui échoue si une clé manque d'un côté.
- Vocabulaire métier à respecter (ne pas inventer de synonymes) :

  | Concept | FR | ES |
  |---|---|---|
  | Rendez-vous | Rendez-vous | Cita |
  | Cliente | Cliente | Clienta |
  | Prestation | Service | Servicio |
  | Employée | Employée | Empleada |
  | Caisse | Caisse | Caja |
  | Facture | Facture | Factura |
  | Stock | Stock | Inventario |
  | Absence non prévenue | Absence (no-show) | Inasistencia |
  | Forfait | Forfait | Paquete |

- Format des nombres et dates : `es-DO` et `fr-FR`, mais **la devise reste RD$ dans les deux
  langues**. Ne jamais convertir automatiquement.
- Les données saisies (nom d'un service, note sur une cliente) ne sont **pas** traduites.
  Seule l'interface l'est. Exception : les libellés des catégories de services, qui ont deux
  colonnes `nameEs` / `nameFr` en base.
- Sélecteur de langue dans le menu utilisateur, en haut à droite ; le choix est persisté sur le
  profil de l'utilisateur, pas seulement dans le navigateur.

### 3.2 Rôles et permissions

| Rôle | Accès |
|---|---|
| `OWNER` | tout, y compris rapports financiers, marges, réglages NCF |
| `RECEPTION` | agenda complet, fiches clientes, caisse, encaissement — pas les marges ni les commissions des autres |
| `STYLIST` | son propre agenda, fiches des clientes qu'elle sert, ses propres commissions |

Les permissions sont vérifiées **côté serveur** dans chaque route et chaque server action.
Masquer un bouton dans l'UI ne suffit jamais.

### 3.3 Conventions

- Toutes les sommes en base : entiers, en **centavos** (`Int`), jamais de `Float`.
- Tous les timestamps en UTC en base, convertis à l'affichage en `America/Santo_Domingo`.
- Suppression logique (`deletedAt`) partout — on n'efface jamais une cliente ni une facture.
- Journal d'audit (`AuditLog`) sur : annulation de facture, modification de prix, ouverture et
  fermeture de caisse, changement de rôle.

---

## 4. Modèle de données (Prisma — à créer en phase 1)

```
User          id, email, passwordHash, name, role, locale, active
Employee      id, userId?, name, phone, color, commissionRate, active
Client        id, firstName, lastName, phone, email?, birthDate?, notes,
              allergies, preferences, createdAt, deletedAt
ClientPhoto   id, clientId, url, type(BEFORE|AFTER), appointmentId?, takenAt

ServiceCategory id, nameEs, nameFr, order
Service       id, categoryId, nameEs, nameFr, durationMin, priceCents,
              commissionRate?, active
Package       id, nameEs, nameFr, priceCents, sessionsTotal, validityDays
ClientPackage id, clientId, packageId, sessionsUsed, expiresAt

Appointment   id, clientId, employeeId, startAt, endAt, status
              (SCHEDULED|CONFIRMED|IN_PROGRESS|DONE|NO_SHOW|CANCELLED),
              notes, source(WALK_IN|PHONE|ONLINE), createdBy
AppointmentItem id, appointmentId, serviceId, priceCents, employeeId

Invoice       id, clientId?, appointmentId?, ncf, ncfType(B01|B02|E_CF),
              subtotalCents, itbisCents, totalCents, status(ISSUED|VOIDED),
              issuedAt, cashSessionId
Payment       id, invoiceId, method(CASH|CARD|TRANSFER|GIFT_CARD),
              amountCents, reference?
NcfSequence   id, type, prefix, currentNumber, maxNumber, expiresAt, active

CashSession   id, employeeId, openedAt, closedAt, openingCents,
              countedCents?, expectedCents?, differenceCents?
CashMovement  id, cashSessionId, type(IN|OUT), amountCents, reason

Product       id, name, sku, costCents, priceCents, stockQty, minStockQty,
              forResale(bool), supplierId?
StockMovement id, productId, type(PURCHASE|SALE|INTERNAL_USE|ADJUSTMENT),
              qty, reason, createdBy, createdAt
Supplier      id, name, phone, notes

LoyaltyAccount id, clientId, points, visits
GiftCard      id, code, amountCents, balanceCents, expiresAt, clientId?
Commission    id, employeeId, invoiceId, baseCents, rate, amountCents, paidAt?
AuditLog      id, userId, action, entity, entityId, before, after, createdAt
```

**Règles d'intégrité critiques sur les NCF :**
- `Invoice.ncf` est `UNIQUE`.
- L'attribution d'un NCF se fait dans une **transaction avec verrou** sur `NcfSequence`
  (`SELECT ... FOR UPDATE`), jamais par un `count()` ni un incrément côté application.
- Une facture émise n'est **jamais** modifiée ni supprimée : on l'annule (`VOIDED`) et on en
  émet une nouvelle. Le NCF annulé est consommé, pas recyclé.
- Alerte visible quand il reste moins de 50 numéros dans une séquence, ou moins de 30 jours
  avant expiration.

---

## 5. Phases de livraison

Chaque phase se termine par : migrations appliquées, seed à jour, tests verts, écrans
utilisables dans les **deux langues**. Ne pas démarrer la phase suivante avant validation.

### Phase 0 — Fondations (0,5 semaine) — ✅ **livrée le 2026-08-30**
- [x] Init Next.js 15 + TS + Tailwind v4 + primitives shadcn/ui (`src/components/ui/`).
- [x] ~~Postgres en Docker Compose local~~ → **Postgres hébergé Aiven** (`sslmode=require`), migration
      `20260830065318_init_user_studio_settings` appliquée.
- [x] next-intl avec routing `/fr` et `/es`, layout, sélecteur de langue fonctionnel et
      **persisté sur le profil** (`User.locale`).
- [x] Auth.js : login, session JWT, middleware de protection des routes, seed d'un compte `OWNER`.
- [x] Layout applicatif : sidebar (desktop) / barre de navigation basse (mobile), items filtrés
      par rôle (`src/lib/nav.ts`).
- [x] CI : lint, typecheck, tests, parité des clés i18n (`tests/i18n-parity.test.ts`).
- [x] **Hors périmètre initial, ajouté** : écran Paramètres (`OWNER`) — identité, RNC, contact,
      ITBIS, commission par défaut, symbole monétaire, affichage US$, largeur d'impression,
      seuils d'alerte NCF, pieds de facture ES/FR, horaires des 7 jours, langue par défaut.
      Toute modification écrit une entrée `AuditLog`.

**Livrable** : ✅ connexion, bascule FR↔ES à chaud persistée sur le profil, tableau de bord vide,
paramètres du studio saisissables.

**Vérifié en conditions réelles** : connexion `OWNER`, bascule ES→FR→ES depuis le menu utilisateur
(`User.locale` passe bien à `fr` en base), enregistrement des paramètres (nom + RNC relus depuis
Postgres, `AuditLog` `SETTINGS_UPDATE` créé), rendu mobile 375 px avec barre basse.

**Écarts / dette de la phase 0** :
- `AuditLog` a été créé dès maintenant (le §4 le plaçait en phase 1) : les paramètres fiscaux
  devaient être traçables dès leur première saisie.
- `next lint` est déprécié en Next 15 ; migration vers l'ESLint CLI à faire avant Next 16.
- Une seule base pour dev et prod tant que la production n'est pas ouverte.

### Phase 1 — Clientes et catalogue (1 semaine) — ✅ **livrée le 2026-08-30**
- [x] CRUD Client : liste avec recherche (nom, téléphone), fiche détaillée, notes, allergies,
      préférences, anniversaire. Recherche insensible aux accents et au format du numéro via
      deux colonnes dérivées (`searchName`, `phoneDigits`), maintenues à l'écriture.
- [x] Upload et affichage des photos avant/après. **Vercel Blob** en production, repli sur le
      disque quand `BLOB_READ_WRITE_TOKEN` est absent (poste de dev).
- [x] CRUD ServiceCategory, Service, Package, avec réordonnancement des catégories.
- [x] Import CSV : détection du séparateur (`,` `;` tabulation), BOM, guillemets, mapping des
      colonnes deviné puis corrigeable, aperçu avant écriture, dates JJ/MM/AAAA et AAAA-MM-JJ.
- [x] Seed §8 : 20 clientes, 15 services en 4 catégories, 2 forfaits.

**Vérifié en conditions réelles** : recherche « peña » et « pena » renvoient la même cliente,
recherche « 849 » renvoie les 6 numéros correspondants ; avertissement de doublon sur un numéro
déjà pris puis création forcée ; import d'un CSV `;` avec accents, champ entre guillemets
contenant une virgule et ligne vide → 3 clientes créées, ligne vide ignorée, `14/02/1992` lu comme
le 14 février ; envoi puis suppression d'une photo.

**Écarts actés en phase 1** :
- `Client.lastName` est **optionnel** (le §4 le donnait obligatoire) : une cliente de passage se
  saisit avec un prénom et un numéro, sinon rien n'est saisi.
- `Client.phone` n'est **pas `UNIQUE`** mais indexé, avec avertissement de doublon à la création :
  une mère et sa fille partagent un numéro, un blocage dur ferait perdre des saisies.
- `Service.commissionRate` devient `commissionRateBp` (points de base), comme le reste des taux.
- `ClientPackage` n'est **pas** créé : il appartient à la phase 5 (fidélité).
- Écriture du catalogue réservée à `OWNER` (il porte les prix) ; `RECEPTION` le consulte.
- La restriction §3.2 « la styliste ne voit que les clientes qu'elle sert » n'est **pas encore
  applicable** : elle dépend des rendez-vous. À implémenter en phase 2.
- `src/lib/form-echo.ts` : React 19 vide les champs non contrôlés après une action de formulaire.
  Sans cet écho, la saisie était perdue au moindre retour en erreur — l'avertissement de doublon
  était inutilisable. Appliqué aussi au formulaire des Paramètres (phase 0).

### Phase 2 — Agenda (1,5 semaine) — cœur du produit
- Vue jour et semaine, colonnes par employée, code couleur par employée.
- Création d'un rendez-vous : cliente → service(s) → employée → créneau. Durée pré-remplie
  depuis le service, modifiable.
- **Détection des conflits côté serveur** : pas de chevauchement pour une même employée.
  Respect des horaires de travail et des congés.
- Glisser-déposer pour déplacer un rendez-vous (desktop), formulaire de replanification (mobile).
- Statuts et transitions, marquage `NO_SHOW`.
- Liste d'attente : clientes en attente d'un désistement.
- Rappel WhatsApp automatique 24 h avant, template bilingue selon la langue de la cliente.

### Phase 3 — Caisse, facturation et NCF (1,5 semaine)
- Ouverture et fermeture de caisse par employée, comptage, écart.
- Encaissement d'un rendez-vous ou vente directe au comptoir.
- Calcul ITBIS 18 %, application des remises, utilisation d'un forfait ou d'un bon cadeau.
- Paiement multi-moyens sur une même facture (ex. moitié efectivo, moitié tarjeta).
- **Attribution du NCF** selon les règles du §4, écran de gestion des séquences réservé à `OWNER`.
- Facture PDF bilingue (langue de la cliente) : logo, RNC du studio, NCF, détail, ITBIS, total.
- Envoi de la facture par WhatsApp, ou impression thermique 80 mm.
- Annulation de facture avec motif obligatoire + entrée dans `AuditLog`.

### Phase 4 — Personnel, commissions, stock (1 semaine)
- Horaires, disponibilités, congés des employées.
- Calcul automatique des commissions à l'émission de la facture (taux du service, sinon taux
  de l'employée), écran de règlement des commissions par période.
- CRUD Product et Supplier, distinction usage interne / revente.
- Mouvements de stock, décrémentation automatique à la vente, alertes de stock minimum.

### Phase 5 — Fidélité, marketing, offline (1 semaine)
- Points ou visites, forfaits multi-séances, bons cadeaux.
- Segments : clientes inactives depuis 60 jours, anniversaires du mois, top clientes.
- Envoi de campagnes WhatsApp sur un segment, avec modèle bilingue.
- Mode dégradé : consultation de l'agenda du jour et des fiches clientes hors ligne ;
  file d'attente des écritures avec résolution de conflits à la reconnexion.
  **Les factures ne sont jamais émises hors ligne** (le NCF exige le serveur).

### Phase 6 — Rapports et mise en production (0,5 semaine)
- Rapports : CA par jour/mois, par service, par employée ; taux d'occupation ; taux de
  no-show ; panier moyen ; produits les plus vendus ; marge sur produits (`OWNER` seul).
- Export Excel et PDF, bilingue.
- Sauvegarde automatique quotidienne de la base, testée en restauration.
- Déploiement, nom de domaine, HTTPS, comptes réels créés, formation.

---

## 6. Ce qui n'est pas dans la v1

À refuser explicitement si la demande arrive en cours de route, et à noter dans un `BACKLOG.md` :
réservation en ligne publique par les clientes, application mobile native, multi-succursales,
pointeuse, comptabilité complète, intégration avec un terminal de paiement, programme de
parrainage, chat intégré.

Exception : la **réservation en ligne** est le seul point qu'on peut remonter en phase 5 si la
propriétaire la juge prioritaire — la base (services, durées, disponibilités) sera déjà en place.

---

## 7. Questions tranchées (réponses de la propriétaire — 2026-08-30)

1. **RNC / séquences NCF** — *pas encore communiqué*. Le module NCF est construit comme prévu
   (§4), mais les séquences réelles seront saisies dans Paramètres par la propriétaire. Une
   séquence B02 de test est fournie par le seed. **Reste à obtenir avant la mise en production.**
2. **Employées / rémunération** — les salaires et taux sont **paramétrés par la propriétaire**
   dans l'écran Paramètres. Le modèle doit donc supporter plusieurs modes de rémunération
   (commission, fixe, location de fauteuil) et non un seul.
3. **Fichier clientes existant** — aucun fichier structuré. La base actuelle est une **liste de
   contacts WhatsApp** plus les personnes qui passent devant le local. L'import CSV reste utile
   (export de contacts WhatsApp/téléphone), avec un minimum viable : nom + téléphone.
   La création rapide d'une cliente au comptoir est prioritaire sur l'import.
4. **Matériel caisse** — **imprimante thermique + laptop**. Impression 80 mm à prévoir dès la
   phase 3 ; pas de tablette à la caisse.
5. **WhatsApp** — **pas de numéro vérifié chez Meta**, pas de Cloud API. On se contente d'un
   **bouton « Partager »** qui ouvre WhatsApp avec un message pré-rempli (lien `wa.me`).
6. **Produits** — le studio vend **des produits et des services**. Le **module de gestion de
   stock est requis**, pas optionnel.
7. **Hébergement** — **Vercel**. Base de données **PostgreSQL hébergée (Aiven)**, déjà
   provisionnée, `sslmode=require`. Pas de Docker Compose local.

**Exigence transversale ajoutée** : toutes les informations du studio (identité, RNC, adresse,
horaires, logo, taux ITBIS, séquences NCF, taux de commission, modes de rémunération, mentions
de facture, largeur d'impression) doivent être **ajoutables et modifiables à volonté dans
Paramètres**. Aucune de ces valeurs ne doit être codée en dur ni figée dans une variable
d'environnement.

---

## 7 bis. Écarts actés par rapport au document initial

| §  | Prévu initialement | Retenu | Conséquence |
|---|---|---|---|
| 2 | Postgres en Docker Compose local | Postgres hébergé Aiven (`sslmode=require`) | pas de `docker-compose.yml` ; une seule base pour dev et prod tant que la prod n'est pas ouverte |
| 2 | Déploiement « Docker+VPS ou Vercel » à trancher en phase 6 | **Vercel**, tranché maintenant | Prisma en runtime serverless : prévoir le pooling de connexions dès la phase 0 |
| 2 / 5 | Notifications via WhatsApp Cloud API (Meta) | Lien `wa.me` + bouton Partager | **rappel automatique 24 h supprimé** de la phase 2 → remplacé par une file « à relancer aujourd'hui » que la réceptionniste envoie en un clic. Idem phase 5 : les campagnes génèrent les messages, l'envoi reste manuel |
| 4 | `Employee.commissionRate` seul | `salaryType` (COMMISSION / FIXED / BOOTH_RENT), `baseSalaryCents`, `commissionRate` | le calcul des commissions (phase 4) branche selon le mode |
| 4 | — | Nouveau modèle **`StudioSettings`** (singleton) + `BusinessHours` | porte l'exigence transversale ci-dessus |
| 3 | Facture PDF + impression thermique | idem, mais **impression thermique 80 mm prioritaire** (pas de tablette) | le PDF reste pour l'envoi/partage |
| 1 | Import CSV des clientes | maintenu, mais **non bloquant** | priorité à la création rapide d'une fiche au comptoir (nom + téléphone) |

## 8. Consignes de travail pour Claude Code

- Travailler **une phase à la fois**, une branche par phase (`feat/phase-2-agenda`).
- Avant d'écrire du code sur une phase : proposer un plan détaillé des fichiers à créer ou
  modifier, et attendre la validation.
- Après chaque tâche significative : `npm run typecheck && npm run lint && npm run test`.
- Toute nouvelle clé i18n est ajoutée **simultanément** dans `fr.json` et `es.json`.
- Les migrations Prisma sont nommées explicitement
  (`npx prisma migrate dev --name add_ncf_sequence`), jamais générées à la volée.
- Le seed (`prisma/seed.ts`) doit toujours produire un jeu de données réaliste :
  1 propriétaire, 3 employées, 20 clientes, 15 services répartis en 4 catégories,
  une semaine de rendez-vous, une séquence NCF B02 de test.
- Ne pas ajouter de commentaires décoratifs. Commenter uniquement la logique NCF,
  la détection de conflits d'agenda et la résolution de conflits offline.
- Mettre à jour ce fichier à la fin de chaque phase : cocher la phase, noter les écarts.
