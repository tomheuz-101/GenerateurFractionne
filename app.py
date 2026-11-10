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

        # Utilisation de l'appel direct validé pour l'API Garmin Workouts
  client.garth.post("connect", "/workout-service/workout", json=workout_payload)
        
        return jsonify({"success": True, "message": "Entraînement envoyé avec succès sur Garmin Connect !" })

    except Exception as e:
        # Capture globale propre pour éviter le plantage et afficher l'erreur exacte
        err_msg = str(e)
        if "MFA" in err_msg or "mfa" in err_msg:
            return jsonify({"success": False, "mfa_required": True, "error": "Code MFA requis par Garmin."}), 401
        return jsonify({"success": False, "error": err_msg}), 400

if __name__ == "__main__":
    app.run(debug=True)
