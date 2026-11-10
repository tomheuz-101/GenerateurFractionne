import os
from flask import Flask, request, jsonify, render_template
from garminconnect import Garmin
import garth  # <-- Indispensable pour éviter le NameError

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

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

        # Construction du payload d'entraînement au format Garmin
        workout_payload = {
            "workoutName": workout_name,
            "sportType": {"sportTypeId": 1, "sportKey": "running"},
            "workoutSegments": [
                {
                    "segmentOrder": 1,
                    "sportType": {"sportTypeId": 1, "sportKey": "running"},
                    "workoutSteps": steps
                }
            ]
        }

        # Utilisation de l'endpoint POST correct de la bibliothèque garminconnect
        client.add_workout(workout_payload)
        
        return jsonify({"success": True, "message": "Entraînement envoyé avec succès sur Garmin Connect !" })

    except garth.exceptions.MFAError:
        return jsonify({"success": False, "mfa_required": True, "error": "Code MFA requis par Garmin."}), 401
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True)
