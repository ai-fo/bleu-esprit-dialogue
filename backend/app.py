from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from typing import List, Dict
from datetime import datetime
from config import DEFAULT_MODE, MISTRAL_PATH

# Import fonctions du module rag
from rag import (
    rag, 
    get_chat_completion,
    initialize_reranker,
    check_api_key
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
    
    # Build prompt sequence with conversation history
    system_msg = (
        "You are a helpful hotline assistant named Oskour. "
        "For technical questions, use the provided documents to answer. "
        "For casual conversations or greetings like 'bonjour', 'ça va ?', etc., respond in a friendly and conversational manner. "
        "Only if the user is asking a technical question and the answer is not in the documents, respond: "
        "'Je suis désolé, je n'ai pas assez d'informations pour répondre à cette question technique.'"
        "\n\nDocuments:\n{context}"
    )
    
    # Start with system message
    messages = [{"role": "system", "content": system_msg.format(context=context)}]
    
    # Construire proprement l'historique alternant user/assistant
    history = []
    
    # Ne prendre que les 10 derniers messages maximum pour avoir 5 échanges
    recent_history = CONVERSATION_CACHE[req.session_id][-10:] if CONVERSATION_CACHE[req.session_id] else []
    
    # S'assurer que l'historique commence par un message utilisateur
    if recent_history and recent_history[0]["role"] == "assistant":
        recent_history = recent_history[1:]
    
    # Ajouter les messages en s'assurant qu'ils alternent correctement
    for i in range(0, len(recent_history), 2):
        if i+1 < len(recent_history):
            # Ne prendre que les paires complètes user/assistant
            if recent_history[i]["role"] == "user" and recent_history[i+1]["role"] == "assistant":
                history.append(recent_history[i])
                history.append(recent_history[i+1])
    
    # Ajouter l'historique correctement construit
    messages.extend(history)
    
    # Ajouter la question actuelle
    messages.append({"role": "user", "content": req.question})
    
    # Get LLM completion
    resp = get_chat_completion(req.model, messages, max_tokens=req.max_tokens)
    answer = resp['choices'][0]['message']['content']
    
    # Update conversation history
    CONVERSATION_CACHE[req.session_id].extend([
        {"role": "user", "content": req.question},
        {"role": "assistant", "content": answer}
    ])
    
    return ChatResponse(answer=answer, files_used=files)

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