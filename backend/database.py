"""Module de gestion de la base de données PostgreSQL pour l'application Bleu Esprit."""
import os
from datetime import datetime
from typing import List, Dict, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from dotenv import load_dotenv

# Configurer le logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Charger les variables d'environnement
load_dotenv()

# Configuration de la base de données
DB_NAME = os.getenv("DB_NAME", "chatbot")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

def get_db_connection():
    """Établir une connexion à la base de données PostgreSQL."""
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            cursor_factory=RealDictCursor
        )
        logger.info("Connexion à la base de données réussie")
        return conn
    except Exception as e:
        logger.error(f"Erreur de connexion à la base de données: {e}")
        return None

def create_tables():
    """Créer les tables nécessaires dans la base de données."""
    conn = get_db_connection()
    if not conn:
        logger.error("Impossible de créer les tables: pas de connexion à la base de données")
        return False

    try:
        with conn.cursor() as cur:
            # Table des sessions
            cur.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                source VARCHAR(50) DEFAULT 'user'  -- 'user' ou 'admin' pour indiquer l'origine
            );
            """)

            # Table des messages
            cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                source VARCHAR(50) DEFAULT 'user',  -- 'user' ou 'admin' pour indiquer l'origine
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            );
            """)

            # Table des parties de message (pour les réponses divisées)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS message_parts (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                message_id INTEGER NOT NULL,
                part_number INTEGER NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
            );
            """)

            # Table des fichiers sources utilisés pour les réponses
            cur.execute("""
            CREATE TABLE IF NOT EXISTS source_files (
                id SERIAL PRIMARY KEY,
                message_id INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
            );
            """)

            # Table des feedbacks
            cur.execute("""
            CREATE TABLE IF NOT EXISTS feedbacks (
                id SERIAL PRIMARY KEY,
                message_id INTEGER NOT NULL,
                rating INTEGER NOT NULL,
                comment TEXT,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
            );
            """)

            # Table des erreurs
            cur.execute("""
            CREATE TABLE IF NOT EXISTS errors (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255),
                error_type VARCHAR(100) NOT NULL,
                error_message TEXT NOT NULL,
                stack_trace TEXT,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            );
            """)

            # Table des questions tendances
            cur.execute("""
            CREATE TABLE IF NOT EXISTS trending_questions (
                id SERIAL PRIMARY KEY,
                question TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 1,
                source VARCHAR(50) DEFAULT 'all',  -- 'user', 'admin', ou 'all' pour indiquer l'origine
                application VARCHAR(100) DEFAULT NULL,  -- Nom de l'application concernée, NULL si aucune
                last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """)

            conn.commit()
            logger.info("Tables créées avec succès")
            return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erreur lors de la création des tables: {e}")
        return False
    finally:
        conn.close()

def save_session(session_id: str, source: str = 'user') -> bool:
    """Enregistrer ou mettre à jour une session.
    
    Args:
        session_id: Identifiant unique de la session
        source: Source de la session ('user' ou 'admin')
        
    Returns:
        True si l'opération a réussi, False sinon
    """
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            # Vérifier si la session existe déjà
            cur.execute("SELECT id FROM sessions WHERE session_id = %s", (session_id,))
            result = cur.fetchone()
            
            if result:
                # Mettre à jour la date de dernière activité
                cur.execute(
                    "UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = %s",
                    (session_id,)
                )
            else:
                # Créer une nouvelle session avec la source spécifiée
                cur.execute(
                    "INSERT INTO sessions (session_id, source) VALUES (%s, %s)",
                    (session_id, source)
                )
            
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erreur lors de l'enregistrement de la session: {e}")
        return False
    finally:
        conn.close()

def save_message(session_id: str, role: str, content: str, message_parts: List[str] = None, files_used: List[str] = None, source: str = 'user') -> int:
    """Enregistrer un message et ses composants dans la base de données.
    
    Args:
        session_id: Identifiant de la session
        role: Rôle du message ('user' ou 'assistant')
        content: Contenu du message
        message_parts: Liste des parties du message (pour les réponses longues)
        files_used: Liste des fichiers utilisés pour la réponse
        source: Source du message ('user' ou 'admin')
        
    Returns:
        ID du message créé, -1 en cas d'erreur
    """
    conn = get_db_connection()
    if not conn:
        return -1

    try:
        # S'assurer que la session existe avec la même source
        save_session(session_id, source)
        
        with conn.cursor() as cur:
            # Enregistrer le message principal avec la source
            cur.execute(
                "INSERT INTO messages (session_id, role, content, source) VALUES (%s, %s, %s, %s) RETURNING id",
                (session_id, role, content, source)
            )
            message_id = cur.fetchone()['id']
            
            # Enregistrer les parties du message si fournies
            if message_parts and role == "assistant":
                for i, part in enumerate(message_parts):
                    cur.execute(
                        "INSERT INTO message_parts (session_id, message_id, part_number, content) VALUES (%s, %s, %s, %s)",
                        (session_id, message_id, i+1, part)
                    )
            
            # Enregistrer les fichiers sources si fournis
            if files_used and role == "assistant":
                for file in files_used:
                    # Extraire le nom du fichier du chemin complet
                    filename = file.split('/')[-1]
                    cur.execute(
                        "INSERT INTO source_files (message_id, filename) VALUES (%s, %s)",
                        (message_id, filename)
                    )
            
            conn.commit()
            return message_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Erreur lors de l'enregistrement du message: {e}")
        return -1
    finally:
        conn.close()

def save_feedback(message_id: int, rating: int, comment: str = None) -> bool:
    """Enregistrer un feedback pour un message."""
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO feedbacks (message_id, rating, comment) VALUES (%s, %s, %s)",
                (message_id, rating, comment)
            )
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erreur lors de l'enregistrement du feedback: {e}")
        return False
    finally:
        conn.close()

def save_error(error_type: str, error_message: str, session_id: str = None, stack_trace: str = None) -> bool:
    """Enregistrer une erreur dans la base de données."""
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO errors (session_id, error_type, error_message, stack_trace) VALUES (%s, %s, %s, %s)",
                (session_id, error_type, error_message, stack_trace)
            )
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erreur lors de l'enregistrement de l'erreur: {e}")
        return False
    finally:
        conn.close()

def get_recent_questions(limit: int = 50) -> List[Dict]:
    """Récupérer les questions récentes des utilisateurs.
    
    Args:
        limit: Nombre maximum de questions à récupérer
        
    Returns:
        Liste de dictionnaires contenant les questions récentes
    """
    conn = get_db_connection()
    if not conn:
        return []

    try:
        with conn.cursor() as cur:
            # Récupérer les questions récentes (messages des utilisateurs)
            # Ordonner par timestamp décroissant pour avoir les plus récentes en premier
            cur.execute(
                """
                SELECT id, session_id, content, timestamp 
                FROM messages 
                WHERE role = 'user' 
                ORDER BY timestamp DESC 
                LIMIT %s
                """,
                (limit,)
            )
            questions = cur.fetchall()
            return list(questions)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des questions récentes: {e}")
        return []
    finally:
        conn.close()

def get_questions_from_today(source: str = 'all') -> List[Dict]:
    """Récupérer les questions posées aujourd'hui.
    
    Args:
        source: Source des questions ('user', 'admin' ou 'all')
        
    Returns:
        Liste de dictionnaires contenant les questions d'aujourd'hui
    """
    conn = get_db_connection()
    if not conn:
        return []

    try:
        with conn.cursor() as cur:
            # Récupérer les questions d'aujourd'hui
            today = datetime.now().strftime("%Y-%m-%d")
            
            # Requête SQL avec ou sans filtre de source
            if source == 'all':
                cur.execute(
                    """
                    SELECT id, session_id, content, source, timestamp 
                    FROM messages 
                    WHERE role = 'user' 
                      AND DATE(timestamp) = %s
                    ORDER BY timestamp DESC
                    """,
                    (today,)
                )
            else:
                cur.execute(
                    """
                    SELECT id, session_id, content, source, timestamp 
                    FROM messages 
                    WHERE role = 'user' 
                      AND DATE(timestamp) = %s
                      AND source = %s
                    ORDER BY timestamp DESC
                    """,
                    (today, source)
                )
            
            questions = cur.fetchall()
            return list(questions)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des questions d'aujourd'hui: {e}")
        return []
    finally:
        conn.close()

def save_trending_questions(questions: List[Dict], source: str = 'all') -> bool:
    """Enregistrer ou mettre à jour les questions tendances.
    
    Args:
        questions: Liste de dictionnaires avec 'question', 'count' et optionnellement 'application'
        source: Source des questions ('user', 'admin' ou 'all')
        
    Returns:
        True si l'opération a réussi, False sinon
    """
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            # Effacer les anciennes tendances de la même source
            cur.execute("DELETE FROM trending_questions WHERE source = %s", (source,))
            
            # Insérer les nouvelles tendances avec la source et l'application
            for q in questions:
                application = q.get('application', None)
                cur.execute(
                    "INSERT INTO trending_questions (question, count, source, application) VALUES (%s, %s, %s, %s)",
                    (q['question'], q['count'], source, application)
                )
            
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erreur lors de l'enregistrement des questions tendances: {e}")
        return False
    finally:
        conn.close()

def get_trending_questions(limit: int = 5, source: str = 'all') -> List[Dict]:
    """Récupérer les questions tendances.
    
    Args:
        limit: Nombre maximum de questions à récupérer
        source: Source des questions ('user', 'admin' ou 'all')
        
    Returns:
        Liste de dictionnaires contenant les questions tendances
    """
    conn = get_db_connection()
    if not conn:
        return []

    try:
        with conn.cursor() as cur:
            # Si source est 'all', récupérer toutes les questions tendances
            # Sinon, filtrer par source
            if source == 'all':
                cur.execute(
                    """
                    SELECT question, count, source, application, last_updated
                    FROM trending_questions
                    ORDER BY count DESC, last_updated DESC
                    LIMIT %s
                    """,
                    (limit,)
                )
            else:
                cur.execute(
                    """
                    SELECT question, count, source, application, last_updated
                    FROM trending_questions
                    WHERE source = %s
                    ORDER BY count DESC, last_updated DESC
                    LIMIT %s
                    """,
                    (source, limit)
                )
            questions = cur.fetchall()
            return list(questions)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des questions tendances: {e}")
        return []
    finally:
        conn.close()

if __name__ == "__main__":
    # Si ce script est exécuté directement, créer les tables
    print("Création des tables de la base de données...")
    success = create_tables()
    if success:
        print("Tables créées avec succès!")
    else:
        print("Échec de la création des tables.") 