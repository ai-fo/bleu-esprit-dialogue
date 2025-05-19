import React, { useState, useRef, useEffect } from 'react';
import ChatMessage, { ChatMessageProps } from './ChatMessage';
import ChatInput from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendMessage, getTrendingQuestions, TrendingQuestion } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import { TrendingUp, Headset } from 'lucide-react';
import IncidentStatus, { waitTimeInfo, appIncidents } from './IncidentStatus';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ChatInterfaceProps {
  chatbotName?: string;
  initialMessage?: string;
  onFirstMessage?: () => void;
  trendingQuestions?: string[];
  theme?: 'user' | 'technician';
  trendingQuestionsTitle?: string;
  source?: 'user' | 'admin';  // Source des messages ('user' ou 'admin')
}

const QUESTIONS = ["Quel souci rencontrez-vous ?", "En quoi puis-je vous aider ?", "Qu'est-ce qui ne va pas ?", "Un soucis technique ?"];
const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatbotName = "Bill",
  initialMessage = "Bonjour ! Je suis Bill, votre assistant personnel. Comment puis-je vous aider aujourd'hui ?",
  onFirstMessage,
  trendingQuestions: initialTrendingQuestions = ["Problème avec Artis", "SAS est très lent aujourd'hui", "Impossible d'accéder à mon compte"],
  theme = 'user',
  trendingQuestionsTitle = "Questions les plus posées par les utilisateurs aujourd'hui",
  source = 'user'  // Par défaut, la source est 'user'
}) => {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showTrendingQuestions, setShowTrendingQuestions] = useState(true);  // Modifié pour afficher par défaut
  const [loadingMessage, setLoadingMessage] = useState<ChatMessageProps | null>(null);
  const [trendingQuestions, setTrendingQuestions] = useState<string[]>(initialTrendingQuestions);
  const [loadingTrendingQuestions, setLoadingTrendingQuestions] = useState(false);
  const [trendingQuestionsData, setTrendingQuestionsData] = useState<{ text: string; application?: string }[]>([]);
  const [showTrendingBelowChat, setShowTrendingBelowChat] = useState(true); // État pour afficher les questions sous le chat
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initialLogoRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();
  
  // Theme-based colors
  const colors = {
    user: {
      primary: '#004c92',
      light: '#e6f0ff',
      accent: '#3380cc',
      gradient: 'from-white to-blue-50/80',
      hover: 'from-blue-50 to-blue-100/80',
      groupHover: 'bg-[#004c92]'
    },
    technician: {
      primary: '#F97316', // Changed from green to orange
      light: '#FFF0E0',   // Light orange background
      accent: '#FEC6A1',  // Accent orange
      gradient: 'from-white to-orange-50/80',
      hover: 'from-orange-50 to-orange-100/80',
      groupHover: 'bg-[#F97316]'
    }
  };
  
  const themeColors = colors[theme];
  
  // Charger les questions tendances au démarrage et périodiquement
  useEffect(() => {
    fetchTrendingQuestions();
    
    // Rafraîchir les tendances toutes les 5 minutes
    const interval = setInterval(() => {
      fetchTrendingQuestions();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Fonction pour récupérer les questions tendances
  const fetchTrendingQuestions = async (forceUpdate: boolean = false) => {
    try {
      setLoadingTrendingQuestions(true);
      // Récupérer uniquement les questions tendances correspondant à la source actuelle
      const trendingData = await getTrendingQuestions(3, forceUpdate, source);
      
      if (trendingData && trendingData.length > 0) {
        // Extraire les questions des données avec les applications
        const questionsWithApps = trendingData.map(item => ({
          text: item.question,
          application: item.application
        }));
        
        // Garder la rétrocompatibilité en stockant uniquement le texte des questions
        const questions = questionsWithApps.map(q => q.text);
        
        setTrendingQuestions(questions);
        
        // Stocker les données complètes pour l'affichage
        setTrendingQuestionsData(questionsWithApps);
        
        console.log(`Questions tendances récupérées pour la source '${source}':`, trendingData);
      } else {
        // Si aucune question tendance n'est trouvée, ne pas utiliser les valeurs par défaut
        // et réinitialiser les données
        console.log(`Aucune question tendance trouvée pour la source '${source}'`);
        
        setTrendingQuestionsData([]);
        setTrendingQuestions([]);
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération des questions tendances pour la source '${source}':`, error);
      toast({
        title: "Erreur",
        description: "Impossible de récupérer les questions tendances",
        variant: "destructive",
        duration: 3000
      });
      
      // En cas d'erreur, réinitialiser les valeurs
      setTrendingQuestionsData([]);
      setTrendingQuestions([]);
    } finally {
      setLoadingTrendingQuestions(false);
    }
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuestionIndex(prev => (prev + 1) % QUESTIONS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Add 3D tilt effect for the initial logo
  useEffect(() => {
    const logo = initialLogoRef.current;
    if (!logo) return;

    const handleMouseMove = (e) => {
      const rect = logo.getBoundingClientRect();
      const logoX = rect.left + rect.width / 2;
      const logoY = rect.top + rect.height / 2;
      
      // Calculate mouse position relative to the center of the logo
      const mouseX = e.clientX - logoX;
      const mouseY = e.clientY - logoY;
      
      // Calculate rotation angles (limit the effect to a reasonable range)
      const rotateY = mouseX * 0.05; // Horizontal axis rotation
      const rotateX = -mouseY * 0.05; // Vertical axis rotation (note the negative to make it intuitive)
      
      // Apply the transform with perspective for 3D effect
      logo.style.transform = `perspective(500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    // Reset transform when mouse leaves the window or stops moving
    const handleMouseLeave = () => {
      logo.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg)';
    };

    // Add a debounced reset to initial position when mouse stops moving
    let timeout;
    const handleMouseStop = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        logo.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg)';
      }, 200); // Reset after 200ms of no movement
    };

    window.addEventListener('mousemove', (e) => {
      handleMouseMove(e);
      handleMouseStop();
    });
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timeout);
    };
  }, []);  // No dependencies needed since the effect runs only once

  // Fonction pour capturer la référence de l'input depuis le composant ChatInput
  const setInputRef = (ref: HTMLInputElement | null) => {
    inputRef.current = ref;
  };

  // Fonction pour refocuser l'input
  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Fonction pour scroller automatiquement vers le bas
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  // Fonction pour scroller automatiquement vers le bas
  const handleSendMessage = async (content: string) => {
    setShowTrendingQuestions(false);
    const userMessage: ChatMessageProps = {
      role: 'user',
      content
    };
    setMessages(prev => [...prev, userMessage]);
    if (messages.length === 0 && onFirstMessage) {
      onFirstMessage();
    }
    
    setLoading(true);
    
    // Add loading message with dots animation
    const loadingMsg: ChatMessageProps = {
      role: 'assistant',
      content: '',
      isLoading: true
    };
    setLoadingMessage(loadingMsg);
    
    // Scroll after adding user message and loading indicator
    setTimeout(scrollToBottom, 100);
    
    try {
      const response = await sendMessage(content, source);

      // Remove loading message
      setLoadingMessage(null);
      
      // Vérifier si le message a été décomposé en plusieurs parties
      if (response.message_parts && response.message_parts.length > 1) {
        // Afficher chaque partie du message comme un message distinct
        const messageParts = response.message_parts;
        
        // On ajoute chaque partie du message comme un message séparé avec un délai entre chaque
        const addMessageWithDelay = async (index: number) => {
          if (index >= messageParts.length) return;
          
          // Ajouter cette partie du message
          const partMessage: ChatMessageProps = {
            role: 'assistant',
            // Filtrer le séparateur %%PARTIE%% s'il est présent
            content: messageParts[index].replace(/%%PARTIE%%/g, ''),
            message_id: response.message_id,
            isLastInSequence: index === messageParts.length - 1
          };
          setMessages(prev => [...prev, partMessage]);
          
          // Scroller après chaque partie
          setTimeout(scrollToBottom, 100);
          
          // Ajouter un délai avant la partie suivante pour simuler la frappe
          if (index < messageParts.length - 1) {
            // Afficher un nouvel indicateur de chargement entre les parties
            if (index < messageParts.length - 1) {
              const typingMsg: ChatMessageProps = {
                role: 'assistant',
                content: '',
                isLoading: true
              };
              setLoadingMessage(typingMsg);
              
              // Attendre un moment avant d'afficher la partie suivante
              await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
              
              // Supprimer l'indicateur de chargement
              setLoadingMessage(null);
              
              // Ajouter la partie suivante
              await addMessageWithDelay(index + 1);
            }
          }
        };
        
        // Commencer à ajouter les parties une par une
        await addMessageWithDelay(0);
      } else {
        // Comportement original pour les messages non décomposés
        // Ajouter d'abord la réponse principale sans les documents
        const initialResponse = response.answer.split(/\n\nSi tu veux plus d'informations/)[0].replace(/%%PARTIE%%/g, '');
        const documentPart = response.answer.includes("\n\nSi tu veux plus d'informations") 
          ? "Si tu veux plus d'informations" + response.answer.split(/\n\nSi tu veux plus d'informations/)[1].replace(/%%PARTIE%%/g, '')
          : "";
          
        // Afficher d'abord la réponse principale
        const initialBotResponse: ChatMessageProps = {
          role: 'assistant',
          content: initialResponse,
          message_id: response.message_id
        };
        setMessages(prev => [...prev, initialBotResponse]);
        
        // Scroller après avoir ajouté la réponse principale
        setTimeout(scrollToBottom, 100);
        
        // Si des documents sont mentionnés, les ajouter comme un message séparé
        if (documentPart) {
          // Ajouter un message de chargement pour la recherche de documents
          const docsLoadingMsg: ChatMessageProps = {
            role: 'assistant',
            content: 'Recherche de documents pertinents...',
            isLoading: true
          };
          setMessages(prev => [...prev, docsLoadingMsg]);
          
          // Scroller après avoir ajouté l'indicateur de chargement
          setTimeout(scrollToBottom, 100);
          
          // Attendre un peu pour montrer que le système "cherche" les documents
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Retirer le message de chargement
          setMessages(prev => prev.filter(msg => msg !== docsLoadingMsg));
          
          // Ajouter un nouveau message distinct avec les informations de documents
          const documentMessage: ChatMessageProps = {
            role: 'assistant',
            content: documentPart
          };
          setMessages(prev => [...prev, documentMessage]);
          
          // Scroller après avoir ajouté le message de documents
          setTimeout(scrollToBottom, 100);
        }
      }
      
      // Mettre à jour les questions tendances après chaque conversation
      fetchTrendingQuestions();
    } catch (error) {
      // Remove loading message in case of error
      setLoadingMessage(null);
      
      console.error("Erreur lors de l'envoi du message:", error);
      toast({
        title: "Erreur de connexion",
        description: error instanceof Error ? error.message : "Impossible de se connecter au serveur. Vérifiez que le backend Python est en cours d'exécution.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      // Refocus the input after receiving response
      focusInput();
    }
  };

  // Effet pour scroller automatiquement vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Effet pour scroller automatiquement vers le bas quand un message du bot reçoit de nouvelles parties
  useEffect(() => {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(() => {
        scrollToBottom();
      });
    });
    if (messagesEndRef.current?.parentElement) {
      observer.observe(messagesEndRef.current.parentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    return () => {
      observer.disconnect();
    };
  }, []);
  
  const toggleTrendingQuestions = () => {
    setShowTrendingQuestions(prev => !prev);
  };
  
  const isInitialState = messages.length === 0;
  
  // Rendu du composant TrendingQuestions
  const renderTrendingQuestions = () => {
    // Si aucune question tendance n'est disponible, ne rien afficher
    if (!trendingQuestionsData.length) {
      return null;
    }
    
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className={`h-4 w-4 text-[${themeColors.primary}]`} />
          <h3 className={`font-medium text-[${themeColors.primary}] text-sm`}>{trendingQuestionsTitle}</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {trendingQuestionsData.map((item, index) => (
            <button 
              key={index} 
              onClick={() => {
                handleSendMessage(item.text);
              }} 
              className={`flex items-center text-left p-3 bg-gradient-to-r ${themeColors.gradient} hover:${themeColors.hover} rounded-lg border border-[${themeColors.light}] shadow-sm hover:shadow transition-all duration-200 text-[#333] hover:text-[${themeColors.primary}] text-sm group trending-question delay-${index}`}
            >
              <span className={`w-6 h-6 flex items-center justify-center rounded-full bg-${theme === 'user' ? 'blue' : 'green'}-100 text-[${themeColors.primary}] text-xs mr-3 group-hover:${themeColors.groupHover} group-hover:text-white transition-colors`}>
                {index + 1}
              </span>
              <div className="flex-1">
                <span>{item.text}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="w-full flex flex-col h-full">
      {!isInitialState && (
        <div className="flex-1 overflow-hidden flex flex-col h-full">
          <ScrollArea ref={scrollAreaRef} className="flex-1">
            <div className="flex flex-col py-5 max-w-3xl mx-auto w-full">
              {messages.map((message, index) => (
                <ChatMessage 
                  key={index} 
                  {...message} 
                  onNewChunkDisplayed={scrollToBottom} 
                  theme={theme}
                  isLastInSequence={
                    // C'est le dernier message si:
                    message.role === 'user' || // C'est un message utilisateur
                    index === messages.length - 1 || // C'est le dernier message de la liste
                    messages[index + 1]?.role === 'user' // Le message suivant est de l'utilisateur
                  }
                />
              ))}
              
              {/* Show loading message with animated dots */}
              {loadingMessage && (
                <ChatMessage
                  {...loadingMessage}
                  onNewChunkDisplayed={scrollToBottom}
                  theme={theme}
                />
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Chat input container aligned with messages */}
          <div className="border-t border-gray-100">
            <div className="max-w-3xl mx-auto w-full">
              <div className="py-4">
                <div className="relative w-full rounded-full shadow-sm bg-white border border-gray-200 mx-auto">
                  <ChatInput 
                    onSendMessage={handleSendMessage} 
                    disabled={loading} 
                    getInputRef={setInputRef}
                    theme={theme}
                  />
                </div>
                
                {/* Supprimé l'ancien dropdown pour les questions tendances */}
              </div>
            </div>
          </div>

          {/* Questions fréquentes avec animation fade-in en dessous de la barre de chat */}
          {trendingQuestionsData.length > 0 && (
            <div className="px-4 pb-6 w-full fade-in-section">
              {renderTrendingQuestions()}
            </div>
          )}
        </div>
      )}
      
      {isInitialState && (
        <div className="flex flex-col items-center justify-center h-full px-5 w-full flex-1">
          {/* Conteneur principal avec flexbox pour centrer verticalement */}
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto w-full">
            {/* Logo large au-dessus des questions - Now with 3D tilt effect */}
            <div className="mb-8">
              <img 
                ref={initialLogoRef}
                src="/lovable-uploads/fb0ab2b3-5c02-4037-857a-19b40f122960.png" 
                alt="Hotline Assistant Logo" 
                className="w-32 h-32 object-contain transition-transform duration-200 ease-out" 
              />
            </div>
            
            {/* Questions défilantes */}
            <div className="h-10 overflow-hidden text-center w-full mb-6">
              <p 
                key={currentQuestionIndex} 
                className={`text-[${themeColors.primary}] text-xl font-bold animate-slide-in`}
              >
                {QUESTIONS[currentQuestionIndex]}
              </p>
            </div>
            
            {/* Barre de recherche centrée et élargie */}
            <div className="w-full max-w-xl mx-auto px-4 relative">
              <div className="rounded-full shadow-sm bg-white border border-gray-200">
                <ChatInput 
                  onSendMessage={handleSendMessage} 
                  disabled={loading} 
                  getInputRef={setInputRef}
                  theme={theme}
                />
              </div>
            </div>
            
            {/* Questions fréquentes avec animation fade-in sous la barre de recherche */}
            {trendingQuestionsData.length > 0 && (
              <div className="w-full max-w-xl mx-auto mt-12 px-4 fade-in-section">
                {renderTrendingQuestions()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
