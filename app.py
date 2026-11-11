import urllib.request
import os
import json
import hmac
import time
import base64
import hashlib
import secrets
import tempfile
import math
from datetime import datetime, timezone
from functools import wraps

from flask import (Flask, request, jsonify, render_template, send_file,
                   session, redirect)
from flask_sqlalchemy import SQLAlchemy
from cryptography.fernet import Fernet, InvalidToken
from werkzeug.security import generate_password_hash, check_password_hash
from garminconnect import Garmin

from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.workout_message import WorkoutMessage
from fit_tool.profile.messages.workout_step_message import WorkoutStepMessage
from fit_tool.profile.profile_type import FileType, Manufacturer, Sport, Intensity


app = Flask(__name__)

# --------------------------------------------------
# BASE DE DONNEES ET COMPTES
# --------------------------------------------------

_uri = os.environ.get("DATABASE_URL", "sqlite:///fractionne.db")
if _uri.startswith("postgres://"):
    _uri = _uri.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = _uri
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-a-changer")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = bool(os.environ.get("RENDER"))

db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False)
    pw = db.Column(db.String(300), nullable=False)


class Workout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"),
                        nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    data = db.Column(db.Text, nullable=False)
    updated = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc))


class Invite(db.Model):
    """Code d'invitation à usage unique, créé par le propriétaire."""
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(40), unique=True, nullable=False)
    used_by = db.Column(db.String(200))


class GarminLink(db.Model):
    """Lien Garmin d'un utilisateur : jetons et état MFA, toujours chiffrés."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"),
                        unique=True, nullable=False)
    tokens = db.Column(db.Text)
    pending = db.Column(db.Text)
    pending_at = db.Column(db.Float)

class PasswordReset(db.Model):
    """Jeton de réinitialisation de mot de passe, à usage unique."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"),
                        nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.Float, nullable=False)

with app.app_context():
    db.create_all()


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("uid"):
            return jsonify(success=False, error="Connexion requise."), 401
        return f(*args, **kwargs)
    return wrapper


def current_user():
    uid = session.get("uid")
    return db.session.get(User, uid) if uid else None


def is_owner(user):
    owner = os.environ.get("OWNER_EMAIL", "").strip().lower()
    return bool(user and owner and user.email == owner)


@app.post("/api/register")
def register():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    pw = d.get("password") or ""
    invite = os.environ.get("INVITE_CODE", "")

    code = str(d.get("invite") or "").strip()
    db_invite = (Invite.query.filter_by(code=code, used_by=None).first()
                 if code else None)
    allowed = (is_owner(User(email=email)) or bool(db_invite)
               or bool(invite and hmac.compare_digest(code, invite)))
    if not allowed:
        return jsonify(success=False,
                       error="Inscription sur invitation : code invalide."), 403
    if "@" not in email or len(pw) < 8:
        return jsonify(success=False,
                       error="E-mail invalide ou mot de passe trop court "
                             "(8 caractères minimum)."), 400
    if User.query.filter_by(email=email).first():
        return jsonify(success=False,
                       error="Un compte existe déjà avec cet e-mail."), 409

    user = User(email=email, pw=generate_password_hash(pw))
    db.session.add(user)
    db.session.commit()
    if db_invite:
        db_invite.used_by = email
        db.session.commit()
    session["uid"] = user.id
    return jsonify(success=True, email=email)


@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.pw, d.get("password") or ""):
        return jsonify(success=False,
                       error="E-mail ou mot de passe incorrect."), 401
    session["uid"] = user.id
    return jsonify(success=True, email=user.email)


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(success=True)


@app.get("/api/me")
def me():
    user = current_user()
    if not user:
        return jsonify(success=False), 401
    return jsonify(success=True, email=user.email)


# --------------------------------------------------
# BIBLIOTHEQUE DE SEANCES
# --------------------------------------------------

