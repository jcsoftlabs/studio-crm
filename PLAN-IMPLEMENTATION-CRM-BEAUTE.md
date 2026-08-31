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

### Phase 2 — Agenda (1,5 semaine) — cœur du produit — ✅ **livrée le 2026-08-30**
- [x] Vue jour (grille, colonnes par employée, couleurs) et vue semaine. Sur mobile, liste
      chronologique du jour : la grille est illisible au doigt.
- [x] Création d'un rendez-vous : cliente → service(s) → employée → créneau. Durée pré-remplie
      depuis les prestations puis modifiable.
- [x] **Détection des conflits côté serveur**, appliquée au formulaire comme au glisser-déposer.
      Chevauchement sur une même employée : **refusé**, non forçable. Hors horaires de travail ou
      pendant un congé : **avertissement forçable** (arbitrage de la propriétaire).
- [x] Glisser-déposer natif HTML5 (desktop), formulaire de replanification (mobile).
- [x] Statuts et transitions, marquage `NO_SHOW`. Une annulation libère le créneau, une absence
      non prévenue ne le libère pas : elle a bien occupé l'agenda.
- [x] Liste d'attente : cliente, prestation et employée souhaitées facultatives, fenêtre de dates.
- [x] ~~Rappel WhatsApp automatique 24 h avant~~ → **file « Relances de demain »** : message
      pré-rempli dans un lien `wa.me`, envoi manuel (§7 bis, pas de Cloud API).
- [x] Seed §8 : 3 employées avec couleurs et horaires, une semaine de rendez-vous, comptes
      `RECEPTION` et `STYLIST`.

**Vérifié en conditions réelles** : rendez-vous à cheval sur un autre chez la même employée →
refusé en nommant la cliente qui occupe le créneau, sans bouton pour forcer ; rendez-vous à 07:30
avant l'ouverture → averti, forçable, créé après confirmation et stocké à `11:30 UTC` (Santo
Domingo = UTC−4) ; glisser-déposer d'un bloc de Yamilet 07:30 vers Massiel 16:00 → déplacé, avec
l'employée reportée sur les lignes du rendez-vous ; glisser-déposer sur un créneau occupé →
refusé, base inchangée ; relance de demain → lien `wa.me/18092001000` avec le message rempli.
Connexion en `STYLIST` : agenda réduit à sa colonne, navigation réduite à Accueil / Agenda /
Clientes, liste des clientes tombée de 20 à 14, fiche d'une cliente non servie en 404 par URL
directe, Paramètres refusés.

**Écarts actés en phase 2** :
- **`Employee`, `EmployeeSchedule` et `TimeOff` sont remontés de la phase 4** : l'agenda exige
  des colonnes par employée et le respect des horaires et des congés, il ne pouvait pas attendre.
  Restent en phase 4 : `salaryType`, `baseSalaryCents`, les taux de commission et l'écran de
  règlement.
- `AppointmentItem` gagne `durationMin` et `order` : la durée est modifiable sur le rendez-vous,
  elle ne peut donc pas être relue depuis le service.
- La restriction §3.2 sur les stylistes, laissée ouverte en phase 1, est **fermée**
  (`scopeToEmployee` dans `src/lib/permissions.ts`).
- Le sélecteur de cliente du formulaire est un `select` natif : à revoir en recherche filtrante
  au-delà de quelques centaines de clientes.
- L'écho de formulaire (phase 1) gère désormais les champs multiples : sans lui, un conflit vidait
  la cliente et les prestations avant même de pouvoir cliquer « Enregistrer quand même ».
- **Aucune librairie ajoutée** : glisser-déposer en API native HTML5.
- Le build affiche un avertissement `jose` / `CompressionStream` en Edge Runtime : il vient d'une
  dépendance d'Auth.js, pas du code du projet.

### Phase 3 — Caisse, facturation et NCF (1,5 semaine) — ✅ **livrée le 2026-08-30**
- [x] Ouverture et fermeture de caisse par employée, comptage, écart. Espèces attendues = fond
      initial + part espèces des factures + entrées − sorties ; cartes et virements ne passent
      pas par le tiroir.
