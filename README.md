# GenerateurFractionne

Générateur de séances de fractionné : bibliothèque par utilisateur, modèles, envoi vers Garmin Connect, export .fit.

## Variables d'environnement (Render)

| Variable | Rôle |
|---|---|
| `SECRET_KEY` | Clé de session (longue chaîne aléatoire, obligatoire) |
| `DATABASE_URL` | Base Postgres (ex. Supabase). Sans elle : SQLite local, effacée à chaque déploiement sur Render gratuit |
| `OWNER_EMAIL` | E-mail du propriétaire : seul compte pouvant s'inscrire sans code, et seul à utiliser `GARMIN_EMAIL` / `GARMIN_PASSWORD` |
| `INVITE_CODE` | Code à donner aux personnes invitées pour créer un compte |
| `TOKEN_KEY` | Clé de chiffrement des jetons Garmin (générer : `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`). Sans elle, dérivée de `SECRET_KEY` |
| `GARMIN_EMAIL`, `GARMIN_PASSWORD` | Facultatif : identifiants Garmin du propriétaire, utilisés seulement s'il n'a pas connecté son compte dans la page |

Chaque utilisateur connecte son propre compte Garmin dans la bibliothèque : le mot de passe sert une fois, seuls des jetons chiffrés sont stockés.

Démarrage : `gunicorn app:app`

## Pages

`/` créateur · `/bibliotheque` séances enregistrées · `/profil` compte, Garmin, mot de passe · `/admin` utilisateurs et invitations (propriétaire) · `/connexion`.
Les invitations à usage unique se créent dans l'administration ; `INVITE_CODE` reste possible comme code partagé.
