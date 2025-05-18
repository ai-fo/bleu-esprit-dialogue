import os
import logging
from pathlib import Path
import httpx
import re
from typing import List, Dict, Tuple
from config import DEFAULT_MODE, MISTRAL_URL, API_MODEL, MISTRAL_PATH, MINISTRAL_URL, MINISTRAL_PATH

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialisation conditionnelle du reranker
if DEFAULT_MODE == "local":
    try:
        # Utiliser FlagReranker en mode local
        from FlagEmbedding import FlagReranker
        reranker = FlagReranker(
            '/home/llama/models/base_models/bge-reranker-v2-m3',
            use_fp16=True
        )
        logger.info("FlagReranker initialisé pour le mode local")
    except ImportError:
        logger.error("FlagEmbedding n'est pas installé. Installez-le avec: pip install FlagEmbedding")
        raise
else:
    try:
        # Utiliser FlagReranker pour le mode API également pour assurer la cohérence
        from FlagEmbedding import FlagReranker
        reranker = FlagReranker(
            'BAAI/bge-reranker-v2-m3',  # Utiliser le modèle de HuggingFace directement
            use_fp16=True
        )
        logger.info("FlagReranker initialisé pour le mode API")
    except ImportError:
        logger.error("FlagEmbedding n'est pas installé. Installez-le avec: pip install FlagEmbedding")
        raise

# Cache for loaded knowledge bases: {kb_path: {'file_texts': {...}, 'chunks': [(filename, chunk_text), ...]}}
KB_CACHE: Dict[str, Dict] = {}

# Fonction simplifiée pour découper un message selon des séparateurs standards
def split_long_message(message: str, min_chunks: int = 2, max_chunks: int = 5) -> List[str]:
    """
    Découpe un message en plusieurs parties en se basant sur des séparateurs standards.
    Si le message contient des séparateurs explicites (%%PARTIE%%), les utilise.
    Sinon, découpe de manière algorithmique tout en préservant le formatage markdown.
    
    Args:
        message: Le message à décomposer
        min_chunks: Nombre minimum de messages à générer (par défaut: 2)
        max_chunks: Nombre maximum de messages à générer (par défaut: 5)
    
    Returns:
        Liste de messages décomposés
    """
    # Si le message est court (<400 caractères), le retourner tel quel
    if len(message) < 400:
        return [message]
    
    # Vérifier si le message contient des séparateurs de partie standard
    standard_separator = "%%PARTIE%%"
    if standard_separator in message:
        logger.info("Message contient des séparateurs standards, découpage selon ces séparateurs")
        parts = message.split(standard_separator)
        # Nettoyer les parties vides ou uniquement avec des espaces
        cleaned_parts = [part.strip() for part in parts if part.strip()]
        
        # Vérifier si le nombre de parties est dans les limites
        if min_chunks <= len(cleaned_parts) <= max_chunks:
            logger.info(f"Découpage standard en {len(cleaned_parts)} parties")
            return cleaned_parts
        
        # Si trop de parties, les regrouper
        if len(cleaned_parts) > max_chunks:
            logger.info(f"Trop de parties ({len(cleaned_parts)}), regroupement en {max_chunks} parties")
            merged_parts = []
            parts_per_group = len(cleaned_parts) // max_chunks
            remainder = len(cleaned_parts) % max_chunks
            
            start_idx = 0
            for i in range(max_chunks):
                count = parts_per_group + (1 if i < remainder else 0)
                end_idx = start_idx + count
                merged_part = "\n\n".join(cleaned_parts[start_idx:end_idx])
                merged_parts.append(merged_part)
                start_idx = end_idx
            
            return merged_parts
        
        # Si pas assez de parties mais au moins une, la retourner
        if cleaned_parts:
            logger.info(f"Pas assez de parties ({len(cleaned_parts)}), mais au moins une partie valide")
            return cleaned_parts
    
    # Si pas de séparateurs standard ou problème avec les parties, utiliser l'approche algorithmique
    logger.info("Pas de séparateurs standards détectés, utilisation du découpage algorithmique")
    
    # Déterminer le nombre recommandé de parties en fonction de la longueur
    msg_length = len(message)
    if msg_length < 1200:
        recommended_chunks = 2
    elif msg_length < 2000:
        recommended_chunks = 3
    elif msg_length < 3000:
        recommended_chunks = 4
    else:
        recommended_chunks = 5
    
    # S'assurer de respecter les limites
    recommended_chunks = max(min_chunks, min(recommended_chunks, max_chunks))
    
    # Prétraitement pour identifier les balises de formatage markdown
    # On protège le texte en gras pour ne pas le couper
    bold_pattern = r'\*\*([^*]+)\*\*'
    bold_sections = re.findall(bold_pattern, message)
    
    # Remplacer temporairement les sections en gras par des marqueurs uniques
    placeholder_map = {}
    for i, section in enumerate(bold_sections):
        placeholder = f"__BOLD_SECTION_{i}__"
        placeholder_map[placeholder] = f"**{section}**"
        message = message.replace(f"**{section}**", placeholder, 1)
    
    # Découpage algorithmique par phrases
    sentences = re.split(r'(?<=[.!?])\s+', message)
    
    # Si très peu de phrases, retourner le message entier
    if len(sentences) <= recommended_chunks:
        logger.info(f"Trop peu de phrases ({len(sentences)}) pour découper en {recommended_chunks} parties")
        # Restaurer les sections en gras avant de retourner
        for placeholder, original in placeholder_map.items():
            message = message.replace(placeholder, original)
        return [message]
    
    # Répartir les phrases dans les parties
    parts = []
    sentences_per_part = len(sentences) // recommended_chunks
    remainder = len(sentences) % recommended_chunks
    
    start_idx = 0
    for i in range(recommended_chunks):
        # Distribuer le reste uniformément
        count = sentences_per_part + (1 if i < remainder else 0)
        end_idx = start_idx + count
        
        # Combiner les phrases pour cette partie
        part = " ".join(sentences[start_idx:end_idx])
        parts.append(part)
        start_idx = end_idx
    
    # Restaurer les sections en gras dans chaque partie
    final_parts = []
    for part in parts:
        for placeholder, original in placeholder_map.items():
            part = part.replace(placeholder, original)
        final_parts.append(part)
    
    # Vérifier que toutes les parties sont non vides
    return [p for p in final_parts if p]