def workout_json(w):
    return {"id": w.id, "name": w.name, "data": json.loads(w.data),
            "updated": w.updated.isoformat() if w.updated else None}


def read_workout_body():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()[:120]
    data = d.get("data")
    if not name:
        return None, None, "Donne un nom à la séance."
    if (not isinstance(data, dict)
            or not isinstance(data.get("steps"), list)
            or not data["steps"] or len(data["steps"]) > 300):
        return None, None, "Séance invalide."
    return name, data, None


def own_workout(wid):
    return Workout.query.filter_by(id=wid, user_id=session["uid"]).first()


@app.get("/api/workouts")
@login_required
def list_workouts():
    rows = (Workout.query.filter_by(user_id=session["uid"])
            .order_by(Workout.updated.desc()).all())
    return jsonify(success=True, workouts=[workout_json(w) for w in rows])


@app.post("/api/workouts")
@login_required
def create_workout():
    name, data, err = read_workout_body()
    if err:
        return jsonify(success=False, error=err), 400
    w = Workout(user_id=session["uid"], name=name, data=json.dumps(data))
    db.session.add(w)
    db.session.commit()
    return jsonify(success=True, workout=workout_json(w))


@app.put("/api/workouts/<int:wid>")
@login_required
def update_workout(wid):
    w = own_workout(wid)
    if not w:
        return jsonify(success=False, error="Séance introuvable."), 404
    name, data, err = read_workout_body()
    if err:
        return jsonify(success=False, error=err), 400
    w.name, w.data = name, json.dumps(data)
    db.session.commit()
    return jsonify(success=True, workout=workout_json(w))


@app.post("/api/workouts/<int:wid>/duplicate")
@login_required
def duplicate_workout(wid):
    w = own_workout(wid)
    if not w:
        return jsonify(success=False, error="Séance introuvable."), 404
    copy = Workout(user_id=w.user_id, name=(w.name + " (copie)")[:120],
                   data=w.data)
    db.session.add(copy)
    db.session.commit()
    return jsonify(success=True, workout=workout_json(copy))


@app.delete("/api/workouts/<int:wid>")
@login_required
def delete_workout(wid):
    w = own_workout(wid)
    if not w:
        return jsonify(success=False, error="Séance introuvable."), 404
    db.session.delete(w)
    db.session.commit()
    return jsonify(success=True)


@app.context_processor
def inject_user():
    user = current_user()
    return {"me": user, "owner": is_owner(user)}


def render_page(template, key, auth=True, owner_only=False):
    if auth and not session.get("uid"):
        return redirect("/connexion?next=" + request.path)
    if owner_only and not is_owner(current_user()):
        return redirect("/")
    return render_template(template, page=key)


@app.route("/")
def index():
    return render_template("index.html", page="creator")


@app.get("/connexion")
def page_login():
    return render_page("connexion.html", "login", auth=False)

@app.get("/reinitialisation")
def page_reset():
    return render_page("reinitialisation.html", "reset", auth=False)


# --------------------------------------------------
# E-MAIL (RESEND)
# --------------------------------------------------

def send_email(to, subject, text):
    api_key = os.environ.get("RESEND_API_KEY")
    mail_from = os.environ.get("MAIL_FROM", "")
    if not api_key or not mail_from:
        app.logger.error("RESEND_API_KEY ou MAIL_FROM manquant : e-mail non envoyé")
        raise RuntimeError("Envoi d'e-mail non configuré.")

    body = json.dumps({
        "from": mail_from,
        "to": [to],
        "subject": subject,
        "text": text,
    }).encode()

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        },
        method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


# --------------------------------------------------
# RECUPERATION DE MOT DE PASSE
# --------------------------------------------------

RESET_TTL = 3600  # 1 heure


