import React, { useState, useRef, useEffect } from 'react';
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
  const logoRef = useRef(null);
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

  // Mouse movement effect for logo - applied regardless of isAnimated state
  useEffect(() => {
    const logo = logoRef.current;
    if (!logo) return;
    const handleMouseMove = e => {
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
    window.addEventListener('mousemove', e => {
      handleMouseMove(e);
      handleMouseStop();
    });
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#e6f0ff]/80">
      {/* Header */}
      <header className="pt-2 pb-1 px-4 sm:px-6 lg:px-8 border-b border-[#004c92]/10">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Center logo and title on mobile, align left on desktop */}
          <div className="flex items-center justify-center sm:justify-start">
            {/* Logo shown only in chat mode */}
            {isAnimated && (
              <div className="w-8 h-8 flex-shrink-0 animate-scale-in">
                <img 
                  ref={logoRef} 
                  src="/lovable-uploads/fb0ab2b3-5c02-4037-857a-19b40f122960.png" 
                  alt="Oskour Logo" 
                  className="w-full h-full object-contain transition-transform duration-200 ease-out" 
                />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-[#004c92] transition-all duration-500 cursor-pointer mx-2">
              Oskour
            </h1>
            
            {/* Refresh button - positioned next to the title when in chat mode */}
            {isAnimated && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-[#E6F0FF]/50 h-8 w-8" 
                onClick={handleNewChat} 
                title="Nouvelle conversation"
              >
                <RefreshCw className="h-4 w-4 text-[#004c92]" />
              </Button>
            )}
          </div>
          
          {/* Actions and wait time info */}
          <div className="flex items-center justify-center sm:justify-end gap-3 sm:gap-4">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/technician'} 
              className="border-[#004c92] text-[#004c92] hover:bg-[#004c92]/10"
            >
              Vue Technicien
            </Button>
            
            {/* Wait time info */}
            <div className="flex items-center">
              <div className="flex items-center gap-2 bg-[#0a5db3] rounded-full px-3 py-1 shadow-sm border border-[#1a6dc3]">
                <Clock className="h-3 w-3 text-[#ea384c]" />
                <span className="text-xs text-white font-medium">~{waitTimeInfo.minutes} min</span>
                <span className="hidden sm:inline text-xs text-white/80">{waitTimeInfo.callers} appelants</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content with chat */}
      <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden pb-10">
        <div className="flex flex-1 w-full gap-4 h-full">
          {/* Chat interface */}
          <div className="flex flex-col h-full w-full transition-all duration-500">
            <ChatInterface 
              key={`user-${chatKey}`} 
              chatbotName="Bill" 
              initialMessage="Bonjour ! Je suis Bill, votre assistant personnel. Comment puis-je vous aider aujourd'hui ?" 
              onFirstMessage={handleFirstMessage} 
              trendingQuestions={TRENDING_QUESTIONS}
              theme="user" 
            />
          </div>
        </div>
      </main>
      
      {/* Incident ticker placed at the bottom of the page */}
      <IncidentTicker theme="user" />
    </div>
  );
};

export default Index;