# Synchronous chat completion via httpx
def get_chat_completion(
    model_name: str,
    messages: list,
    max_tokens: int = 6000,
    api_url: str = MISTRAL_URL
) -> dict:
    # Check if we use API or local mode
    if DEFAULT_MODE == "api":
        return get_api_chat_completion(model_name, messages, max_tokens)
    else:
        try:
            # Mode local exclusif
            logger.info("Utilisation du mode local pour l'inférence LLM")
            return get_local_chat_completion(model_name, messages, max_tokens, api_url)
        except Exception as e:
            # En mode local, ne pas basculer vers l'API en cas d'erreur
            logger.error(f"Échec du mode local: {str(e)}")
            raise Exception(f"Erreur en mode local: {str(e)}")

def get_local_chat_completion(
    model_name: str,
    messages: list,
    max_tokens: int = 6000,
    api_url: str = MISTRAL_URL
) -> dict:
    headers = {"Content-Type": "application/json"}
    # Toujours utiliser le modèle configuré dans config.py, peu importe ce qui est passé
    payload = {
        "model": MISTRAL_PATH,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0
    }
    
    logger.info(f"Appel au modèle local: {MISTRAL_PATH} (paramètre original: {model_name})")

    try:
        # Augmenter le délai d'attente pour donner plus de temps au serveur
        with httpx.Client(timeout=120.0) as client:
            logger.info(f"Tentative de connexion au serveur LLM local à l'adresse: {api_url}")
            logger.info(f"Payload envoyé: {payload}")
            response = client.post(api_url, json=payload, headers=headers)
            if response.status_code == 200:
                return response.json()
            logger.error(f"Échec de la requête au serveur LLM avec le code: {response.status_code}")
            logger.error(f"Réponse du serveur: {response.text}")
            raise Exception(f"Request failed with status code {response.status_code}: {response.text}")
    except httpx.ConnectError as e:
        logger.error(f"Erreur de connexion au serveur LLM: {e}")
        logger.error(f"Vérifiez que le serveur LLM est en cours d'exécution à l'adresse {api_url}")
        logger.error(f"Commande pour vérifier: curl -X GET {api_url}")
        raise Exception(f"Impossible de se connecter au serveur LLM à l'adresse {api_url}. Vérifiez que le serveur est en cours d'exécution et que l'URL est correcte dans config.py.")
    except Exception as e:
        logger.error(f"Erreur lors de l'appel du serveur LLM: {str(e)}")
        raise Exception(f"Request failed: {str(e)}")

