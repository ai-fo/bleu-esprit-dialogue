
import { v4 as uuidv4 } from 'uuid';

// URL de base de l'API
const API_URL = 'http://localhost:8090';
const RAG_API_URL = 'http://localhost:8091'; // URL du service RAG

// Nous utilisons un ID de session unique pour suivre la conversation
let SESSION_ID = localStorage.getItem('chat_session_id');
if (!SESSION_ID) {
  SESSION_ID = uuidv4();
  localStorage.setItem('chat_session_id', SESSION_ID);
}

export interface ChatResponse {
  humanized: string | null;
  answer: string;
  sources?: Array<{
    fichier: string;
    pertinence: number;
    est_image?: boolean;
  }>;
  peut_repondre?: boolean;
  files_used?: string[]; // Ajout des fichiers utilisés par RAG
}

/**
 * Envoie un message au serveur et obtient une réponse
 * @param message Le message de l'utilisateur à envoyer
 */
export const sendMessage = async (message: string): Promise<ChatResponse> => {
  try {
    // Utiliser l'API RAG pour la recherche contextuelle
    const response = await fetch(`${RAG_API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: SESSION_ID,
        question: message,
        knowledge_base: 'backend/transcripts', // Utiliser le dossier de transcriptions
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur réseau: ${response.status}`);
    }

    const data = await response.json();
    
    // Adapter le format de réponse RAG au format attendu par le frontend
    return {
      humanized: null, // Le backend RAG n'utilise pas de réponse humanisée
      answer: data.answer,
      files_used: data.files_used,
    };
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    toast({
      title: "Erreur de connexion au backend RAG",
      description: "Impossible d'obtenir une réponse du système RAG. Vérifiez que le serveur est en cours d'exécution.",
      variant: "destructive"
    });
    // En cas d'erreur, fournir une réponse par défaut
    return {
      humanized: null,
      answer: "Je suis désolé, je rencontre un problème technique pour accéder à ma base de connaissances. L'équipe technique a été alertée.",
    };
  }
};

/**
 * Efface l'historique de conversation côté serveur
 */
export const clearConversation = async (): Promise<void> => {
  try {
    // Générer un nouvel ID de session pour effacer l'historique
    SESSION_ID = uuidv4();
    localStorage.setItem('chat_session_id', SESSION_ID);
    
    // Pas besoin d'appeler une API spécifique, le nouveau session_id suffit
    console.log("Session réinitialisée avec un nouvel ID:", SESSION_ID);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la conversation:', error);
    throw error;
  }
};

// Import toast pour les notifications d'erreur
import { toast } from "@/hooks/use-toast";
