import os
import logging
from pathlib import Path
import httpx
from typing import List, Dict
from config import DEFAULT_MODE, MISTRAL_URL, API_MODEL

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
        return get_local_chat_completion(model_name, messages, max_tokens, api_url)

def get_local_chat_completion(
    model_name: str,
    messages: list,
    max_tokens: int = 6000,
    api_url: str = MISTRAL_URL
) -> dict:
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": model_name,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(api_url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json()
        raise Exception(f"Request failed with status code {response.status_code}: {response.text}")

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