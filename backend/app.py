from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from typing import List, Dict, Optional
from datetime import datetime
import httpx
import time
import random
import traceback
from config import DEFAULT_MODE, MISTRAL_PATH, PDF_FOLDER, MINISTRAL_PATH, MINISTRAL_URL

# Import fonctions du module rag
from rag import (
    rag, 
    get_chat_completion,
    initialize_reranker,
    check_api_key,
    split_long_message
)

# Import fonctions du module database
from database import (
    save_session,
    save_message,
    save_feedback,
    save_error,
    get_trending_questions
)

# Import fonctions du module trending_analysis
from trending_analysis import analyze_and_update_trending_questions

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
    source: str = 'user'  # 'user' ou 'admin'

class ChatResponse(BaseModel):
    answer: str
    files_used: List[str]
    message_parts: List[str] = []  # Liste des parties du message si décomposé
    performance: Dict[str, float] = {}  # Mesures de performance
    typing_delays: List[float] = []  # Délais de frappe aléatoires entre les parties de message
    message_id: int = -1  # ID du message dans la base de données

class ClearHistoryRequest(BaseModel):
    session_id: str

class FeedbackRequest(BaseModel):
    message_id: int
    rating: int
    comment: str = None

class TrendingQuestion(BaseModel):
    question: str
    count: int
    source: str = 'all'
    application: Optional[str] = None

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
    # Démarrer le minuteur global
    start_total = time.time()
    
    # Enregistrer ou mettre à jour la session dans la base de données avec la source
    try:
        save_session(req.session_id, req.source)
    except Exception as e:
        logger.error(f"Erreur lors de l'enregistrement de la session: {e}")
        save_error("database_error", str(e), req.session_id, traceback.format_exc())
    
    # Initialize conversation history if it doesn't exist
    if req.session_id not in CONVERSATION_CACHE:
        CONVERSATION_CACHE[req.session_id] = []
    
    # Retrieve context for prompt
    start_rag = time.time()
    context, files = rag(req.question, req.knowledge_base)
    rag_time = time.time() - start_rag
    logger.info(f"RAG a trouvé {len(files)} fichiers pour la question: {req.question}")
    logger.info(f"Fichiers trouvés: {files}")
    logger.info(f"Temps RAG: {rag_time:.2f}s")
    
    # Build prompt sequence with conversation history
    start_prompt = time.time()
    system_msg = (
        "Tu es Oskour, un assistant de hotline sympathique et humain. "
        "Tu as une personnalité chaleureuse et tu t'exprimes comme un vrai humain, pas comme un robot. "
        "\n\nSTYLE: "
        "- Utilise un ton conversationnel, dynamique et naturel"
        "- Emploie parfois des expressions familières comme 'Ah, je vois!', 'Hmm, laisse-moi réfléchir...', 'Bien sûr!'"
        "- Fais des phrases de longueurs variées - parfois courtes, parfois plus longues"
        "- N'hésite pas à utiliser des petites interjections (ah, eh bien, tiens, etc.)"
        "- Montre un peu d'empathie quand l'utilisateur semble frustré"
        "- Évite le langage trop formel ou trop technique sauf si nécessaire"
        "- Utilise occasionnellement des émojis simples comme :) ou ;) mais avec modération"
        "- Fais parfois des petites fautes de frappe mineures (pas trop) ou reprends-toi comme un humain le ferait"
        "\n\nRÔLE: Ta mission principale est de répondre aux questions techniques en utilisant les documents fournis et "
        "te souvenir des interactions précédentes avec l'utilisateur. "
        "Pour les conversations décontractées ou les salutations comme 'bonjour', 'ça va ?', etc., réponds de façon amicale. "
        "Uniquement si l'utilisateur pose une question technique et que la réponse n'est pas dans les documents, réponds: "
        "'Mmm, je suis désolé, je n'ai pas assez d'infos pour répondre à cette question technique...'"
        "\n\nIMPORTANT: NE JAMAIS terminer tes réponses par des phrases comme 'N'hésite pas à me poser d'autres questions', "
        "'Si tu as besoin de plus d'infos...', etc. J'ajouterai moi-même un message avec les infos de contact. "
        "Termine simplement ta réponse quand tu as fini d'expliquer."
        "\n\nMEMORY: Quand l'utilisateur te demande de te rappeler quelque chose, utilise l'historique de conversation "
        "pour retrouver l'info précise. Si on te demande de répéter ou résumer ce que tu as déjà expliqué, "
        "utilise les messages précédents pour formuler ta réponse."
        "\n\nSTRUCTURE: Pour les réponses longues (plus de 400 caractères), structure ta réponse en parties logiques "
        "en insérant le séparateur '%%PARTIE%%' entre chaque partie (entre 2 et 5 parties maximum). "
        "Ne numérote pas les parties et n'ajoute pas d'introduction spéciale pour chaque partie. "
        "Assure-toi que chaque partie est autonome et contient des phrases complètes."
        "\n\nFORMATAGE: Mets en **gras** les informations importantes et les concepts clés de ta réponse en utilisant "
        "la syntaxe markdown (deux astérisques avant et après le texte important: **texte important**). "
        "N'en abuse pas, seulement 2-3 éléments importants par partie de message."
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
    start_llm = time.time()
    resp = get_chat_completion(req.model, messages, max_tokens=req.max_tokens)
    answer = resp['choices'][0]['message']['content']
    llm_time = time.time() - start_llm
    logger.info(f"Temps génération LLM: {llm_time:.2f}s")
    
    # Afficher la sortie complète du LLM
    logger.info("=== SORTIE COMPLÈTE DU LLM ===")
    logger.info(answer)
    logger.info("=== FIN SORTIE LLM ===")
    
    # Déterminer si c'est une question technique qui nécessite vraiment des documents (présence de fichiers utilisés)
    is_technical_question = len(files) > 0
    logger.info(f"Question technique: {is_technical_question}")
    
    # Message principal sans les liens de documents
    main_answer = answer
    documents_message = ""

    # Vérifier si nous devons ajouter des liens de documents
    start_doc_check = time.time()
    if is_technical_question and files:
        # Approche directe basée sur la correspondance de mots-clés
        keywords_messages = [
            {"role": "system", "content": "Tu es un assistant qui détermine si un document contient des informations sur les sujets mentionnés dans une question. Réponds uniquement par 'OUI' ou 'NON'."},
            {"role": "user", "content": f"Quels sont les mots-clés ou concepts principaux dans cette question: \"{req.question}\"? Puis vérifie si ces mots-clés apparaissent dans le document suivant:\n\n{context}\n\nSi au moins un mot-clé ou concept important de la question apparaît dans le document, réponds 'OUI', sinon réponds 'NON'."}
        ]
        
        verification_resp = get_chat_completion(req.model, keywords_messages, max_tokens=100)
        verification_text = verification_resp['choices'][0]['message']['content'].upper()
        documents_are_relevant = "OUI" in verification_text
        logger.info(f"Vérification de pertinence par mots-clés: {verification_text}")
        
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
    doc_check_time = time.time() - start_doc_check
    logger.info(f"Temps vérification documents: {doc_check_time:.2f}s")
    
    # Décomposer le message principal en plusieurs parties si nécessaire
    start_split = time.time()
    message_parts = split_long_message(main_answer)
    split_time = time.time() - start_split
    logger.info(f"Message principal décomposé en {len(message_parts)} parties")
    logger.info(f"Temps découpage message: {split_time:.2f}s")
    
    # Générer des délais de frappe aléatoires pour un affichage plus naturel
    typing_delays = []
    for i in range(len(message_parts)):
        # Délai aléatoire entre 0.5 et 2.5 secondes entre les parties
        delay = round(random.uniform(0.5, 2.5), 2)
        typing_delays.append(delay)
    
    # Afficher tous les morceaux découpés
    logger.info("=== MORCEAUX DU MESSAGE DÉCOUPÉS ===")
    for i, part in enumerate(message_parts):
        logger.info(f"--- MORCEAU {i+1}/{len(message_parts)} ---")
        logger.info(part)
    logger.info("=== FIN MORCEAUX DÉCOUPÉS ===")
    
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
    
    # Sauvegarder le message de l'utilisateur dans la base de données
    user_message_id = -1
    assistant_message_id = -1
    try:
        # Enregistrer le message de l'utilisateur avec la source
        user_message_id = save_message(
            session_id=req.session_id, 
            role="user", 
            content=req.question,
            source=req.source
        )
        
        # Enregistrer la réponse de l'assistant avec ses parties et les fichiers sources
        assistant_message_id = save_message(
            session_id=req.session_id, 
            role="assistant", 
            content=combined_answer, 
            message_parts=message_parts,
            files_used=files,
            source=req.source
        )
        
        # Mettre à jour les questions tendances en arrière-plan après chaque nouveau message
        # Exécution en arrière-plan pour ne pas ralentir la réponse
        try:
            # Lancer l'analyse en arrière-plan avec la source
            logger.info(f"Lancement de l'analyse des tendances en arrière-plan pour la source: {req.source}")
            threading.Thread(
                target=analyze_and_update_trending_questions,
                args=(3, req.source),  # Limiter à 3 questions tendances et spécifier la source
                daemon=True
            ).start()
        except Exception as e:
            logger.error(f"Erreur lors du lancement de l'analyse des tendances: {e}")
    except Exception as e:
        logger.error(f"Erreur lors de l'enregistrement des messages dans la base de données: {e}")
        save_error("database_error", str(e), req.session_id, traceback.format_exc())
    
    # Journaliser l'état de l'historique pour le débogage
    history_count = len(CONVERSATION_CACHE[req.session_id])
    logger.info(f"Historique mis à jour: {history_count} messages au total pour la session {req.session_id}")
    
    # Calculer et journaliser le temps total
    total_time = time.time() - start_total
    logger.info(f"Temps total de traitement: {total_time:.2f}s")
    
    # Résumé des performances
    logger.info(f"RÉSUMÉ PERFORMANCES: Total={total_time:.2f}s | RAG={rag_time:.2f}s | LLM={llm_time:.2f}s | DocCheck={doc_check_time:.2f}s | Split={split_time:.2f}s")
    
    return ChatResponse(
        answer=answer, 
        files_used=files, 
        message_parts=message_parts,
        performance={
            "total_time": round(total_time, 2),
            "rag_time": round(rag_time, 2),
            "llm_time": round(llm_time, 2),
            "doc_check_time": round(doc_check_time, 2),
            "split_time": round(split_time, 2)
        },
        typing_delays=typing_delays,
        message_id=assistant_message_id
    )

@app.post("/clear_history")
def clear_history_endpoint(req: ClearHistoryRequest):
    """Clear conversation history for a given session."""
    if req.session_id in CONVERSATION_CACHE:
        logger.info(f"Clearing conversation history for session {req.session_id}")
        CONVERSATION_CACHE[req.session_id] = []
        return {"success": True, "message": "Conversation history cleared"}
    return {"success": False, "message": "Session not found"}

@app.post("/feedback")
def feedback_endpoint(req: FeedbackRequest):
    """Enregistrer un feedback utilisateur pour un message."""
    try:
        success = save_feedback(req.message_id, req.rating, req.comment)
        if success:
            logger.info(f"Feedback enregistré pour le message {req.message_id}: {req.rating}/5")
            return {"success": True, "message": "Feedback enregistré avec succès"}
        else:
            logger.error(f"Échec de l'enregistrement du feedback pour le message {req.message_id}")
            return {"success": False, "message": "Échec de l'enregistrement du feedback"}
    except Exception as e:
        error_message = f"Erreur lors de l'enregistrement du feedback: {str(e)}"
        logger.error(error_message)
        save_error("feedback_error", error_message, stack_trace=traceback.format_exc())
        return {"success": False, "message": error_message}

@app.get("/trending_questions", response_model=List[TrendingQuestion])
def get_trending_questions_endpoint(limit: int = 3, force_update: bool = False, source: str = 'all'):
    """Récupérer les questions tendances d'aujourd'hui.
    
    Args:
        limit: Nombre maximum de questions à récupérer
        force_update: Forcer la mise à jour des tendances
        source: Source des questions ('user', 'admin' ou 'all')
    """
    try:
        # Mettre à jour les tendances si demandé
        if force_update:
            logger.info(f"Mise à jour forcée des questions tendances pour la source: {source}")
            trending_questions = analyze_and_update_trending_questions(limit)
        else:
            # Récupérer les questions tendances existantes pour la source spécifiée
            trending_questions = get_trending_questions(limit, source)
            
            # Si aucune question tendance n'existe, en générer
            if not trending_questions:
                logger.info(f"Aucune question tendance trouvée pour la source {source}, analyse en cours...")
                trending_questions = analyze_and_update_trending_questions(limit)
        
        logger.info(f"Questions tendances récupérées: {trending_questions}")
        return trending_questions
    except Exception as e:
        error_message = f"Erreur lors de la récupération des questions tendances: {str(e)}"
        logger.error(error_message)
        save_error("trending_error", error_message, stack_trace=traceback.format_exc())
        return []

if __name__ == "__main__":
    import uvicorn
    import threading
    uvicorn.run(app, host="0.0.0.0", port=8091) 