from flask import Flask, send_from_directory
from config import PDF_FOLDER
import os

app = Flask(__name__)

@app.route('/pdf/<filename>')
def serve_pdf(filename):
    """Sert un fichier PDF depuis le dossier PDF."""
    return send_from_directory(PDF_FOLDER, filename)

if __name__ == '__main__':
    # S'assurer que le dossier PDF existe
    os.makedirs(PDF_FOLDER, exist_ok=True)
    print(f"Serveur PDF démarré sur http://localhost:8098")
    print(f"Les PDFs seront servis depuis : {PDF_FOLDER}")
    # Lancer le serveur sur le port 8098
    app.run(host='0.0.0.0', port=8098, debug=True) 