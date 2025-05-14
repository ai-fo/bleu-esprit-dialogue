
import React, { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
import { clearConversation } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import { waitTimeInfo } from '@/components/IncidentStatus';
import IncidentTicker from '@/components/IncidentTicker';
import { Clock } from 'lucide-react';

// Trending questions without having to access them from ChatInterface
const TRENDING_QUESTIONS = ["Problème avec Artis", "SAS est très lent aujourd'hui", "Impossible d'accéder à mon compte"];

const Index = () => {
  const [isAnimated, setIsAnimated] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const {
    toast
  } = useToast();

  const handleFirstMessage = () => {
    setIsAnimated(true);
  };

  const handleNewChat = async () => {
    try {
      await clearConversation();
      setIsAnimated(false);
      setChatKey(prev => prev + 1);
      toast({
        title: "Conversation réinitialisée",
        description: "Une nouvelle conversation a été démarrée"
      });
    } catch (error) {
      console.error("Erreur lors de la réinitialisation de la conversation:", error);
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser la conversation",
        variant: "destructive"
      });
    }
  };

  return <div className="h-screen flex flex-col bg-[#e6f0ff]/80 animate-fade-in overflow-hidden">
      {/* Header section with title and logo */}
      <header className={`transition-all duration-500 ease-in-out ${isAnimated ? 'pt-2 pb-1 px-6' : 'pt-4 pb-2 px-6'}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4">
            {/* Logo avec animation uniquement visible en mode chat */}
            {isAnimated && (
              <div className={`transition-all duration-500 w-8 h-8 flex-shrink-0 animate-scale-in`}>
                <img 
                  src="/lovable-uploads/fb0ab2b3-5c02-4037-857a-19b40f122960.png" 
                  alt="Hotline Assistant Logo" 
                  className="w-full h-full object-contain animate-[spin_3s_ease-in-out_infinite_alternate] hover:animate-[spin_1s_ease-in-out_infinite]" 
                />
              </div>
            )}
            <div className="flex items-center">
              <h1 className={`text-xl sm:text-2xl font-bold text-[#004c92] transition-all duration-500 cursor-pointer`}>
                HotlineAssistance
              </h1>
              
              {/* Refresh button - positioned next to the title when in chat mode */}
              {isAnimated && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-[#E6F0FF]/50 h-8 w-8 ml-2" 
                  onClick={handleNewChat} 
                  title="Nouvelle conversation"
                >
                  <RefreshCw className="h-4 w-4 text-[#004c92]" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Removed incident dropdown from here */}
        </div>
      </header>
      
      {/* Main content with chat */}
      <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
        <div className="flex flex-1 w-full gap-4 h-full">
          {/* Chat interface */}
          <div className={`flex flex-col h-full w-full transition-all duration-500`}>
            <ChatInterface 
              key={chatKey} 
              chatbotName="Bill" 
              initialMessage="Bonjour ! Je suis Bill, votre assistant personnel. Comment puis-je vous aider aujourd'hui ?" 
              onFirstMessage={handleFirstMessage} 
              trendingQuestions={TRENDING_QUESTIONS} 
            />
          </div>
        </div>
      </main>
      
      {/* Incident ticker */}
      <IncidentTicker />

      {/* Footer section - hotline banner */}
      <footer className="py-2 bg-[#004c92] text-white flex items-center justify-center gap-3 shadow-md">
        <p className="font-medium">Si l'IA prends le contrôle, contactez vite la hotline au <span className="text-[#ea384c] font-bold">3400</span></p>
        <div className="flex items-center gap-2 bg-[#0a5db3] rounded-full px-3 py-0.5 shadow-sm border border-[#1a6dc3]">
          <Clock className="h-3 w-3 text-[#ea384c]" />
          <span className="text-xs text-white font-medium">~{waitTimeInfo.minutes} min d'attente</span>
        </div>
      </footer>
    </div>;
};

export default Index;
