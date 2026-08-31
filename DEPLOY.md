# Déploiement sur Vercel

## 1. Variables d'environnement

À saisir dans Vercel → Settings → Environment Variables.

| Variable | Valeur | Obligatoire |
|---|---|---|
| `DATABASE_URL` | l'URL **du pooler**, avec `?sslmode=require&connection_limit=1` | oui |
| `AUTH_SECRET` | `openssl rand -base64 32` | oui |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob → Connect | oui pour les photos |

**Ne pas définir `AUTH_URL`.** Avec `trustHost`, l'hôte est déduit de la requête ;
une valeur figée renvoie toutes les redirections de connexion sur ce domaine-là.

### Le pooler n'est pas optionnel

Le service a **15 connexions au total**. Mesuré en production : les fonctions Vercel
en retenaient **9 à elles seules, toutes inactives**. Sans pooler, l'application tombe
dès que quelques instances sont tièdes.

Console Aiven → service → **Pools** → *Create pool* :

| Champ | Valeur |
|---|---|
| Database | `defaultdb` |
| Username | `avnadmin` |
| Pool mode | **`transaction`** |
| Pool size | 10 |

Copier ensuite le **Service URI du pool** (port différent de celui de la base) et
y ajouter `?sslmode=require&pgbouncer=true&connection_limit=1`.

**`pgbouncer=true` est obligatoire** : en mode `transaction`, Prisma doit désactiver
ses requêtes préparées. Sans ce paramètre, les erreurs sont erratiques et illisibles.

Le verrou `SELECT ... FOR UPDATE` des NCF reste correct derrière ce pooler : en mode
`transaction`, une transaction entière tient sur une même connexion serveur.

**`connection_limit=1` reste nécessaire** par-dessus. L'application la pose déjà
elle-même quand l'URL ne la contient pas (`src/lib/db.ts`), pour qu'une variable
oubliée ne mette pas le studio à l'arrêt — mais la poser dans l'URL reste préférable,
c'est explicite.

**Symptôme d'un pooler manquant** : `FATAL: sorry, too many clients already` ou
`remaining connection slots are reserved for roles with the SUPERUSER attribute`,
sur n'importe quelle page, de façon intermittente.

## 2. Premier démarrage

Le build applique les migrations tout seul (`prisma migrate deploy`), mais la base
reste sans compte : personne ne peut se connecter. Une seule fois, depuis un poste
pointant sur la base de production :

```bash
SEED_OWNER_EMAIL="…" SEED_OWNER_PASSWORD="…" npm run db:bootstrap
```

`db:bootstrap` ne crée que les Paramètres du studio et le compte propriétaire.

> `npm run db:seed` est le jeu de **démonstration** : 20 clientes fictives, une
> semaine de rendez-vous inventés, un bon cadeau et une séquence NCF de test.
> Il refuse de s'exécuter en production. Ne pas le lancer sur une base réelle.

## 3. À faire dans l'application, dans cet ordre

1. **Paramètres** — nom, RNC, adresse, horaires, ITBIS, largeur d'impression.
2. **Paramètres → Séquences NCF** — dès que la DGII a délivré les numéros.
   Tant qu'aucune séquence n'est active, la caisse fonctionne : les encaissements
   sortent en **reçus numérotés portant la mention « sans valeur fiscale »**, et
   non en factures. Dès qu'une séquence est saisie, les NCF reprennent
   automatiquement. Le réglage « Autoriser les encaissements sans NCF » est activé
   par défaut : **le désactiver une fois l'enregistrement DGII finalisé**, pour
   qu'une séquence oubliée bloque la caisse au lieu de produire des reçus.
3. **Employées** — noms, couleurs, horaires.
4. **Services** — catégories et prestations, en espagnol et en français.

## 4. Sauvegardes

Deux niveaux, et le second n'est pas facultatif :

1. **Celles du fournisseur.** Aiven prend des sauvegardes automatiques ; vérifier la
   rétention dans la console du service. Elles disparaissent avec le compte.
2. **La copie du studio.** `npm run db:backup` écrit un dump dans `backups/`
   (format `custom`, les 14 derniers conservés). Il faut `pg_dump` :
   `brew install libpq && brew link --force libpq` sur macOS.

Restauration :

```bash
pg_restore --clean --no-owner --dbname="$DATABASE_URL" backups/studio-crm-<horodatage>.dump
```

> **La restauration n'a pas été testée** : `pg_dump` n'est pas installé sur le poste
> de développement. À faire une fois, sur une base jetable, **avant** de confier des
> factures réelles au système. Une sauvegarde jamais restaurée n'est pas une sauvegarde.

Planifier le dump quotidien avec `cron` ou une tâche planifiée sur le poste de la caisse.

## 5. Points ouverts

- Le mot de passe de la base a transité par une capture d'écran : le faire tourner.
- Base unique dev et production tant qu'une seconde n'est pas provisionnée.
- Restauration à tester (voir ci-dessus).
