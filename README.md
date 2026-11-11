# Générateur de fractionné

Refonte technique de l'application Générateur de fractionné.

Cette branche (`refonte-react`) accueille la nouvelle architecture React / TypeScript et NestJS. L'ancienne application Flask est conservée pendant la reconstruction, mais elle n'est pas utilisée par la nouvelle application.

## 1. Architecture technique

| Composant | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite 6 |
| Backend | NestJS 11 |
| Base de données | PostgreSQL 16 |
| ORM | Prisma 7 |
| Authentification | Argon2id, sessions en base de données |
| Environnement local | Docker Compose |
| Gestion des dépendances | npm workspaces |

### Organisation du projet

- `frontend/` : application React.
- `backend/` : API NestJS.
- `backend/prisma/` : schéma Prisma et migrations SQL.
- `backend/src/auth/` : premières briques d'authentification.
- `backend/src/prisma/` : service et module Prisma.
- `backend/scripts/` : scripts techniques, dont la création du compte administrateur.
- `docker-compose.yml` : configuration PostgreSQL locale.

## 2. Prérequis

- Node.js 20 ou supérieur.
- npm.
- Docker Desktop.
- Git.

## 3. Installation du projet

Récupérer la branche `refonte-react` :

```bash
git clone -b refonte-react https://github.com/tomheuz-101/GenerateurFractionne.git
cd GenerateurFractionne
```

### Configuration des variables d'environnement

Créer le fichier `backend/.env` à partir de `backend/.env.example`.

Sous Windows (CMD) :

```cmd
copy backend\.env.example backend\.env
```

Configurer notamment les variables suivantes :

```env
DATABASE_URL="postgresql://app:app@localhost:5433/generateur_fractionne?schema=public"
FRONTEND_ORIGIN="http://localhost:5173"
PORT=3000
ADMIN_EMAIL="admin@example.com"
```

Remplacer `admin@example.com` par l'adresse souhaitée pour le compte administrateur local.

**Important :** le fichier `.env` contient des informations privées. Il ne doit jamais être envoyé sur GitHub.

### Installation des dépendances

À la racine du projet :

```bash
npm install
```

Le client Prisma est généré automatiquement lors de l'installation grâce au script `postinstall` du backend.

## 4. Démarrage de PostgreSQL

Depuis la racine du projet :

```bash
docker compose up -d
```

La base locale est accessible sur :

- Hôte : `localhost`
- Port : `5433`
- Base : `generateur_fractionne`

Les données sont conservées dans un volume Docker nommé `postgres_data`.

## 5. Initialisation de la base de données

Depuis le dossier `backend` :

```bash
npx prisma migrate deploy
```

Cette commande applique les migrations déjà présentes dans le dépôt.

Pour vérifier leur état :

```bash
npx prisma migrate status
```

Pour régénérer manuellement le client Prisma :

```bash
npx prisma generate
```

## 6. Création du compte administrateur

Depuis la racine du projet :

```bash
npm run create:admin --workspace backend
```

Le script demande le mot de passe administrateur deux fois et crée le compte correspondant à `ADMIN_EMAIL`.

Le mot de passe est stocké sous forme de hash Argon2id.

## 7. Démarrage de l'application

Depuis la racine du projet :

```bash
npm run dev
```

Les deux applications démarrent simultanément.

| Service | Adresse |
|---|---|
| Frontend | http://localhost:5173 |
| API NestJS | http://localhost:3000/api |
| Santé de l'API | http://localhost:3000/api/health |

Le frontend utilise le proxy Vite pour transmettre les appels `/api` au backend.

## 8. Compilation

Pour compiler le frontend et le backend :

```bash
npm run build
```

## 9. État actuel du développement

### Réalisé

- [x] Mise en place du monorepo npm.
- [x] Initialisation React / TypeScript / Vite.
- [x] Initialisation NestJS.
- [x] Configuration de PostgreSQL avec Docker Compose.
- [x] Intégration de Prisma 7.
- [x] Création du schéma de données.
- [x] Création des migrations initiales et des sessions.
- [x] Connexion du backend à PostgreSQL.
- [x] Configuration des validations globales et du CORS.
- [x] Mise en place du hashage des mots de passe avec Argon2id.
- [x] Premières briques de gestion des sessions.
- [x] Script de création du compte administrateur.
- [x] Compilation du frontend et du backend.

### À réaliser

- [ ] Finaliser les routes d'inscription, de connexion et de déconnexion.
- [ ] Mettre en place la protection des routes et la gestion des droits administrateur.
- [ ] Finaliser la gestion des invitations.
- [ ] Construire l'interface utilisateur React.
- [ ] Recréer les fonctionnalités de génération et de gestion des entraînements.
- [ ] Mettre en place les tests automatisés.
- [ ] Préparer le déploiement sur Render et la base Neon.
- [ ] Configurer les envois d'e-mails avec Brevo.
- [ ] Réaliser les tests de sécurité et de fonctionnement avant mise en production.

## 10. Stratégie de migration

La nouvelle application repart sur une base propre.

Aucun compte utilisateur ni aucune donnée de l'ancienne application Flask ne sont importés automatiquement.

L'ancienne application et son environnement de production ne doivent pas être modifiés pendant la refonte.

La mise en production de la nouvelle application interviendra uniquement après validation complète des fonctionnalités et des tests.

## 11. Règles Git

Les développements de la refonte sont réalisés sur la branche :

`refonte-react`

Les branches `main` et `develop` restent indépendantes de cette refonte tant qu'une bascule n'a pas été explicitement décidée.

Les fichiers `.env`, les secrets, les dépendances installées et les fichiers générés ne doivent pas être versionnés.