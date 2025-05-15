from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from typing import List, Dict
from datetime import datetime
import httpx
from config import DEFAULT_MODE, MISTRAL_PATH, PDF_FOLDER

# Import fonctions du module rag
from rag import (
    rag, 
    get_chat_completion,
    initialize_reranker,
    check_api_key,
    split_long_message
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Conversation history cache: {session_id: list of messages}
CONVERSATION_CACHE: Dict[str, List[Dict[str, str]]] = {}

# Request and response models
class RAGRequest(BaseModel):
    question: str
    knowledge_base: str

class RAGResponse(BaseModel):
    context: str
    files_used: List[str]

class ChatRequest(BaseModel):
    question: str
    knowledge_base: str
    session_id: str
    model: str = MISTRAL_PATH
    max_tokens: int = 6000

class ChatResponse(BaseModel):
    answer: str
    files_used: List[str]
    message_parts: List[str] = []  # Liste des parties du message si décomposé

class ClearHistoryRequest(BaseModel):
    session_id: str

# Initialize FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.on_event("startup")
def startup_event():
    """Warm up the reranker model and check configuration"""
    logger.info(f"Mode actuel: {DEFAULT_MODE}")
    check_api_key()
    initialize_reranker()

@app.post("/rag", response_model=RAGResponse)
def rag_endpoint(req: RAGRequest):
    """Run RAG for a given question and knowledge base path"""
    context, files = rag(req.question, req.knowledge_base)
    return RAGResponse(context=context, files_used=files)

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    """Combine RAG context with LLM response for a chatbot hotline with conversation history."""
    # Initialize conversation history if it doesn't exist
    if req.session_id not in CONVERSATION_CACHE:
        CONVERSATION_CACHE[req.session_id] = []
    
    # Retrieve context for prompt
    context, files = rag(req.question, req.knowledge_base)
    logger.info(f"RAG a trouvé {len(files)} fichiers pour la question: {req.question}")
    logger.info(f"Fichiers trouvés: {files}")
    
    # Build prompt sequence with conversation history
    system_msg = (
        "You are a helpful hotline assistant named Oskour. "
        "Your primary role is to answer technical questions using the provided documents and remember previous interactions with the user. "
        "For casual conversations or greetings like 'bonjour', 'ça va ?', etc., respond in a friendly and conversational manner. "
        "Only if the user is asking a technical question and the answer is not in the documents, respond: "
        "'Je suis désolé, je n'ai pas assez d'informations pour répondre à cette question technique.'"
        "\n\nIMPORTANT : NE JAMAIS terminer tes réponses par des phrases comme 'N'hésitez pas à me poser d'autres questions', "
        "'Si vous avez besoin de plus d'informations...', 'N'hésitez pas à demander plus de détails', etc. "
        "J'ajouterai moi-même un message standardisé avec les informations de contact. "
        "Termine simplement ta réponse quand tu as fini d'expliquer."
        "\n\nMEMORY: Quand l'utilisateur te demande de te rappeler de quelque chose que tu as dit précédemment, "
        "utilise l'historique de conversation pour retrouver l'information précise. Si on te demande de répéter ou résumer "
        "ce que tu as déjà expliqué, utilise les messages précédents de l'historique pour formuler ta réponse."
        "\n\nDocuments:\n{context}"
    )
    
    # Start with system message
    messages = [{"role": "system", "content": system_msg.format(context=context)}]
    
    # Construire proprement l'historique alternant user/assistant
    history = []
    
    # Ne prendre que les 10 derniers messages maximum pour avoir 5 échanges
    recent_history = CONVERSATION_CACHE[req.session_id][-10:] if CONVERSATION_CACHE[req.session_id] else []
    
    # Journaliser l'historique récupéré pour le débogage
    if recent_history:
        logger.info(f"Historique récupéré pour la session {req.session_id}: {len(recent_history)} messages")
        for i, msg in enumerate(recent_history):
            logger.info(f"  Message {i+1}: {msg['role']} - {msg['content'][:50]}...")
    else:
        logger.info(f"Aucun historique pour la session {req.session_id}")
    
    # S'assurer que l'historique commence par un message utilisateur
    if recent_history and recent_history[0]["role"] == "assistant":
        recent_history = recent_history[1:]
        logger.info("Premier message assistant supprimé de l'historique")
    
    # Ajouter les messages en s'assurant qu'ils alternent correctement
    for i in range(0, len(recent_history), 2):
        if i+1 < len(recent_history):
            # Ne prendre que les paires complètes user/assistant
            if recent_history[i]["role"] == "user" and recent_history[i+1]["role"] == "assistant":
                history.append(recent_history[i])
                history.append(recent_history[i+1])
    
    # Ajouter l'historique correctement construit
    messages.extend(history)
    logger.info(f"Nombre de messages d'historique ajoutés au prompt: {len(history)}")
    
    # Ajouter la question actuelle
    messages.append({"role": "user", "content": req.question})
    
    # Log des messages envoyés au LLM
    logger.info("Messages envoyés au LLM:")
    for i, msg in enumerate(messages):
        if i == 0:  # Le premier message est le système prompt, qui peut être très long
            logger.info(f"  Message {i} (system): {msg['content'][:100]}... (tronqué)")
        else:
            logger.info(f"  Message {i} ({msg['role']}): {msg['content'][:100]}...")
    
    # Get LLM completion
    resp = get_chat_completion(req.model, messages, max_tokens=req.max_tokens)
    answer = resp['choices'][0]['message']['content']
    
    # Déterminer si c'est une question technique qui nécessite vraiment des documents (présence de fichiers utilisés)
    is_technical_question = len(files) > 0
    logger.info(f"Question technique: {is_technical_question}")
    
    # Message principal sans les liens de documents
    main_answer = answer
    documents_message = ""

    # Vérifier si nous devons ajouter des liens de documents
    if is_technical_question and files:
        # Demander au LLM si les documents ont réellement été utiles pour répondre à la question
        verification_messages = [
            {"role": "system", "content": "Tu es un assistant expert chargé d'évaluer si les documents fournis ont été utilisés pour répondre à la question. Ne considère PAS le format ou la structure de la question mais seulement son contenu sémantique. Réponds uniquement par 'OUI' si tu détectes une correspondance entre la question et le document, même si la formulation est différente. Une question simple qui mentionne un sujet contenu dans le document doit être considérée comme pertinente. Réponds 'NON' uniquement pour les questions de salutation pure comme 'bonjour' ou 'comment ça va'."},
            {"role": "user", "content": f"Question de l'utilisateur: \"{req.question}\"\n\nRéponse générée: \"{answer}\"\n\nDocuments utilisés et leur contenu:\n{context}\n\nÉvaluation: Le document contient-il des informations pertinentes pour cette question précise, même si la question est simple ou ne contient qu'une mention du sujet? Si le document contient des informations sur le sujet mentionné dans la question, réponds 'OUI', même si la question est courte ou peu détaillée."}
        ]
        
        verification_resp = get_chat_completion(req.model, verification_messages, max_tokens=100)
        verification_text = verification_resp['choices'][0]['message']['content'].upper()
        documents_are_relevant = "OUI" in verification_text
        
        # Ajouter une seconde vérification si la première répond NON
        if not documents_are_relevant:
            logger.info(f"Première vérification négative, tentative de seconde vérification avec une méthode différente")
            # Approche plus directe, basée sur la correspondance de mots-clés
            keywords_messages = [
                {"role": "system", "content": "Tu es un assistant qui détermine si un document contient des informations sur les sujets mentionnés dans une question. Réponds uniquement par 'OUI' ou 'NON'."},
                {"role": "user", "content": f"Quels sont les mots-clés ou concepts principaux dans cette question: \"{req.question}\"? Puis vérifie si ces mots-clés apparaissent dans le document suivant:\n\n{context}\n\nSi au moins un mot-clé ou concept important de la question apparaît dans le document, réponds 'OUI', sinon réponds 'NON'."}
            ]
            
            keywords_resp = get_chat_completion(req.model, keywords_messages, max_tokens=100)
            keywords_text = keywords_resp['choices'][0]['message']['content'].upper()
            documents_are_relevant = "OUI" in keywords_text
            logger.info(f"Seconde vérification de pertinence: {keywords_text}")
        
        logger.info(f"Vérification finale de pertinence des documents: {verification_text}")
        logger.info(f"Documents jugés pertinents: {documents_are_relevant}")
        
        # Vérifier si le serveur PDF est disponible (port 8077)
        pdf_server_available = False
        try:
            with httpx.Client(timeout=2.0) as client:
                response = client.get("http://localhost:8077/")
                pdf_server_available = response.status_code == 200
        except Exception as e:
            logger.warning(f"Serveur PDF non disponible: {e}")
        
        # Ne pas inclure les documents s'ils ne sont pas pertinents ou si le serveur PDF n'est pas disponible
        if documents_are_relevant and pdf_server_available:
            # Construire les liens vers les PDFs
            pdf_links = []
            for file in files:
                # Extraire le nom du fichier à partir du chemin complet
                filename = file.split('/')[-1].replace('.txt', '.pdf')
                
                # Vérifier que le fichier PDF existe réellement
                pdf_file_path = PDF_FOLDER / filename
                if not pdf_file_path.exists():
                    logger.warning(f"Fichier PDF non trouvé: {pdf_file_path}")
                    continue
                
                # Créer le lien vers le PDF
                pdf_link = f"http://localhost:8077/pdf/{filename}"
                pdf_links.append(pdf_link)
            
            # Créer un message séparé pour les documents
            if pdf_links:
                if len(pdf_links) == 1:
                    documents_message = f"Plus d'informations dans ce document : {pdf_links[0]} ou appelle le 3400."
                else:
                    links_text = ", ".join(pdf_links[:-1]) + " et " + pdf_links[-1] if len(pdf_links) > 1 else pdf_links[0]
                    documents_message = f"Plus d'informations dans ces documents : {links_text} ou appelle le 3400."
                logger.info(f"Message séparé avec liens PDF créé: {pdf_links}")
            else:
                logger.warning("Aucun fichier PDF valide n'a été trouvé, pas de liens ajoutés.")
        elif not pdf_server_available:
            logger.warning("Serveur PDF non disponible, pas de liens ajoutés.")
        elif not documents_are_relevant:
            logger.info("Documents jugés non pertinents, pas de liens ajoutés.")
    
    # Décomposer le message principal en plusieurs parties si nécessaire
    message_parts = split_long_message(main_answer)
    logger.info(f"Message principal décomposé en {len(message_parts)} parties")
    
    # Ajouter le message de documents comme une partie séparée si présent
    if documents_message:
        message_parts.append(documents_message)
        logger.info("Message sur les documents ajouté comme partie séparée")
    
    # Update conversation history
    # Ajouter la question de l'utilisateur
    CONVERSATION_CACHE[req.session_id].append({"role": "user", "content": req.question})
    
    # Si le message est décomposé en plusieurs parties, les ajouter comme une seule entrée concaténée
    # pour préserver le contexte
    combined_answer = "\n\n".join(message_parts)
    CONVERSATION_CACHE[req.session_id].append({"role": "assistant", "content": combined_answer})
    
    # Journaliser l'état de l'historique pour le débogage
    history_count = len(CONVERSATION_CACHE[req.session_id])
    logger.info(f"Historique mis à jour: {history_count} messages au total pour la session {req.session_id}")
    
    return ChatResponse(answer=answer, files_used=files, message_parts=message_parts)

@app.post("/clear_history")
def clear_history_endpoint(req: ClearHistoryRequest):
    """Clear conversation history for a given session."""
    if req.session_id in CONVERSATION_CACHE:
        logger.info(f"Clearing conversation history for session {req.session_id}")
        CONVERSATION_CACHE[req.session_id] = []
        return {"success": True, "message": "Conversation history cleared"}
    return {"success": False, "message": "Session not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8091) 