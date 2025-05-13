import os
from pathlib import Path
from typing import Dict, List
from mistralai import Mistral
from dotenv import load_dotenv
import requests
import json
from config import PROMPTS_DIR, MISTRAL_URL, MISTRAL_PATH
from rag_transcripts import TranscriptRAG
from evaluateur_reponse import evaluer_possibilite_reponse

# Chargement des variables d'environnement
load_dotenv()

# Configuration du chemin pour le prompt
CONCISE_PROMPT_PATH = PROMPTS_DIR / "concis.txt"

# Création du fichier prompt si nécessaire
if not CONCISE_PROMPT_PATH.exists():
    with open(CONCISE_PROMPT_PATH, "w", encoding="utf-8") as f:
        f.write("""Vous êtes un assistant expert qui répond de manière brève et concise.
Votre objectif est de fournir des réponses directes et précises sans détails superflus.
Limitez votre réponse à 2-3 phrases maximum.
Utilisez un langage simple et clair.
Basez votre réponse uniquement sur les informations fournies dans le contexte.""")

def generer_reponse_concise(question: str, mode: str = "api", temperature: float = 0.2, max_tokens: int = 150) -> Dict:
    """
    Génère une réponse concise à partir des documents pertinents.
    
    Args:
        question: La question posée par l'utilisateur
        mode: Mode d'appel du modèle ("api" ou "local")
        temperature: Température pour la génération
        max_tokens: Nombre maximum de tokens pour la réponse
        
    Returns:
        Dict: Dictionnaire contenant la réponse et des métadonnées
    """
    # Vérifier d'abord si on peut répondre à la question
    peut_repondre = evaluer_possibilite_reponse(question, mode=mode)
    
    if not peut_repondre:
        return {
            "reponse": "Je ne trouve pas d'information pertinente sur ce sujet dans mes documents.",
            "sources": [],
            "peut_repondre": False
        }
    
    # Récupérer les chunks pertinents
    rag = TranscriptRAG.get_instance()
    relevant_chunks = rag.search(question, top_k=3)
    
    # Construire le contexte avec les chunks trouvés
    chunks_text = []
    sources = []
    for chunk, similarity in relevant_chunks:
        prefix = "[Description d'image] " if chunk.is_image_description else ""
        chunks_text.append(f"{prefix}{chunk.content}")
        
        # Enregistrer la source
        source_info = {
            "fichier": Path(chunk.source_file).name,
            "pertinence": round(similarity, 2),
            "est_image": chunk.is_image_description
        }
        sources.append(source_info)
    
    contexte = "\n\n".join(chunks_text)
    
    # Charger le prompt concis
    with open(CONCISE_PROMPT_PATH, "r", encoding="utf-8") as f:
        concise_prompt = f.read().strip()
    
    # Préparer les messages
    messages = [
        {"role": "system", "content": concise_prompt},
        {"role": "user", "content": f"Contexte:\n{contexte}\n\nQuestion: {question}"}
    ]
    
    # Appeler le modèle selon le mode choisi
    if mode == "api":
        reponse = _appeler_api(messages, temperature, max_tokens)
    else:
        reponse = _appeler_local(messages, temperature, max_tokens)
    
    return {
        "reponse": reponse,
        "sources": sources,
        "peut_repondre": True
    }

def _appeler_api(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
    """Appelle l'API Mistral pour générer une réponse."""
    try:
        api_key = os.environ["MISTRAL_API_KEY"]
        client = Mistral(api_key=api_key)
        model = "mistral-small-latest"
        
        chat_response = client.chat.complete(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return chat_response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Erreur lors de l'appel à l'API Mistral: {str(e)}")
        return "Désolé, je n'ai pas pu générer une réponse pour le moment."

def _appeler_local(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
    """Appelle le modèle Mistral en local pour générer une réponse."""
    try:
        url = MISTRAL_URL
        payload = {
            "model": MISTRAL_PATH,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(url, json=payload)
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Erreur lors de l'appel au modèle local: {str(e)}")
        return "Désolé, je n'ai pas pu générer une réponse pour le moment."

# Exemple d'utilisation
if __name__ == "__main__":
    # Initialiser le système RAG
    rag = TranscriptRAG.get_instance("/Users/rekta/projet/backend/transcripts")
    
    # Tester avec quelques questions
    questions = [
        "Comment accéder aux logs des DAGs dans Airflow?",
        "Comment utiliser GPT efficacement?",
        "Quels sont les avantages du quantum computing?"
    ]
    
    for question in questions:
        resultat = generer_reponse_concise(question)
        print(f"Question: {question}")
        print(f"Réponse: {resultat['reponse']}")
        
        if resultat['peut_repondre']:
            print("Sources:")
            for source in resultat['sources']:
                print(f"- {source['fichier']} (Pertinence: {source['pertinence']})")
        
        print("-" * 50) 