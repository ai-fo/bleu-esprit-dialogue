"""Script pour tester la base de données et diagnostiquer les problèmes de statistiques."""
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from dotenv import load_dotenv
import logging

# Configurer le logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Charger les variables d'environnement
load_dotenv()

# Configuration de la base de données
DB_NAME = os.getenv("DB_NAME", "chatbot")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

def get_connection():
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

def check_tables():
    """Vérifier si les tables existent et contiennent des données."""
    conn = get_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Lister toutes les tables
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            tables = [row['table_name'] for row in cur.fetchall()]
            logger.info(f"Tables trouvées: {tables}")
            
            # Vérifier chaque table
            for table in tables:
                cur.execute(f"SELECT COUNT(*) as count FROM {table}")
                count = cur.fetchone()['count']
                logger.info(f"Table {table} contient {count} enregistrements")
                
                # Pour les tables les plus importantes, lister quelques exemples
                if table in ['messages', 'sessions'] and count > 0:
                    cur.execute(f"SELECT * FROM {table} LIMIT 3")
                    rows = cur.fetchall()
                    for i, row in enumerate(rows):
                        logger.info(f"Exemple {i+1} de {table}: {row}")
    except Exception as e:
        logger.error(f"Erreur lors de la vérification des tables: {e}")
    finally:
        conn.close()

