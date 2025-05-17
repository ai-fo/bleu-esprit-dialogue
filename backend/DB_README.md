# Configuration de la Base de Données PostgreSQL

Ce document explique comment configurer et initialiser la base de données PostgreSQL pour Bleu Esprit Dialogue.

## Prérequis

- PostgreSQL installé sur votre système
- Python 3.8 ou supérieur
- Le package `psycopg2` installé (`pip install psycopg2-binary`)

## Étapes de configuration

### 1. Créer la base de données

```bash
createdb chatbot
```

### 2. Configurer les variables d'environnement

Créez un fichier `.env` dans le dossier `backend/` avec le contenu suivant (adaptez les valeurs selon votre configuration):

```
# Configuration de la base de données
DB_NAME=chatbot
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe
DB_HOST=localhost
DB_PORT=5432

# Configuration de l'API Mistral (optionnel)
MISTRAL_API_KEY=

# Autres configurations
DEFAULT_MODE=local  # "api" ou "local"
```

### 3. Initialiser la base de données

Exécutez le script d'initialisation pour créer les tables:

```bash
cd backend
python init_db.py
```

## Structure de la base de données

La base de données contient plusieurs tables:

1. **sessions**: Stocke les informations sur les sessions de conversation
   - `id`: Identifiant unique auto-incrémenté
   - `session_id`: Identifiant de session (chaîne de caractères unique)
   - `created_at`: Date de création
   - `last_activity`: Date de dernière activité

2. **messages**: Stocke tous les messages échangés
   - `id`: Identifiant unique auto-incrémenté
   - `session_id`: Référence à la session
   - `role`: Rôle (user/assistant)
   - `content`: Contenu du message
   - `timestamp`: Horodatage

3. **message_parts**: Stocke les parties des messages découpés
   - `id`: Identifiant unique auto-incrémenté
   - `session_id`: Référence à la session
   - `message_id`: Référence au message parent
   - `part_number`: Numéro de la partie
   - `content`: Contenu de la partie
   - `timestamp`: Horodatage

4. **source_files**: Stocke les fichiers sources utilisés pour générer les réponses
   - `id`: Identifiant unique auto-incrémenté
   - `message_id`: Référence au message
   - `filename`: Nom du fichier source
   - `timestamp`: Horodatage

5. **feedbacks**: Stocke les retours utilisateurs sur les réponses
   - `id`: Identifiant unique auto-incrémenté
   - `message_id`: Référence au message évalué
   - `rating`: Note (entier)
   - `comment`: Commentaire (optionnel)
   - `timestamp`: Horodatage

6. **errors**: Stocke les erreurs survenues pendant l'exécution
   - `id`: Identifiant unique auto-incrémenté
   - `session_id`: Référence à la session (optionnel)
   - `error_type`: Type d'erreur
   - `error_message`: Message d'erreur
   - `stack_trace`: Trace d'erreur complète (optionnel)
   - `timestamp`: Horodatage

## Endpoints API pour la base de données

- `/chat` - Enregistre automatiquement les questions et réponses
- `/feedback` - Permet d'enregistrer les feedbacks utilisateurs sur les réponses
- `/clear_history` - Efface l'historique de conversation en mémoire (pas dans la base de données)

## Dépannage

Si vous rencontrez des problèmes de connexion à la base de données:

1. Vérifiez que PostgreSQL est bien en cours d'exécution
2. Vérifiez les informations de connexion dans le fichier `.env`
3. Assurez-vous que l'utilisateur PostgreSQL a les permissions nécessaires
4. Consultez les logs de l'application pour plus de détails 