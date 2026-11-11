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
| `RESEND_API_KEY` | Clé API Resend, pour l'e-mail de réinitialisation de mot de passe |
| `MAIL_FROM` | Expéditeur des e-mails (adresse d'un domaine vérifié chez Resend, ex. `Fractionné <noreply@ton-domaine.fr>`) |
| `APP_URL` | Facultatif : adresse publique du site (sinon `RENDER_EXTERNAL_URL`, fourni par Render) |
| `GARMIN_EMAIL`, `GARMIN_PASSWORD` | Facultatif : identifiants Garmin du propriétaire, utilisés seulement s'il n'a pas connecté son compte dans la page |

Chaque utilisateur connecte son propre compte Garmin dans l'onglet Profil : le mot de passe sert une fois, seuls des jetons chiffrés sont stockés.

Démarrage : `gunicorn app:app`

## Pages

`/` créateur · `/bibliotheque` séances enregistrées · `/profil` compte, Garmin, mot de passe · `/admin` utilisateurs et invitations (propriétaire) · `/connexion`.
Les invitations à usage unique se créent dans l'administration ; `INVITE_CODE` reste possible comme code partagé.

## Sécurité

- Mots de passe hashés ; jetons Garmin chiffrés (`TOKEN_KEY`).
- Changer ou réinitialiser un mot de passe déconnecte les sessions ouvertes.
- Limites de tentatives : 8 connexions échouées / 15 min par adresse + e-mail, 3 demandes de réinitialisation / heure par e-mail (compteurs en mémoire, par processus).
- Lien de réinitialisation : à usage unique, valable 1 heure ; la réponse est identique que le compte existe ou non.
