from flask import Flask, render_template_string, send_from_directory, url_for
import os
from pathlib import Path
from config import PDF_FOLDER, BASE_DIR, PDF_ADMINS_FOLDER

app = Flask(__name__)

@app.route('/')
def index():
    """Affiche une liste de tous les PDFs disponibles (utilisateurs et admins) avec des liens pour les ouvrir."""
    pdfs = []
    for filename in os.listdir(PDF_FOLDER):
        if filename.endswith('.pdf'):
            pdf_url = url_for('serve_pdf', filename=filename)
            pdfs.append({'name': filename, 'url': pdf_url})
    pdfs_admin = []
    for filename in os.listdir(PDF_ADMINS_FOLDER):
        if filename.endswith('.pdf'):
            pdf_url = url_for('serve_pdf_admin', filename=filename)
            pdfs_admin.append({'name': filename, 'url': pdf_url})
    # Template HTML simple pour afficher les deux listes
    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Serveur de PDF</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            ul { list-style-type: none; padding: 0; }
            li { margin-bottom: 10px; }
            a { color: #0066cc; text-decoration: none; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <h1>Liste des PDFs disponibles</h1>
        <h2>PDF Utilisateurs</h2>
        {% if pdfs %}
            <ul>
            {% for pdf in pdfs %}
                <li><a href="{{ pdf.url }}" target="_blank">{{ pdf.name }}</a></li>
            {% endfor %}
            </ul>
        {% else %}
            <p>Aucun PDF utilisateur trouvé dans le dossier.</p>
        {% endif %}
        <h2>PDF Admins</h2>
        {% if pdfs_admin %}
            <ul>
            {% for pdf in pdfs_admin %}
                <li><a href="{{ pdf.url }}" target="_blank">{{ pdf.name }}</a></li>
            {% endfor %}
            </ul>
        {% else %}
            <p>Aucun PDF admin trouvé dans le dossier.</p>
        {% endif %}
    </body>
    </html>
    '''
    return render_template_string(html, pdfs=pdfs, pdfs_admin=pdfs_admin)

@app.route('/pdf/<filename>')
def serve_pdf(filename):
    """Sert un fichier PDF spécifique depuis le dossier des PDFs utilisateurs."""
    return send_from_directory(PDF_FOLDER, filename)

@app.route('/pdf_admin/<filename>')
def serve_pdf_admin(filename):
    """Sert un fichier PDF spécifique depuis le dossier des PDFs admins."""
    return send_from_directory(PDF_ADMINS_FOLDER, filename)

if __name__ == '__main__':
    # Assurons-nous que le dossier PDF existe
    if not PDF_FOLDER.exists():
        print(f"Le dossier {PDF_FOLDER} n'existe pas.")
        exit(1)
    
    # Informations sur le serveur
    host = '0.0.0.0'  # Accessible depuis n'importe quelle adresse IP
    port = 8077       # Port standard pour Flask
    
    print(f"Démarrage du serveur sur http://localhost:{port}")
    print(f"Servir les PDFs depuis: {PDF_FOLDER}")
    app.run(host=host, port=port, debug=True) 