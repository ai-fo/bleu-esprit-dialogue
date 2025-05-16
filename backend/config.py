"""Configuration pour le système RAG."""
from pathlib import Path
import os
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

#==============================================
# CONFIGURATION DES MODES ET MODÈLES
#==============================================

# Mode d'appel au modèle principal
DEFAULT_MODE = "local"  # Choisir entre "api" (API Mistral) ou "local" (serveur local)

# Configuration API Mistral
# Pour activer le mode API:
# 1. Changer DEFAULT_MODE = "api" 
# 2. Définir la variable d'environnement MISTRAL_API_KEY
# ex: export MISTRAL_API_KEY="votre_clé_api"
API_MODEL = "mistral-small-latest"  # Modèle par défaut pour l'API Mistral

#----------------------------------------------
# CONFIGURATION DES MODÈLES DISPONIBLES
#----------------------------------------------

# Modèles locaux disponibles - format: {"nom_affiché": ("chemin/au/modèle", "port")}
MODELS = {
    "mistral-large": ("Mistral-Large-Instruct-2407-AWQ", "5263"),
    "ministral-8b": ("/home/llama/models/base_models/Ministral-8B-Instruct-2410", "8787"),
    # Ajoutez vos autres modèles ici
}

#----------------------------------------------
# ATTRIBUTION DES MODÈLES AUX TÂCHES
#----------------------------------------------

# 1. Modèle principal pour la génération de réponses
MAIN_MODEL = "mistral-large"

# 2. Modèle pour les vérifications (pertinence des documents)
USE_SEPARATE_VERIFICATION_MODEL = True  # Utiliser un modèle distinct pour les vérifications
VERIFICATION_MODEL = "ministral-8b"  # Modèle à utiliser pour les vérifications

# 3. Modèle pour le découpage des messages
USE_SEPARATE_SPLITTING_MODEL = True  # Utiliser un modèle distinct pour le découpage
SPLITTING_MODEL = "ministral-8b"  # Modèle à utiliser pour le découpage

#----------------------------------------------
# CONSTRUCTION DES CHEMINS ET URLs
#----------------------------------------------

def get_model_info(model_key):
    """Récupère les informations du modèle à partir de sa clé."""
    if model_key not in MODELS:
        raise ValueError(f"Modèle '{model_key}' non trouvé dans la configuration.")
    model_path, port = MODELS[model_key]
    model_url = f"http://localhost:{port}/v1/chat/completions"
    return model_path, model_url

# Construction des configurations des modèles
MISTRAL_PATH, MISTRAL_URL = get_model_info(MAIN_MODEL)

# Configuration du modèle de vérification
if USE_SEPARATE_VERIFICATION_MODEL:
    VERIFICATION_MODEL_PATH, VERIFICATION_MODEL_URL = get_model_info(VERIFICATION_MODEL)
else:
    VERIFICATION_MODEL_PATH, VERIFICATION_MODEL_URL = MISTRAL_PATH, MISTRAL_URL

# Configuration du modèle de découpage
if USE_SEPARATE_SPLITTING_MODEL:
    SPLITTING_MODEL_PATH, SPLITTING_MODEL_URL = get_model_info(SPLITTING_MODEL)
else:
    SPLITTING_MODEL_PATH, SPLITTING_MODEL_URL = MISTRAL_PATH, MISTRAL_URL

#==============================================
# CONFIGURATION DES DOSSIERS ET CHEMINS
#==============================================

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

#==============================================
# AUTRES CONFIGURATIONS
#==============================================

# Configuration Pixtral (pour analyse d'images)
PIXTRAL_PATH = "/home/llama/models/base_models/Pixtral-12B-2409"  # Modèle Pixtral
PIXTRAL_URL = "http://localhost:8085/v1/chat/completions"  # Port pour Pixtral