def _hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_reset_token(user):
    """Crée un jeton (renvoyé en clair une seule fois) et invalide les anciens."""
    PasswordReset.query.filter_by(user_id=user.id).delete()
    token = secrets.token_urlsafe(24)
    db.session.add(PasswordReset(
        user_id=user.id,
        token_hash=_hash_token(token),
        created_at=time.time()))
    db.session.commit()
    return token


@app.post("/api/forgot-password")
def forgot_password():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()

    # Réponse identique que le compte existe ou non,
    # pour ne pas révéler qui a un compte.
    if user:
        base_url = os.environ.get("APP_URL", request.host_url.rstrip("/"))
        link = base_url + "/reinitialisation?token=" + create_reset_token(user)
        try:
            send_email(
                user.email,
                "Réinitialisation de ton mot de passe",
                "Bonjour,\n\nPour choisir un nouveau mot de passe, ouvre ce "
                "lien (valable 1 heure) :\n\n" + link +
                "\n\nSi tu n'es pas à l'origine de cette demande, "
                "ignore ce message.")
        except Exception:
            app.logger.exception("Envoi de l'e-mail de réinitialisation impossible")
            return jsonify(success=False,
                           error="Envoi de l'e-mail impossible, réessaie plus "
                                 "tard."), 502

    return jsonify(success=True,
                   message="Si un compte existe avec cet e-mail, un lien de "
                           "réinitialisation vient d'être envoyé.")


@app.post("/api/reset-password")
def reset_password():
    d = request.get_json(silent=True) or {}
    token = (d.get("token") or "").strip()
    new = d.get("password") or ""
    if len(new) < 8:
        return jsonify(success=False,
                       error="Mot de passe trop court (8 caractères "
                             "minimum)."), 400

    reset = (PasswordReset.query.filter_by(token_hash=_hash_token(token)).first()
             if token else None)
    if not reset or time.time() - reset.created_at > RESET_TTL:
        return jsonify(success=False,
                       error="Lien invalide ou expiré, demande-en un "
                             "nouveau."), 400

    user = db.session.get(User, reset.user_id)
    if not user:
        return jsonify(success=False, error="Compte introuvable."), 404

    user.pw = generate_password_hash(new)
    db.session.delete(reset)
    PasswordReset.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify(success=True,
                   message="Mot de passe modifié, tu peux te connecter.")

@app.get("/bibliotheque")
def page_library():
    return render_page("bibliotheque.html", "library")


@app.get("/profil")
def page_profile():
    return render_page("profil.html", "profile")


@app.get("/admin")
def page_admin():
    return render_page("admin.html", "admin", owner_only=True)


# --------------------------------------------------
# COMPTE GARMIN DE CHAQUE UTILISATEUR
# --------------------------------------------------
# Le mot de passe Garmin sert une seule fois, pour obtenir des jetons.
# Seuls ces jetons sont conservés, chiffrés (Fernet) avec TOKEN_KEY.

def _fernet():
    key = os.environ.get("TOKEN_KEY")
    if not key:
        raw = hashlib.sha256(app.config["SECRET_KEY"].encode()).digest()
        key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def enc(text):
    return _fernet().encrypt(text.encode()).decode()


def dec(text):
    try:
        return _fernet().decrypt(text.encode()).decode()
    except InvalidToken:
        raise ValueError(
            "Jetons Garmin illisibles : reconnecte ton compte Garmin.")


def get_link(create=False):
    link = GarminLink.query.filter_by(user_id=session["uid"]).first()
    if not link and create:
        link = GarminLink(user_id=session["uid"])
        db.session.add(link)
    return link


def save_tokens(link, client):
    link.tokens = enc(client.client.dumps())
    link.pending = None
    link.pending_at = None
    db.session.commit()


