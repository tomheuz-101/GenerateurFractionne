import os
import io
from flask import Flask, request, jsonify, render_template, send_file
from garminconnect import Garmin
import garth
from fit_tool.fit_file_builder import FitFileBuilder

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

def format_garmin_steps(raw_steps):
    formatted_steps = []
    for index, step in enumerate(raw_steps, start=1):
        step_type_id = 3 if step.get("type") == "warmup" else 1
        garmin_step = {
            "type": "ExecutableStep",
            "stepOrder": index,
            "stepType": {
                "stepTypeId": step_type_id,
                "stepKey": step.get("type", "interval")
            },
            "childStepId": None,
            "endCondition": {
                "conditionTypeId": 2,
                "conditionKey": step.get("kind", "time")
            },
            "targetType": {
                "refreshRate": 0,
                "workoutTargetTypeId": 1,
                "workoutTargetTypeKey": "no.target"
            },
            "durationValue": float(step.get("value", 0)),
            "targetValueOne": None,
            "targetValueTwo": None
        }
        formatted_steps.append(garmin_step)
    return formatted_steps

@app.route("/api/send-to-garmin", methods=["POST"])
def send_to_garmin():
    data = request.json
    
    email = data.get("email") or os.environ.get("GARMIN_EMAIL")
    password = data.get("password") or os.environ.get("GARMIN_PASSWORD")
    
    workout_name = data.get("name")
    steps = data.get("steps")
    mfa_code = data.get("mfa_code")

    if not email or not password:
        return jsonify({"success": False, "error": "Identifiants Garmin manquants."}), 400

    try:
        client = Garmin(email, password)
        if mfa_code:
            client.login(mfa_code)
        else:
            client.login()

        workout_payload = {
            "workoutName": workout_name,
            "sportType": {"sportTypeId": 1, "sportKey": "running"},
            "workoutSegments": [
                {
                    "segmentOrder": 1,
                    "sportType": {"sportTypeId": 1, "sportKey": "running"},
                    "workoutSteps": format_garmin_steps(steps)
                }
            ]
        }

        garth.client.request(
            "POST",
            "connect",
            "/modern/proxy/workout-service/workout",
            json=workout_payload
        )
        
        return jsonify({"success": True, "message": "Séance envoyée avec succès ! Synchronise ta montre."})

    except Exception as e:
        err_msg = str(e)
        if "MFA" in err_msg or "mfa" in err_msg:
            return jsonify({"success": False, "mfa_required": True, "error": "Code MFA requis par Garmin."}), 401
        return jsonify({"success": False, "error": err_msg}), 400
        
import tempfile
import os
from flask import request, send_file, jsonify
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.workout_message import WorkoutMessage
from fit_tool.profile.messages.workout_step_message import WorkoutStepMessage
from fit_tool.profile.profile_type import FileType, Manufacturer, Sport, Intensity

@app.route("/api/export-fit", methods=["POST"])
def export_fit():
    try:
        data = request.json
        workout_name = data.get("name", "Séance Fractionnée")
        steps = data.get("steps", [])

        builder = FitFileBuilder(auto_define=True)
        
        # 1. Message d'identification du fichier
        file_id = FileIdMessage()
        file_id.type = FileType.WORKOUT
        file_id.manufacturer = Manufacturer.DEVELOPMENT.value
        file_id.product = 0
        file_id.serial_number = 12345
        builder.add(file_id)

        # 2. Message principal de l'entraînement
        workout_msg = WorkoutMessage()
        workout_msg.wkt_name = workout_name
        workout_msg.sport = Sport.RUNNING
        workout_msg.num_valid_steps = len(steps)
        builder.add(workout_msg)

        # 3. Ajout de chaque étape
        for index, step in enumerate(steps, start=1):
            step_msg = WorkoutStepMessage()
            step_msg.message_index = index - 1
            step_msg.wkt_step_name = step.get("type", "interval")
            
            # Utilisation directe de Intensity.ACTIVE ou valeur par défaut pour éviter l'erreur d'attribut
            step_msg.intensity = Intensity.ACTIVE
            
            # Durée (Temps en millisecondes ou distance en millimètres)
            duration_val = float(step.get("value", 0))
            if step.get("kind") == "time":
                step_msg.duration_time = duration_val
            else:
                step_msg.duration_distance = duration_val * 1000
                
            builder.add(step_msg)

        fit_file = builder.build()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
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
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
