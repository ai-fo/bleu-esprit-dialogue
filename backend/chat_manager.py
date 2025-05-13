import os
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any
from mistralai import Mistral
from dotenv import load_dotenv
import requests
import torch
import re
import json
from rag_transcripts import TranscriptRAG
from config import PROMPTS_DIR, MISTRAL_URL, MISTRAL_PATH, TRANSCRIPTS_DIR

# Chargement des variables d'environnement
load_dotenv()

# Liste de mots-clés qui indiquent une question conversationnelle
QUESTIONS_CONVERSATIONNELLES = [
    r"\bbonjour\b", r"\bsalut\b", r"\bcoucou\b", r"\bhello\b", r"\bcc\b",
    r"\bça va\b", r"\bca va\b", r"\bcomment vas[ -]tu\b", r"\btu vas bien\b",
    r"\bau revoir\b", r"\badieu\b", r"\bmerci\b", r"\bà plus\b", r"\ba plus\b",
    r"\bbonsoir\b"
]

class Conversation:
    """Classe qui représente une conversation avec l'utilisateur."""
    
    def __init__(self):
        self.messages = []
        self.created_at = time.time()
        self.last_access = time.time()
    
    def add_message(self, role: str, content: str):
        """Ajoute un message à l'historique."""
        self.messages.append({"role": role, "content": content})
        self.last_access = time.time()
    
    def get_history(self, max_messages: int = 10) -> List[Dict[str, str]]:
        """Récupère l'historique récent des messages."""
        return self.messages[-max_messages:]
    
    def clear(self):
        """Efface l'historique de la conversation."""
        self.messages = []
        self.last_access = time.time()
        
    def format_for_context(self) -> str:
        """Formate l'historique pour l'inclure dans le contexte."""
        formatted_history = []
        for msg in self.messages:
            prefix = "Utilisateur" if msg["role"] == "user" else "Assistant"
            formatted_history.append(f"{prefix}: {msg['content']}")
        return "\n\n".join(formatted_history)

