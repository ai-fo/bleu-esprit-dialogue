import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";

// Créer un ID de session unique pour chaque utilisateur
export const SESSION_ID = uuidv4();

// URL de base du backend
const BASE_URL = 'http://servicedeskbot.lefoyer.lu:8081/';

// Interface pour les questions tendances
export interface TrendingQuestion {
  question: string;
  count: number;
  source?: string;
  application?: string;
}

// Interface pour les statistiques du chatbot
export interface ChatbotStats {
  daily_messages: number;
  weekly_messages: number;
  total_messages: number;
  current_sessions: number;
}

// Interface pour les statistiques des applications
export interface ApplicationStat {
  id: string;
  name: string;
  incident_count: number;
  user_count: number;
  status: string;
  last_updated?: Date;
}

// Interface pour les incidents horaires
export interface HourlyIncident {
  hour: string;
  incidents: number;
}

// Interface pour les incidents
export interface Incident {
  id: string;
  application: string;
  status: string;
  description: string;
  date: Date;
}

// Interface pour le feedback
export interface FeedbackData {
  message_id: number;
  rating: number;
  comment?: string;
}

// Fonction pour envoyer un message au backend
export async function sendMessage(content: string, source: string = 'user'): Promise<any> {
  try {
    const response = await axios.post(`${BASE_URL}/chat`, {
      question: content,
      knowledge_base: 'default',
      session_id: SESSION_ID,
      source: source
    });
    return response.data;
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    throw error;
  }
}

// Fonction pour envoyer un feedback
export async function sendFeedback(data: FeedbackData): Promise<any> {
  try {
    const response = await axios.post(`${BASE_URL}/feedback`, {
      message_id: data.message_id,
      rating: data.rating,
      comment: data.comment || '',
      session_id: SESSION_ID
    });
    return response.data;
  } catch (error) {
    console.error('Erreur lors de l\'envoi du feedback:', error);
    throw error;
  }
}

// Fonction pour effacer la conversation actuelle
export async function clearConversation(): Promise<any> {
  try {
    const response = await axios.post(`${BASE_URL}/clear_history`, {
      session_id: SESSION_ID
    });
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la conversation:', error);
    throw error;
  }
}

// Fonction pour récupérer les questions les plus posées
export async function getTrendingQuestions(
  limit: number = 4,  // Mis à jour de 3 à 4
  forceUpdate: boolean = false,
  source: string = 'user'
): Promise<TrendingQuestion[]> {
  try {
    const response = await axios.get(`${BASE_URL}/trending_questions`, {
      params: {
        limit,
        force_update: forceUpdate,
        source
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des questions tendances:', error);
    return [];
  }
}

// Fonction pour récupérer les statistiques du chatbot
export async function getChatbotStats(): Promise<ChatbotStats> {
  try {
    const response = await axios.get(`${BASE_URL}/chatbot_stats`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du chatbot:', error);
    return {
      daily_messages: 0,
      weekly_messages: 0,
      total_messages: 0,
      current_sessions: 0
    };
  }
}

// Fonction pour récupérer les statistiques des applications
export async function getApplicationStats(): Promise<ApplicationStat[]> {
  try {
    const response = await axios.get(`${BASE_URL}/application_stats`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques des applications:', error);
    return [];
  }
}

// Fonction pour récupérer la volumétrie des incidents par heure
export async function getHourlyIncidents(): Promise<HourlyIncident[]> {
  try {
    const response = await axios.get(`${BASE_URL}/hourly_incidents`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération de la volumétrie des incidents:', error);
    return [];
  }
}

// Fonction pour initialiser la base de données
export async function initDatabase(): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/init_db`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
}
