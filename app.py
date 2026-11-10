
import os
import tempfile
import math

from flask import Flask, request, jsonify, render_template, send_file
from garminconnect import Garmin

from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.workout_message import WorkoutMessage
from fit_tool.profile.messages.workout_step_message import WorkoutStepMessage
from fit_tool.profile.profile_type import FileType, Manufacturer, Sport, Intensity


app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


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
def send_to_garmin():

    data = request.get_json(silent=True) or {}

    email = data.get("email") or os.environ.get("GARMIN_EMAIL")
    password = data.get("password") or os.environ.get("GARMIN_PASSWORD")

    workout_name = data.get("name", "Séance Fractionnée")
    raw_steps = data.get("steps", [])

    if not email or not password:
        return jsonify({
            "success": False,
            "error": "Identifiants Garmin manquants."
        }), 400

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
        client = Garmin(email, password)
        client.login()

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
