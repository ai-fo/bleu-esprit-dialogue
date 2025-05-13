import React, { useState, useRef, useEffect } from 'react';
import ChatMessage, { RagSources } from './ChatMessage'; // Import component from ChatMessage.tsx without default import
import ChatInput from './ChatInput';
import RagSourcesComponent from './RagSources'; // Renamed to avoid conflict
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendMessage } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import { TrendingUp, Headset } from 'lucide-react';
import IncidentStatus, { waitTimeInfo, appIncidents } from './IncidentStatus';
import { Card } from '@/components/ui/card';

// Define the message interface correctly
interface ChatMessageProps {
  content: string;
  isUser?: boolean;
  isLoading?: boolean;
  onNewChunkDisplayed?: () => void;
}

interface ExtendedChatMessageProps extends ChatMessageProps {
  isUser?: boolean;
  files_used?: string[]; // Files used in RAG
}

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
  const [messages, setMessages] = useState<ExtendedChatMessageProps[]>([]);
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

  // Function to capture the input reference from ChatInput component
  const setInputRef = (ref: HTMLInputElement | null) => {
    inputRef.current = ref;
  };

  // Function to focus the input
  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Function to automatically scroll to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  // Function to handle sending messages
  const handleSendMessage = async (content: string) => {
    setShowTrendingQuestions(false);
    const userMessage: ExtendedChatMessageProps = {
      content,
      isUser: true
    };
    setMessages(prev => [...prev, userMessage]);
    if (messages.length === 0 && onFirstMessage) {
      onFirstMessage();
    }
    setLoading(true);
    try {
      // Scroll after adding user message
      setTimeout(scrollToBottom, 100);
      const response = await sendMessage(content);

      // If there's a humanized response, add it
      if (response.humanized) {
        const humanizedMessage: ExtendedChatMessageProps = {
          content: response.humanized,
          isUser: false
        };
        setMessages(prev => [...prev, humanizedMessage]);
        // Scroll after adding humanized message
        setTimeout(scrollToBottom, 100);
      }

      // Add the bot's actual response with RAG sources
      const botResponse: ExtendedChatMessageProps = {
        content: response.answer,
        isUser: false,
        files_used: response.files_used
      };
      setMessages(prev => [...prev, botResponse]);
      // Scroll after adding bot response
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
      // Refocus input after receiving response
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
  return <div className="w-full flex flex-col h-[calc(100vh-10rem)]">
      {!isInitialState && <ScrollArea ref={scrollAreaRef} className="flex-1 p-5 space-y-5 overflow-hidden scrollbar-hidden">
          <div className="flex flex-col">
            {messages.map((message, index) => (
              <div key={index} className="mb-4">
                <ChatMessage 
                  content={message.content} 
                  isUser={message.isUser}
                  isLoading={loading && index === messages.length - 1}
                  onNewChunkDisplayed={scrollToBottom}
                />
                {!message.isUser && message.files_used && (
                  <RagSourcesComponent files={message.files_used} />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>}
      
      {isInitialState && <div className="flex flex-col items-center justify-center h-full px-5 w-full flex-1">
          {/* Conteneur principal avec flexbox pour centrer verticalement */}
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto w-full">
            {/* Logo large au-dessus des questions avec animation */}
            <div className="mb-8">
              <img 
                src="/lovable-uploads/fb0ab2b3-5c02-4037-857a-19b40f122960.png" 
                alt="Hotline Assistant Logo" 
                className="w-32 h-32 object-contain animate-[spin_6s_ease-in-out_infinite_alternate] hover:animate-[spin_2s_ease-in-out_infinite]" 
              />
            </div>
            
            {/* Questions défilantes */}
            <div className="h-10 overflow-hidden text-center w-full mb-6">
              <p key={currentQuestionIndex} className="text-[#3380cc] text-xl font-bold animate-slide-in">
                {QUESTIONS[currentQuestionIndex]}
              </p>
            </div>
            
            {/* Barre de recherche centrée et élargie */}
            <div className="w-full max-w-3xl mx-auto px-2 py-3 relative">
              <ChatInput onSendMessage={handleSendMessage} disabled={loading} getInputRef={setInputRef} onTrendingClick={toggleTrendingQuestions} showTrendingIcon={true} />
              
              {/* Trending Questions Dropdown */}
              {showTrendingQuestions && <div className="absolute z-10 mt-3 w-full bg-white rounded-lg shadow-lg border border-[#e6f0ff] overflow-hidden">
                  <div className="flex items-center gap-2 p-3 border-b border-[#e6f0ff]">
                    <TrendingUp className="h-5 w-5 text-[#004c92]" />
                    <h3 className="font-medium text-[#004c92] text-sm">Questions tendance aujourd'hui</h3>
                  </div>
                  <div className="p-3">
                    {trendingQuestions.map((question, index) => <button key={index} onClick={() => {
                handleSendMessage(question);
                setShowTrendingQuestions(false);
              }} className="w-full flex items-center text-left p-3 bg-gradient-to-r from-white to-blue-50/80 hover:from-blue-50 hover:to-blue-100/80 rounded-lg my-1.5 border border-[#e6f0ff] shadow-sm hover:shadow transition-all duration-200 text-[#333] hover:text-[#004c92] text-sm group">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-[#004c92] text-xs mr-3 group-hover:bg-[#004c92] group-hover:text-white transition-colors">
                          {index + 1}
                        </span>
                        <span className="flex-1">{question}</span>
                      </button>)}
                  </div>
                </div>}
            </div>
          </div>
        </div>}
      
      {!isInitialState && <div className="sticky bottom-0 p-3 bg-gradient-to-b from-transparent to-[#E6F0FF] w-full relative">
          <div className="max-w-3xl mx-auto w-full">
            <ChatInput onSendMessage={handleSendMessage} disabled={loading} getInputRef={setInputRef} onTrendingClick={toggleTrendingQuestions} showTrendingIcon={true} />
          </div>
          
          {/* Trending Questions Dropdown for conversation mode - Now aligned with the chat input */}
          {showTrendingQuestions && <div className="absolute bottom-full mb-3 max-w-3xl mx-auto w-full left-0 right-0 bg-white rounded-lg shadow-lg border border-[#e6f0ff] overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b border-[#e6f0ff]">
                <TrendingUp className="h-5 w-5 text-[#004c92]" />
                <h3 className="font-medium text-[#004c92] text-sm">Questions tendance aujourd'hui</h3>
              </div>
              <div className="p-3">
                {trendingQuestions.map((question, index) => <button key={index} onClick={() => {
            handleSendMessage(question);
            setShowTrendingQuestions(false);
          }} className="w-full flex items-center text-left p-3 bg-gradient-to-r from-white to-blue-50/80 hover:from-blue-50 hover:to-blue-100/80 rounded-lg my-1.5 border border-[#e6f0ff] shadow-sm hover:shadow transition-all duration-200 text-[#333] hover:text-[#004c92] text-sm group">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-[#004c92] text-xs mr-3 group-hover:bg-[#004c92] group-hover:text-white transition-colors">
                      {index + 1}
                    </span>
                    <span className="flex-1">{question}</span>
                  </button>)}
              </div>
            </div>}
        </div>}
    </div>;
};
export default ChatInterface;
