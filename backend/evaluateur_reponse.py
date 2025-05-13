import os
from pathlib import Path
from typing import List, Tuple, Dict
from mistralai import Mistral
from dotenv import load_dotenv
import torch
import requests
import json
from config import PROMPTS_DIR
from rag_transcripts import TranscriptRAG, TranscriptChunk

# Chargement des variables d'environnement
load_dotenv()

# Configuration du chemin pour le prompt d'évaluation
EVAL_PROMPT_PATH = PROMPTS_DIR / "evaluateur.txt"

# Création du fichier prompt si nécessaire
if not EVAL_PROMPT_PATH.exists():
    with open(EVAL_PROMPT_PATH, "w", encoding="utf-8") as f:
        f.write("""Vous êtes un évaluateur qui analyse si les documents fournis permettent de répondre à une question.
Votre tâche est de déterminer si le contexte contient suffisamment d'informations pour répondre à la question posée.
Répondez uniquement par "oui" ou "non".

Si le contexte contient des informations directement liées à la question, même partielles, répondez "oui".
Si le contexte ne contient aucune information pertinente pour répondre à la question, répondez "non".
""")

def evaluer_possibilite_reponse(question: str, mode: str = "api", temperature: float = 0.2) -> bool:
    """
    Évalue si les documents permettent de répondre à la question posée.
    
    Args:
        question: La question posée par l'utilisateur
        mode: Mode d'appel du modèle ("api" ou "local")
        temperature: Température pour la génération
        
    Returns:
        bool: True si les documents permettent de répondre, False sinon
    """
    # Récupérer les chunks pertinents
    rag = TranscriptRAG.get_instance()
    relevant_chunks = rag.search(question, top_k=5)
    
    # Construire le contexte avec les chunks trouvés
    chunks_text = []
    for chunk, similarity in relevant_chunks:
        prefix = "[Description d'image] " if chunk.is_image_description else ""
        chunks_text.append(f"{prefix}{chunk.content} (Pertinence: {similarity:.2f})")
    contexte = "\n\n".join(chunks_text)
    
    # Charger le prompt d'évaluation
    with open(EVAL_PROMPT_PATH, "r", encoding="utf-8") as f:
        eval_prompt = f.read().strip()
    
    # Préparer les messages
    messages = [
        {"role": "system", "content": eval_prompt},
        {"role": "user", "content": f"Contexte:\n{contexte}\n\nQuestion: {question}"}
    ]
    
    # Appeler le modèle selon le mode choisi
    if mode == "api":
        return _evaluer_api(messages)
    else:
        return _evaluer_local(messages)

def _evaluer_api(messages: List[Dict[str, str]]) -> bool:
    """Évalue en utilisant l'API Mistral."""
    try:
        api_key = os.environ["MISTRAL_API_KEY"]
        client = Mistral(api_key=api_key)
        model = "mistral-small-latest"
        
        chat_response = client.chat.complete(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=10
        )
        
        reponse = chat_response.choices[0].message.content.strip().lower()
        return reponse == "oui"
    except Exception as e:
        print(f"Erreur lors de l'appel à l'API Mistral: {str(e)}")
        return False

def _evaluer_local(messages: List[Dict[str, str]]) -> bool:
    """Évalue en utilisant le modèle Mistral en local."""
    try:
        url = "http://localhost:11434/v1/chat/completions"
        payload = {
            "model": "Mistral-Large-Instruct-2407-AWQ",
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 10
        }
        
        response = requests.post(url, json=payload)
        answer = response.json()["choices"][0]["message"]["content"].strip().lower()
        return answer == "oui"
    except Exception as e:
        print(f"Erreur lors de l'appel au modèle local: {str(e)}")
        return False

# Exemple d'utilisation
if __name__ == "__main__":
    # Initialiser le système RAG
    rag = TranscriptRAG.get_instance("/Users/rekta/projet/backend/transcripts")
    
    # Tester avec quelques questions
    questions = [
        "acceder aux logs dag qu'Airflow?",
        "Comment fonctionne un algorithme de tri rapide?",
        "use gpt?"
    ]
    
    for question in questions:
        peut_repondre = evaluer_possibilite_reponse(question)
        print(f"Question: {question}")
        print(f"Les documents permettent-ils de répondre? {'Oui' if peut_repondre else 'Non'}")
        print("-" * 50) 