class ChatManager:
    """Gestionnaire de conversations avec RAG intégré."""
    
    def __init__(self, mode: str = "api", seuil_similarite: float = 0.15):
        """
        Initialise le gestionnaire de chat.
        
        Args:
            mode: Mode d'appel du modèle ("api" ou "local")
            seuil_similarite: Seuil de similarité pour la sélection des documents
        """
        self.conversations: Dict[str, Conversation] = {}
        self.mode = mode
        self.seuil_similarite = seuil_similarite
        
        # Initialiser le RAG
        print("Initialisation du système RAG...")
        self.rag = TranscriptRAG.get_instance(str(TRANSCRIPTS_DIR))
        
        # Charger les prompts
        self.prompts_path = PROMPTS_DIR
        self.prompts_path.mkdir(exist_ok=True)
        
        # Prompt de conversation
        self.conv_prompt_path = self.prompts_path / "conversation.txt"
        if not self.conv_prompt_path.exists():
            with open(self.conv_prompt_path, "w", encoding="utf-8") as f:
                f.write("""Vous êtes un assistant amical et utile.
Basez vos réponses sur les informations fournies dans l'historique de conversation et dans le contexte documentaire si disponible.
Soyez précis, concis et utile dans vos réponses.
Si vous ne connaissez pas la réponse, admettez-le simplement.""")
        
        with open(self.conv_prompt_path, "r", encoding="utf-8") as f:
            self.conv_prompt = f.read().strip()
        
        # Prompt RAG avec contexte
        self.rag_context_prompt_path = self.prompts_path / "rag_context.txt"
        if not self.rag_context_prompt_path.exists():
            with open(self.rag_context_prompt_path, "w", encoding="utf-8") as f:
                f.write("""Vous êtes un assistant expert qui répond aux questions en utilisant les documents fournis.
Utilisez à la fois le contexte documentaire ET l'historique de conversation pour générer des réponses précises.
Tenez compte des questions précédentes et de vos réponses pour maintenir la cohérence de la conversation.
Si les documents ne contiennent pas l'information nécessaire, basez-vous uniquement sur l'historique de conversation.
Soyez précis, clair et concis dans vos réponses.""")
        
        with open(self.rag_context_prompt_path, "r", encoding="utf-8") as f:
            self.rag_context_prompt = f.read().strip()
            
        print("Système prêt!")
    
    def get_conversation(self, session_id: str) -> Conversation:
        """Récupère une conversation existante ou en crée une nouvelle."""
        if session_id not in self.conversations:
            self.conversations[session_id] = Conversation()
        return self.conversations[session_id]
    
    def clear_history(self, session_id: str):
        """Efface l'historique d'une conversation."""
        if session_id in self.conversations:
            self.conversations[session_id].clear()
    
    def est_question_conversationnelle(self, question: str) -> bool:
        """
        Détermine si la question est une salutation ou une question conversationnelle.
        
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
    
    def verifier_similarite_documents(self, question: str) -> Tuple[bool, List[Tuple[Any, float]]]:
        """
        Vérifie si les documents ont une similarité suffisante avec la question.
        
        Args:
            question: La question posée
            
        Returns:
            Tuple[bool, List]: Indique si les documents sont pertinents et la liste des chunks
        """
        # Récupérer les chunks pertinents
        relevant_chunks = self.rag.search(question, top_k=5)
        
        # Vérifier si au moins un chunk dépasse le seuil de similarité
        for chunk, similarite in relevant_chunks:
            if similarite > self.seuil_similarite:
                return True, relevant_chunks
        
        return False, relevant_chunks
    
    def generer_reponse_avec_contexte(self, question: str, historique_formatte: str) -> str:
        """
        Génère une réponse en tenant compte de l'historique mais sans utiliser les documents.
        
        Args:
            question: La question posée
            historique_formatte: L'historique de la conversation formaté
            
        Returns:
            str: La réponse générée
        """
        # Préparer les messages
        messages = [
            {"role": "system", "content": self.conv_prompt},
            {"role": "user", "content": f"Historique de la conversation:\n{historique_formatte}\n\nNouvelle question: {question}"}
        ]
        
        # Appeler le modèle selon le mode choisi
        if self.mode == "api":
            try:
                api_key = os.environ["MISTRAL_API_KEY"]
                client = Mistral(api_key=api_key)
                model = "mistral-small-latest"
                
                chat_response = client.chat.complete(
                    model=model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=200
                )
                
                return chat_response.choices[0].message.content.strip()
            except Exception as e:
                print(f"Erreur lors de l'appel à l'API Mistral: {str(e)}")
                return "Désolé, je n'ai pas pu générer une réponse pour le moment. Veuillez réessayer plus tard."
        else:
            try:
                url = MISTRAL_URL
                payload = {
                    "model": MISTRAL_PATH,
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 200
                }
                
                response = requests.post(url, json=payload)
                return response.json()["choices"][0]["message"]["content"].strip()
            except Exception as e:
                print(f"Erreur lors de l'appel au modèle local: {str(e)}")
                return "Désolé, je n'ai pas pu générer une réponse pour le moment. Veuillez réessayer plus tard."
    
    def generer_reponse_rag_avec_contexte(self, question: str, historique_formatte: str, chunks: List[Tuple[Any, float]]) -> str:
        """
        Génère une réponse basée sur les documents et l'historique.
        
        Args:
            question: La question posée
            historique_formatte: L'historique de la conversation formaté
            chunks: Les chunks de documents pertinents avec leur score
            
        Returns:
            str: La réponse générée
        """
        # Construire le contexte documentaire
        contexte_docs = []
        for chunk, similarite in chunks:
            prefix = "[Description d'image] " if chunk.is_image_description else ""
            contexte_docs.append(f"{prefix}{chunk.content} (Pertinence: {similarite:.2f})")
        
        contexte_documents = "\n\n".join(contexte_docs)
        
        # Préparer les messages
        messages = [
            {"role": "system", "content": self.rag_context_prompt},
            {"role": "user", "content": f"Contexte documentaire:\n{contexte_documents}\n\nHistorique de la conversation:\n{historique_formatte}\n\nNouvelle question: {question}"}
        ]
        
        # Trouver le document le plus pertinent
        most_relevant_chunk = None
        highest_similarity = -1
        for chunk, similarity in chunks:
            if similarity > highest_similarity and hasattr(chunk, 'source_file'):
                most_relevant_chunk = chunk
                highest_similarity = similarity
        
        # Appeler le modèle selon le mode choisi
        if self.mode == "api":
            try:
                api_key = os.environ["MISTRAL_API_KEY"]
                client = Mistral(api_key=api_key)
                model = "mistral-small-latest"
                
                chat_response = client.chat.complete(
                    model=model,
                    messages=messages,
                    temperature=0.2,
                    max_tokens=300
                )
                
                reponse = chat_response.choices[0].message.content.strip()
            except Exception as e:
                print(f"Erreur lors de l'appel à l'API Mistral: {str(e)}")
                return "Désolé, je n'ai pas pu générer une réponse pour le moment. Veuillez réessayer plus tard."
        else:
            try:
                url = MISTRAL_URL
                payload = {
                    "model": MISTRAL_PATH,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 300
                }
                
                response = requests.post(url, json=payload)
                reponse = response.json()["choices"][0]["message"]["content"].strip()
            except Exception as e:
                print(f"Erreur lors de l'appel au modèle local: {str(e)}")
                return "Désolé, je n'ai pas pu générer une réponse pour le moment. Veuillez réessayer plus tard."

        # Ajouter le lien vers le PDF le plus pertinent
        if most_relevant_chunk:
            pdf_name = Path(most_relevant_chunk.source_file).name.replace('.txt', '.pdf')
            reponse += f"\n\nContactez la Hotline au 3400 ou consultez la documentation : http://localhost:8098/pdf/{pdf_name}"
        
        return reponse
    
    def chat(self, session_id: str, message: str) -> Tuple[str, str]:
        """
        Traite un message de l'utilisateur et génère une réponse.
        
        Args:
            session_id: Identifiant de la session
            message: Message de l'utilisateur
            
        Returns:
            Tuple[str, str]: Message humanisé (traitement de la réponse) et réponse brute
        """
        # Récupérer la conversation
        conversation = self.get_conversation(session_id)
        
        # Ajouter le message de l'utilisateur à l'historique
        conversation.add_message("user", message)
        
        # Récupérer l'historique formaté
        historique_formatte = conversation.format_for_context()
        
        # Informations de debug pour les logs internes
        debug_info = {
            "message": message,
            "timestamp": time.time(),
            "session_id": session_id
        }
        
        # Vérifier si c'est une question conversationnelle
        if self.est_question_conversationnelle(message):
            debug_info["type"] = "conversationnelle"
            # Générer une réponse conversationnelle avec contexte
            reponse = self.generer_reponse_avec_contexte(message, historique_formatte)
        else:
            # Vérifier la pertinence des documents
            documents_pertinents, chunks = self.verifier_similarite_documents(message)
            
            # Ajouter les infos de similarité pour debug
            debug_info["documents_pertinents"] = documents_pertinents
            debug_info["similarites"] = [
                {"source": Path(chunk.source_file).name, 
                 "similarite": round(sim, 4), 
                 "est_image": chunk.is_image_description}
                for chunk, sim in chunks[:3]
            ]
            
            if documents_pertinents:
                debug_info["type"] = "avec_documents"
                # Utiliser le RAG avec contexte pour une réponse
                reponse = self.generer_reponse_rag_avec_contexte(message, historique_formatte, chunks)
            else:
                debug_info["type"] = "sans_documents"
                # Générer une réponse directe avec le contexte de la conversation
                reponse = self.generer_reponse_avec_contexte(message, historique_formatte)
        
        # Ajouter la réponse à l'historique
        conversation.add_message("assistant", reponse)
        
        # Convertir les infos de debug en JSON pour le retour
        humanized = json.dumps(debug_info, ensure_ascii=False, indent=2)
        
        return humanized, reponse

# Exemple d'utilisation direct du chat manager
if __name__ == "__main__":
    chat_manager = ChatManager(mode="api", seuil_similarite=0.15)
    session_id = "test_console"
    
    print("Système de chat initialisé. Tapez 'q' pour quitter.")
    print("-" * 50)
    
    while True:
        user_input = input("\nVous: ")
        if user_input.lower() in ["q", "quit", "exit"]:
            break
        
        debug, response = chat_manager.chat(session_id, user_input)
        debug_obj = json.loads(debug)
        
        # Afficher le type de réponse
        response_type = debug_obj.get("type", "inconnue")
        print(f"[Type: {response_type}]")
        
        # Afficher les similarités si disponibles
        if "similarites" in debug_obj:
            print("Similarités:")
            for i, sim in enumerate(debug_obj["similarites"]):
                print(f"  {i+1}. {sim['source']} ({sim['similarite']})")
        
        print(f"\nAssistant: {response}")
        print("-" * 50) 