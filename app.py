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
    
    # Récupération sécurisée depuis le JSON envoyé par le front (ou les variables d'environnement)
    email = data.get("email") or os.environ.get("GARMIN_EMAIL")
    password = data.get("password") or os.environ.get("GARMIN_PASSWORD")
    
    workout_name = data.get("name")
    steps = data.get("steps")
    mfa_code = data.get("mfa_code")

    if not email or not password:
        return jsonify({"success": False, "error": "Identifiants Garmin manquants."}), 400

    try:
        # Suite de ton code de connexion...
        # Connexion à Garmin Connect
        # Astuce : Pour éviter les blocages de captcha/MFA répétés, garth/garminconnect 
        # permet de sauvegarder les tokens de session.
        client = Garmin(EMAIL, PASSWORD)
        client.login()

        # Formatage et envoi de l'entraînement via l'API Garmin Connect
        # (L'API interne de Garmin utilise un format JSON spécifique pour les workouts)
        workout_payload = {
            "workoutName": workout_name,
            "sportType": {"sportTypeId": 1, "sportKey": "running"},
            "workoutSegments": [
                {
                    "segmentOrder": 1,
                    "sportType": {"sportTypeId": 1, "sportKey": "running"},
                    "workoutSteps": convert_steps_to_garmin(steps)
                }
            ]
        }

        # Appel de l'API Garmin Connect pour créer l'entraînement
        client.connectapi("workout-service/workout", method="POST", json=workout_payload)

        return jsonify({"success": True, "message": "Entraînement envoyé avec succès sur Garmin Connect !" })

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
