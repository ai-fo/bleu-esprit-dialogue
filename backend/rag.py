import os
import logging
from pathlib import Path
import httpx
import re
from typing import List, Dict, Tuple
from config import DEFAULT_MODE, MISTRAL_URL, API_MODEL, VERIFICATION_MODEL_PATH, VERIFICATION_MODEL_URL, USE_SEPARATE_VERIFICATION_MODEL

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

# Fonction pour décomposer un message long en plusieurs messages en utilisant le LLM
def split_long_message(message: str, min_chunks: int = 2, max_chunks: int = 5) -> List[str]:
    """
    Utilise un LLM pour décomposer un message long en plusieurs messages, avec une limite stricte de 2 à 5 messages.
    
    Args:
        message: Le message à décomposer
        min_chunks: Nombre minimum de messages à générer (par défaut: 2)
        max_chunks: Nombre maximum de messages à générer (par défaut: 5)
    
    Returns:
        Liste de messages décomposés
    """
    # Si le message est court (<400 caractères), le retourner tel quel
    if len(message) < 400:
        logger.info(f"Message trop court pour être découpé ({len(message)} caractères)")
        return [message]
    
    # Afficher les 100 premiers caractères du message à découper
    logger.info(f"Message à découper (début): {message[:100]}...")
    logger.info(f"Longueur totale du message: {len(message)} caractères")
    
    # Déterminer le nombre recommandé de parties en fonction de la longueur
    msg_length = len(message)
    # Définir des seuils adaptés pour respecter la limite de 2-5 messages
    if msg_length < 1200:
        recommended_chunks = 2  # Pour les messages courts: 2 parties
    elif msg_length < 2000:
        recommended_chunks = 3  # Pour les messages moyens: 3 parties
    elif msg_length < 3000:
        recommended_chunks = 4  # Pour les messages longs: 4 parties
    else:
        recommended_chunks = 5  # Pour les très longs messages: max 5 parties
    
    # S'assurer de respecter les limites
    recommended_chunks = max(min_chunks, min(recommended_chunks, max_chunks))
    logger.info(f"Nombre recommandé de parties: {recommended_chunks}")
    
    # Préparer le prompt pour le LLM avec des instructions très strictes
    system_prompt = """Tu es un expert en découpage de texte. Ta mission est de diviser un texte en exactement X parties.

INSTRUCTIONS:
1. Divise le texte en EXACTEMENT le nombre de parties demandé
2. Utilise exactement trois tirets ("---") comme séparateur entre les parties
3. Chaque partie doit faire une taille similaire

TRÈS IMPORTANT:
- N'ajoute PAS de numéros, de titres ou de texte supplémentaire
- Réponds UNIQUEMENT avec les parties du texte séparées par ---
- Ne numérote PAS les parties (pas de "Partie 1:", etc.)

EXEMPLE pour diviser en 2 parties:
Première partie du texte...
---
Deuxième partie du texte...

ATTENTION: Tu dois produire EXACTEMENT le nombre de séparateurs "---" demandé (soit X-1 séparateurs pour X parties)."""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Découpe ce texte en EXACTEMENT {recommended_chunks} parties égales, séparées par ---:\n\n{message}"}
    ]
    
    # Appeler le LLM pour découper le message
    try:
        # Utiliser le modèle de vérification plus léger pour le découpage si configuré
        if USE_SEPARATE_VERIFICATION_MODEL:
            model = VERIFICATION_MODEL_PATH
            api_url = VERIFICATION_MODEL_URL
            logger.info(f"Utilisation du modèle léger {model} pour le découpage de message")
        else:
            # Sinon, utiliser le modèle par défaut pour le mode actuel (API ou local)
            model = API_MODEL if DEFAULT_MODE == "api" else MISTRAL_URL
            api_url = None
        
        response = get_chat_completion(model, messages, max_tokens=6000, api_url=api_url)
        content = response['choices'][0]['message']['content']
        
        # Afficher la réponse brute pour débogage
        logger.info(f"Réponse brute du LLM pour le découpage: {content[:500]}...")
        
        # Essayer différentes variantes du séparateur pour plus de robustesse
        if '---' in content:
            parts = content.split('---')
            logger.info("Séparateur standard '---' trouvé dans la réponse")
        elif '\n\n' in content:
            # Essayer de diviser par paragraphes si pas de séparateur explicite
            parts = content.split('\n\n')
            logger.info("Pas de séparateur '---', utilisation des paragraphes vides '\\n\\n'")
        elif '***' in content:
            # Certains modèles pourraient utiliser des astérisques au lieu de tirets
            parts = content.split('***')
            logger.info("Utilisation du séparateur alternatif '***'")
        elif re.search(r'partie\s+\d+', content.lower()):
            # Rechercher des motifs comme "Partie 1", "partie 2", etc.
            parts = re.split(r'(?i)partie\s+\d+[\s:]*', content)
            # Supprimer la première partie vide s'il y en a une
            if parts and not parts[0].strip():
                parts = parts[1:]
            logger.info("Utilisation des indicateurs 'Partie X' comme séparateurs")
        else:
            # Fallback: simplement diviser en paragraphes
            parts = [content]
            logger.info("Aucun séparateur reconnu, considérant toute la réponse comme une seule partie")
        
        # Nettoyer les parties
        cleaned_parts = [part.strip() for part in parts if part.strip()]
        logger.info(f"Nombre de parties identifiées après découpage: {len(cleaned_parts)}")
        
        # Afficher le début de chaque partie pour débogage
        for i, part in enumerate(cleaned_parts):
            logger.info(f"Partie {i+1} (début): {part[:50]}...")
            
        # Si nous avons trop peu ou trop de parties, essayer une dernière approche basée sur les retours à la ligne
        if (len(cleaned_parts) < min_chunks or len(cleaned_parts) > max_chunks) and len(content) > 0:
            logger.info(f"Découpage inapproprié ({len(cleaned_parts)} parties), analyse basée sur les retours à la ligne")
            
            # Diviser le contenu en paragraphes
            paragraphs = [p.strip() for p in re.split(r'\n\s*\n', content) if p.strip()]
            
            if len(paragraphs) >= min_chunks:
                # Diviser les paragraphes en nombre de parties approprié
                target_part_count = min(max(min_chunks, len(paragraphs) // 2), max_chunks)
                logger.info(f"Tentative de regroupement en {target_part_count} parties à partir de {len(paragraphs)} paragraphes")
                
                paragraphs_per_part = len(paragraphs) // target_part_count
                remainder = len(paragraphs) % target_part_count
                
                new_parts = []
                start_idx = 0
                
                for i in range(target_part_count):
                    count = paragraphs_per_part + (1 if i < remainder else 0)
                    end_idx = start_idx + count
                    joined_paragraphs = "\n\n".join(paragraphs[start_idx:end_idx])
                    new_parts.append(joined_paragraphs)
                    start_idx = end_idx
                
                if new_parts:
                    cleaned_parts = new_parts
                    logger.info(f"Nouvelle division réussie en {len(cleaned_parts)} parties")
                    for i, part in enumerate(cleaned_parts):
                        logger.info(f"Nouvelle partie {i+1} (début): {part[:50]}...")
        
        # Vérifier si le LLM a respecté le nombre exact de parties
        if len(cleaned_parts) == recommended_chunks:
            logger.info(f"LLM a correctement divisé le message en {recommended_chunks} parties")
            return cleaned_parts
        
        # Si le nombre n'est pas exact mais dans les limites, accepter quand même
        if min_chunks <= len(cleaned_parts) <= max_chunks:
            logger.info(f"LLM a fourni {len(cleaned_parts)} parties au lieu de {recommended_chunks}, mais c'est dans les limites acceptables")
            return cleaned_parts
            
        # Si trop ou pas assez de parties, mais au moins une partie valide
        if cleaned_parts:
            logger.warning(f"LLM a fourni {len(cleaned_parts)} parties au lieu de {recommended_chunks}. Tentative d'ajustement...")
            
            # Si trop de parties, les regrouper
            if len(cleaned_parts) > max_chunks:
                logger.info(f"Regroupement de {len(cleaned_parts)} parties en {max_chunks} parties")
                merged_parts = []
                parts_per_group = len(cleaned_parts) // max_chunks
                remainder = len(cleaned_parts) % max_chunks
                
                start_idx = 0
                for i in range(max_chunks):
                    # Distribuer le reste uniformément
                    count = parts_per_group + (1 if i < remainder else 0)
                    end_idx = start_idx + count
                    merged_part = "\n\n".join(cleaned_parts[start_idx:end_idx])
                    merged_parts.append(merged_part)
                    start_idx = end_idx
                
                return merged_parts
            
            # Si pas assez de parties, diviser les plus longues
            if len(cleaned_parts) < min_chunks:
                logger.info(f"Pas assez de parties ({len(cleaned_parts)}), utilisation de la méthode de secours")
    except Exception as e:
        logger.error(f"Erreur lors de l'appel au LLM pour découper le message: {e}")
    
    # Méthode de secours: découpage simple en parties égales
    logger.info(f"Utilisation de la méthode de secours pour diviser en {recommended_chunks} parties")
    
    # Diviser simplement en parties approximativement égales
    parts = []
    chars_per_part = len(message) // recommended_chunks
    
    for i in range(recommended_chunks):
        start = i * chars_per_part
        # Pour la dernière partie, prendre tout ce qui reste
        end = None if i == recommended_chunks - 1 else (i + 1) * chars_per_part
        
        # Si ce n'est pas la dernière partie, essayer de trouver une fin de phrase
        part = message[start:end]
        if i < recommended_chunks - 1 and end is not None:
            # Chercher la dernière fin de phrase dans la partie
            last_period = part.rfind('. ')
            if last_period > len(part) * 0.5:  # S'il y a un point dans la seconde moitié
                part = part[:last_period + 1]  # Inclure le point
                # Ajuster le message pour la prochaine partie
                message = message[:start] + message[start + last_period + 1:]
        
        parts.append(part.strip())
    
    # Filtrer les parties vides
    return [p for p in parts if p]

# Synchronous chat completion via httpx
def get_chat_completion(
    model_name: str,
    messages: list,
    max_tokens: int = 6000,
    api_url: str = None
) -> dict:
    # Si une URL spécifique est fournie, l'utiliser directement en mode local
    if api_url:
        logger.info(f"Utilisation de l'URL spécifique: {api_url}")
        return get_local_chat_completion(model_name, messages, max_tokens, api_url)
    
    # Sinon, utiliser le mode configuré (API ou local)
    if DEFAULT_MODE == "api":
        return get_api_chat_completion(model_name, messages, max_tokens)
    else:
        try:
            # Essayer d'abord le mode local
            logger.info("Tentative d'utilisation du mode local pour l'inférence LLM")
            return get_local_chat_completion(model_name, messages, max_tokens, MISTRAL_URL)
        except Exception as e:
            if os.environ.get("MISTRAL_API_KEY"):
                # Si l'API key est configurée, essayer de basculer vers le mode API en cas d'erreur locale
                logger.warning(f"Échec du mode local ({str(e)}), basculement vers le mode API")
                try:
                    return get_api_chat_completion(model_name, messages, max_tokens)
                except Exception as api_error:
                    logger.error(f"Échec également en mode API: {str(api_error)}")
                    raise Exception(f"Les deux modes de complétion ont échoué. Local: {str(e)}. API: {str(api_error)}")
            else:
                # Si pas d'API key, propager simplement l'erreur
                raise

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

    try:
        # Augmenter le délai d'attente pour donner plus de temps au serveur
        with httpx.Client(timeout=120.0) as client:
            logger.info(f"Tentative de connexion au serveur LLM local à l'adresse: {api_url}")
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