def garmin_client_for(user):
    link = GarminLink.query.filter_by(user_id=user.id).first()

    if link and link.tokens:
        stored = dec(link.tokens)
        client = Garmin()
        client.login(tokenstore=stored)
        fresh = client.client.dumps()
        if fresh != stored:
            link.tokens = enc(fresh)
            db.session.commit()
        return client

    if (is_owner(user) and os.environ.get("GARMIN_EMAIL")
            and os.environ.get("GARMIN_PASSWORD")):
        client = Garmin(os.environ["GARMIN_EMAIL"],
                        os.environ["GARMIN_PASSWORD"])
        client.login()
        return client

    raise PermissionError(
        "Compte Garmin non connecté : connecte-le dans l'onglet Profil.")


@app.get("/api/garmin/status")
@login_required
def garmin_status():
    link = get_link()
    owner_env = bool(is_owner(current_user())
                     and os.environ.get("GARMIN_EMAIL"))
    return jsonify(success=True, linked=bool(link and link.tokens),
                   owner_env=owner_env)


@app.post("/api/garmin/connect")
@login_required
def garmin_connect():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip()
    password = d.get("password") or ""
    if not email or not password:
        return jsonify(success=False,
                       error="E-mail et mot de passe Garmin requis."), 400
    try:
        client = Garmin(email, password, return_on_mfa=True)
        status, state = client.login()
        link = get_link(create=True)
        if status == "needs_mfa":
            link.pending = enc(json.dumps(state))
            link.pending_at = time.time()
            db.session.commit()
            return jsonify(success=False, mfa_required=True,
                           error="Garmin demande un code de vérification.")
        save_tokens(link, client)
        return jsonify(success=True, linked=True)
    except Exception as e:
        app.logger.exception("Connexion Garmin impossible")
        return jsonify(success=False,
                       error="Connexion Garmin refusée : " + str(e)[:150]), 400


@app.post("/api/garmin/mfa")
@login_required
def garmin_mfa():
    code = ((request.get_json(silent=True) or {}).get("code") or "").strip()
    link = get_link()
    if (not link or not link.pending
            or time.time() - (link.pending_at or 0) > 600):
        return jsonify(success=False,
                       error="Demande expirée : recommence la connexion."), 400
    try:
        client = Garmin()
        client.resume_login(json.loads(dec(link.pending)), code)
        save_tokens(link, client)
        return jsonify(success=True, linked=True)
    except Exception as e:
        app.logger.exception("Code MFA Garmin refusé")
        return jsonify(success=False,
                       error="Code refusé : " + str(e)[:150]), 400


@app.post("/api/garmin/disconnect")
@login_required
def garmin_disconnect():
    link = get_link()
    if link:
        db.session.delete(link)
        db.session.commit()
    return jsonify(success=True)


# --------------------------------------------------
# PROFIL ET ADMINISTRATION
# --------------------------------------------------

def owner_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not is_owner(current_user()):
            return jsonify(success=False,
                           error="Réservé au propriétaire."), 403
        return f(*args, **kwargs)
    return login_required(wrapper)


def purge_user(user):
    Workout.query.filter_by(user_id=user.id).delete()
    GarminLink.query.filter_by(user_id=user.id).delete()
    PasswordReset.query.filter_by(user_id=user.id).delete()   # ← nouvelle ligne
    db.session.delete(user)
    db.session.commit()


@app.patch("/api/workouts/<int:wid>")
@login_required
def rename_workout(wid):
    w = own_workout(wid)
    name = ((request.get_json(silent=True) or {}).get("name") or "").strip()[:120]
    if not w:
        return jsonify(success=False, error="Séance introuvable."), 404
    if not name:
        return jsonify(success=False, error="Nom vide."), 400
    w.name = name
    db.session.commit()
    return jsonify(success=True, workout=workout_json(w))


@app.post("/api/profile/password")
@login_required
def change_password():
    d = request.get_json(silent=True) or {}
    user = current_user()
    if not check_password_hash(user.pw, d.get("current") or ""):
        return jsonify(success=False,
                       error="Mot de passe actuel incorrect."), 403
    new = d.get("new") or ""
    if len(new) < 8:
        return jsonify(success=False,
                       error="Nouveau mot de passe trop court (8 min)."), 400
    user.pw = generate_password_hash(new)
    db.session.commit()
    return jsonify(success=True)


