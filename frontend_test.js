// Script pour tester la communication avec le backend
async function testBackendConnection() {
  // Configuration
  const API_URL = 'http://localhost:8091';
  const SESSION_ID = 'test-session-' + Date.now();
  
  console.log('Test de connexion au backend:', API_URL);
  
  try {
    // Test de l'endpoint /chat
    console.log('Test de l\'endpoint /chat...');
    const chatPayload = {
      session_id: SESSION_ID,
      question: "Ceci est un test de connexion",
      knowledge_base: "transcripts",
      model: "Mistral-Large-Instruct-2407-AWQ"
    };
    
    console.log('Envoi de la requête:', chatPayload);
    
    const chatResponse = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatPayload),
    });
    
    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('Erreur de connexion à /chat:', {
        status: chatResponse.status,
        statusText: chatResponse.statusText,
        body: errorText
      });
      return false;
    }
    
    const chatData = await chatResponse.json();
    console.log('Réponse reçue de /chat:', chatData);
    
    // Test de l'endpoint /clear_history
    console.log('Test de l\'endpoint /clear_history...');
    const clearPayload = {
      session_id: SESSION_ID
    };
    
    const clearResponse = await fetch(`${API_URL}/clear_history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clearPayload),
    });
    
    if (!clearResponse.ok) {
      const errorText = await clearResponse.text();
      console.error('Erreur de connexion à /clear_history:', {
        status: clearResponse.status,
        statusText: clearResponse.statusText,
        body: errorText
      });
      return false;
    }
    
    const clearData = await clearResponse.json();
    console.log('Réponse reçue de /clear_history:', clearData);
    
    console.log('Tests réussis! Le backend est accessible et répond correctement.');
    return true;
    
  } catch (error) {
    console.error('Erreur lors du test:', error);
    return false;
  }
}

// Pour utiliser ce script :
// 1. Ouvrez la console de votre navigateur
// 2. Copiez et collez ce code
// 3. Exécutez testBackendConnection()
console.log('Pour tester la connexion, exécutez testBackendConnection() dans la console du navigateur.'); 