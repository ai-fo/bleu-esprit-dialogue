from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from typing import List, Dict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Conversation history cache: {session_id: list of messages}
CONVERSATION_CACHE: Dict[str, List[Dict[str, str]]] = {}

# Request and response models
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

@app.get("/")
def read_root():
    return {"message": "Simple API server is running"}

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    """Simple mock chat endpoint that just echoes back the question with some context."""
    logger.info(f"Received chat request: {req}")
    
    # Initialize conversation history if it doesn't exist
    if req.session_id not in CONVERSATION_CACHE:
        CONVERSATION_CACHE[req.session_id] = []
    
    # Add user message to history
    CONVERSATION_CACHE[req.session_id].append({"role": "user", "content": req.question})
    
    # Generate a simple response
    history_length = len(CONVERSATION_CACHE[req.session_id])
    answer = f"Voici une réponse à votre question: '{req.question}'. C'est votre message #{history_length} dans cette session."
    
    # Add bot response to history
    CONVERSATION_CACHE[req.session_id].append({"role": "assistant", "content": answer})
    
    logger.info(f"Sending response: {answer}")
    return ChatResponse(answer=answer, files_used=[f"mock_file_{history_length}.txt"])

@app.post("/clear_history")
def clear_history_endpoint(req: ClearHistoryRequest):
    """Clear conversation history for a given session."""
    logger.info(f"Clearing history for session: {req.session_id}")
    if req.session_id in CONVERSATION_CACHE:
        logger.info(f"Clearing conversation history for session {req.session_id}")
        CONVERSATION_CACHE[req.session_id] = []
        return {"success": True, "message": "Conversation history cleared"}
    return {"success": False, "message": "Session not found"}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting simple API server on port 8091")
    uvicorn.run(app, host="0.0.0.0", port=8091) 