@app.post("/api/profile/delete")
@login_required
def delete_account():
    d = request.get_json(silent=True) or {}
    user = current_user()
    if not check_password_hash(user.pw, d.get("password") or ""):
        return jsonify(success=False, error="Mot de passe incorrect."), 403
    purge_user(user)
    session.clear()
    return jsonify(success=True)


@app.get("/api/admin/users")
@owner_required
def admin_users():
    rows = []
    for u in User.query.order_by(User.id).all():
        linked = GarminLink.query.filter(
            GarminLink.user_id == u.id,
            GarminLink.tokens.isnot(None)).first()
        rows.append({
            "id": u.id, "email": u.email, "owner": is_owner(u),
            "self": u.id == session["uid"], "garmin": bool(linked),
            "workouts": Workout.query.filter_by(user_id=u.id).count()})
    return jsonify(success=True, users=rows)


@app.delete("/api/admin/users/<int:uid>")
@owner_required
def admin_delete_user(uid):
    user = db.session.get(User, uid)
    if not user or uid == session["uid"]:
        return jsonify(success=False, error="Suppression impossible."), 400
    purge_user(user)
    return jsonify(success=True)


@app.post("/api/admin/users/<int:uid>/password")
@owner_required
def admin_reset_password(uid):
    user = db.session.get(User, uid)
    if not user:
        return jsonify(success=False, error="Utilisateur introuvable."), 404
    new = secrets.token_urlsafe(9)
    user.pw = generate_password_hash(new)
    db.session.commit()
    return jsonify(success=True, password=new)


@app.get("/api/admin/invites")
@owner_required
def admin_invites():
    rows = Invite.query.order_by(Invite.id.desc()).all()
    return jsonify(success=True, invites=[
        {"id": i.id, "code": i.code, "used_by": i.used_by} for i in rows])


@app.post("/api/admin/invites")
@owner_required
def admin_create_invite():
    inv = Invite(code=secrets.token_urlsafe(6))
    db.session.add(inv)
    db.session.commit()
    return jsonify(success=True, code=inv.code)


@app.delete("/api/admin/invites/<int:iid>")
@owner_required
def admin_delete_invite(iid):
    inv = db.session.get(Invite, iid)
    if inv:
        db.session.delete(inv)
        db.session.commit()
    return jsonify(success=True)


# --------------------------------------------------
# CONSTRUCTION DES ETAPES GARMIN
# --------------------------------------------------