- [x] Encaissement d'un rendez-vous (pré-rempli depuis ses prestations) ou vente directe.
- [x] ITBIS calculé **après** remise, remises par ligne, bon cadeau débité à l'émission.
- [x] Paiement multi-moyens sur une même facture, avec reste à payer et rendu.
- [x] **Attribution du NCF** conforme au §4 : `SELECT ... FOR UPDATE` sur `NcfSequence` dans la
      transaction d'émission, `Invoice.ncf` unique, aucun `count()`. Écran de gestion des
      séquences réservé à `OWNER`, avec alerte sous le seuil et à l'approche de l'expiration.
- [x] Facture bilingue : logo, RNC, NCF, détail, ITBIS, total, pied de facture des Paramètres.
- [x] Impression thermique via une **page ticket dédiée** `/{locale}/ticket/{id}`, hors du gabarit
      applicatif : le ticket est rendu **aux dimensions réelles du papier à l'écran comme sur la
      feuille**, d'après `printerWidthMm` des Paramètres (`@page` injecté depuis le réglage, pas
      figé à 80 mm). Pas de librairie PDF : le navigateur imprime et exporte en PDF, le pilote de
      l'imprimante fait le reste.
- [x] Annulation avec motif obligatoire, `AuditLog` `INVOICE_VOID`, bon cadeau recrédité.

**Vérifié en conditions réelles** : ouverture de caisse à RD$ 2 000 ; facture d'une manucure en
gel à RD$ 1 500 → ITBIS RD$ 270, total RD$ 1 770 ; règlement mixte espèces RD$ 770 + bon cadeau
RD$ 1 000, solde du bon passé de 2 000 à 1 000 ; NCF `B0200000001` attribué et séquence
incrémentée à 1 ; annulation motivée → statut `VOIDED`, bon recrédité à 2 000, `AuditLog` écrit,
et **`currentNumber` reste à 1 : le numéro est consommé, pas recyclé**.
**Concurrence prouvée** : 5 transactions simultanées sur la même séquence → 5 numéros distincts
et consécutifs, aucun doublon.

**Écarts actés en phase 3** :
- **`ClientPackage` et `GiftCard` remontés de la phase 5** : la phase 3 exige l'utilisation d'un
  forfait ou d'un bon cadeau. Restent en phase 5 : points de fidélité, segments, campagnes.
- Nouveau modèle `InvoiceLine` (absent du §4) : sans lignes, la facture ne peut pas porter le
  « détail » que le §5 exige.
- `Invoice` gagne `discountCents`, `itbisRateBp` (taux figé à l'émission : une facture ne change
  pas si l'ITBIS change ensuite), `locale` et `voidReason`.
- `Payment` gagne `giftCardId` pour pouvoir recréditer le bon à l'annulation.
- **`Client.locale` ajouté** : le §5 demandait des modèles « selon la langue de la cliente », mais
  le §4 ne prévoyait aucune colonne pour la stocker. Les relances et le message de facture
  suivent maintenant la langue de la cliente, pas celle de l'interface.
- **La facture ne peut pas partir en pièce jointe sur WhatsApp** : un lien `wa.me` ne transporte
  que du texte. On envoie un récapitulatif (NCF, total) ; l'impression et le PDF restent locaux.
  Une page de facture publique par lien signé exposerait le détail des soins : **à trancher avec
  la propriétaire avant de l'implémenter**.
- Pas de librairie PDF : impression navigateur avec une règle `@page` 80 mm.

**Corrections après revue de l'impression** :
- Il n'existait **aucun aperçu à l'écran** : les styles du ticket ne vivaient que dans
  `@media print`. Une page ticket dédiée les rend maintenant visibles au format réel.
- La règle `@page { size: 80mm }` était **globale** : elle s'appliquait à toutes les pages du CRM.
  Elle est désormais portée par la seule page ticket.
- L'impression aurait embarqué **la sidebar et l'en-tête** : `print:hidden` posé sur le gabarit
  applicatif, et le ticket sorti de ce gabarit.
- Le gabarit d'impression émettait un **second `<html>/<body>` imbriqué** dans celui de la racine,
  d'où une erreur d'hydratation React. Réduit à un simple conteneur.
- Vérifié : ticket mesuré à 302 px = 80 mm exactement, puis 219 px = 58 mm après changement du
  réglage ; rendu papier simulé sans chrome, en noir sur blanc.

**Ajout après coup — NCF facultatif (enregistrement DGII en cours)** :
- `Invoice.ncf`, `ncfType` et `sequenceId` deviennent **nullables**, et un
  `Invoice.number` séquentiel identifie **tout** document, avec ou sans NCF.
- Sans séquence active, l'encaissement produit un **reçu portant « SANS VALEUR FISCALE »**
  et la mention « ne remplace pas une facture avec NCF auprès de la DGII ». Le dialogue de
  caisse avertit avant émission et le bouton devient « Émettre un reçu ».
- Une séquence **épuisée ou expirée reste bloquante** : le studio est enregistré, il doit
  demander de nouveaux numéros — pas basculer en reçu en douce.
- `StudioSettings.allowSalesWithoutNcf` (vrai par défaut) : à désactiver une fois
  l'enregistrement finalisé.
- Vérifié : reçu n° 1 sans NCF, puis facture n° 2 en `B0200000001` après réactivation de la
  séquence, numérotation interne continue entre les deux.

**Bug trouvé au passage** : la transaction d'émission dépassait le **délai de 5 s de Prisma**
(6,4 s mesurées) — trop d'allers-retours vers une base distante. Les bons cadeaux sont désormais
validés hors transaction, les lignes et règlements créés en une seule écriture imbriquée, et le
délai porté à 20 s. Même correction sur l'enregistrement des Paramètres (sept upserts d'horaires).

