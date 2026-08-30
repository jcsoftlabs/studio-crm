# Déploiement sur Vercel

## 1. Variables d'environnement

À saisir dans Vercel → Settings → Environment Variables.

| Variable | Valeur | Obligatoire |
|---|---|---|
| `DATABASE_URL` | l'URL Postgres **avec `?sslmode=require&connection_limit=1`** | oui |
| `AUTH_SECRET` | `openssl rand -base64 32` | oui |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob → Connect | oui pour les photos |

**Ne pas définir `AUTH_URL`.** Avec `trustHost`, l'hôte est déduit de la requête ;
une valeur figée renvoie toutes les redirections de connexion sur ce domaine-là.

**`connection_limit=1` n'est pas décoratif.** Chaque fonction serverless ouvre son
propre pool ; sans cette limite le fournisseur répond
`FATAL: sorry, too many clients already` dès la première pointe.

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
2. **Paramètres → Séquences NCF** — saisir les séquences réelles de la DGII.
   Sans séquence active, **aucune facture ne peut être émise**.
3. **Employées** — noms, couleurs, horaires.
4. **Services** — catégories et prestations, en espagnol et en français.

## 4. Points ouverts

- Le mot de passe de la base a transité par une capture d'écran : le faire tourner.
- Base unique dev et production tant qu'une seconde n'est pas provisionnée.
- Sauvegarde quotidienne et restauration testée : prévues en phase 6.
