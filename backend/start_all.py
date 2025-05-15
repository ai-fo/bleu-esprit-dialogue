"""
Script pour démarrer à la fois le serveur PDF et l'API principale.
Ce script lance les deux serveurs dans des threads séparés.
"""

import subprocess
import threading
import time
import os
import signal
import sys
from pathlib import Path

def run_pdf_server():
    """Lance le serveur PDF sur le port 8077"""
    print("🚀 Démarrage du serveur PDF sur le port 8077...")
    
    # Utiliser subprocess pour capturer la sortie
    process = subprocess.Popen(
        ["python", "pdf_server.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Lire et afficher la sortie en temps réel
    for line in iter(process.stdout.readline, ''):
        print(f"[PDF Server] {line.strip()}")
    
    process.stdout.close()
    process.wait()
    return process

def run_main_api():
    """Lance l'API principale sur le port 8091"""
    print("🚀 Démarrage de l'API principale sur le port 8091...")
    
    # Attendre que le serveur PDF soit prêt
    time.sleep(2)
    
    # Utiliser subprocess pour capturer la sortie
    process = subprocess.Popen(
        ["python", "app.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Lire et afficher la sortie en temps réel
    for line in iter(process.stdout.readline, ''):
        print(f"[Main API] {line.strip()}")
    
    process.stdout.close()
    process.wait()
    return process

if __name__ == "__main__":
    print("=" * 70)
    print("Démarrage des serveurs backend pour Oskour")
    print("=" * 70)
    
    # S'assurer que nous sommes dans le bon répertoire
    script_dir = Path(__file__).parent.absolute()
    os.chdir(script_dir)
    
    # Lancer les deux serveurs dans des threads séparés
    pdf_thread = threading.Thread(target=run_pdf_server)
    api_thread = threading.Thread(target=run_main_api)
    
    pdf_thread.daemon = True
    api_thread.daemon = True
    
    pdf_thread.start()
    api_thread.start()
    
    # Gérer l'arrêt proprement
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Arrêt des serveurs demandé...")
        print("Appuyez à nouveau sur Ctrl+C pour forcer l'arrêt.")
        sys.exit(0) 