def build_garmin_steps(raw_steps):

    formatted_steps = []

    step_types = {
        "warmup": (1, "warmup", 1),
        "cooldown": (2, "cooldown", 2),
        "interval": (3, "interval", 3),
        "recovery": (4, "recovery", 4),
    }

    for index, step in enumerate(raw_steps, start=1):

        step_type = step.get("type", "interval")
        kind = step.get("kind", "time")

        if step_type not in step_types:
            raise ValueError(
                f"Type d'étape inconnu : {step_type}"
            )

        if kind not in ("time", "distance"):
            raise ValueError(
                f"Type de durée inconnu : {kind}"
            )

        try:
            value = float(step.get("value", 0))
        except (TypeError, ValueError):
            raise ValueError(
                f"Valeur invalide à l'étape {index}"
            )

        if not math.isfinite(value) or value <= 0:
            raise ValueError(
                f"La valeur de l'étape {index} doit être positive."
            )

        step_type_id, step_type_key, display_order = step_types[step_type]

        if kind == "time":
            condition_id = 2
            condition_key = "time"
            condition_order = 2
        else:
            condition_id = 3
            condition_key = "distance"
            condition_order = 3

        # Cible par défaut : aucune cible
        target_type = {
            "workoutTargetTypeId": 1,
            "workoutTargetTypeKey": "no.target",
            "displayOrder": 1
        }

        extra_target_fields = {}

        # ------------------------------------------
        # CIBLE D'ALLURE POUR LES EFFORTS
        # ------------------------------------------

        if step_type == "interval":

            pace_min_raw = step.get("paceMinSecPerKm")
            pace_max_raw = step.get("paceMaxSecPerKm")

            has_min = pace_min_raw is not None and pace_min_raw != ""
            has_max = pace_max_raw is not None and pace_max_raw != ""

            # Les deux bornes doivent être renseignées
            # ou aucune des deux.
            if has_min != has_max:
                raise ValueError(
                    f"Les deux bornes d'allure doivent être renseignées "
                    f"à l'étape {index}."
                )

            if has_min and has_max:

                try:
                    pace_min = float(pace_min_raw)
                    pace_max = float(pace_max_raw)

                except (TypeError, ValueError):
                    raise ValueError(
                        f"Allure invalide à l'étape {index}."
                    )

                if (
                    not math.isfinite(pace_min)
                    or not math.isfinite(pace_max)
                    or pace_min <= 0
                    or pace_max <= 0
                ):
                    raise ValueError(
                        f"Les allures de l'étape {index} "
                        f"doivent être positives."
                    )

                if pace_min > pace_max:
                    raise ValueError(
                        f"L'allure minimale doit être inférieure "
                        f"ou égale à l'allure maximale à l'étape {index}."
                    )

                # Garmin attend des mètres par seconde.
                #
                # pace_min = allure la plus rapide
                # pace_max = allure la plus lente
                #
                # La vitesse la plus lente est donc
                # la valeur numérique la plus petite.

                speed_min = 1000.0 / pace_max
                speed_max = 1000.0 / pace_min

                target_type = {
                    "workoutTargetTypeId": 6,
                    "workoutTargetTypeKey": "pace.zone",
                    "displayOrder": 1
                }

                extra_target_fields = {
                    "targetValueOne": speed_min,
                    "targetValueTwo": speed_max
                }

        # ------------------------------------------
        # ETAPE GARMIN
        # ------------------------------------------

        formatted_step = {
            "type": "ExecutableStepDTO",
            "stepOrder": index,

            "stepType": {
                "stepTypeId": step_type_id,
                "stepTypeKey": step_type_key,
                "displayOrder": display_order
            },

            "endCondition": {
                "conditionTypeId": condition_id,
                "conditionTypeKey": condition_key,
                "displayOrder": condition_order,
                "displayable": True
            },

            "endConditionValue": value,

            "targetType": target_type
        }

        # Ajout des bornes d'allure si elles existent.
        formatted_step.update(extra_target_fields)

        formatted_steps.append(formatted_step)

    return formatted_steps


# --------------------------------------------------
# ENVOI DIRECT VERS GARMIN CONNECT
# --------------------------------------------------

