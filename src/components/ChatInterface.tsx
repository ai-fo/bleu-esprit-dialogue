
import React, { useState, useRef, useEffect } from 'react';
import ChatMessage, { ChatMessageProps } from './ChatMessage';
import ChatInput from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendMessage } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import { TrendingUp, Headset } from 'lucide-react';
import IncidentStatus, { waitTimeInfo, appIncidents } from './IncidentStatus';
import { Card } from '@/components/ui/card';

interface ChatInterfaceProps {
  chatbotName?: string;
  initialMessage?: string;
  onFirstMessage?: () => void;
  trendingQuestions?: string[];
  theme?: 'user' | 'technician';
  trendingQuestionsTitle?: string;
}

const QUESTIONS = ["Quel souci rencontrez-vous ?", "En quoi puis-je vous aider ?", "Qu'est-ce qui ne va pas ?", "Un soucis technique ?"];
const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatbotName = "Bill",
  initialMessage = "Bonjour ! Je suis Bill, votre assistant personnel. Comment puis-je vous aider aujourd'hui ?",
  onFirstMessage,
  trendingQuestions = ["Problème avec Artis", "SAS est très lent aujourd'hui", "Impossible d'accéder à mon compte"],
  theme = 'user',
  trendingQuestionsTitle = "Questions tendance aujourd'hui"
}) => {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showTrendingQuestions, setShowTrendingQuestions] = useState(false);
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
    try {
      // Scroll après l'ajout du message utilisateur
      setTimeout(scrollToBottom, 100);
      const response = await sendMessage(content);

      // Ajouter la réponse du bot
      const botResponse: ChatMessageProps = {
        role: 'assistant',
        content: response.answer
      };
      setMessages(prev => [...prev, botResponse]);
      // Scroll après l'ajout de la réponse du bot
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      toast({
        title: "Erreur de connexion",
        description: error instanceof Error ? error.message : "Impossible de se connecter au serveur. Vérifiez que le backend Python est en cours d'exécution.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      // Refocuser l'input après réception de la réponse
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
                />
              ))}
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
                    onTrendingClick={toggleTrendingQuestions} 
                    showTrendingIcon={true} 
                    theme={theme}
                  />
                </div>
                
                {/* Trending Questions Dropdown for conversation mode */}
                {showTrendingQuestions && (
                  <div className="absolute bottom-full mb-3 w-full max-w-3xl bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10">
                    <div className="flex items-center gap-2 p-3 border-b border-gray-100">
                      <TrendingUp className={`h-5 w-5 text-[${themeColors.primary}]`} />
                      <h3 className={`font-medium text-[${themeColors.primary}] text-sm`}>{trendingQuestionsTitle}</h3>
                    </div>
                    <div className="p-3">
                      {trendingQuestions.map((question, index) => (
                        <button 
                          key={index} 
                          onClick={() => {
                            handleSendMessage(question);
                            setShowTrendingQuestions(false);
                          }} 
                          className={`w-full flex items-center text-left p-3 bg-gradient-to-r ${themeColors.gradient} hover:${themeColors.hover} rounded-lg my-1.5 border border-[${themeColors.light}] shadow-sm hover:shadow transition-all duration-200 text-[#333] hover:text-[${themeColors.primary}] text-sm group`}
                        >
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full bg-${theme === 'user' ? 'blue' : 'green'}-100 text-[${themeColors.primary}] text-xs mr-3 group-hover:${themeColors.groupHover} group-hover:text-white transition-colors`}>
                            {index + 1}
                          </span>
                          <span className="flex-1">{question}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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
                  onTrendingClick={toggleTrendingQuestions} 
                  showTrendingIcon={true} 
                  theme={theme}
                />
              </div>
              
              {/* Trending Questions Dropdown */}
              {showTrendingQuestions && (
                <div className="absolute z-10 mt-3 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 p-3 border-b border-gray-100">
                    <TrendingUp className={`h-5 w-5 text-[${themeColors.primary}]`} />
                    <h3 className={`font-medium text-[${themeColors.primary}] text-sm`}>{trendingQuestionsTitle}</h3>
                  </div>
                  <div className="p-3">
                    {trendingQuestions.map((question, index) => (
                      <button 
                        key={index} 
                        onClick={() => {
                          handleSendMessage(question);
                          setShowTrendingQuestions(false);
                        }} 
                        className={`w-full flex items-center text-left p-3 bg-gradient-to-r ${themeColors.gradient} hover:${themeColors.hover} rounded-lg my-1.5 border border-[${themeColors.light}] shadow-sm hover:shadow transition-all duration-200 text-[#333] hover:text-[${themeColors.primary}] text-sm group`}
                      >
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full bg-${theme === 'user' ? 'blue' : 'green'}-100 text-[${themeColors.primary}] text-xs mr-3 group-hover:${themeColors.groupHover} group-hover:text-white transition-colors`}>
                          {index + 1}
                        </span>
                        <span className="flex-1">{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
