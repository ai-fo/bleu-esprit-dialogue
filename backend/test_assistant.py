import os
from pathlib import Path
from dotenv import load_dotenv
from evaluateur_reponse import evaluer_possibilite_reponse
from rag_transcripts import TranscriptRAG
from mistralai import Mistral
import requests
import torch
import re
from config import MISTRAL_URL, MISTRAL_PATH

# Chargement des variables d'environnement
load_dotenv()

# Liste de mots-clés qui indiquent une question conversationnelle
QUESTIONS_CONVERSATIONNELLES = [
    r"\bbonjour\b", r"\bsalut\b", r"\bcoucou\b", r"\bhello\b", r"\bcc\b",
    r"\bça va\b", r"\bca va\b", r"\bcomment vas[ -]tu\b", r"\btu vas bien\b",
    r"\bau revoir\b", r"\badieu\b", r"\bmerci\b", r"\bà plus\b", r"\ba plus\b",
    r"\bbonsoir\b"
]

def est_question_conversationnelle(question: str) -> bool:
    """
    Détermine si la question est une salutation ou une question conversationnelle
    plutôt qu'une recherche d'information.
    
    Args:
        question: La question posée
        
    Returns:
        bool: True si c'est une question conversationnelle
    """
    question = question.lower()
    
    # Vérifier les patterns conversationnels
    for pattern in QUESTIONS_CONVERSATIONNELLES:
        if re.search(pattern, question):
            return True
    
    # Vérifier si la question est très courte (probablement conversationnelle)
    if len(question.split()) <= 3 and ("?" in question or not any(c.isalpha() for c in question)):
        return True
    
    return False

def generer_reponse_directe(question: str, mode: str = "api", temperature: float = 0.3, max_tokens: int = 150):
    """
    Génère une réponse directe sans vérification de document, pour les cas où
    les documents ne contiennent pas d'information pertinente.
    
    Args:
        question: La question posée par l'utilisateur
        mode: Mode d'appel du modèle ("api" ou "local")
        
    Returns:
        str: La réponse générée
    """
    # Prompt simple pour répondre à des questions générales
    prompt = """Vous êtes un assistant conversationnel utile et amical.
Répondez de manière brève et directe à la question posée.
Limitez votre réponse à 2-3 phrases maximum.
Si la question est une salutation ou une question de routine, répondez de façon naturelle et amicale."""
    
    # Préparer les messages
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": question}
    ]
    
    # Appeler le modèle selon le mode choisi
    if mode == "api":
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
            return "Bonjour! Comment puis-je vous aider aujourd'hui?"
    else:
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
            return "Bonjour! Comment puis-je vous aider aujourd'hui?"

def verifier_similarite_manuelle(question: str, seuil_similarite: float = 0.15):
    """
    Vérifie manuellement si les chunks ont une similarité suffisante.
    Stratégie plus simple et plus directe que d'utiliser l'évaluateur LLM.
    
    Args:
        question: La question posée
        seuil_similarite: Seuil minimal de similarité pour considérer un chunk pertinent
        
    Returns:
        bool: True si au moins un chunk dépasse le seuil de similarité
    """
    # Récupérer les chunks pertinents
    rag = TranscriptRAG.get_instance()
    # Utiliser top_k=5 pour avoir suffisamment de chunks à évaluer
    relevant_chunks = rag.search(question, top_k=5)
    
    # Vérifier si au moins un chunk dépasse le seuil de similarité
    for chunk, similarite in relevant_chunks:
        if similarite > seuil_similarite:
            return True, relevant_chunks
    
    return False, relevant_chunks

def assistant_intelligent(question: str, mode: str = "api", seuil_similarite: float = 0.15):
    """
    Assistant qui répond aux questions en utilisant différentes stratégies selon
    la pertinence des documents.
    
    Args:
        question: La question posée par l'utilisateur
        mode: Mode d'appel du modèle ("api" ou "local")
        seuil_similarite: Seuil minimal de similarité pour considérer un document pertinent
        
    Returns:
        dict: Résultat contenant la réponse et les métadonnées
    """
    print(f"Question: {question}")
    
    # Détecter si c'est une question conversationnelle
    if est_question_conversationnelle(question):
        print("🗣️ Question conversationnelle détectée, génération d'une réponse directe...")
        reponse_texte = generer_reponse_directe(question, mode=mode)
        return {
            "reponse": reponse_texte,
            "type_reponse": "conversationnelle",
            "documents_pertinents": False
        }
    
    print("Évaluation de la question...")
    
    # Vérifier directement avec le seuil de similarité (plus fiable que l'évaluateur LLM)
    peut_repondre, chunks = verifier_similarite_manuelle(question, seuil_similarite)
    
    # Afficher les similarités pour debug
    print("Similarités des chunks trouvés:")
    for i, (chunk, similarite) in enumerate(chunks[:3]):
        source = Path(chunk.source_file).name
        est_image = "IMAGE" if chunk.is_image_description else "TEXTE"
        print(f"  Chunk {i+1}: {similarite:.4f} ({est_image}, {source})")
    
    if peut_repondre:
        print(f"✅ Documents pertinents trouvés (similarité > {seuil_similarite}), génération d'une réponse détaillée...")
        # Utiliser le RAG complet pour une réponse détaillée
        rag = TranscriptRAG.get_instance()
        reponse_texte = rag.query(question)
        
        return {
            "reponse": reponse_texte,
            "type_reponse": "détaillée",
            "documents_pertinents": True
        }
    else:
        print(f"❌ Pas de documents pertinents (similarité < {seuil_similarite}), génération d'une réponse directe...")
        # Utiliser une réponse directe sans passer par le processus RAG
        reponse_texte = generer_reponse_directe(question, mode=mode)
        
        return {
            "reponse": reponse_texte,
            "type_reponse": "directe",
            "documents_pertinents": False
        }

# Interface utilisateur simple pour tester
def interface_test():
    """Interface simple pour tester l'assistant."""
    
    # Initialiser le RAG
    print("Initialisation du système RAG...")
    rag = TranscriptRAG.get_instance("/Users/rekta/projet/backend/transcripts")
    print("Système prêt!")
    
    # Demander si on veut utiliser l'API ou local
    mode = input("Mode d'exécution (api/local, défaut: api): ").strip().lower()
    if mode != "local":
        mode = "api"
    
    # Demander le seuil de similarité
    seuil_input = input("Seuil de similarité (défaut: 0.15): ").strip()
    try:
        seuil_similarite = float(seuil_input) if seuil_input else 0.15
    except ValueError:
        print("Valeur invalide, utilisation du seuil par défaut: 0.15")
        seuil_similarite = 0.15
    
    print(f"Mode sélectionné: {mode}")
    print(f"Seuil de similarité: {seuil_similarite}")
    print("-" * 50)
    
    # Boucle principale
    while True:
        question = input("\nVotre question (ou 'q' pour quitter): ").strip()
        
        if question.lower() in ['q', 'quit', 'exit']:
            break
        
        print("-" * 50)
        resultat = assistant_intelligent(question, mode=mode, seuil_similarite=seuil_similarite)
        
        print("\nRéponse:")
        print(resultat["reponse"])
        print(f"\nType de réponse: {resultat['type_reponse']}")
        print("-" * 50)

if __name__ == "__main__":
    interface_test() 