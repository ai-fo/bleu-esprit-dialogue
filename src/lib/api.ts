
import { v4 as uuidv4 } from 'uuid';

// URL de base de l'API
const API_URL = 'http://localhost:8000';

// Nous utilisons un ID de session unique pour suivre la conversation
let SESSION_ID = localStorage.getItem('chat_session_id');
if (!SESSION_ID) {
  SESSION_ID = uuidv4();
  localStorage.setItem('chat_session_id', SESSION_ID);
}

export interface ChatResponse {
  humanized: string | null;
  answer: string;
}

/**
 * Envoie un message au serveur et obtient une réponse
 * @param message Le message de l'utilisateur à envoyer
 */
export const sendMessage = async (message: string): Promise<ChatResponse> => {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: SESSION_ID,
        message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur réseau: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
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
