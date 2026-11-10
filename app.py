import os
from flask import Flask, request, jsonify, render_template
from garminconnect import Garmin

app = Flask(__name__)

# Tes identifiants Garmin stockés en variables d'environnement sur Render
EMAIL = os.environ.get("GARMIN_EMAIL")
PASSWORD = os.environ.get("GARMIN_PASSWORD")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/send-to-garmin", methods=["POST"])
def send_to_garmin():
    data = request.json
    
    # Récupération des identifiants (via la requête ou les variables d'environnement Render)
    email = data.get("email") or os.environ.get("GARMIN_EMAIL")
    password = data.get("password") or os.environ.get("GARMIN_PASSWORD")
    
    workout_name = data.get("name")
    steps = data.get("steps")
    mfa_code = data.get("mfa_code")

    if not email or not password:
        return jsonify({"success": False, "error": "Identifiants Garmin manquants."}), 400

    try:
        # Connexion au client Garmin
        client = Garmin(email, password)
        if mfa_code:
            client.login(mfa_code)
        else:
            client.login()

        # Construction du payload adapté à l'API d'entraînement Garmin
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

        # Envoi de l'entraînement via l'endpoint officiel Garmin
        client.connectapi("workout-service/workout", json=workout_payload)
        return jsonify({"success": True, "message": "Entraînement envoyé avec succès !" })

    except garth.exceptions.MFAError:
        return jsonify({"success": False, "mfa_required": True, "error": "Code MFA requis."}), 401
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

def convert_steps_to_garmin(steps):
    # Traduction des étapes de ton générateur vers le format attendu par l'API Garmin
    garmin_steps = []
    for index, step in enumerate(steps):
        # Mappage des types (warmup, interval, recovery, cooldown)
        # ... logique de conversion des durées/distances et des allures ...
        pass
    return garmin_steps

if __name__ == "__main__":
    app.run(debug=True)
