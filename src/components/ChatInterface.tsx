import React, { useState, useRef, useEffect } from 'react';
import ChatMessage, { ChatMessageProps } from './ChatMessage';
import ChatInput from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendMessage } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import { TrendingUp } from 'lucide-react';
import IncidentStatus, { waitTimeInfo, appIncidents } from './IncidentStatus';
import { Card } from '@/components/ui/card';

interface ChatInterfaceProps {
  chatbotName?: string;
  initialMessage?: string;
  onFirstMessage?: () => void;
  trendingQuestions?: string[];
}

const QUESTIONS = ["Quel souci rencontrez-vous ?", "En quoi puis-je vous aider ?", "Qu'est-ce qui ne va pas ?", "Un soucis technique ?"];

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatbotName = "Bill",
  initialMessage = "Bonjour ! Je suis Bill, votre assistant personnel. Comment puis-je vous aider aujourd'hui ?",
  onFirstMessage,
  trendingQuestions = ["Problème avec Artis", "SAS est très lent aujourd'hui", "Impossible d'accéder à mon compte"]
}) => {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showTrendingQuestions, setShowTrendingQuestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    toast
  } = useToast();
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuestionIndex(prev => (prev + 1) % QUESTIONS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

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

      // Si c'est le premier message, ajouter la réponse humanisée
      if (response.humanized) {
        const humanizedMessage: ChatMessageProps = {
          role: 'assistant',
          content: response.humanized
        };
        setMessages(prev => [...prev, humanizedMessage]);
        // Scroll après l'ajout du message humanisé
        setTimeout(scrollToBottom, 100);
      }

      // Ajouter la réponse réelle du bot
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
        description: "Impossible de se connecter au serveur. Vérifiez que le backend Python est en cours d'exécution.",
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
    <div className="w-full flex flex-col h-[calc(100vh-8.5rem)]">
      {!isInitialState && <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 space-y-4 overflow-hidden scrollbar-hidden">
          <div className="flex flex-col">
            {messages.map((message, index) => <ChatMessage key={index} {...message} onNewChunkDisplayed={scrollToBottom} />)}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>}
      
      {isInitialState && (
        <div className="flex flex-col items-center justify-center h-full px-4 w-full flex-1">
          {/* Conteneur principal avec flexbox pour centrer verticalement */}
          <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto w-full">
            {/* Questions défilantes */}
            <div className="h-8 overflow-hidden text-center w-full mb-4">
              <p key={currentQuestionIndex} className="text-[#3380cc] text-lg font-bold animate-slide-in">
                {QUESTIONS[currentQuestionIndex]}
              </p>
            </div>
            
            {/* Barre de recherche centrée et élargie */}
            <div className="w-full px-2 py-2 relative">
              <ChatInput 
                onSendMessage={handleSendMessage} 
                disabled={loading} 
                getInputRef={setInputRef} 
                onTrendingClick={toggleTrendingQuestions} 
                showTrendingIcon={true} 
              />
              
              {/* Trending Questions Dropdown */}
              {showTrendingQuestions && (
                <div className="absolute z-10 mt-2 w-full bg-white rounded-lg shadow-lg border border-[#e6f0ff] overflow-hidden">
                  <div className="flex items-center gap-2 p-2 border-b border-[#e6f0ff]">
                    <TrendingUp className="h-4 w-4 text-[#004c92]" />
                    <h3 className="font-medium text-[#004c92] text-sm">Questions tendance aujourd'hui</h3>
                  </div>
                  <div className="p-2">
                    {trendingQuestions.map((question, index) => (
                      <button 
                        key={index} 
                        onClick={() => {
                          handleSendMessage(question);
                          setShowTrendingQuestions(false);
                        }} 
                        className="w-full flex items-center text-left p-2 bg-gradient-to-r from-white to-blue-50/80 hover:from-blue-50 hover:to-blue-100/80 rounded-lg my-1 border border-[#e6f0ff] shadow-sm hover:shadow transition-all duration-200 text-[#333] hover:text-[#004c92] text-sm group"
                      >
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-[#004c92] text-xs mr-2 group-hover:bg-[#004c92] group-hover:text-white transition-colors">
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
          
          {/* Incidents déplacés en bas vers le footer */}
          <div className="w-full max-w-md mx-auto px-4 mt-auto mb-6">
            <Card className="bg-white/80 shadow-sm overflow-hidden">
              <IncidentStatus showTitle={true} compact={true} />
            </Card>
          </div>
        </div>
      )}
      
      {!isInitialState && <div className="sticky bottom-0 p-2 bg-gradient-to-b from-transparent to-[#E6F0FF] w-full relative">
          <div className="max-w-xl mx-auto w-full">
            <ChatInput onSendMessage={handleSendMessage} disabled={loading} getInputRef={setInputRef} onTrendingClick={toggleTrendingQuestions} showTrendingIcon={true} />
          </div>
          
          {/* Trending Questions Dropdown for conversation mode */}
          {showTrendingQuestions && <div className="absolute bottom-full mb-2 w-full max-w-xl mx-auto left-0 right-0 bg-white rounded-lg shadow-lg border border-[#e6f0ff] overflow-hidden">
              <div className="flex items-center gap-2 p-2 border-b border-[#e6f0ff]">
                <TrendingUp className="h-4 w-4 text-[#004c92]" />
                <h3 className="font-medium text-[#004c92] text-sm">Questions tendance aujourd'hui</h3>
              </div>
              <div className="p-2">
                {trendingQuestions.map((question, index) => <button key={index} onClick={() => {
            handleSendMessage(question);
            setShowTrendingQuestions(false);
          }} className="w-full flex items-center text-left p-2 bg-gradient-to-r from-white to-blue-50/80 hover:from-blue-50 hover:to-blue-100/80 rounded-lg my-1 border border-[#e6f0ff] shadow-sm hover:shadow transition-all duration-200 text-[#333] hover:text-[#004c92] text-sm group">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-[#004c92] text-xs mr-2 group-hover:bg-[#004c92] group-hover:text-white transition-colors">
                      {index + 1}
                    </span>
                    <span className="flex-1">{question}</span>
                  </button>)}
              </div>
            </div>}
        </div>}
    </div>
  );
};

export default ChatInterface;
