"""Module pour analyser les questions récentes et générer les tendances."""
import logging
from typing import List, Dict
import json
from collections import Counter

from database import get_questions_from_today, save_trending_questions, get_trending_questions
from rag import get_chat_completion
from config import MINISTRAL_URL

# Configurer le logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Liste des applications qui peuvent être concernées par les questions
APPLICATIONS = [
    "Webex", "CICsSAM", "SAMnet", "Phonebook", "MyParking", "Triskell", 
    "LotusNotes", "MS365", "Horaire Mobile", "SAS", "Artis", "Argos", 
    "MyPortal", "DSKNet", "Gesper", "MyGesper"
]

def analyze_and_update_trending_questions(limit: int = 5, source: str = 'all') -> List[Dict]:
    """Analyser les questions d'aujourd'hui et mettre à jour les tendances.
    
    Cette fonction filtre les questions par source (user, admin, ou all) avant l'analyse.
    Cela permet à l'interface utilisateur et à l'interface admin d'afficher des questions
    tendances distinctes et pertinentes pour chaque contexte.
    
    Args:
        limit: Nombre maximum de questions tendances à générer
        source: Source des questions ('user', 'admin' ou 'all')
        
    Returns:
        Liste des questions tendances
    """
    # Récupérer les questions d'aujourd'hui avec la source spécifiée
    questions = get_questions_from_today(source)
    
    if not questions:
        logger.info(f"Aucune question trouvée pour aujourd'hui (source: {source})")
        return []
    
    # Extraire juste le contenu des questions
    question_contents = [q['content'] for q in questions]
    
    logger.info(f"Analyse de {len(question_contents)} questions de source '{source}'")
    
    # Analyser les questions avec un LLM pour les regrouper
    grouped_questions = group_similar_questions(question_contents)
    
    if not grouped_questions:
        logger.warning("Échec du regroupement des questions")
        return []
    
    # Sauvegarder les questions tendances dans la base de données avec la source
    success = save_trending_questions(grouped_questions, source)
    
    if not success:
        logger.error("Échec de l'enregistrement des questions tendances")
    
    # Récupérer les questions tendances mises à jour
    return get_trending_questions(limit, source)

def group_similar_questions(questions: List[str]) -> List[Dict]:
    """Regrouper les questions similaires à l'aide d'un LLM.
    
    Args:
        questions: Liste des questions à analyser
        
    Returns:
        Liste des questions regroupées avec leur nombre d'occurrences
    """
    if not questions:
        return []
    
    try:
        # Formater les questions pour le prompt
        formatted_questions = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])
        
        # Construire la liste des applications pour le prompt
        applications_list = ", ".join(APPLICATIONS)
        
        # Construire le prompt pour le LLM
        prompt = f"""
        Tu es un assistant spécialisé dans l'analyse des questions d'utilisateurs.
        
        Voici une liste de questions posées aujourd'hui:
        {formatted_questions}
        
        Ta tâche est de:
        1. Analyser ces questions
        2. Identifier les questions qui portent sur des sujets similaires ou identiques
        3. Regrouper ces questions et formuler une question générique qui représente bien chaque groupe
        4. Compter le nombre de questions dans chaque groupe
        5. Déterminer si chaque groupe de questions concerne une application parmi la liste suivante: {applications_list}
        
        Réponds UNIQUEMENT au format JSON comme suit:
        [
            {{
                "question": "Question générique reformulée",
                "count": nombre_d'occurrences,
                "application": "Nom de l'application concernée ou null si aucune"
            }},
            ...
        ]
        
        Ordonne les résultats par nombre d'occurrences décroissant (les plus fréquentes d'abord).
        Limite-toi aux 10 groupes les plus fréquents maximum.
        Si une question est unique et n'appartient à aucun groupe, tu peux la garder telle quelle avec count: 1.
        
        Pour le champ "application":
        - Identifie si la question concerne précisément une des applications de la liste fournie
        - Si oui, écris le nom exact de l'application concernée tel qu'il apparaît dans la liste
        - Si la question ne concerne aucune application spécifique ou si l'application n'est pas dans la liste, écris null
        - Ne tente pas de deviner une application si elle n'est pas clairement mentionnée ou sous-entendue
        """
        
        # Préparer les messages pour le LLM
        messages = [
            {"role": "system", "content": "Tu es un assistant spécialisé dans l'analyse de données textuelles."},
            {"role": "user", "content": prompt}
        ]
        
        # Obtenir la réponse du LLM, en utilisant ministral_path 
        # Correction de l'appel pour correspondre à la signature de la fonction
        response = get_chat_completion(
            model_name="ministral",  # Remplace "model" par "model_name"
            messages=messages,
            max_tokens=2000,
            api_url=MINISTRAL_URL  # Utiliser l'API URL de ministral
        )
        
        if not response or 'choices' not in response:
            logger.error("Pas de réponse valide du LLM")
            return []
        
        # Extraire le contenu de la réponse
        content = response['choices'][0]['message']['content']
        
        # Extraire le JSON de la réponse (au cas où il y aurait du texte autour)
        json_content = extract_json_from_string(content)
        
        if not json_content:
            logger.error(f"Impossible d'extraire du JSON de la réponse: {content}")
            return []
        
        # Parser le JSON
        try:
            results = json.loads(json_content)
            logger.info(f"Questions regroupées: {results}")
            return results
        except json.JSONDecodeError as e:
            logger.error(f"Erreur lors du parsing JSON: {e}, contenu: {json_content}")
            return []
            
    except Exception as e:
        logger.error(f"Erreur lors du regroupement des questions: {e}")
        return []

def extract_json_from_string(text: str) -> str:
    """Extraire le contenu JSON d'une chaîne de caractères.
    
    Args:
        text: Texte contenant potentiellement du JSON
        
    Returns:
        Contenu JSON extrait ou chaîne vide si non trouvé
    """
    try:
        # Chercher les crochets ouvrants et fermants pour délimiter le JSON
        start_idx = text.find('[')
        end_idx = text.rfind(']') + 1
        
        if start_idx == -1 or end_idx == 0:
            # Essayer avec les accolades si les crochets ne sont pas trouvés
            start_idx = text.find('{')
            end_idx = text.rfind('}') + 1
        
        if start_idx != -1 and end_idx != 0:
            return text[start_idx:end_idx]
        return ""
    except Exception as e:
        logger.error(f"Erreur lors de l'extraction du JSON: {e}")
        return ""

def get_simple_trending_questions(questions: List[str], limit: int = 5) -> List[Dict]:
    """Méthode alternative simple pour trouver les questions tendances sans LLM.
    
    Utilisée comme fallback en cas d'erreur avec le LLM.
    
    Args:
        questions: Liste des questions à analyser
        limit: Nombre maximum de questions tendances à retourner
        
    Returns:
        Liste des questions les plus fréquentes
    """
    # Compter les occurrences de chaque question
    counter = Counter(questions)
    
    # Convertir en format attendu
    results = [{"question": q, "count": c} for q, c in counter.most_common(limit)]
    
    return results 