**Dette relevée** : le Postgres hébergé refuse les connexions au-delà de son quota
(`FATAL: sorry, too many clients already`) — constaté à 12 transactions parallèles. `connection_limit`
est documenté dans `.env.example` et **doit être posé sur Vercel avant la mise en production**.

### Phase 4 — Personnel, commissions, stock (1 semaine) — ✅ **livrée le 2026-08-30**
- [x] Horaires, disponibilités, congés — déjà livrés en phase 2.
- [x] Rémunération paramétrable par employée : `salaryType` (commission / fixe / location de
      fauteuil), `baseSalaryCents`, `commissionRateBp`.
- [x] Commissions calculées **à l'émission de la facture**, cascade taux du service → taux de
      l'employée → taux des Paramètres. Seule une employée à la commission en génère.
      Une ligne par prestation, avec son assiette, pour justifier le règlement.
- [x] Écran de règlement par période sur `/staff`, agrégé par employée, tracé dans `AuditLog`
      (`COMMISSIONS_SETTLE`).
- [x] CRUD `Product` et `Supplier`, distinction revente / usage interne.
- [x] Mouvements de stock, décrément automatique à la vente, alertes de stock minimum.
      Le stock initial passe par un mouvement `PURCHASE` : jamais de quantité posée à la main.
- [x] **Trou de la phase 3 bouché** : le paiement « Forfait » consomme désormais une séance et
      `Payment.clientPackageId` retient laquelle. Les forfaits et les produits se vendent depuis
      la caisse.

**Vérifié en conditions réelles** : facture d'un service à RD$ 1 800 affecté à Yamilet (30 %) et
d'un produit → commission de RD$ 540 sur la seule ligne service, stock du produit passé de 24 à 23 ;
paiement par forfait → séance consommée 1/5 avec le forfait référencé sur le règlement ; annulation
de la facture → commission supprimée, mouvement compensatoire `ADJUSTMENT +1`, stock revenu à 24,
l'historique conservant la vente **et** son annulation ; écran des commissions affichant
« Yamilet · assiette RD$ 800 · RD$ 240 · à régler ».

**Écarts actés en phase 4** :
- `Commission` porte `baseCents` et `rateBp` en plus du montant : sans l'assiette, une employée
  ne peut pas vérifier son règlement.
- `InvoiceLine` gagne `productId` et `packageId` ; `ClientPackage` gagne `invoiceId`.
- Le stock est vérifié **avant** l'émission : on ne vend pas ce qu'on n'a pas, et un produit
  de cabine est refusé à la vente.
- Une facture annulée ne rémunère personne : les commissions sont supprimées, pas marquées.
- Le coût d'achat et la marge ne sont visibles que par `OWNER` (§3.2).

**Bug trouvé au passage** : la page `/staff` passait une fonction de formatage d'un composant
serveur à un composant client — `Functions cannot be passed directly to Client Components`.
Les montants sont désormais formatés côté serveur.

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