def test_stats_queries():
    """Tester les requêtes utilisées pour les statistiques."""
    conn = get_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Vérifier la structure de la table messages
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'messages'
            """)
            columns = cur.fetchall()
            logger.info("Structure de la table messages:")
            for col in columns:
                logger.info(f"  {col['column_name']} - {col['data_type']}")
            
            # Test 1: Compter tous les messages
            cur.execute("SELECT COUNT(*) as count FROM messages")
            total = cur.fetchone()['count']
            logger.info(f"Total des messages: {total}")
            
            # Test 2: Compter les messages par rôle
            cur.execute("SELECT role, COUNT(*) as count FROM messages GROUP BY role")
            roles = cur.fetchall()
            for role in roles:
                logger.info(f"Messages avec rôle '{role['role']}': {role['count']}")
            
            # Test 3: Vérifier les timestamps
            cur.execute("SELECT MIN(timestamp) as min_date, MAX(timestamp) as max_date FROM messages")
            dates = cur.fetchone()
            logger.info(f"Date du premier message: {dates['min_date']}")
            logger.info(f"Date du dernier message: {dates['max_date']}")
            
            # Test 4: Compter les messages d'aujourd'hui
            today = datetime.now().strftime("%Y-%m-%d")
            cur.execute(
                "SELECT COUNT(*) as count FROM messages WHERE DATE(timestamp) = %s",
                (today,)
            )
            today_count = cur.fetchone()['count']
            logger.info(f"Messages d'aujourd'hui ({today}): {today_count}")
            
            # Test 5: Compter les messages d'aujourd'hui (rôle assistant)
            cur.execute(
                """
                SELECT COUNT(*) as count 
                FROM messages 
                WHERE role = 'assistant' 
                AND DATE(timestamp) = CURRENT_DATE
                """
            )
            daily_result = cur.fetchone()['count']
            logger.info(f"Messages assistant d'aujourd'hui: {daily_result}")
            
            # Test 6: Si aucun message aujourd'hui, essayer avec CURRENT_DATE - 1 
            if today_count == 0:
                cur.execute(
                    "SELECT COUNT(*) as count FROM messages WHERE DATE(timestamp) = CURRENT_DATE - INTERVAL '1 day'"
                )
                yesterday_count = cur.fetchone()['count']
                logger.info(f"Messages d'hier: {yesterday_count}")
                
                # Vérifier si le problème est lié au fuseau horaire
                cur.execute("SHOW timezone")
                timezone = cur.fetchone()['timezone']
                logger.info(f"Fuseau horaire de la base de données: {timezone}")
                
                # Lister les 5 derniers messages avec leur timestamp
                cur.execute("SELECT id, role, timestamp FROM messages ORDER BY timestamp DESC LIMIT 5")
                recent = cur.fetchall()
                logger.info("5 derniers messages:")
                for msg in recent:
                    logger.info(f"  ID: {msg['id']}, Rôle: {msg['role']}, Timestamp: {msg['timestamp']}")
                
                # Comparer avec la fonction DATE
                cur.execute("SELECT CURRENT_DATE as today, NOW() as now")
                date_info = cur.fetchone()
                logger.info(f"CURRENT_DATE: {date_info['today']}, NOW(): {date_info['now']}")
                
                # Tester une requête alternative avec NOW() et CAST
                cur.execute(
                    """
                    SELECT COUNT(*) as count 
                    FROM messages 
                    WHERE DATE(timestamp) = DATE(NOW())
                    """
                )
                alt_today = cur.fetchone()['count']
                logger.info(f"Messages d'aujourd'hui (alternative): {alt_today}")
    except Exception as e:
        logger.error(f"Erreur lors des tests de requêtes: {e}")
    finally:
        conn.close()

def insert_test_data():
    """Insérer des données de test pour vérifier les statistiques."""
    conn = get_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Vérifier si une session de test existe déjà
            test_session_id = "test_session_" + datetime.now().strftime("%Y%m%d%H%M%S")
            
            # Créer une session de test
            cur.execute(
                "INSERT INTO sessions (session_id, source) VALUES (%s, %s)",
                (test_session_id, 'user')
            )
            
            # Insérer un message utilisateur
            cur.execute(
                "INSERT INTO messages (session_id, role, content, source) VALUES (%s, %s, %s, %s)",
                (test_session_id, 'user', 'Question de test pour statistiques', 'user')
            )
            
            # Insérer une réponse assistant
            cur.execute(
                "INSERT INTO messages (session_id, role, content, source) VALUES (%s, %s, %s, %s)",
                (test_session_id, 'assistant', 'Réponse de test pour statistiques', 'user')
            )
            
            conn.commit()
            logger.info(f"Données de test insérées avec succès (session {test_session_id})")
            
            # Vérifier immédiatement le comptage
            cur.execute(
                """
                SELECT COUNT(*) as count 
                FROM messages 
                WHERE role = 'assistant' 
                AND DATE(timestamp) = CURRENT_DATE
                """
            )
            count_after = cur.fetchone()['count']
            logger.info(f"Messages assistant d'aujourd'hui après insertion: {count_after}")
    except Exception as e:
        conn.rollback()
        logger.error(f"Erreur lors de l'insertion des données de test: {e}")
    finally:
        conn.close()

def fix_timezone():
    """Corriger le fuseau horaire de la base de données si nécessaire."""
    conn = get_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Vérifier le fuseau horaire actuel
            cur.execute("SHOW timezone")
            current_tz = cur.fetchone()['timezone']
            logger.info(f"Fuseau horaire actuel: {current_tz}")
            
            # Définir le fuseau horaire à une valeur standard
            cur.execute("SET timezone = 'Europe/Paris'")
            conn.commit()
            
            # Vérifier que le changement a été appliqué
            cur.execute("SHOW timezone")
            new_tz = cur.fetchone()['timezone']
            logger.info(f"Nouveau fuseau horaire: {new_tz}")
            
            # Afficher l'heure actuelle selon la base de données
            cur.execute("SELECT NOW() as now, CURRENT_DATE as today")
            time_info = cur.fetchone()
            logger.info(f"Heure selon la base de données: {time_info['now']}")
            logger.info(f"Date selon la base de données: {time_info['today']}")
    except Exception as e:
        logger.error(f"Erreur lors de la correction du fuseau horaire: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    logger.info("=== DIAGNOSTIC DE LA BASE DE DONNÉES ===")
    
    logger.info("\n--- Vérification des tables ---")
    check_tables()
    
    logger.info("\n--- Test des requêtes de statistiques ---")
    test_stats_queries()
    
    # Si un argument 'insert' est passé, insérer des données de test
    if len(sys.argv) > 1 and sys.argv[1] == 'insert':
        logger.info("\n--- Insertion de données de test ---")
        insert_test_data()
    
    # Si un argument 'fix' est passé, corriger le fuseau horaire
    if len(sys.argv) > 1 and sys.argv[1] == 'fix':
        logger.info("\n--- Correction du fuseau horaire ---")
        fix_timezone()
    
    logger.info("=== FIN DU DIAGNOSTIC ===") 