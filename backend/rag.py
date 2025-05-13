from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import logging
from pathlib import Path
from FlagEmbedding import FlagReranker
import httpx
from typing import List, Dict
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the reranker model
reranker = FlagReranker(
    '/home/llama/models/base_models/bge-reranker-v2-m3',
    use_fp16=True
)

# Cache for loaded knowledge bases: {kb_path: {'file_texts': {...}, 'chunks': [(filename, chunk_text), ...]}}
KB_CACHE: dict[str, dict] = {}

# Conversation history cache: {session_id: list of messages}
CONVERSATION_CACHE: Dict[str, List[Dict[str, str]]] = {}

# Synchronous chat completion via httpx
def get_chat_completion(
    model_name: str,
    messages: list,
    max_tokens: int = 6000,
    api_url: str = "http://0.0.0.0:5263/v1/chat/completions"
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

# Retrieve context using batched scoring
def rag(question: str, kv_path: str, k: int = 1):
    if kv_path not in KB_CACHE:
        KB_CACHE[kv_path] = load_knowledge_base(kv_path)
    data = KB_CACHE[kv_path]
    chunks = data['chunks']

    # Build batch of [question, chunk_text]
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
    model: str = "Mistral-Large-Instruct-2407-AWQ"
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
    """Warm up the reranker model"""
    logger.info("Warming up reranker with dummy call...")
    try:
        reranker.compute_score([['', '']])
        logger.info("Reranker warmed up successfully.")
    except Exception as e:
        logger.error(f"Reranker warm-up failed: {e}")

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
        "You are a helpful hotline assistant named Bill. "
        "You should respond to user queries in French. "
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
    recent_history = CONVERSATION_CACHE[req.session_id][-10:]
    
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