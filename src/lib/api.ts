import { v4 as uuidv4 } from 'uuid';

// URL de base de l'API
const API_URL = 'http://localhost:8091';

// Génération d'un nouvel ID de session à chaque chargement de page
const SESSION_ID = uuidv4();
console.log('Nouvelle session créée:', SESSION_ID);

// Configuration par défaut alignée avec backend/config.py
const DEFAULT_KNOWLEDGE_BASE = 'transcripts';  // Dossier des transcriptions complètes
const DEFAULT_MODEL = 'Mistral-Large-Instruct-2407-AWQ';

export interface ChatResponse {
  answer: string;
  files_used: string[];
  message_parts: string[];
  message_id?: number;  // ID du message pour le feedback
}

export interface FeedbackData {
  message_id: number;
  rating: number;
  comment?: string;
}

export interface TrendingQuestion {
  question: string;
  count: number;
  source?: string;  // 'user', 'admin' ou 'all'
  application?: string;  // Nom de l'application concernée ou undefined si aucune
}

/**
 * Envoie un message au serveur et obtient une réponse
 * @param message Le message de l'utilisateur à envoyer
 * @param source La source du message ('user' ou 'admin')
 */
export const sendMessage = async (message: string, source: string = 'user'): Promise<ChatResponse> => {
  try {
    const payload = {
      session_id: SESSION_ID,
      question: message,
      knowledge_base: DEFAULT_KNOWLEDGE_BASE,
      model: DEFAULT_MODEL,
      source: source  // Ajouter la source
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

    const responseText = await response.text();
    console.log('Réponse brute du serveur:', responseText);

    if (!response.ok) {
      console.error('Réponse serveur non-ok:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      throw new Error(`Erreur serveur: ${response.status} - ${responseText}`);
    }

    // Essayer de parser la réponse JSON
    try {
      const data = JSON.parse(responseText);
      console.log('Réponse parsée:', data);
      return data;
    } catch (e) {
      console.error('Erreur de parsing JSON:', e);
      throw new Error(`Erreur de format de réponse: ${responseText}`);
    }
  } catch (error) {
    console.error('Erreur détaillée lors de l\'envoi du message:', error);
    throw error;
  }
};

/**
 * Envoie un feedback pour une réponse du chatbot
 * @param feedback Les données de feedback
 */
export const sendFeedback = async (feedback: FeedbackData): Promise<void> => {
  try {
    console.log('Envoi du feedback au serveur:', {
      url: `${API_URL}/feedback`,
      payload: feedback,
    });

    const response = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedback),
    });

    const responseText = await response.text();
    console.log('Réponse du serveur pour le feedback:', responseText);

    if (!response.ok) {
      console.error('Erreur lors de l\'envoi du feedback:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      throw new Error(`Erreur serveur: ${response.status} - ${responseText}`);
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi du feedback:', error);
    throw error;
  }
};

/**
 * Récupère les questions tendances
 * @param limit Nombre maximum de questions à récupérer (défaut: 3)
 * @param forceUpdate Forcer une mise à jour des tendances (défaut: false)
 * @param source Source des questions ('user', 'admin' ou 'all') (défaut: 'all')
 */
export const getTrendingQuestions = async (limit: number = 3, forceUpdate: boolean = false, source: string = 'all'): Promise<TrendingQuestion[]> => {
  try {
    console.log('Récupération des questions tendances:', {
      url: `${API_URL}/trending_questions`,
      params: { limit, force_update: forceUpdate, source },
    });

    const url = new URL(`${API_URL}/trending_questions`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('force_update', forceUpdate.toString());
    url.searchParams.append('source', source);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Réponse du serveur pour les questions tendances:', responseText);

    if (!response.ok) {
      console.error('Erreur lors de la récupération des questions tendances:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      throw new Error(`Erreur serveur: ${response.status} - ${responseText}`);
    }

    // Essayer de parser la réponse JSON
    try {
      const data = JSON.parse(responseText);
      console.log('Questions tendances parsées:', data);
      return data;
    } catch (e) {
      console.error('Erreur de parsing JSON:', e);
      return [];
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des questions tendances:', error);
    return [];
  }
};

/**
 * Efface l'historique de conversation côté serveur
 */
export const clearConversation = async (): Promise<void> => {
  try {
    console.log('Envoi de la requête pour effacer l\'historique:', {
      url: `${API_URL}/clear_history`,
      payload: { session_id: SESSION_ID },
    });

    const response = await fetch(`${API_URL}/clear_history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: SESSION_ID,
      }),
    });

    const responseText = await response.text();
    console.log('Réponse de la réinitialisation:', responseText);

    if (!response.ok) {
      throw new Error(`Erreur serveur: ${response.status} - ${responseText}`);
    }
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la conversation:', error);
    throw error;
  }
};
