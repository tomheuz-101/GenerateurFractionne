# Générateur de fractionné — refonte technique

Cette branche accueille la nouvelle application React + TypeScript / NestJS.
L'application Flask historique est conservée à la racine pendant la migration ;
elle n'est pas supprimée ni remplacée dans cette première étape.

## Architecture cible

- `frontend/` : interface React, TypeScript et Vite.
- `backend/` : API NestJS.
- PostgreSQL : base locale via Docker Compose, puis base Neon dédiée à la refonte.
- Prisma sera utilisé comme ORM lors de la prochaine étape de modélisation des données.

## Prérequis

- Node.js 20 ou supérieur
- npm
- Docker Desktop (pour PostgreSQL local)

## Démarrage

```bash
npm install
docker compose up -d
npm run dev
```

- Frontend : http://localhost:5173
- API : http://localhost:3000/api
- Vérification API : http://localhost:3000/api/health

Le frontend utilise le proxy Vite pour transmettre les appels `/api` au backend.

## Configuration

Ne jamais committer de secret ni de fichier `.env`.
Les variables et connexions Render/Neon de l'application historique ne sont pas réutilisées automatiquement.

## Stratégie de migration

1. Valider le socle technique.
2. Définir le modèle de données cible à partir des fonctionnalités réellement utilisées.
3. Mettre en place Prisma et les migrations PostgreSQL.
4. Migrer les comptes et les données avec une procédure contrôlée.
5. Recréer les fonctionnalités une par une et les tester avant toute bascule.

Aucune donnée de production ne doit être migrée ou modifiée pendant la mise en place du socle.