@app.route("/api/send-to-garmin", methods=["POST"])
@login_required
def send_to_garmin():

    data = request.get_json(silent=True) or {}

    workout_name = data.get("name", "Séance Fractionnée")
    raw_steps = data.get("steps", [])

    if not isinstance(raw_steps, list) or not raw_steps:
        return jsonify({
            "success": False,
            "error": "La séance ne contient aucune étape."
        }), 400

    try:

        # Construction des étapes et de leurs cibles
        formatted_steps = build_garmin_steps(raw_steps)

        sport_type = {
            "sportTypeId": 1,
            "sportTypeKey": "running",
            "displayOrder": 1
        }

        estimated_duration = sum(
            float(step.get("value", 0))
            for step in raw_steps
            if step.get("kind") == "time"
        )

        workout_payload = {
            "workoutName": workout_name,
            "sportType": sport_type,
            "estimatedDurationInSecs": int(estimated_duration),

            "workoutSegments": [
                {
                    "segmentOrder": 1,
                    "sportType": sport_type,
                    "workoutSteps": formatted_steps
                }
            ]
        }

        # Connexion à Garmin
        client = garmin_client_for(current_user())

        # Envoi de la séance
        result = client.upload_workout(workout_payload)

        if not isinstance(result, dict):
            raise Exception(
                f"Réponse Garmin inattendue : {result}"
            )

        workout_id = result.get("workoutId")

        if not workout_id:
            return jsonify({
                "success": False,
                "error": (
                    "Garmin n'a pas retourné d'identifiant de séance. "
                    "L'envoi n'a pas pu être confirmé."
                ),
                "garmin_response": result
            }), 502

        # Vérification de la présence dans Garmin Connect
        saved_workout = client.get_workout_by_id(workout_id)

        if (
            not saved_workout
            or str(saved_workout.get("workoutId")) != str(workout_id)
        ):
            return jsonify({
                "success": False,
                "error": (
                    "La séance a été envoyée, mais sa présence "
                    "dans Garmin Connect n'a pas pu être vérifiée."
                ),
                "workout_id": workout_id
            }), 502

        # Nombre de fractions comportant une cible d'allure
        pace_targets_count = sum(
            1 for step in raw_steps
            if (
                step.get("type") == "interval"
                and step.get("paceMinSecPerKm") is not None
                and step.get("paceMaxSecPerKm") is not None
            )
        )

        return jsonify({
            "success": True,
            "message": "Séance envoyée et vérifiée dans Garmin Connect !",
            "workout_id": workout_id,
            "pace_targets_sent": pace_targets_count
        })

    except Exception as e:

        error_message = str(e)

        if "MFA" in error_message or "mfa" in error_message:
            return jsonify({
                "success": False,
                "mfa_required": True,
                "error": "Garmin demande un code de vérification."
            }), 401

        app.logger.exception(
            "Erreur lors de l'envoi vers Garmin"
        )

        return jsonify({
            "success": False,
            "error": error_message
        }), 400


# --------------------------------------------------
# EXPORT AU FORMAT FIT
# --------------------------------------------------

@app.route("/api/export-fit", methods=["POST"])
def export_fit():

    try:

        data = request.get_json(silent=True) or {}

        workout_name = data.get("name", "Séance Fractionnée")
        steps = data.get("steps", [])

        if not isinstance(steps, list) or not steps:
            return jsonify({
                "success": False,
                "error": "La séance ne contient aucune étape."
            }), 400

        builder = FitFileBuilder(auto_define=True)

        # 1. Identifiant du fichier
        file_id = FileIdMessage()
        file_id.type = FileType.WORKOUT
        file_id.manufacturer = Manufacturer.DEVELOPMENT.value
        file_id.product = 0
        file_id.serial_number = 12345
        builder.add(file_id)

        # 2. Entraînement
        workout_msg = WorkoutMessage()
        workout_msg.wkt_name = workout_name
        workout_msg.sport = Sport.RUNNING
        workout_msg.num_valid_steps = len(steps)
        builder.add(workout_msg)

        # 3. Étapes
        for index, step in enumerate(steps):

            step_msg = WorkoutStepMessage()
            step_msg.message_index = index
            step_msg.wkt_step_name = step.get("type", "interval")
            step_msg.intensity = Intensity.ACTIVE

            duration_val = float(step.get("value", 0))

            if step.get("kind") == "time":
                step_msg.duration_time = duration_val * 1000
            else:
                step_msg.duration_distance = duration_val * 1000

            builder.add(step_msg)

        fit_file = builder.build()

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".fit"
        ) as tmp:
            tmp_path = tmp.name

        fit_file.to_file(tmp_path)

        filename = f"{workout_name.replace(' ', '_')}.fit"

        return send_file(
            tmp_path,
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:

        app.logger.exception(
            "Erreur lors de la génération du fichier FIT"
        )

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
