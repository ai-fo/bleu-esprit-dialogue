"""Configuration pour le système RAG."""
from pathlib import Path
import os
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# Configuration du mode d'appel au modèle
DEFAULT_MODE = "api"  # Choisir entre "api" (API Mistral) ou "local" (serveur local)

# Configuration API Mistral
# Pour activer le mode API:
# 1. Changer DEFAULT_MODE = "api" 
# 2. Définir la variable d'environnement MISTRAL_API_KEY
# ex: export MISTRAL_API_KEY="votre_clé_api"
API_MODEL = "mistral-small-latest"  # Modèle par défaut pour l'API Mistral

# Chemins des dossiers
BASE_DIR = Path(__file__).parent
PDF_FOLDER = BASE_DIR / "pdfs"  # Dossier par défaut pour les PDFs
PDF_DIR = "pdfs"  # Dossier contenant les PDFs
PDF_PATTERN = "*.pdf"  # Pattern pour trouver les PDFs
CACHE_DIR = BASE_DIR / "cache"  # Dossier pour stocker les caches
DOC_CACHE_FILE = CACHE_DIR / "doc_cache.json"  # Cache des documents prétraités
IMAGE_CACHE_FILE = CACHE_DIR / "image_cache.json"  # Cache des analyses Pixtral
TEMP_DIR = BASE_DIR / "temp_images"
TRANSCRIPTS_DIR = BASE_DIR / "transcripts"  # Dossier pour les transcriptions complètes
TRANSCRIPTS_TEXT_ONLY_DIR = BASE_DIR / "transcripts_text_only"  # Dossier pour les transcriptions sans images
PROMPTS_DIR = BASE_DIR / "prompts"  # Dossier pour stocker les prompts

# Créer les dossiers s'ils n'existent pas
PDF_FOLDER.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)
TRANSCRIPTS_DIR.mkdir(exist_ok=True)  # Création du dossier des transcriptions
TRANSCRIPTS_TEXT_ONLY_DIR.mkdir(exist_ok=True)  # Création du dossier des transcriptions sans images
PROMPTS_DIR.mkdir(exist_ok=True)  # Création du dossier des prompts


PIXTRAL_URL = "http://localhost:8085/v1/chat/completions"  # Port pour Pixtral
MISTRAL_URL = "http://localhost:5263/v1/chat/completions"  # Port pour Mistral
PIXTRAL_PATH = "/home/llama/models/base_models/Pixtral-12B-2409"  # Modèle Pixtral
MISTRAL_PATH = "Mistral-Large-Instruct-2407-AWQ"  # Modèle Mistral