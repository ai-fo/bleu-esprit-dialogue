import { v4 as uuidv4 } from 'uuid';

// URL de base de l'API
const API_URL = 'http://localhost:8091';

// Nous utilisons un ID de session unique pour suivre la conversation
let SESSION_ID = localStorage.getItem('chat_session_id');
if (!SESSION_ID) {
  SESSION_ID = uuidv4();
  localStorage.setItem('chat_session_id', SESSION_ID);
}

// Configuration par défaut alignée avec backend/config.py
const DEFAULT_KNOWLEDGE_BASE = 'transcripts';  // Dossier des transcriptions complètes
const DEFAULT_MODEL = 'Mistral-Large-Instruct-2407-AWQ';

export interface ChatResponse {
  humanized: string | null;
  answer: string;
  sources?: Array<{
    fichier: string;
    pertinence: number;
    est_image?: boolean;
  }>;
  peut_repondre?: boolean;
}

/**
 * Envoie un message au serveur et obtient une réponse
 * @param message Le message de l'utilisateur à envoyer
 */
export const sendMessage = async (message: string): Promise<ChatResponse> => {
  try {
    const payload = {
      session_id: SESSION_ID,
      question: message,  // Renommé de 'message' à 'question'
      knowledge_base: DEFAULT_KNOWLEDGE_BASE,
      model: DEFAULT_MODEL
    };
    
    console.log('Envoi de la requête au serveur:', {
      url: `${API_URL}/chat`,
      payload,
    });

    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Réponse serveur non-ok:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      throw new Error(`Erreur réseau: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Réponse serveur:', data);
    return data;
  } catch (error) {
    console.error('Erreur détaillée lors de l\'envoi du message:', error);
    throw error;
  }
};

/**
 * Efface l'historique de conversation côté serveur
 */
export const clearConversation = async (): Promise<void> => {
  try {
    await fetch(`${API_URL}/clear_history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: SESSION_ID,
        message: '', // Message vide puisqu'on veut juste effacer l'historique
      }),
    });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la conversation:', error);
    throw error;
  }
};