def get_api_chat_completion(
    model_name: str,
    messages: list,
    max_tokens: int = 6000
) -> dict:
    # Utiliser l'API Mistral
    try:
        import os
        from mistralai import Mistral
        
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY environment variable is not set")
            
        # Utiliser le modèle défini dans config.py par défaut pour l'API
        api_model = API_MODEL
        
        client = Mistral(api_key=api_key)
        
        response = client.chat.complete(
            model=api_model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0
        )
        
        # Formater la réponse pour qu'elle corresponde au format attendu par le reste du code
        return {
            "choices": [
                {
                    "message": {
                        "content": response.choices[0].message.content
                    }
                }
            ]
        }
    except ImportError:
        raise ImportError("Pour utiliser le mode API, installez la bibliothèque 'mistralai' avec: pip install mistralai")
    except Exception as e:
        raise Exception(f"Erreur lors de l'appel à l'API Mistral: {str(e)}")

# Load and chunk all transcripts from a directory
def load_knowledge_base(kb_path: str) -> dict:
    file_texts: dict[str, str] = {}
    chunks: list[tuple[str, str]] = []
    for fn in os.listdir(kb_path):
        if fn.endswith('.txt'):
            full_path = Path(kb_path) / fn
            try:
                text = full_path.read_text(encoding='utf-8')
            except OSError as e:
                logger.error(f"Could not read {full_path}: {e}")
                continue
            file_texts[fn] = text
            # Split into 2000-char chunks
            for i in range(0, len(text), 2000):
                chunks.append((fn, text[i:i+2000]))
    logger.info(f"Loaded {len(file_texts)} files and {len(chunks)} chunks from {kb_path}")
    return {'file_texts': file_texts, 'chunks': chunks}

# Retrieve context using reranker - même approche pour les deux modes
def rag(question: str, kv_path: str, k: int = 1):
    if kv_path not in KB_CACHE:
        KB_CACHE[kv_path] = load_knowledge_base(kv_path)
    data = KB_CACHE[kv_path]
    chunks = data['chunks']
    
    # Utiliser la même approche pour les deux modes
    batch = [[question, chunk_text] for _, chunk_text in chunks]
    scores = reranker.compute_score(batch)
    
    # Select top-k
    scored = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:k]

    contexts: list[str] = []
    files_used: list[str] = []
    for idx, _ in scored:
        filename = chunks[idx][0]
        contexts.append(data['file_texts'][filename])
        files_used.append(filename)

    combined_context = "\n\n".join(contexts)
    return combined_context, files_used

def initialize_reranker():
    """Warm up the reranker model"""
    logger.info("Warming up reranker with dummy call...")
    try:
        # FlagReranker warm-up pour les deux modes
        reranker.compute_score([['', '']])
        logger.info("Reranker warmed up successfully.")
    except Exception as e:
        logger.error(f"Reranker warm-up failed: {e}")

def check_api_key():
    """Check if API key is set when in API mode"""
    if DEFAULT_MODE == "api":
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            logger.warning("ATTENTION: Mode API activé mais MISTRAL_API_KEY n'est pas défini dans les variables d'environnement!")
            return False
        return True
    return None